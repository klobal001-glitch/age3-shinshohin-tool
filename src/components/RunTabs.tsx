"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { ProductInfo, ProductRun } from "@/lib/types";
import { createDefaultProductInfo } from "@/lib/productInfo";
import { focusRing } from "@/lib/ui";

/**
 * 「販売の回」の切り替え。
 *
 * 同じ商品でも、年やバージョン（ハロウィン仕様など）で出し直すことがある。
 * 1回ごとに変わるのは 発売月・販売終了月・ビジュアル・準備タスク の4つだけで、
 * 品名・材料・価格・レシピ・紹介文は商品で1つ（ものは同じなので）。
 *
 * シートでもタスクでも同じ場所（上の帯）に出す。どの回を見ているかが常に分かるように。
 *
 * 確認は画面の中で行う。confirm / prompt / alert は環境によって表示されず、
 * ボタンを押しても何も起きないように見えてしまうため使わない（2026年9月16日）。
 */
export function runView(app: ReturnType<typeof useAppData>, info: ProductInfo | null) {
  const id = app.selectedProduct?.id ?? "";
  const viewing = app.runTab && app.runTab.productId === id ? app.runTab.label : null;
  const past: ProductRun | null =
    (viewing && info?.runs.find((r) => r.label === viewing)) || null;
  return {
    /** 今の回の名前。空なら回で分けていない */
    currentLabel: info?.runLabel ?? "",
    /** 過去の回を見ているなら、その中身 */
    past,
    /** 過去の回を見ているか */
    viewingPast: !!past,
    /** いま見ている回の名前 */
    viewingLabel: past ? past.label : info?.runLabel ?? "",
  };
}

type Action = "rename" | "add" | "makeCurrent" | "delete" | null;

const smallBtn =
  "rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700";
const okBtn =
  "rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700";
const dangerBtn =
  "rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700";
const cancelBtn =
  "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 transition hover:bg-stone-50";

