"use client";

import Age3Logo from "@/components/Age3Logo";
import { focusRing } from "@/lib/ui";

export type TabKey = "menu" | "sheet" | "tasks" | "gallery" | "help";

/**
 * このヘッダーはスマホ専用（PCでは左のサイドバーを使う）。
 *
 * 画面の切り替えは下端に固定したタブで行う。スマホは片手で持つと親指が
 * 届くのが画面の下半分なので、いちばん押す5つを下に置いている。
 * 上の帯は「今どの商品を見ているか」を示し、押すと商品を切り替えられる。
 */
const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: "menu", icon: "🏠", label: "メニュー" },
  { key: "sheet", icon: "📝", label: "シート" },
  { key: "tasks", icon: "✅", label: "タスク" },
  { key: "gallery", icon: "🖼", label: "ビジュアル" },
  { key: "help", icon: "❓", label: "使い方" },
];

const SUBTITLES: Record<TabKey, string> = {
  menu: "揚げサンド 直営店で共有",
  sheet: "商品情報シート：空欄を埋めていく",
  tasks: "準備タスク：発売月から締め切りを自動計算",
  gallery: "ビジュアル一覧（Instagram 1枚目）",
  help: "使い方",
};

export default function Header({
  activeTab,
  onChangeTab,
  productName,
  onOpenSwitcher,
}: {
  activeTab: TabKey;
  onChangeTab: (t: TabKey) => void;
  productName?: string;
  onOpenSwitcher?: () => void;
}) {
  /* メニューと使い方は商品に紐づかないので、商品名は出さない */
  const showProduct = Boolean(productName) && activeTab !== "menu" && activeTab !== "help";

  return (
    <>
      {/* シート側に sticky の見出しがあるので、この帯は固定しない（二重に貼り付くのを避ける） */}
      <header className="border-b border-amber-900/10 bg-[#4a2f1f] text-amber-50">
        <div className="mx-auto max-w-5xl px-4 pb-2.5 pt-3">
          <div className="flex items-center gap-3">
            <Age3Logo className="h-6 w-auto shrink-0" />
            <h1 className="shrink-0 whitespace-nowrap text-base font-bold leading-tight">
              新商品シート
            </h1>
          </div>
          {showProduct ? (
            <button
              type="button"
              onClick={onOpenSwitcher}
              className={`mt-1.5 flex w-full min-h-11 items-center gap-2 rounded-lg bg-amber-50/10 px-3 py-2 text-left transition hover:bg-amber-50/20 ${focusRing}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-amber-50">
                {productName}
              </span>
              <span aria-hidden className="shrink-0 text-xs text-amber-200/90">
                商品を変える ▾
              </span>
            </button>
          ) : (
            <p className="mt-1 truncate text-xs text-amber-200/80">{SUBTITLES[activeTab]}</p>
          )}
        </div>
      </header>

      {/* 下端に固定するタブ。本文が隠れないよう、main 側に下の余白を入れてある */}
      <nav
        aria-label="画面の切り替え"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-amber-900/20 bg-[#4a2f1f] print:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 pb-1 pt-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onChangeTab(t.key)}
              aria-current={activeTab === t.key ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 transition ${focusRing} ${
                activeTab === t.key
                  ? "bg-amber-50 text-amber-900"
                  : "text-amber-100 active:bg-amber-800/60"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {t.icon}
              </span>
              <span className="text-[11px] font-medium leading-none">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
