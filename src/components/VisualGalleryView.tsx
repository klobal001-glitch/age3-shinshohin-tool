"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { TabKey } from "./Header";
import { toThumbnailUrl } from "@/lib/imageUrl";
import { CardImage, isFullBleed, pickCardImage } from "@/lib/visualThumb";
import { requiredVisualFilled, requiredVisualTotal } from "@/lib/productInfo";
import { SALE_STATUS_LABEL, isInactive, saleStatus, todayKey } from "@/lib/saleStatus";
import { card, chip, eyebrow, field, focusRing, h3, muted } from "@/lib/ui";
import { requestImageSlot } from "@/lib/imageQueue";
import Icon from "@/components/Icon";
import VisualViewer, { ViewerItem } from "@/components/VisualViewer";

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

/** 読み込みを何回まで試すか（候補URL × 3周ぶん） */
const MAX_ATTEMPTS = 6;

/**
 * ますの中の画像。
 *
 * Dropbox は数十枚をまとめて取りに行くと弾くので、requestImageSlot で
 * 同時に読み込む枚数を絞る。それでも失敗したときは、少し待ってから
 * 表示用URL（raw=1）と貼られたURLを交互に試し直す。
 * 一度の失敗で諦めると「出たり出なかったり」になるため。
 */
function Thumb({
  card,
  alt,
  className = "",
}: {
  card: CardImage | null;
  alt: string;
  className?: string;
}) {
  /* 何回目の読み込みか。候補URLを交互に試すのにも使う */
  const [attempt, setAttempt] = useState(0);
  /* 試し切って諦めたか */
  const [failed, setFailed] = useState(false);
  /* 順番が回ってきた読み込みの目印。今の url と attempt に一致したら読み込む */
  const [readyToken, setReadyToken] = useState("");

  const url = card?.url ?? "";
  const candidates = useMemo(
    () => (url ? [toThumbnailUrl(url), url].filter((u, i, all) => u && all.indexOf(u) === i) : []),
    [url]
  );

  const releaseRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);

  const token = `${url}#${attempt}`;

  /* 順番待ちに並ぶ。読み込みが終わる（成功・失敗）まで枠を持つ */
  useEffect(() => {
    if (!url || failed) return;
    const release = requestImageSlot(() => setReadyToken(token));
    releaseRef.current = release;
    return () => {
      release();
      releaseRef.current = null;
    };
  }, [token, url, failed]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  if (!card || failed || candidates.length === 0) return null;
  if (readyToken !== token)
    return <div className={`h-full w-full animate-pulse bg-stone-200 ${className}`} />;

  const src = candidates[attempt % candidates.length];

  const finish = () => {
    releaseRef.current?.();
    releaseRef.current = null;
  };

  const onError = () => {
    finish();
    const next = attempt + 1;
    if (next >= MAX_ATTEMPTS) {
      setFailed(true);
      return;
    }
    /* 一斉に試し直すとまた弾かれるので、待ち時間を延ばしつつ少しずらす */
    const round = Math.floor(next / candidates.length);
    const wait = 700 * 2 ** round + Math.random() * 800;
    timerRef.current = window.setTimeout(() => setAttempt(next), wait);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      /* 同じURLに戻ったときも確実に読み込み直すよう、要素ごと作り直す */
      key={attempt}
      src={src}
      alt={alt}
      className={`h-full w-full ${isFullBleed(card) ? "object-cover" : "object-contain p-1.5"} ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={finish}
      onError={onError}
    />
  );
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
  /* 全画面で見ている商品。null なら閉じている */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const today = todayKey();

  const rows = useMemo(() => {
    let list = products.map((p) => {
      const info = getInfo(p.id);
      /* 必須ぶんで数える。レギュラー商品はビジュアル3件で完成 */
      const done = requiredVisualFilled(info, p.genre);
      /* ますに出す画像。「画像あり」の数え方と絞り込みも必ずこれを見る */
      const card = pickCardImage(info);
      return {
        product: p,
        info,
        done,
        total: requiredVisualTotal(p.genre),
        card,
        status: saleStatus(info, today),
      };
    });
    if (genre !== "all") list = list.filter((r) => r.product.genre === genre);
    if (imageFilter === "has") list = list.filter((r) => r.card !== null);
    if (imageFilter === "none") list = list.filter((r) => r.card === null);

    if (sortMode === "date") {
      /* 発売日が新しい順。未設定は下に回す */
      list.sort((a, b) => (b.info.releaseDate || "").localeCompare(a.info.releaseDate || ""));
    } else if (sortMode === "name") {
      list.sort((a, b) => a.product.name.localeCompare(b.product.name, "ja"));
    } else {
      list.sort((a, b) => a.done - b.done || a.product.name.localeCompare(b.product.name, "ja"));
    }
    return list;
    /* getInfo は infoMap が変わると作り直される。ここに入れておかないと、
       商品より後から中身が届いたときに一覧が古いままになる */
  }, [products, getInfo, today, genre, imageFilter, sortMode]);

  const withImage = rows.filter((r) => r.card !== null).length;

  /**
   * 上の丸い列：これから発売する商品を、発売日が近い順に並べる。
   * 画像がまだ足りないものには輪を付けて、先に手を付けるものが分かるようにする。
   * 絞り込みの影響は受けない（いつでも同じ場所にある方が押しやすい）。
   */
  const upcoming = useMemo(() => {
    return products
      .map((p) => {
        const info = getInfo(p.id);
        return {
          product: p,
          info,
          done: requiredVisualFilled(info, p.genre),
          total: requiredVisualTotal(p.genre),
          card: pickCardImage(info),
          status: saleStatus(info, today),
        };
      })
      .filter((r) => !r.info.discontinued && r.info.releaseDate && r.info.releaseDate >= today)
      .sort((a, b) => (a.info.releaseDate || "").localeCompare(b.info.releaseDate || ""))
      .slice(0, 14);
  }, [products, getInfo, today]);

  const viewerItems: ViewerItem[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.product.id,
        name: r.product.name,
        genre: r.product.genre,
        releaseDate: r.info.releaseDate,
        card: r.card,
        done: r.done,
        total: r.total,
        status: r.status,
      })),
    [rows]
  );

  const openSheet = (id: string) => {
    setSelectedId(id);
    setViewerIndex(null);
    onNavigate("sheet");
  };

  /* 丸い列から押されたら、その商品をますの一覧の中から探して全画面で開く */
  const openById = (id: string) => {
    const i = rows.findIndex((r) => r.product.id === id);
    if (i >= 0) setViewerIndex(i);
    else openSheet(id);
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center gap-2.5 border-b border-stone-200 px-4 py-3.5 sm:px-5">
          <h2 className={h3}>ビジュアル一覧</h2>
          <span className="text-sm tabular-nums text-stone-500">
            {rows.length}件中 {withImage}件に画像あり
          </span>
        </div>

        {/* 並べ替えと絞り込みは1列にまとめる。上の操作盤が画面の半分を占めると、
            肝心の画像までスクロールしないと辿り着けないため */}
        <div className="scroll-x-clean flex items-center gap-1.5 overflow-x-auto p-3 sm:flex-wrap sm:p-4">
          <button className={chip(sortMode === "date", "", "sm")} onClick={() => setSortMode("date")}>
            発売日が新しい順
          </button>
          <button className={chip(sortMode === "name", "", "sm")} onClick={() => setSortMode("name")}>
            名前順
          </button>
          <button className={chip(sortMode === "least", "", "sm")} onClick={() => setSortMode("least")}>
            画像が少ない順
          </button>

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-stone-200" />

          <button
            className={chip(imageFilter === "all", "", "sm")}
            onClick={() => setImageFilter("all")}
          >
            すべて
          </button>
          <button
            className={chip(imageFilter === "none", "", "sm")}
            onClick={() => setImageFilter("none")}
          >
            画像なしだけ
          </button>
          <button
            className={chip(imageFilter === "has", "", "sm")}
            onClick={() => setImageFilter("has")}
          >
            画像ありだけ
          </button>
          <select
            className={`${field} !min-h-10 w-auto shrink-0 !py-1 text-xs md:!min-h-8`}
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

        <p className={`border-t border-stone-100 px-3 pb-3 pt-2.5 sm:px-4 ${muted}`}>
          画像を押すと全画面で開きます（左右にスワイプ／← →キーで次の商品）。
        </p>
      </div>

      {/* これから発売する商品。丸く並べて、画像が足りないものに輪を付ける */}
      {upcoming.length > 0 && (
        <div>
          <div className={`mb-2 px-0.5 ${eyebrow}`}>これから発売（発売日が近い順）</div>
          <div className="scroll-x-clean -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {upcoming.map((u) => {
              const short = u.done < u.total;
              return (
                <button
                  key={u.product.id}
                  type="button"
                  onClick={() => openById(u.product.id)}
                  className={`flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-lg pb-1 pt-0.5 ${focusRing}`}
                >
                  <span
                    className={`rounded-full p-0.5 ${
                      short ? "bg-amber-500" : "bg-stone-200"
                    }`}
                  >
                    <span className="block overflow-hidden rounded-full border-2 border-white bg-stone-100">
                      <span className="block h-14 w-14">
                        {u.card ? (
                          <Thumb card={u.card} alt={u.product.name} />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-stone-300">
                            <Icon name="gallery" className="h-5 w-5" />
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="line-clamp-2 w-full text-center text-xs leading-tight text-stone-600">
                    {u.product.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          条件に合う商品がありません。絞り込みを変えてください。
        </p>
      ) : (
        /* ますの一覧。写真アプリと同じで、枠も余白も置かず画像そのものを並べる。
           スマホは画面の端まで使いたいので、本文の余白（px-4）を打ち消している */
        <div className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:grid-cols-4 sm:gap-1 lg:grid-cols-6">
          {rows.map(({ product, info, done, total, card, status }, i) => {
            const off = isInactive(status);
            const pct = total ? (done / total) * 100 : 0;
            const soon = info.releaseDate && info.releaseDate > today;
            return (
              <button
                key={product.id}
                onClick={() => setViewerIndex(i)}
                className={`group relative aspect-square overflow-hidden bg-stone-100 text-left transition sm:rounded-lg ${focusRing}`}
              >
                {card ? (
                  <Thumb card={card} alt={product.name} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-300">
                    <Icon name="gallery" className="h-6 w-6" />
                  </span>
                )}

                {/* 名前は画像の上に重ねる。ますだけだとどの商品か分からないため */}
                <span
                  className={`pointer-events-none absolute inset-x-0 bottom-0 px-1.5 pb-1.5 pt-5 text-xs font-medium leading-tight ${
                    card
                      ? "bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white"
                      : "text-stone-600"
                  }`}
                >
                  <span className="line-clamp-2">{product.name}</span>
                </span>

                {/* 左上の印。発売前・販売終了・廃盤だけ出す */}
                {(off || soon) && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-stone-900/55 px-1.5 py-0.5 text-xs text-white">
                    {off ? SALE_STATUS_LABEL[status] : "発売前"}
                  </span>
                )}

                {/* いちばん下の細い線がビジュアルの埋まり具合 */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/25">
                  <span
                    className={`block h-full ${done === total ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {viewerIndex !== null && viewerItems[viewerIndex] && (
        <VisualViewer
          items={viewerItems}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onOpenSheet={openSheet}
        />
      )}
    </div>
  );
}
