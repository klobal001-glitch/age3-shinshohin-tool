"use client";

import { useMemo } from "react";
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

export default function GrandMenuView() {
  const { rows, loading, saveState, update, add, remove } = useGrandMenu();
  const today = todayKey();

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
                    <Field
                      label="データの置き場所（URL）"
                      value={d.links[0] ?? ""}
                      placeholder="https://..."
                      onChange={(v) => update(row.id, { links: v ? [v] : [] })}
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

                  {d.links[0] && (
                    <a
                      href={d.links[0]}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 ${focusRing}`}
                    >
                      <Icon name="external" className="h-4 w-4" />
                      データを開く
                    </a>
                  )}

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
        ※号ごとの決めごと（配布日・入稿日）を残しておくための場所です。実際のデータ（入稿用のファイル）は Dropbox に置いたまま、ここにはそのリンクを貼ってください。
      </p>
    </div>
  );
}
