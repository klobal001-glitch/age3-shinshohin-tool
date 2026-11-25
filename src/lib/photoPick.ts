import { MonthEntry } from "./monthly";
import { toThumbnailUrl } from "./imageUrl";
import { loadPhoto, PhotoState } from "./posterPdf";
import { storedPhoto } from "./posterPhotoStore";
import { readSavedArtwork, savedArtwork } from "./storedArtwork";

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
 *
 * **1枚ごとに、この順で試す**（2026年11月追加）。
 * ① この端末に覚えている写真（「写真を選ぶ」で読み込んだもの）
 * ② **アプリに保存してある画像**（「画像保存済み」のもの）
 * ③ 置き場所（Dropbox / Googleドライブ）から直接
 *
 * ②を足した理由：Googleドライブの画像は、画面には出せても**紙（PDF）には入れられない**
 * （ドライブが外部サイトからの読み取りを許していないため）。アプリに保存してある画像なら
 * 読めるので、「画像保存済み」になっている商品は、そのまま資料にも入るようになる。
 */
export type PickedPhoto = { url: string; st: PhotoState };

/**
 * その商品で試す写真のURL（使う順）。
 *
 * **貼られたままのURLを返す。**表示用への読み替えは `loadFirstPhoto` の中で行う。
 * アプリに保存した画像は「貼られたままのURL」で覚えているので、
 * ここで読み替えてしまうと保存した画像が見つからなくなる。
 */
export function photoUrlsOf(e: MonthEntry): string[] {
  const list = e.images.length > 0 ? e.images : e.image ? [e.image] : [];
  return list.map((c) => c.url.trim()).filter(Boolean);
}

/** アプリに保存してある画像を読む。無ければ null */
async function savedPhoto(url: string): Promise<PhotoState | null> {
  try {
    const saved = await savedArtwork(url, true);
    if (!saved) return null;
    const object = URL.createObjectURL(await readSavedArtwork(saved));
    const st = await loadPhoto(object);
    /* 絵として読み込み終わっていれば、この先は入れ物を手放してよい */
    URL.revokeObjectURL(object);
    return st;
  } catch {
    return null;
  }
}

/** 候補を順に試して、最初に使える1枚を返す。全部だめなら最後に試したものを返す */
export async function loadFirstPhoto(urls: string[]): Promise<PickedPhoto | null> {
  let last: PickedPhoto | null = null;
  for (const u of urls) {
    const view = toThumbnailUrl(u);
    /* ① この端末に覚えている写真。古い記録は表示用URLで覚えているので、そちらも見る */
    const kept = storedPhoto(u) ?? storedPhoto(view);
    if (kept) {
      const st = await loadPhoto(kept);
      last = { url: u, st };
      if (st.readable) return last;
    }
    /* ② アプリに保存してある画像 */
    const inside = await savedPhoto(u);
    if (inside) {
      last = { url: u, st: inside };
      if (inside.readable) return last;
    }
    /* ③ 置き場所から直接 */
    const st = await loadPhoto(view);
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
