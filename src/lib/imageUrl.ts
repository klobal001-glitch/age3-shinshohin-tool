/**
 * 貼られたURLを「表示用」に変換するためのユーティリティ。
 *
 * 保存する値は変えない。ユーザーが貼った元のURLをそのままDBに入れ、
 * サムネイルを描くときだけここを通す。リンクを開くときも元URLを使う。
 */

/** サムネイルとして扱う拡張子 */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** 共有リンクなら拡張子が無くても画像候補として扱うホスト */
const IMAGE_HOSTS = ["dropbox.com", "drive.google.com"];

/**
 * URLとして読む。`/visuals/xxx.jpg` のような相対パスも扱えるよう、
 * 絶対URLでなければダミーの基準URLを当てて解釈する。
 */
function parse(rawUrl: string): URL | null {
  const s = rawUrl.trim();
  if (!s) return null;
  try {
    return new URL(s);
  } catch {
    /* 絶対URLでなければ相対パスとして読み直す */
  }
  try {
    return new URL(s, "http://relative.invalid");
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, host: string) {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/**
 * 表示用URLに変換する。変換できないものは入力をそのまま返す（throwしない）。
 *
 * - Dropbox: dl / raw を消して raw=1 を付ける（rlkey などは残す）
 * - Google Drive: /file/d/<ID>/... を thumbnail エンドポイントに置き換える
 */
export function toThumbnailUrl(rawUrl: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return rawUrl;
  }

  if (hostMatches(u.hostname, "dropbox.com")) {
    u.searchParams.delete("dl");
    u.searchParams.delete("raw");
    u.searchParams.set("raw", "1");
    return u.toString();
  }

  if (hostMatches(u.hostname, "drive.google.com")) {
    const m = u.pathname.match(/^\/file\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  }

  return rawUrl;
}

/**
 * サムネイルを出す候補かどうか。
 * クエリ文字列に惑わされないよう、判定は必ず pathname の拡張子で行う。
 */
export function isImageUrl(rawUrl: string): boolean {
  const u = parse(rawUrl);
  if (!u) return false;
  if (IMAGE_HOSTS.some((h) => hostMatches(u.hostname, h))) return true;
  return IMAGE_EXT.test(u.pathname);
}

/**
 * 「保存」ボタン用のURLに変換する。ここは開く用ではなく、
 * ブラウザのダウンロードを直接始めさせるためのURL。
 *
 * - Dropbox: dl=1（Dropboxが添付ファイルとして返す）
 * - Google Drive: /uc?export=download&id=<ID>
 */
export function toDownloadUrl(rawUrl: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return rawUrl;
  }

  if (hostMatches(u.hostname, "dropbox.com")) {
    u.searchParams.delete("raw");
    u.searchParams.delete("dl");
    u.searchParams.set("dl", "1");
    return u.toString();
  }

  if (hostMatches(u.hostname, "drive.google.com")) {
    const m = u.pathname.match(/^\/file\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }

  return rawUrl;
}

/**
 * 登録済みリンクを一覧で見分けるための短い名前。
 * URLそのものではなく「Banana-Brulee3s.png」のようなファイル名を返す。
 *
 * name … 画面に大きく出す名前 ／ host … その下に薄く出す置き場所
 */
export function linkLabel(rawUrl: string): { name: string; host: string } {
  const s = rawUrl.trim();
  const u = parse(s);
  if (!u) return { name: s, host: "" };

  const host = u.hostname === "relative.invalid" ? "" : u.hostname.replace(/^www\./, "");

  /* Google Drive は末尾が /view などで名前にならないため、置き場所の名前を出す */
  if (hostMatches(u.hostname, "drive.google.com")) {
    return { name: "Google Drive のファイル", host };
  }

  const segments = u.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    /* エンコードが壊れていればそのまま使う */
  }

  if (!name) return { name: host || s, host: "" };
  return { name, host };
}
