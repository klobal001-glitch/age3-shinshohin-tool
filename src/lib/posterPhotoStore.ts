/* ------------------------------------------------------------------ *
 * 掲示用に、手元の写真をこの端末だけに覚えておく
 *
 * Dropbox に置いた写真は、画面には出せても **PDFの中には入れられない**
 * （置き場所が「よそのページから読んでよい」と返さないため）。
 * そこで、同じ写真を一度だけ手元から読み込んでもらい、この端末に覚えておく。
 *
 * 決めごと
 * - **商品データベースには一切書かない。** ビジュアルのリンクも変えない
 * - どこへも送らない。この端末のブラウザの中だけに置く
 * - 紙に出すのに必要な大きさまで縮めてから覚える（置き場所を使いすぎないため）
 * - 覚えた写真は、いつでも「忘れる」で消せる
 * ------------------------------------------------------------------ */

const PREFIX = "age3_poster_photo_";
/** 覚えておく写真の最大件数。古いものから消す */
const MAX_ENTRIES = 12;
/** 紙に出すのに十分な大きさ（長辺） */
const MAX_PX = 1800;
const QUALITY = 0.8;

/** リンクごとの合い言葉。長いURLをそのまま鍵にしないための短い名前 */
function keyOf(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  return PREFIX + (h >>> 0).toString(36) + "_" + url.length.toString(36);
}

type Entry = { url: string; data: string; at: number };

function read(key: string): Entry | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Entry;
    return v && typeof v.data === "string" ? v : null;
  } catch {
    return null;
  }
}

/** この端末に覚えてある写真（なければ null） */
export function storedPhoto(url: string): string | null {
  if (typeof window === "undefined" || !url) return null;
  return read(keyOf(url))?.data ?? null;
}

/** 覚えている写真の数 */
export function storedCount(): number {
  if (typeof window === "undefined") return 0;
  let n = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) n++;
  }
  return n;
}

function evictOldest() {
  const rows: { key: string; at: number }[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    rows.push({ key: k, at: read(k)?.at ?? 0 });
  }
  rows.sort((a, b) => a.at - b.at);
  while (rows.length >= MAX_ENTRIES) {
    const old = rows.shift();
    if (old) window.localStorage.removeItem(old.key);
  }
}

/** 覚える。置き場所がいっぱいなら古いものから消して、それでも駄目なら諦める */
export function rememberPhoto(url: string, data: string): boolean {
  if (typeof window === "undefined") return false;
  const entry: Entry = { url, data, at: Date.now() };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      window.localStorage.setItem(keyOf(url), JSON.stringify(entry));
      return true;
    } catch {
      evictOldest();
    }
  }
  return false;
}

/** 忘れる */
export function forgetPhoto(url: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyOf(url));
}

/**
 * 選んでもらったファイルを、紙に出すのにちょうどよい大きさの写真に直す。
 * 元のファイルはどこへも送らない。ここで絵に変えるだけ。
 */
export function fileToPosterPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("写真のファイルを選んでください"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) {
        reject(new Error("写真を読み込めませんでした"));
        return;
      }
      /* 透明な部分は白にする（紙は白いので） */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("この形式の写真は読み込めませんでした"));
    };
    img.src = url;
  });
}
