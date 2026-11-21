"use client";

import { useState } from "react";
import { CardImage } from "@/lib/visualThumb";
import { toThumbnailUrl } from "@/lib/imageUrl";

/**
 * 月別の一覧・共有・掲示で使う商品写真。
 *
 * ビジュアルのリンクは Dropbox / Google Drive の共有リンクなので、
 * 共有設定が変わったりファイルを入れ直したりすると**切れることがある**。
 * 切れたリンクをブラウザ任せにすると、壊れた絵の記号が紙にまで出てしまうため、
 * 読み込めなかったときは文字で「読み込めません」と出す。
 *
 * **控えの画像（2026年11月追加）。** `images` を渡すと、1番目が読み込めなかったときに
 * 次の候補へ自動で移る。すき焼きのように Instagram の画像だけが消えていて、
 * 商品画像は生きている、という商品で絵が出なくなるのを防ぐ。
 * 代わりの絵を作るわけではなく、**その商品に登録されている別の正式画像**を使う。
 */
export default function MonthlyPhoto({
  image,
  images,
  style,
  className = "",
  /** 画像そのものが登録されていないときの文字 */
  emptyText = "画像未登録",
  /** 文字の大きさ（px）。紙と画面で変える */
  fontSize = 14,
  /** 紙に刷るときは大きめの画像を取りに行く */
  big = false,
}: {
  image: CardImage | null;
  /** 使う順の候補。渡さないときは image だけを見る */
  images?: CardImage[];
  style?: React.CSSProperties;
  className?: string;
  emptyText?: string;
  fontSize?: number;
  big?: boolean;
}) {
  /* どのURLで失敗したかを覚える。真偽値にすると、写真を差し替えたあとも
     「読み込めません」のまま残ってしまう */
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const list = images && images.length > 0 ? images : image ? [image] : [];
  const srcOf = (c: CardImage) => {
    const url = toThumbnailUrl(c.url);
    return big ? url.replace("sz=w400", "sz=w1200") : url;
  };
  const srcs = list.map(srcOf);
  const src = srcs.find((s) => !failedUrls.includes(s)) ?? "";

  if (!src) {
    return (
      <div
        style={{ ...style, fontSize }}
        className={`flex items-center justify-center border border-stone-300 bg-stone-100 text-center leading-tight text-stone-400 ${className}`}
      >
        {srcs.length > 0 ? "画像を読み込めません" : emptyText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      /* 候補が変わったら作り直す。同じ <img> を使い回すと、前の失敗が残る */
      key={src}
      src={src}
      alt=""
      style={style}
      className={className}
      onError={() => setFailedUrls((cur) => (cur.includes(src) ? cur : [...cur, src]))}
    />
  );
}
