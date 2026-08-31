import { ProductInfo } from "./types";

/**
 * ビジュアル一覧のカードに、まずこの順で画像を探す。
 *
 * レギュラー商品には Instagram フィード投稿画像が無く、商品画像（背景なし画像）
 * だけがあることが多いので、無い場合はそちらで代替する。
 */
const PREFERRED_KEYS = ["ig_feed", "product_image"];

export type CardImage = {
  /** 貼られたままのURL（変換していない） */
  url: string;
  /** どのビジュアルから採ったか */
  key: string;
};

/** グループの中で、空白でない最初のリンク */
function firstLink(links: string[]): string | undefined {
  return links.map((l) => l.trim()).find(Boolean);
}

/**
 * カードに出す画像を1つ選ぶ。どこにもリンクが無ければ null。
 *
 * ① Instagram フィード投稿画像
 * ② 商品画像（背景なし画像）
 * ③ それ以外の登録済みビジュアルの1件目
 *
 * ③まで見るのは、商品画像の枠が後から追加されたもので、既存商品では
 * 画像が別の行に入っていることがあるため。
 *
 * 「画像あり」の数え方・絞り込みも必ずこの関数を通すこと。
 * 別々に判定すると、カードの見た目と件数が食い違う。
 */
export function pickCardImage(info: ProductInfo): CardImage | null {
  for (const key of PREFERRED_KEYS) {
    const url = firstLink(info.visualDownloads.find((v) => v.key === key)?.links ?? []);
    if (url) return { url, key };
  }

  for (const v of info.visualDownloads) {
    const url = firstLink(v.links);
    if (url) return { url, key: v.key };
  }

  return null;
}

/**
 * Instagram フィード投稿画像は 1,080×1,350 で切り抜き前提。
 * それ以外（透過PNGの商品画像、ポスター、サイネージなど）は縦横比がまちまちなので、
 * 切り取らずに全体を見せる。
 */
export function isFullBleed(card: CardImage): boolean {
  return card.key === "ig_feed";
}
