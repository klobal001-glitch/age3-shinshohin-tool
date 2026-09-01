"use client";

import { SaveState } from "@/lib/genba/types";

export type ViewId = "check" | "survey" | "report";

const VIEWS: { id: ViewId; label: string; note: string }[] = [
  { id: "check", label: "現場チェック", note: "訪問ごとに9項目" },
  { id: "survey", label: "アンケート", note: "入力と集計" },
  { id: "report", label: "改善レポート", note: "A→B→C で出力" },
];

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "idle") return null;
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-[#c0392b] px-3 py-1 text-xs font-bold text-white"
      >
        保存できていません・再試行
      </button>
    );
  }
  return (
    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
      {state === "saving" ? "保存中…" : "保存しました"}
    </span>
  );
}

export function Header({
  view,
  onChangeView,
  saveState,
  onRetry,
  period,
}: {
  view: ViewId;
  onChangeView: (v: ViewId) => void;
  saveState: SaveState;
  onRetry: () => void;
  /** 追加した訪問から作った日程。訪問がなければ空 */
  period: string;
}) {
  return (
    <header className="no-print">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1f3350,#2c4a6e)] px-5 pt-6 pb-5 text-white">
        <svg
          className="pointer-events-none absolute -top-2 -right-3 opacity-15"
          width="130"
          height="130"
          viewBox="0 0 24 24"
          fill="#fff"
          aria-hidden="true"
        >
          <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
        </svg>
        <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.26em] text-[#a9c6df]">
              Age.3　STORE FIELD CHECK
            </div>
            <h1 className="mt-1 text-2xl font-extrabold">現場チェック</h1>
            <p className="text-[13px] text-[#cdddec]">
              銀座・浅草・原宿　直営店視察{period && `　／　${period}`}
            </p>
          </div>
          <SaveBadge state={saveState} onRetry={onRetry} />
        </div>
      </div>

      <nav className="sticky top-0 z-20 border-b border-[#e3e8ee] bg-[#f6f8fa]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-2 px-4 py-3">
          {VIEWS.map((v) => {
            const on = v.id === view;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChangeView(v.id)}
                aria-current={on ? "page" : undefined}
                className={`flex-1 rounded-xl border px-2 py-2 text-center text-sm font-extrabold transition ${
                  on
                    ? "border-[#1f3350] bg-[#1f3350] text-white"
                    : "border-[#e3e8ee] bg-white text-[#5a6b7c] hover:border-[#2f8f9d] hover:text-[#1f3350]"
                }`}
              >
                {v.label}
                <span className="block text-[10.5px] font-semibold opacity-80">{v.note}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
