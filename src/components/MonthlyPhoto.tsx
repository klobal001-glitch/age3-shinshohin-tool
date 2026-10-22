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
 */
export default function MonthlyPhoto({
  image,
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
  style?: React.CSSProperties;
  className?: string;
  emptyText?: string;
  fontSize?: number;
  big?: boolean;
}) {
  /* どのURLで失敗したかを覚える。真偽値にすると、写真を差し替えたあとも
     「読み込めません」のまま残ってしまう */
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image ? toThumbnailUrl(image.url) : "";
  const src = big ? url.replace("sz=w400", "sz=w1200") : url;
  const failed = !!src && failedUrl === src;

  if (!image || failed) {
    return (
      <div
        style={{ ...style, fontSize }}
        className={`flex items-center justify-center border border-stone-300 bg-stone-100 text-center leading-tight text-stone-400 ${className}`}
      >
        {failed ? "画像を読み込めません" : emptyText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={style}
      className={className}
      onError={() => setFailedUrl(src)}
    />
  );
}
