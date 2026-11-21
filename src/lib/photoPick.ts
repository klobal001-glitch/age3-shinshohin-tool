import { MonthEntry } from "./monthly";
import { toThumbnailUrl } from "./imageUrl";
import { loadPhoto, PhotoState } from "./posterPdf";
import { storedPhoto } from "./posterPhotoStore";

/**
 * 紙（PDF・画像）に入れる写真を1枚決める。
 *
 * **1番目の画像が読み込めないときは、次の候補に移る**（2026年11月追加）。
 * ビジュアルのリンクは Dropbox / Google Drive の共有リンクなので、
 * ファイルを消したり入れ直したりすると切れる。すき焼きのように
 * Instagram の画像だけが消えていて商品画像は生きている、という商品で
 * 絵が出なくなるのを防ぐ。**代わりの絵は作らない。**
 * 使うのは、その商品に登録されている別の正式画像だけ。
 *
 * 候補は1件ずつ順に試す（まとめて読みに行かない）。
 * 1番目が読めれば2番目は取りに行かないので、ふだんの読み込みの数は今までと同じ。
 */
export type PickedPhoto = { url: string; st: PhotoState };

/** その商品で試す写真のURL（使う順） */
export function photoUrlsOf(e: MonthEntry): string[] {
  const list = e.images.length > 0 ? e.images : e.image ? [e.image] : [];
  return list.map((c) => toThumbnailUrl(c.url)).filter(Boolean);
}

/** 候補を順に試して、最初に使える1枚を返す。全部だめなら最後に試したものを返す */
export async function loadFirstPhoto(urls: string[]): Promise<PickedPhoto | null> {
  let last: PickedPhoto | null = null;
  for (const u of urls) {
    const st = await loadPhoto(storedPhoto(u) ?? u);
    last = { url: u, st };
    if (st.readable) return last;
  }
  return last;
}

/* 商品のキーには「|」が入っていて、URLには「,」や「:」が入ることがある。
   区切りに見える文字を使うとキーが壊れるので、文中に出てこない制御文字で区切る。 */
const ROW = "\u0001";
const COL = "\u0002";
const SEP = "\u0003";

/** useEffect の見張りに使う1本の文字列（中身が変わったときだけ調べ直す） */
export function photoPlan(rows: { key: string; urls: string[] }[]): string {
  return rows
    .filter((r) => r.urls.length > 0)
    .map((r) => `${r.key}${COL}${r.urls.join(SEP)}`)
    .join(ROW);
}

/** photoPlan が作った文字列を元に戻す */
export function parsePhotoPlan(plan: string): { key: string; urls: string[] }[] {
  return plan
    .split(ROW)
    .filter(Boolean)
    .map((part) => {
      const [key, urls] = part.split(COL);
      return { key, urls: (urls ?? "").split(SEP).filter(Boolean) };
    });
}
