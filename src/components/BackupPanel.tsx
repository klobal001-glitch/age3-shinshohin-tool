"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { btn, card, h3, muted } from "@/lib/ui";

/**
 * データの控え（バックアップ）を取る／戻す。
 *
 * 作りを変える前に、その日の中身をまるごとファイルに落としておけるようにする。
 * 何かあったときは、そのファイルから元に戻せる。
 *
 * 「戻す」は上の書き方（upsert）で、ファイルに入っている商品だけを書き換える。
 * ファイルに無い商品は触らない（消さない）。
 */

/** 控えファイルの形 */
type Backup = {
  形式: string;
  書き出した日時: string;
  商品: unknown[];
  商品情報: unknown[];
  準備タスク: unknown[];
};

const FORMAT = "age3-backup-1";

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export default function BackupPanel() {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<Backup | null>(null);
  const [confirmWord, setConfirmWord] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------------- 書き出す ---------------- */
  const exportAll = async () => {
    setBusy("書き出し中…");
    setError("");
    setNote("");
    try {
      const [p, i, t] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("product_info").select("*"),
        supabase.from("task_state").select("*"),
      ]);
      const bad = [p.error, i.error, t.error].find(Boolean);
      if (bad) throw bad;
      const data: Backup = {
        形式: FORMAT,
        書き出した日時: new Date().toISOString(),
        商品: p.data ?? [],
        商品情報: i.data ?? [],
        準備タスク: t.data ?? [],
      };
      const text = JSON.stringify(data);
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `age3-backup-${stamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(
        `書き出しました。商品 ${data.商品.length}件 / 商品情報 ${data.商品情報.length}件 / 準備タスク ${data.準備タスク.length}件（${Math.round(text.length / 1024)}KB）`
      );
    } catch (e) {
      console.error(e);
      setError("書き出せませんでした。通信を確かめて、もう一度お試しください。");
    } finally {
      setBusy("");
    }
  };

  /* ---------------- 読み込む（まだ戻さない） ---------------- */
  const pick = async (file: File | undefined | null) => {
    setError("");
    setNote("");
    setLoaded(null);
    setConfirmWord("");
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Backup;
      if (data?.形式 !== FORMAT) {
        setError("このツールで書き出した控えファイルではないようです。");
        return;
      }
      setLoaded(data);
    } catch {
      setError("ファイルを読み取れませんでした。");
    }
  };

  /* ---------------- 戻す ---------------- */
  const restore = async () => {
    if (!loaded) return;
    setBusy("戻しています…");
    setError("");
    setNote("");
    try {
      const chunk = <T,>(rows: T[], size = 50) => {
        const out: T[][] = [];
        for (let k = 0; k < rows.length; k += size) out.push(rows.slice(k, k + size));
        return out;
      };
      for (const [table, rows] of [
        ["products", loaded.商品],
        ["product_info", loaded.商品情報],
        ["task_state", loaded.準備タスク],
      ] as const) {
        for (const part of chunk(rows)) {
          if (part.length === 0) continue;
          const { error: e } = await supabase.from(table).upsert(part);
          if (e) throw e;
        }
      }
      setNote("戻しました。画面を読み込み直すと、戻した内容が出ます。");
      setLoaded(null);
      setConfirmWord("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error(e);
      setError("戻せませんでした。途中まで戻っている場合があります。もう一度お試しください。");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className={`${card} p-5`}>
      <h2 className={`mb-3 ${h3}`}>データの控え（バックアップ）</h2>
      <p className="text-sm leading-relaxed text-stone-600">
        いまの中身をまるごとファイルに落とします。作りを変える前や、大きな入れ替えの前に押しておくと、
        何かあったときにこのファイルから元に戻せます。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={btn("primary")} disabled={!!busy} onClick={exportAll}>
          ⬇ 控えを書き出す
        </button>
        {busy && <span className={muted}>{busy}</span>}
      </div>

      {note && <p className="mt-3 text-sm text-emerald-700">{note}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-medium text-stone-600">
          控えから戻す（よく確かめてから）
        </summary>
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm leading-relaxed text-stone-700">
            書き出した控えファイルを選ぶと、その中身で<strong className="font-semibold">いまのデータを上書き</strong>します。
            控えに入っていない商品はそのまま残ります（消しません）。
            <br />
            戻したあとは元に戻せません。先に「⬇ 控えを書き出す」で今の中身を取っておいてください。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="mt-3 block w-full text-sm text-stone-600"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          {loaded && (
            <div className="mt-3">
              <p className="text-sm text-stone-700">
                このファイル：商品 {loaded.商品.length}件 / 商品情報 {loaded.商品情報.length}件 /
                準備タスク {loaded.準備タスク.length}件（{new Date(loaded.書き出した日時).toLocaleString("ja-JP")} 書き出し）
              </p>
              <p className="mt-2 text-sm text-stone-700">
                戻してよければ、下の欄に <strong className="font-semibold">もどす</strong> と入れてください。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="w-32 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  placeholder="もどす"
                />
                <button
                  type="button"
                  className="rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
                  disabled={confirmWord.trim() !== "もどす" || !!busy}
                  onClick={() => void restore()}
                >
                  この控えで戻す
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
