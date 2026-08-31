"use client";

import Age3Logo from "@/components/Age3Logo";

export type TabKey = "menu" | "sheet" | "tasks" | "gallery" | "help";

/**
 * このヘッダーはスマホ専用（PCでは左のサイドバーを使う）。
 * 横幅が狭いので、絵文字を上・短いラベルを下に置いて5つを1画面に収める。
 */
const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "menu", icon: "🏠", label: "メニュー" },
  { key: "sheet", icon: "📝", label: "シート" },
  { key: "tasks", icon: "✅", label: "タスク" },
  { key: "gallery", icon: "🖼", label: "ビジュアル" },
  { key: "help", icon: "❓", label: "使い方" },
];

const SUBTITLES: Record<TabKey, string> = {
  menu: "1商品ぶんの「情報シート」と「準備タスク」をまとめて管理 / 揚げサンド直営共有",
  sheet: "商品情報シート：1商品ぶんの情報を空欄から入力",
  tasks: "準備タスク：発売月から締め切りを自動計算",
  gallery: "ビジュアル一覧（Instagram 1枚目）",
  help: "使い方",
};

export default function Header({
  activeTab,
  onChangeTab,
  productName,
}: {
  activeTab: TabKey;
  onChangeTab: (t: TabKey) => void;
  productName?: string;
}) {
  return (
    <header className="border-b border-amber-900/10 bg-[#4a2f1f] text-amber-50">
      <div className="mx-auto max-w-5xl px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Age3Logo className="h-6 w-auto shrink-0" />
          <h1 className="shrink-0 whitespace-nowrap text-lg font-bold leading-tight">
            新商品ツール
          </h1>
          {productName && (
            <div className="min-w-0 flex-1 truncate text-right text-sm text-amber-100">
              商品：<span className="font-semibold">{productName}</span>
            </div>
          )}
        </div>
        <p className="mt-1.5 truncate text-xs text-amber-200/80">
          {SUBTITLES[activeTab]}
        </p>
      </div>
      <nav className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-3 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab(t.key)}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition ${
              activeTab === t.key
                ? "bg-amber-50 text-amber-900"
                : "text-amber-100 hover:bg-amber-800/60"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              {t.icon}
            </span>
            <span className="text-[11px] font-medium leading-none">{t.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
