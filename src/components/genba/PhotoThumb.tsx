"use client";

import { useState } from "react";
import { thumbUrl } from "@/lib/genba/photos";

/**
 * 一覧に並べる現場写真の1枚。
 *
 * 原寸（長辺1600px・約1MB）のまま並べると、iPhone のような端末では
 * 写真が増えたところで表示に使うメモリが足りなくなり、ページごと落ちて
 * 「開かない」状態になる。ここでは枠の大きさに合わせて小さく作り直した
 * ものを読み込み、変換できない写真だけ元のURLに戻す。
 */
export function PhotoThumb({
  url,
  alt,
  size,
  className,
  lazy = true,
}: {
  url: string;
  alt: string;
  /** 表示する一辺（px）。実際はこの2倍の大きさで読み込む */
  size: number;
  className?: string;
  /** 画面に入るまで読み込みを待つ。印刷する画面では false にする */
  lazy?: boolean;
}) {
  const [src, setSrc] = useState(() => thumbUrl(url, size * 2));

  return (
    // 静的書き出しのため next/image ではなく img を使う
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={lazy ? "lazy" : undefined}
      decoding="async"
      onError={() => {
        // 変換できない形式のときは、元の写真をそのまま出す
        if (src !== url) setSrc(url);
      }}
      className={className}
    />
  );
}
