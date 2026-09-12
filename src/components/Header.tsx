"use client";

import Age3Logo from "@/components/Age3Logo";
import Icon, { IconName } from "@/components/Icon";
import { focusRing } from "@/lib/ui";

export type TabKey = "menu" | "sheet" | "tasks" | "gallery" | "help";

/**
 * このヘッダーはスマホ専用（PCでは左のサイドバーを使う）。
 *
 * 画面の切り替えは下端に固定したタブで行う。スマホは片手で持つと親指が
 * 届くのが画面の下半分なので、いちばん押す5つを下に置いている。
 * 上の帯は「今どの商品を見ているか」を示し、押すと商品を切り替えられる。
 *
 * 2026年9月に、こげ茶の帯をやめて地と同じ明るい面にした。
 * 帯が濃いと画面の上下が黒く縁取られて、中身が窮屈に見えていたため。
 */
const TABS: { key: TabKey; icon: IconName; label: string }[] = [
  { key: "menu", icon: "home", label: "ホーム" },
  { key: "sheet", icon: "sheet", label: "シート" },
  { key: "tasks", icon: "task", label: "タスク" },
  { key: "gallery", icon: "gallery", label: "ビジュアル" },
  { key: "help", icon: "help", label: "使い方" },
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
  /* ホームと使い方は商品に紐づかないので、商品名は出さない */
  const showProduct = Boolean(productName) && activeTab !== "menu" && activeTab !== "help";

  return (
    <>
      {/* シート側に sticky の見出しがあるので、この帯は固定しない（二重に貼り付くのを避ける） */}
      <header className="border-b border-stone-200 bg-rail">
        <div className="mx-auto max-w-5xl px-4 pb-2.5 pt-3">
          <div className="flex items-center gap-2.5">
            <Age3Logo className="h-5 w-auto shrink-0 text-stone-900" />
            <span aria-hidden className="h-3.5 w-px bg-stone-300" />
            <h1 className="shrink-0 whitespace-nowrap text-sm font-semibold text-stone-700">
              商品データベース
            </h1>
          </div>
          {showProduct ? (
            <button
              type="button"
              onClick={onOpenSwitcher}
              className={`mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-xs transition active:bg-stone-50 ${focusRing}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-900">
                {productName}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
                商品を変える
                <Icon name="chevronDown" className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <p className="mt-1 truncate text-xs text-stone-500">{SUBTITLES[activeTab]}</p>
          )}
        </div>
      </header>

      {/* 下端に固定するタブ。本文が隠れないよう、main 側に下の余白を入れてある */}
      <nav
        aria-label="画面の切り替え"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-rail/95 backdrop-blur print:hidden"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5 px-1 pb-1 pt-1.5">
          {TABS.map((t) => {
            const on = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChangeTab(t.key)}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 transition ${focusRing} ${
                  on ? "text-amber-700" : "text-stone-400 active:bg-stone-100"
                }`}
              >
                <Icon name={t.icon} className="h-5 w-5" strokeWidth={on ? 2 : 1.7} />
                <span className={`text-xs leading-none ${on ? "font-semibold" : "font-medium"}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
