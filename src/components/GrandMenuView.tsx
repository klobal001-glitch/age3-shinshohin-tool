"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { useGrandMenu } from "@/hooks/useGrandMenu";
import {
  GrandMenuRow,
  IssueState,
  currentIssueId,
  daysUntil,
  issueState,
  sortIssues,
} from "@/lib/grandMenu";
import { todayKey } from "@/lib/saleStatus";
import { badge, btn, field, focusRing, h3, muted } from "@/lib/ui";

/**
 * グランドメニュー（お店で配る二つ折りの手元メニュー）の号を並べる画面。
 *
 * 2026年9月15日、松尾さんの依頼で追加した。
 * 「今どの号を配っているか」「次はいつ入稿か」がひと目で分かることだけを狙っている。
 *
 * 色の意味は他の画面と同じ。
 * 橙＝これから手を付けるもの（入稿がまだ）／緑＝進んでいる・配っている／灰＝終わった号。
 */

const STATE_LABEL: Record<IssueState, string> = {
  submit: "入稿がまだ",
  waiting: "入稿ずみ・配布前",
  current: "いま配っている号",
  past: "終わった号",
};

function StateBadge({ state, days }: { state: IssueState; days: number | null }) {
  if (state === "submit") {
    const text =
      days === null ? "入稿がまだ" : days < 0 ? `入稿日を${-days}日過ぎています` : days === 0 ? "本日入稿" : `入稿まであと${days}日`;
    return <span className={badge(days !== null && days < 0 ? "danger" : "warn", "shrink-0 tabular-nums")}>{text}</span>;
  }
  if (state === "past") return <span className={badge("neutral", "shrink-0")}>{STATE_LABEL.past}</span>;
  return <span className={badge("good", "shrink-0")}>{STATE_LABEL[state]}</span>;
}

/** 入力欄1つ分。ラベルを上に小さく置く */
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      <input
        type={type}
        className={field}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}


/** 画像かどうか。画像なら絵で出し、それ以外はリンクとして出す */
function isImage(url: string) {
  return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url.trim());
}

/**
 * チラシを大きく見る窓。
 * 左右の矢印（←→）で次の面へ、Esc か外側を押すと閉じる。
 * 紙の面を1枚ずつ確かめたいので、ビジュアル一覧と同じ見せ方にしてある。
 */
