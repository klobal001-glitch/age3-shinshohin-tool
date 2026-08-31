"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { TabKey } from "./Header";
import { isImageUrl, toThumbnailUrl } from "@/lib/imageUrl";

const GENRE_OPTIONS: { value: Genre | "all"; label: string }[] = [
  { value: "all", label: "すべてのジャンル" },
  { value: "regular_sweet", label: GENRE_LABELS.regular_sweet },
  { value: "regular_savory", label: GENRE_LABELS.regular_savory },
  { value: "sweets_sand", label: GENRE_LABELS.sweets_sand },
  { value: "fruit_sand", label: GENRE_LABELS.fruit_sand },
  { value: "single", label: GENRE_LABELS.single },
  { value: "shop_limited", label: GENRE_LABELS.shop_limited },
  { value: "season", label: GENRE_LABELS.season },
];

type ImageFilter = "all" | "has" | "none";
type SortMode = "date" | "name" | "least";

/**
 * カードの画像。Dropbox/Google Drive の共有リンクは表示用URLに読み替える。
 * 読み込めなかったときは「画像未登録」と同じ枠に戻し、壊れた画像を出さない。
 */
function CardThumb({ url, alt }: { url?: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const src = url?.trim();

  if (!src || broken || !isImageUrl(src)) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center border-b border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
        画像未登録
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={toThumbnailUrl(src)}
      alt={alt}
      className="aspect-[4/3] w-full bg-stone-100 object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** 選択中のボタンかどうかで見た目を切り替える共通スタイル */
function chipCls(active: boolean) {
  return `rounded-lg border px-3 py-1.5 text-sm transition ${
    active
      ? "border-stone-700 bg-stone-700 font-medium text-white"
      : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
  }`;
}

export default function VisualGalleryView({
  app,
  onNavigate,
}: {
  app: ReturnType<typeof useAppData>;
  onNavigate: (t: TabKey) => void;
}) {
  const { products, getInfo, setSelectedId } = app;
  const [genre, setGenre] = useState<Genre | "all">("all");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("date");

  const rows = useMemo(() => {
    let list = products.map((p) => {
      const info = getInfo(p.id);
      const done = info.visualDownloads.filter((v) => v.links.some((l) => l.trim())).length;
      const thumb = info.visualDownloads
        .find((v) => v.key === "ig_feed")
        ?.links.find((l) => l.trim());
      return { product: p, info, done, total: info.visualDownloads.length, thumb };
    });
    if (genre !== "all") list = list.filter((r) => r.product.genre === genre);
    if (imageFilter === "has") list = list.filter((r) => r.done > 0);
    if (imageFilter === "none") list = list.filter((r) => r.done === 0);

    if (sortMode === "date") {
      list.sort((a, b) =>
        (a.info.releaseDate || "9999").localeCompare(b.info.releaseDate || "9999")
      );
    } else if (sortMode === "name") {
      list.sort((a, b) => a.product.name.localeCompare(b.product.name, "ja"));
    } else {
      list.sort((a, b) => a.done - b.done || a.product.name.localeCompare(b.product.name, "ja"));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, genre, imageFilter, sortMode]);

  const totalDone = rows.filter((r) => r.done > 0).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-stone-100 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-800">ビジュアル一覧</h2>
          <span className="text-sm tabular-nums text-stone-500">
            {rows.length}件中 {totalDone}件に画像あり
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-sm text-stone-500">並べ替え</span>
            <button className={chipCls(sortMode === "date")} onClick={() => setSortMode("date")}>
              発売日が古い順
            </button>
            <button className={chipCls(sortMode === "name")} onClick={() => setSortMode("name")}>
              名前順
            </button>
            <button className={chipCls(sortMode === "least")} onClick={() => setSortMode("least")}>
              画像が少ない順
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-sm text-stone-500">絞り込み</span>
            <button className={chipCls(imageFilter === "all")} onClick={() => setImageFilter("all")}>
              すべて
            </button>
            <button className={chipCls(imageFilter === "none")} onClick={() => setImageFilter("none")}>
              画像なしだけ
            </button>
            <button className={chipCls(imageFilter === "has")} onClick={() => setImageFilter("has")}>
              画像ありだけ
            </button>
            <select
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
              value={genre === "all" ? "" : genre ?? ""}
              onChange={(e) => setGenre((e.target.value || "all") as Genre | "all")}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g.label} value={g.value === "all" ? "" : g.value ?? ""}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-stone-400">
            カードを押すと、その商品の情報シートが開きます。画像はInstagramフィード投稿画像を表示しています。
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          条件に合う商品がありません。絞り込みを変えてください。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ product, info, done, total, thumb }) => (
            <button
              key={product.id}
              className="overflow-hidden rounded-xl border border-stone-300 bg-white text-left transition hover:border-stone-500"
              onClick={() => {
                setSelectedId(product.id);
                onNavigate("sheet");
              }}
            >
              <CardThumb url={thumb} alt={product.name} />

              <div className="space-y-1 p-3">
                <div className="text-sm font-semibold leading-snug text-stone-800">{product.name}</div>
                <div className="text-xs text-stone-500">
                  {product.genre ? GENRE_LABELS[product.genre] : "ジャンル未設定"}
                  <span className="mx-1 text-stone-300">/</span>
                  <span className="tabular-nums">
                    {info.releaseDate ? info.releaseDate.replaceAll("-", "/") : "発売日未設定"}
                  </span>
                  {info.releaseDate && info.releaseDate > today && "（発売前）"}
                </div>

                <div className="pt-1">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-stone-500">ビジュアル</span>
                    <span className="tabular-nums text-stone-600">
                      {done}/{total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full ${done === total ? "bg-emerald-500" : "bg-stone-600"}`}
                      style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
