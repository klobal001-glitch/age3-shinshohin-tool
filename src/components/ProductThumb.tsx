"use client";

import { useState } from "react";
import { ProductInfo } from "@/lib/types";
import { isFullBleed, pickCardImage } from "@/lib/visualThumb";
import { toThumbnailUrl } from "@/lib/imageUrl";

/**
 * 商品の小さな絵。
 *
 * 2026年9月15日、松尾さんの指示で追加した。
 * 「商品画像が入ったら、一番上とか、バーのとこ。小さくていいので直感的に分かるように。」
 *
 * 88商品を名前だけで見分けるのは大変で、下までスクロールすると
 * 何の商品を開いているか分からなくなっていた。**絵は名前より早く分かる。**
 *
 * - 出す絵は ビジュアル一覧のカードと同じ選び方（`pickCardImage`）。
 *   Instagram画像 → 商品画像（背景なし）→ それ以外、の順。
 * - **画像が無い商品では何も出さない。** 空の枠を置くと、名前の位置が
 *   商品ごとにずれて、かえって読みにくくなる。
 * - 読み込みに失敗したときも消す（リンク切れの灰色の四角を残さない）。
 */
export default function ProductThumb({
  info,
  size = "sm",
  className = "",
}: {
  info: ProductInfo;
  /** sm = 上の帯の中（28px）／md = 画面のいちばん上（40px） */
  size?: "sm" | "md";
  className?: string;
}) {
  const card = pickCardImage(info);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!card) return null;
  const url = toThumbnailUrl(card.url);
  if (failedUrl === url) return null;

  const dim = size === "md" ? "h-10 w-10" : "h-7 w-7";
  return (
    <span className={`${dim} shrink-0 overflow-hidden rounded-lg bg-stone-100 ${className}`}>
      {/* next/image は外部ドメインの許可が要るうえ、Dropboxのリンクは
          途中で変わることがあるので、素の img を使う */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`h-full w-full ${isFullBleed(card) ? "object-cover" : "object-contain p-0.5"}`}
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}
