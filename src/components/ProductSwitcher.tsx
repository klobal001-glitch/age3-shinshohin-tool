"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useLocalStorageState } from "@/lib/storage";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { infoFillRate } from "@/lib/stats";
import { SALE_STATUS_LABEL, isInactive, saleStatus, todayKey } from "@/lib/saleStatus";
import Icon from "@/components/Icon";
import { badge, eyebrow, field, focusRing, rowSelect } from "@/lib/ui";

/** 商品リストの並び順。今いちばん動いているものから上に出す */
export const GENRE_ORDER: Genre[] = [
  "season",
  "shop_limited",
  "regular_sweet",
  "regular_savory",
  "sweets_sand",
  "fruit_sand",
  "single",
  null,
];

export function genreLabel(g: Genre) {
  return g ? GENRE_LABELS[g] : "未分類";
}

/** 索引に出す短い見出し。縦に並べるので2〜4文字に切り詰める */
const GENRE_SHORT: Record<string, string> = {
  season: "季節",
  shop_limited: "店舗",
  regular_sweet: "甘い",
  regular_savory: "惣菜",
  sweets_sand: "ｽｲｰﾂ",
  fruit_sand: "果物",
  single: "単品",
  none: "他",
};

/** 最近開いた商品。端末ごとの覚えごとなので localStorage に置く */
export function useRecentProducts() {
  const [recent, setRecent] = useLocalStorageState<string[]>("recent_products", []);
  const push = (id: string) =>
    setRecent((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 6));
  return { recent, push };
}

function fillDotColor(pct: number) {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-stone-300";
}

/**
 * 商品を探して選ぶための画面。
 *
 * 88件をプルダウンから探すのが一番の手間だったので、
 * 「検索」「最近開いた商品」「ジャンルの索引」の3つで当てられるようにする。
 * スマホでは全画面、PCでは中央の窓として出す（操作は同じ）。
 */
export default function ProductSwitcher({
  app,
  onClose,
}: {
  app: ReturnType<typeof useAppData>;
  onClose: () => void;
}) {
  const { products, selectedId, setSelectedId, getInfo } = app;
  const [query, setQuery] = useState("");
  const { recent, push } = useRecentProducts();
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const today = todayKey();

  /* 開いた直後に検索欄へ入れるようにする。Esc でも閉じられる。
     （開くたびにこの部品ごと作り直されるので、前回の絞り込みは残らない） */
  useEffect(() => {
    const t = window.setTimeout(() => searchRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matched = useMemo(
    () => (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products),
    [products, q]
  );

  const sections = useMemo(() => {
    const map = new Map<Genre, typeof products>();
    for (const g of GENRE_ORDER) map.set(g, []);
    for (const p of matched) {
      const key = GENRE_ORDER.includes(p.genre) ? p.genre : null;
      map.get(key)!.push(p);
    }
    return GENRE_ORDER.map((g) => ({ genre: g, items: map.get(g) ?? [] })).filter(
      (s) => s.items.length > 0
    );
  }, [matched]);

  const recentProducts = useMemo(
    () =>
      recent
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is (typeof products)[number] => Boolean(p))
        .filter((p) => p.id !== selectedId)
        .slice(0, 5),
    [recent, products, selectedId]
  );

  const choose = (id: string) => {
    setSelectedId(id);
    push(id);
    onClose();
  };

  const jumpTo = (key: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-genre="${key}"]`);
    if (el && listRef.current) {
      listRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  };

  const Row = ({ p }: { p: (typeof products)[number] }) => {
    const info = getInfo(p.id);
    const pct = infoFillRate(info, p.genre);
    const status = saleStatus(info, today);
    const off = isInactive(status);
    const current = p.id === selectedId;
    return (
      <button
        type="button"
        onClick={() => choose(p.id)}
        className={rowSelect(current, `min-h-12 ${off && !current ? "text-stone-400" : ""}`)}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${off ? "bg-stone-300" : fillDotColor(pct)}`}
        />
        <span className="min-w-0 flex-1 truncate">{p.name}</span>
        {off ? (
          <span className={badge("neutral", "shrink-0")}>{SALE_STATUS_LABEL[status]}</span>
        ) : (
          <span className="shrink-0 text-xs tabular-nums text-stone-400">{pct}%</span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/30 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white sm:h-[min(36rem,85vh)] sm:max-w-lg sm:flex-none sm:rounded-2xl sm:shadow-lg">
        <div className="flex items-center gap-2 border-b border-stone-200 bg-rail px-3 py-3 sm:rounded-t-2xl">
          <div className="relative min-w-0 flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            />
            <input
              ref={searchRef}
              className={`${field} pl-9`}
              placeholder="商品名で検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 ${focusRing}`}
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pr-10">
            {recentProducts.length > 0 && !q && (
              <div className="mb-4">
                <div className={`mb-1 px-2.5 ${eyebrow}`}>最近開いた商品</div>
                {recentProducts.map((p) => (
                  <Row key={`recent-${p.id}`} p={p} />
                ))}
              </div>
            )}

            {sections.length === 0 && (
              <p className="px-1 py-8 text-center text-sm text-stone-400">
                「{query}」に当てはまる商品がありません。
              </p>
            )}

            {sections.map(({ genre, items }) => (
              <div key={genre ?? "none"} data-genre={genre ?? "none"} className="mb-4">
                <div className={`mb-1 px-2.5 ${eyebrow}`}>
                  {genreLabel(genre)}
                  <span className="ml-1.5 font-normal tabular-nums">{items.length}</span>
                </div>
                {items.map((p) => (
                  <Row key={p.id} p={p} />
                ))}
              </div>
            ))}
          </div>

          {/* 右端の索引。押すとそのジャンルの先頭まで飛ぶ */}
          {sections.length > 1 && (
            <nav
              aria-label="ジャンルで飛ぶ"
              className="absolute right-1 top-3 flex w-8 flex-col items-center gap-0.5 rounded-full border border-stone-200 bg-white/90 py-2 shadow-sm backdrop-blur"
            >
              {sections.map(({ genre }) => (
                <button
                  key={genre ?? "none"}
                  type="button"
                  onClick={() => jumpTo(genre ?? "none")}
                  className={`w-full rounded-full px-0.5 py-1 text-xs leading-tight text-stone-500 transition hover:bg-stone-100 hover:text-amber-700 ${focusRing}`}
                >
                  {GENRE_SHORT[genre ?? "none"]}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
