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
  return pickCardImages(info)[0] ?? null;
}

/** 候補として持っておく数。多すぎると読み込みが重くなるだけなので3つまで */
const MAX_CANDIDATES = 3;

/**
 * カードに出す画像の候補を、使う順に返す。
 *
 * **1番目が読み込めなかったときの控え**（2026年11月追加）。
 * ビジュアルのリンクは Dropbox / Google Drive の共有リンクなので、
 * ファイルを消したり入れ直したりすると切れる。1番目が切れているだけで
 * 「画像を読み込めません」になってしまうのを防ぐため、次の候補に自動で移る。
 * 順番は pickCardImage と同じ（① Instagram ② 商品画像 ③ その他）。
 */
export function pickCardImages(info: ProductInfo): CardImage[] {
  const out: CardImage[] = [];
  const seen = new Set<string>();
  const add = (url: string | undefined, key: string) => {
    if (!url || seen.has(url) || out.length >= MAX_CANDIDATES) return;
    seen.add(url);
    out.push({ url, key });
  };

  for (const key of PREFERRED_KEYS) {
    add(firstLink(info.visualDownloads.find((v) => v.key === key)?.links ?? []), key);
  }
  for (const v of info.visualDownloads) add(firstLink(v.links), v.key);

  return out;
}

/**
 * Instagram フィード投稿画像は 1,080×1,350 で切り抜き前提。
 * それ以外（透過PNGの商品画像、ポスター、サイネージなど）は縦横比がまちまちなので、
 * 切り取らずに全体を見せる。
 */
export function isFullBleed(card: CardImage): boolean {
  return card.key === "ig_feed";
}

/**
 * 上の帯などに出す「商品の顔」。
 *
 * 今の回にまだビジュアルが入っていない商品（再販の準備中など）でも、
 * **前の回の絵**を出す。ものは同じなので、絵が出ないより出たほうが分かる。
 * runs は古い順に積まれているので、新しい回から順に探す。
 */
export function pickProductThumb(info: ProductInfo): CardImage | null {
  return pickProductThumbs(info)[0] ?? null;
}

/** pickProductThumb の候補つき。1番目が読み込めなかったときに次へ移るため */
export function pickProductThumbs(info: ProductInfo): CardImage[] {
  const now = pickCardImages(info);
  if (now.length) return now;
  for (let i = info.runs.length - 1; i >= 0; i--) {
    const visuals = info.runs[i]?.visuals;
    if (!visuals || visuals.length === 0) continue;
    const hit = pickCardImages({ ...info, visualDownloads: visuals });
    if (hit.length) return hit;
  }
  return [];
}
