"use client";

import Age3Logo from "@/components/Age3Logo";

export type TabKey = "menu" | "sheet" | "tasks" | "gallery" | "help";

const TABS: { key: TabKey; label: string }[] = [
  { key: "menu", label: "🏠 メニュー" },
  { key: "sheet", label: "📝 商品情報シート" },
  { key: "tasks", label: "✅ 準備タスク" },
  { key: "gallery", label: "🖼 ビジュアル一覧" },
  { key: "help", label: "❓ 使い方" },
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
        <div className="flex items-center gap-3">
          <Age3Logo className="h-6 w-auto shrink-0" />
          <h1 className="shrink-0 whitespace-nowrap text-lg font-bold leading-tight">
            新商品ツール
          </h1>
          {productName && (
            <div className="ml-auto min-w-0 truncate text-sm text-amber-100">
              商品：<span className="font-semibold">{productName}</span>
            </div>
          )}
        </div>
        <p className="mt-1.5 truncate text-xs text-amber-200/80">
          {SUBTITLES[activeTab]}
        </p>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === t.key
                ? "bg-amber-50 text-amber-900"
                : "text-amber-100 hover:bg-amber-800/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
