"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { TabKey } from "./Header";

const FILTERS: { value: Genre | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "regular_sweet", label: GENRE_LABELS.regular_sweet },
  { value: "regular_savory", label: GENRE_LABELS.regular_savory },
  { value: "sweets_sand", label: GENRE_LABELS.sweets_sand },
  { value: "fruit_sand", label: GENRE_LABELS.fruit_sand },
  { value: "single", label: GENRE_LABELS.single },
  { value: "shop_limited", label: GENRE_LABELS.shop_limited },
  { value: "season", label: GENRE_LABELS.season },
];

const GENRE_BADGE_COLOR: Record<NonNullable<Genre>, string> = {
  regular_sweet: "bg-pink-100 text-pink-700",
  regular_savory: "bg-orange-100 text-orange-700",
  sweets_sand: "bg-purple-100 text-purple-700",
  fruit_sand: "bg-lime-100 text-lime-700",
  single: "bg-sky-100 text-sky-700",
  shop_limited: "bg-blue-100 text-blue-700",
  season: "bg-amber-100 text-amber-700",
};

export default function VisualGalleryView({
  app,
  onNavigate,
}: {
  app: ReturnType<typeof useAppData>;
  onNavigate: (t: TabKey) => void;
}) {
  const { products, getInfo, setSelectedId } = app;
  const [filter, setFilter] = useState<Genre | "all">("all");
  const [sortMode, setSortMode] = useState<"date" | "name">("date");

  const rows = useMemo(() => {
    let list = products.map((p) => ({ product: p, info: getInfo(p.id) }));
    if (filter !== "all") list = list.filter((r) => r.product.genre === filter);
    if (sortMode === "date") {
      list.sort((a, b) => (a.info.releaseDate || "9999").localeCompare(b.info.releaseDate || "9999"));
    } else {
      list.sort((a, b) => a.product.name.localeCompare(b.product.name, "ja"));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filter, sortMode]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-white p-4">
        <p className="mb-3 text-sm text-stone-500">
          サムネイルをクリックすると、その商品の情報シートが開きます。画像は準備でき次第、順次追加します。
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">並べ替え：</span>
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              sortMode === "date" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
            }`}
            onClick={() => setSortMode("date")}
          >
            発売順（古い→新しい）
          </button>
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              sortMode === "name" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
            }`}
            onClick={() => setSortMode("name")}
          >
            名前順
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">表示：</span>
          {FILTERS.map((f) => (
            <button
              key={f.label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f.value ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
              }`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-stone-400">{rows.length}件</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {rows.map(({ product, info }) => (
          <button
            key={product.id}
            className="rounded-xl border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:shadow-md"
            onClick={() => {
              setSelectedId(product.id);
              onNavigate("sheet");
            }}
          >
            <div className="mb-2 flex aspect-square items-center justify-center rounded-lg bg-stone-100 text-3xl text-stone-300">
              🖼
            </div>
            {product.genre && (
              <span className={`mb-1 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${GENRE_BADGE_COLOR[product.genre]}`}>
                {GENRE_LABELS[product.genre]}
              </span>
            )}
            <div className="text-sm font-medium text-stone-800">{product.name}</div>
            <div className="text-xs text-stone-400">
              {info.releaseDate ? info.releaseDate.replaceAll("-", "/") : "発売日未設定"}
            </div>
            {info.releaseDate && info.releaseDate > today && (
              <span className="mt-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">
                発売予定
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