function FlyerViewer({
  list,
  index,
  onClose,
  onMove,
}: {
  list: string[];
  index: number;
  onClose: () => void;
  onMove: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove((index + 1) % list.length);
      if (e.key === "ArrowLeft") onMove((index - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    /* 開いている間は後ろの画面を動かさない */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, list.length, onClose, onMove]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="チラシを大きく見る"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={list[index]}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 ${focusRing}`}
        aria-label="閉じる"
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove((index - 1 + list.length) % list.length);
            }}
            className={`absolute left-3 flex h-12 w-12 rotate-180 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 ${focusRing}`}
            aria-label="前の面"
          >
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove((index + 1) % list.length);
            }}
            className={`absolute right-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 ${focusRing}`}
            aria-label="次の面"
          >
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>
          <span className="absolute bottom-5 rounded-full bg-white/15 px-3 py-1 text-xs tabular-nums text-white">
            {index + 1} / {list.length}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * 1号ぶんのチラシ。絵で並べる。
 * 「どの号だったか」は文字より絵のほうが早く分かるので、一覧は必ず絵で出す。
 */
function FlyerImages({
  links,
  onOpen,
  onRemove,
}: {
  links: string[];
  onOpen: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  if (links.length === 0) {
    return (
      <p className="rounded-xl bg-stone-100 px-4 py-6 text-center text-xs leading-relaxed text-stone-500">
        まだ1枚も入っていません。下の欄に画像のURLを貼って Enter を押すと、ここに絵で並びます。
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {links.map((url, i) => (
        <div key={`${url}-${i}`} className="group relative">
          <button
            type="button"
            onClick={() => onOpen(i)}
            className={`block w-full overflow-hidden rounded-lg bg-stone-100 ${focusRing}`}
            title="大きく見る"
          >
            {isImage(url) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
            ) : (
              <span className="flex aspect-[3/4] w-full items-center justify-center p-2 text-center text-xs text-stone-500">
                リンク
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/55 text-white transition hover:bg-red-600"
            aria-label="この1枚を外す"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function GrandMenuView() {
  const { rows, loading, saveState, update, add, remove } = useGrandMenu();
  const today = todayKey();
  /* 大きく見ている画像。{どの号の何枚目} */
  const [viewer, setViewer] = useState<{ id: string; index: number } | null>(null);

  const sorted = useMemo(() => sortIssues(rows), [rows]);
  const currentId = useMemo(() => currentIssueId(rows, today), [rows, today]);

  /* 入稿がまだの号のうち、入稿日がいちばん近いもの。上に大きく出す */
  const next = useMemo(() => {
    const yet = rows.filter((r) => r.data.submitDate && r.data.submitDate > today);
    yet.sort((a, b) => a.data.submitDate.localeCompare(b.data.submitDate));
    return yet[0] ?? null;
  }, [rows, today]);

  const saveLabel =
    saveState === "saving" ? "保存中…" : saveState === "saved" ? "保存しました" : saveState === "error" ? "保存できませんでした" : "";

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="pt-1 sm:pt-4">
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900 sm:text-4xl">
          グランドメニュー
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone-500 sm:text-base">
          お店で配る二つ折りの手元メニューを、号ごとに残しておく場所です。配布をはじめる日と、印刷所へ入稿する日を入れておくと、次の入稿がいつかがひと目で分かります。
        </p>
      </div>

      {/* 次の入稿。いちばん近い1件だけを大きく出す（ホームの「次にやること」と同じ考え方） */}
      {next && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-6 shadow-md sm:rounded-3xl sm:p-8">
          <div className="flex items-center gap-2.5">
            <Icon name="calendar" className="h-4 w-4 text-white/80" />
            <span className="text-sm font-semibold text-white/90">次の入稿</span>
            <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-white ring-1 ring-inset ring-white/30">
              あと{daysUntil(next.data.submitDate, today)}日
            </span>
          </div>
          <div className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {next.data.vol || "号数が未入力"}
            {next.data.title && <span className="ml-3 text-base font-medium text-white/80">{next.data.title}</span>}
          </div>
          <div className="mt-2 text-[15px] leading-relaxed text-white/90">
            入稿 {next.data.submitDate}
            <span className="mx-2 text-white/50">/</span>
            配布開始 {next.data.distributeDate || "未定"}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1">
        <button className={`${btn("primary")} rounded-full px-6`} onClick={() => void add()}>
          <Icon name="plus" className="h-4 w-4" />
          号を追加
        </button>
        <span className="text-sm tabular-nums text-stone-400">{rows.length}号</span>
        {saveLabel && (
          <span className={`ml-auto text-xs ${saveState === "error" ? "text-red-600" : "text-stone-400"}`}>
            {saveLabel}
          </span>
        )}
      </div>

      {loading ? (
        <p className="rounded-2xl bg-white p-10 text-center text-sm text-stone-400 shadow-sm">読み込み中…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-sm leading-relaxed text-stone-500 shadow-sm">
          まだ1号も入っていません。
          <br />
          「号を追加」を押して、号数と配布開始日を入れてください。
        </p>
      ) : (
        <div className="space-y-5">
          {sorted.map((row: GrandMenuRow) => {
            const d = row.data;
            const state = issueState(d, today, row.id === currentId);
            const days = daysUntil(d.submitDate, today);
            return (
              <section
                key={row.id}
                className={`overflow-hidden rounded-2xl bg-white shadow-sm sm:rounded-3xl ${
                  state === "current" ? "ring-1 ring-emerald-300" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone-100 px-5 py-4 sm:px-6">
                  <h3 className={h3}>{d.vol || "号数が未入力"}</h3>
                  <span className="min-w-0 truncate text-sm text-stone-500">{d.title}</span>
                  <StateBadge state={state} days={days} />
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="号数" value={d.vol} placeholder="vol.14" onChange={(v) => update(row.id, { vol: v })} />
                    <Field
                      label="見出し"
                      value={d.title}
                      placeholder="2026年2月 グランドメニュー"
                      onChange={(v) => update(row.id, { title: v })}
                    />
                    <Field
                      label="入稿日（印刷所へ渡す日）"
                      type="date"
                      value={d.submitDate}
                      onChange={(v) => update(row.id, { submitDate: v })}
                    />
                    <Field
                      label="配布開始日"
                      type="date"
                      value={d.distributeDate}
                      onChange={(v) => update(row.id, { distributeDate: v })}
                    />
                    <Field
                      label="配る店"
                      value={d.scope}
                      placeholder="全店共通"
                      onChange={(v) => update(row.id, { scope: v })}
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-stone-500">
                      チラシの画像（押すと大きく見られます）
                    </span>
                    <FlyerImages
                      links={d.links}
                      onOpen={(i) => setViewer({ id: row.id, index: i })}
                      onRemove={(i) =>
                        update(row.id, { links: d.links.filter((_, k) => k !== i) })
                      }
                    />
                    <input
                      className={field}
                      placeholder="画像やデータのURLを貼って Enter"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const el = e.currentTarget;
                        const v = el.value.trim();
                        if (!v) return;
                        update(row.id, { links: [...d.links, v] });
                        el.value = "";
                      }}
                    />
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-stone-500">変更点・覚え書き</span>
                    <textarea
                      className={`${field} min-h-24 py-2`}
                      value={d.note}
                      placeholder="前の号から変えたところ、表紙の商品など"
                      onChange={(e) => update(row.id, { note: e.target.value })}
                    />
                  </label>

                  <div className="flex justify-end pt-1">
                    <button
                      className={btn("danger")}
                      onClick={() => {
                        if (!confirm(`${d.vol || "この号"}を消します。よろしいですか？`)) return;
                        void remove(row.id);
                      }}
                    >
                      この号を消す
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className={`px-1 pb-2 ${muted}`}>
        ※号ごとの決めごと（配布日・入稿日）と、配った紙の絵を残しておくための場所です。入稿用の重いデータは Dropbox に置いたまま、ここにはそのリンクを貼ってください。
      </p>

      {viewer &&
        (() => {
          const hit = rows.find((r) => r.id === viewer.id);
          if (!hit || hit.data.links.length === 0) return null;
          return (
            <FlyerViewer
              list={hit.data.links}
              index={Math.min(viewer.index, hit.data.links.length - 1)}
              onClose={() => setViewer(null)}
              onMove={(i) => setViewer({ id: viewer.id, index: i })}
            />
          );
        })()}
    </div>
  );
}
