import { ProductInfo } from "./types";

/**
 * ビジュアル一覧のカードに出す画像を選ぶ順番。
 * 上から順に見て、リンクが入っている最初のものを使う。
 *
 * レギュラー商品には Instagram フィード投稿画像が無く、商品画像（背景なし画像）
 * だけがあることが多いので、無い場合はそちらで代替する。
 */
const CARD_IMAGE_KEYS = ["ig_feed", "product_image"] as const;

export type CardImage = {
  /** 貼られたままのURL（変換していない） */
  url: string;
  /** どのビジュアルから採ったか。product_image は背景が透過なので見せ方を変える */
  key: (typeof CARD_IMAGE_KEYS)[number];
};

/**
 * カードに出す画像を1つ選ぶ。どちらも登録が無ければ null。
 *
 * 「画像あり」の数え方・絞り込みも必ずこの関数を通すこと。
 * 別々に判定すると、カードの見た目と件数が食い違う。
 */
export function pickCardImage(info: ProductInfo): CardImage | null {
  for (const key of CARD_IMAGE_KEYS) {
    const url = info.visualDownloads
      .find((v) => v.key === key)
      ?.links.map((l) => l.trim())
      .find(Boolean);
    if (url) return { url, key };
  }
  return null;
}