export default function RunTabs({
  app,
  info,
}: {
  app: ReturnType<typeof useAppData>;
  info: ProductInfo;
  /** 旧：親から渡していた処理。いまは RunTabs の中で完結している */
  onAddRun?: () => void;
  /** 旧：親から渡していた処理。いまは RunTabs の中で完結している */
  onRenameRun?: (label: string) => void;
}) {
  const id = app.selectedProduct?.id ?? "";
  const { currentLabel, viewingLabel } = runView(app, info);
  const hasRuns = !!currentLabel || info.runs.length > 0;
  const viewingCurrent = viewingLabel === currentLabel;

  const [action, setAction] = useState<Action>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const close = () => {
    setAction(null);
    setText("");
    setError("");
  };

  const open = (next: Exclude<Action, null>) => {
    setAction(next);
    setText(next === "rename" ? viewingLabel : "");
    setError("");
  };

  const nameTaken = (name: string, except: string) =>
    (name === info.runLabel && except !== info.runLabel) ||
    info.runs.some((r) => r.label === name && r.label !== except);

  /** いまの回の中身を、控えの形にして取り出す */
  const parkCurrent = (): ProductRun => ({
    label: currentLabel,
    releaseDate: info.releaseDate,
    endDate: info.endDate,
    ongoing: info.ongoing,
    visuals: info.visualDownloads,
    taskState: app.getTaskState(id),
  });

  /** 回の名前を変える */
  const doRename = () => {
    const next = text.trim();
    if (!next) return setError("名前を入れてください。");
    if (next === viewingLabel) return close();
    if (nameTaken(next, viewingLabel)) return setError(`「${next}」はすでにあります。`);
    if (viewingCurrent) {
      app.updateInfo(id, { runLabel: next });
    } else {
      app.updateInfo(id, {
        runs: info.runs.map((r) => (r.label === viewingLabel ? { ...r, label: next } : r)),
      });
      app.setRunTab({ productId: id, label: next });
    }
    close();
  };

  /** 新しい回を始める。いまの内容は控えに残り、新しい回は空から始まる */
  const doAdd = () => {
    const next = text.trim();
    if (!next) return setError("名前を入れてください（例: 2027 9月）。");
    if (nameTaken(next, "")) return setError(`「${next}」はすでにあります。`);
    if (!currentLabel) return setError("いまの回に名前がありません。先に「✎ 名前」で名前を付けてください。");
    app.updateInfo(id, {
      runLabel: next,
      runs: [parkCurrent(), ...info.runs],
      releaseDate: "",
      endDate: "",
      ongoing: false,
      visualDownloads: createDefaultProductInfo().visualDownloads,
    });
    app.setProductTasks(id, {});
    app.setRunTab(null);
    close();
  };

  /** 控えの回と、今準備中の回を入れ替える。中身はどちらも消えない */
  const doMakeCurrent = (label: string) => {
    const idx = info.runs.findIndex((r) => r.label === label);
    const pick = info.runs[idx];
    if (!pick) return setError("その回が見つかりません。");
    if (!currentLabel) return setError("いまの回に名前がありません。先に「✎ 名前」で名前を付けてください。");
    const nextRuns = info.runs.slice();
    nextRuns.splice(idx, 1, parkCurrent());
    app.updateInfo(id, {
      runLabel: pick.label,
      runs: nextRuns,
      releaseDate: pick.releaseDate,
      endDate: pick.endDate,
      ongoing: pick.ongoing,
      visualDownloads: pick.visuals,
    });
    app.setProductTasks(id, pick.taskState);
    app.setRunTab(null);
    close();
  };

  /** 控えの回を消す */
  const doDeletePast = () => {
    app.updateInfo(id, { runs: info.runs.filter((r) => r.label !== viewingLabel) });
    app.setRunTab(null);
    close();
  };

  /** 今準備中の回を消して、選んだ控えの回を今準備中にする */
  const doDeleteCurrent = (label: string) => {
    const idx = info.runs.findIndex((r) => r.label === label);
    const pick = info.runs[idx];
    if (!pick) return setError("その回が見つかりません。");
    app.updateInfo(id, {
      runLabel: pick.label,
      runs: info.runs.filter((_, i) => i !== idx),
      releaseDate: pick.releaseDate,
      endDate: pick.endDate,
      ongoing: pick.ongoing,
      visualDownloads: pick.visuals,
    });
    app.setProductTasks(id, pick.taskState);
    app.setRunTab(null);
    close();
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 print:hidden">
      {hasRuns && (
        <>
          <button
            type="button"
            onClick={() => {
              close();
              app.setRunTab(null);
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
              viewingCurrent
                ? "border-amber-600 bg-amber-600 font-medium text-white"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {currentLabel || "今の回"}
            <span className={`ml-1.5 ${viewingCurrent ? "text-amber-100" : "text-stone-400"}`}>
              今準備中
            </span>
          </button>
          {info.runs.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                close();
                app.setRunTab({ productId: id, label: r.label });
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
                viewingLabel === r.label
                  ? "border-stone-600 bg-stone-600 font-medium text-white"
                  : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </>
      )}

      {hasRuns && !viewingCurrent && (
        <button
          type="button"
          onClick={() => open("makeCurrent")}
          className={`${smallBtn} ${focusRing}`}
        >
          ↺ 今準備中にする
        </button>
      )}
      {hasRuns && (
        <button type="button" onClick={() => open("rename")} className={`${smallBtn} ${focusRing}`}>
          ✎ 名前
        </button>
      )}
      {hasRuns && (
        <button
          type="button"
          onClick={() => open("delete")}
          className={`rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-500 transition hover:border-red-500 hover:text-red-700 ${focusRing}`}
        >
          🗑 この回を消す
        </button>
      )}
      <button
        type="button"
        onClick={() => open("add")}
        className={`rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700 ${focusRing}`}
      >
        ＋ 回を追加
      </button>

      {action && (
        <div className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50 p-3">
          {action === "rename" && (
            <>
              <p className="text-xs text-stone-700">
                「{viewingLabel || "今の回"}」の新しい名前を入れてください。
              </p>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doRename()}
                className="mt-2 w-full max-w-xs rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={doRename} className={`${okBtn} ${focusRing}`}>
                  名前を変える
                </button>
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  やめる
                </button>
              </div>
            </>
          )}

          {action === "add" && (
            <>
              <p className="text-xs text-stone-700">
                新しく始める回の名前を入れてください（例: 2027 9月）。
                <br />
                いまの 発売月・販売終了月・ビジュアル・チェック は「{currentLabel || "今の回"}」として
                控えに残り、新しい回は空から始まります。品名・材料・価格・レシピ・紹介文はそのままです。
              </p>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doAdd()}
                className="mt-2 w-full max-w-xs rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={doAdd} className={`${okBtn} ${focusRing}`}>
                  この名前で始める
                </button>
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  やめる
                </button>
              </div>
            </>
          )}

          {action === "makeCurrent" && (
            <>
              <p className="text-xs text-stone-700">
                「{viewingLabel}」を今準備中にします。いまの「{currentLabel}」は控えに移ります。
                <strong>中身はどちらも消えません。</strong>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => doMakeCurrent(viewingLabel)}
                  className={`${okBtn} ${focusRing}`}
                >
                  入れ替える
                </button>
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  やめる
                </button>
              </div>
            </>
          )}

          {action === "delete" && !viewingCurrent && (
            <>
              <p className="text-xs text-stone-700">
                「{viewingLabel}」を消します。この回の 発売月・販売終了月・ビジュアル・チェック の控えが
                なくなります。品名・材料・価格・レシピ・紹介文は消えません。
                <strong>元に戻せません。</strong>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={doDeletePast} className={`${dangerBtn} ${focusRing}`}>
                  消す
                </button>
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  やめる
                </button>
              </div>
            </>
          )}

          {action === "delete" && viewingCurrent && info.runs.length === 0 && (
            <>
              <p className="text-xs text-stone-700">
                回が1つしかないので消せません。回で分けるのをやめるときは「✎ 名前」で名前を空にしてください。
              </p>
              <div className="mt-2">
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  閉じる
                </button>
              </div>
            </>
          )}

          {action === "delete" && viewingCurrent && info.runs.length > 0 && (
            <>
              <p className="text-xs text-stone-700">
                今準備中の「{viewingLabel}」を消します。いま入っている 発売月・販売終了月・ビジュアル・
                チェック も一緒に消えます。<strong>元に戻せません。</strong>
                <br />
                代わりに今準備中にする回を選んでください。
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {info.runs.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => doDeleteCurrent(r.label)}
                    className={`${dangerBtn} ${focusRing}`}
                  >
                    消して「{r.label}」にする
                  </button>
                ))}
                <button type="button" onClick={close} className={`${cancelBtn} ${focusRing}`}>
                  やめる
                </button>
              </div>
            </>
          )}

          {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** 今準備中でない回を見ているときの注意書き。シートでもタスクでも同じ文にする */
export function PastRunNotice({ label, current }: { label: string; current: string }) {
  return (
    <p className="rounded-lg border border-stone-300 bg-stone-200/60 px-3 py-2 text-xs text-stone-700">
      <span className="font-medium">{label}</span>{" "}
      は、いま準備中の回ではありません。見るだけで、直せません。
      直すときは「↺ 今準備中にする」を押してください。
      締め切りの数・進捗・入力率は「{current || "今の回"}」を見ています。
    </p>
  );
}
