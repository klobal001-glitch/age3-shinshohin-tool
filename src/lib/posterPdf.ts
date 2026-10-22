import { AGE3_LOGO_PATH } from "@/components/Age3Logo";

/* ------------------------------------------------------------------ *
 * 店頭掲示（A4たて1枚）を、そのままPDFファイルとして保存する
 *
 * やっていること
 *  1. 紙と同じ絵を canvas に描く（文字はパソコンの書体をそのまま使うので
 *     日本語の字が化けない）
 *  2. canvas を JPEG にして、1ページぶんのPDFに包む
 *  3. ふつうのダウンロードとして保存する
 *
 * ★ 写真を canvas に描くには、写真の置き場所が「よそから読んでよい」と
 *   返してくれる必要がある（CORS）。Dropbox の共有リンクはこれを返さないので、
 *   画面には出せても **PDFの中に入れられない**。
 *   読めない写真があるときは、この方法を使わず印刷（→PDFに保存）に回す。
 * ------------------------------------------------------------------ */

/** A4 たて。96ピクセル＝1インチで数えた大きさ */
export const A4_W = 793.7; // 210mm
export const A4_H = 1122.5; // 297mm
/** 紙の内側（左右上10mm）。掲示の中身はこの中に組む */
export const PAPER_X = 37.8;
export const PAPER_Y = 37.8;
export const PAPER_W = 718; // 190mm
export const PAPER_H = 1024; // 271mm

/** 1枚に載せられる上限。これ以上は文字が小さくなりすぎる */
export const POSTER_MAX = 8;

export type Tier = {
  cols: number;
  rows: number;
  /** 写真を上に大きく置くか（1件のときだけ）、左に置いて右に文字を並べるか */
  shape: "tall" | "row";
  name: number;
  period: number;
  price: number;
  /** tall のときの写真の高さの割合／row のときの写真の幅の上限（セル幅に対する割合） */
  img: number;
};

/**
 * 件数ごとの組み方。文字の大きさは px（14px ≒ 10.5ポイント）。
 * **写真は切り取らない**。正式な商品写真の端を落とさないため。
 */
export function tierOf(n: number): Tier {
  if (n <= 1) return { cols: 1, rows: 1, shape: "tall", name: 46, period: 26, price: 34, img: 0.72 };
  if (n === 2) return { cols: 1, rows: 2, shape: "row", name: 38, period: 22, price: 30, img: 0.4 };
  if (n === 3) return { cols: 1, rows: 3, shape: "row", name: 33, period: 20, price: 27, img: 0.4 };
  if (n === 4) return { cols: 1, rows: 4, shape: "row", name: 29, period: 18, price: 24, img: 0.4 };
  if (n <= 6) return { cols: 2, rows: 3, shape: "row", name: 23, period: 15, price: 20, img: 0.4 };
  return { cols: 2, rows: 4, shape: "row", name: 21, period: 14, price: 19, img: 0.4 };
}

export const HEADER_H = 150;
export const FOOTER_H = 34;

/* ------------------------------------------------------------------ *
 * 色と書体は、アプリの画面とまったく同じものを使う。
 * 値の出どころは src/app/globals.css の @theme。あちらを直したらここも直す。
 * ------------------------------------------------------------------ */
const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", ' +
  '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, system-ui, sans-serif';

export const T = {
  canvas: "#f6f5f3", // 画面の地
  white: "#ffffff", // 面（カード）
  line: "#e8e5e1", // 面の区切り（stone-200）
  stone50: "#faf9f8",
  stone100: "#f4f2f0",
  stone400: "#a8a49d", // 小さな見出し
  stone500: "#7a766f", // 補足の文章
  stone600: "#5c5850",
  stone900: "#1a1713", // 本文・見出し
  amber700: "#b84208", // アクセント（1か所だけ）
} as const;

const INK = T.stone900;
const SUB = T.stone500;
const FAINT = T.stone400;

/** 面の角丸。アプリのカードは rounded-2xl（16px）、小さな枠は rounded-lg（8px） */
const R_CARD = 16;
const R_THUMB = 8;
/** カードどうしのすき間 */
const CARD_GAP = 14;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** アプリの shadow-sm と同じ、うっすら浮かせる影 */
function withCardShadow(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.shadowColor = "rgba(26, 23, 19, 0.07)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  draw();
  ctx.restore();
}

/* ------------------------------ 写真の読み込み ------------------------------ */

export type PhotoState = {
  /** 画面に出す用（読めたかどうかに関わらず） */
  shown: boolean;
  /** canvas に描ける（＝PDFに入れられる）か */
  readable: boolean;
  img: HTMLImageElement | null;
  host: string;
};

function hostOf(url: string): string {
  if (url.startsWith("data:")) return "この端末に覚えた写真";
  try {
    return new URL(url, window.location.href).hostname || "このアプリ";
  } catch {
    return "不明";
  }
}

/** 1枚ぶん。まず「よそから読んでよい」形で試し、だめなら普通に読んで表示だけ確かめる */
export function loadPhoto(url: string): Promise<PhotoState> {
  const host = hostOf(url);
  return new Promise((resolve) => {
    const cors = new Image();
    cors.crossOrigin = "anonymous";
    const plain = () => {
      const p = new Image();
      p.onload = () => resolve({ shown: true, readable: false, img: p, host });
      p.onerror = () => resolve({ shown: false, readable: false, img: null, host });
      p.src = url;
    };
    cors.onload = () => resolve({ shown: true, readable: true, img: cors, host });
    cors.onerror = plain;
    cors.src = url;
  });
}

/** ロゴ（正式素材のSVGをそのまま絵にする） */
function loadLogo(): Promise<HTMLImageElement | null> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1052 336">` +
    `<path fill="${INK}" fill-rule="evenodd" d="${AGE3_LOGO_PATH}"/></svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = url;
  });
}

/* ------------------------------ 文字 ------------------------------ */

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: string) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/** 日本語は単語の切れ目が無いので、1文字ずつ入るところまで詰めて折り返す */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = ch;
    } else {
      line = t;
    }
  }
  if (line) out.push(line);
  return out;
}

/* ------------------------------ 絵を描く ------------------------------ */

export interface PosterItem {
  name: string;
  period: string;
  price: string;
  /** 価格が入っているか（入っていなければ「（税込）」を付けない） */
  hasPrice: boolean;
  /** 標準と違う店の価格 */
  exceptions: string[];
  photo: PhotoState | null;
}

/** 掲示の絵を canvas に描く。dpi は紙に刷る細かさ（300 なら 300dpi 相当） */
export async function drawPoster(
  year: number,
  month: number,
  items: PosterItem[],
  dpi = 300
): Promise<HTMLCanvasElement> {
  const s = dpi / 96;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(A4_W * s);
  canvas.height = Math.round(A4_H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を用意できませんでした");

  /* 紙の地。アプリの画面と同じ、ほんのり沈んだ白 */
  ctx.fillStyle = T.canvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s, s);
  ctx.translate(PAPER_X, PAPER_Y);
  ctx.textBaseline = "alphabetic";

  /* ── 見出し。アプリのホーム画面と同じ組み方（小さな見出し → 大きな題） ── */
  const logo = await loadLogo();
  const logoH = 22;
  const logoW = (logoH * 1052) / 336;
  if (logo) ctx.drawImage(logo, 0, 8, logoW, logoH);
  setFont(ctx, 12, "500");
  ctx.fillStyle = FAINT;
  ctx.letterSpacing = "0.04em";
  ctx.fillText("新商品のご案内", logoW + 12, 8 + logoH - 5);
  ctx.letterSpacing = "0px";

  const baseY = 108;
  let x = 0;
  const put = (t: string, size: number, weight: string, color: string) => {
    setFont(ctx, size, weight);
    ctx.fillStyle = color;
    ctx.fillText(t, x, baseY);
    x += ctx.measureText(t).width;
  };
  ctx.letterSpacing = "-0.02em"; // tracking-tight
  put(`${year}年`, 40, "600", INK);
  x += 4;
  put(`${month}月`, 56, "600", INK);
  ctx.letterSpacing = "0px";
  x += 14;
  put("の新商品", 24, "600", SUB);

  /* アクセント（ember）はここ1か所だけ。アプリと同じ使い方 */
  ctx.fillStyle = T.amber700;
  ctx.fillRect(0, HEADER_H - 14, 56, 3);
  ctx.fillStyle = T.line;
  ctx.fillRect(56, HEADER_H - 13, PAPER_W - 56, 1);

  /* ── 商品のカード ── */
  const shown = items.slice(0, POSTER_MAX);
  const tier = tierOf(shown.length);
  const gridH = PAPER_H - HEADER_H - FOOTER_H;
  const cellW = PAPER_W / tier.cols;
  const cellH = gridH / tier.rows;
  const half = CARD_GAP / 2;
  const pad = 18;

  shown.forEach((it, i) => {
    const cx = (i % tier.cols) * cellW + half;
    const cy = HEADER_H + Math.floor(i / tier.cols) * cellH + half;
    const cw = cellW - CARD_GAP;
    const ch = cellH - CARD_GAP;
    const tall = tier.shape === "tall";

    /* 面（カード）。白・角丸・うっすら影。線は面の区切りと同じ薄さ */
    withCardShadow(ctx, () => {
      ctx.fillStyle = T.white;
      roundRect(ctx, cx, cy, cw, ch, R_CARD);
      ctx.fill();
    });
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1;
    roundRect(ctx, cx + 0.5, cy + 0.5, cw - 1, ch - 1, R_CARD);
    ctx.stroke();

    const innerW = cw - pad * 2;
    const innerH = ch - pad * 2;
    const boxH = tall ? innerH * tier.img : innerH;
    const boxW = tall ? innerW : Math.min(innerH, cw * tier.img);
    const boxX = cx + pad;
    const boxY = cy + pad;

    /* 写真の枠。アプリの一覧と同じ、うすい面に全体を収める */
    ctx.save();
    roundRect(ctx, boxX, boxY, boxW, boxH, R_THUMB);
    ctx.clip();
    ctx.fillStyle = T.stone50;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    const ph = it.photo;
    if (ph?.readable && ph.img && ph.img.naturalWidth > 0) {
      const iw = ph.img.naturalWidth;
      const ih = ph.img.naturalHeight;
      const k = Math.min((boxW - 8) / iw, (boxH - 8) / ih);
      const w = iw * k;
      const h = ih * k;
      ctx.drawImage(ph.img, boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h);
    } else {
      setFont(ctx, 13, "400");
      ctx.fillStyle = FAINT;
      ctx.textAlign = "center";
      ctx.fillText(ph ? "画像を読み込めません" : "画像未登録", boxX + boxW / 2, boxY + boxH / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    /* ── 文字。見出し → 補足 → 価格 の順はアプリのカードと同じ ── */
    const textX = tall ? cx + pad : boxX + boxW + 16;
    const textW = tall ? innerW : cw - pad * 2 - boxW - 16;
    const center = tall;
    const anchor = center ? cx + cw / 2 : textX;
    ctx.textAlign = center ? "center" : "left";

    ctx.letterSpacing = "-0.01em";
    setFont(ctx, tier.name, "600");
    const nameLines = wrap(ctx, it.name, textW);
    ctx.letterSpacing = "0px";
    const nameH = nameLines.length * tier.name * 1.25;
    const periodH = tier.period * 1.5;
    const priceH = tier.price * 1.35;
    const badgeH = it.exceptions.length ? Math.max(12, tier.period - 1) * 1.1 + 8 : 0;
    const blockH = nameH + 6 + periodH + 6 + priceH + (badgeH ? 8 + badgeH : 0);

    let ty = center ? boxY + boxH + 16 : cy + (ch - blockH) / 2;

    ctx.letterSpacing = "-0.01em";
    setFont(ctx, tier.name, "600");
    ctx.fillStyle = INK;
    for (const ln of nameLines) {
      ty += tier.name * 1.25;
      ctx.fillText(ln, anchor, ty - tier.name * 0.3);
    }
    ctx.letterSpacing = "0px";
    ty += 6;

    setFont(ctx, tier.period, "400");
    ctx.fillStyle = SUB;
    ty += periodH;
    ctx.fillText(it.period, anchor, ty - tier.period * 0.38);
    ty += 6;

    /* 価格は数字を等幅に（アプリと同じ tabular-nums） */
    const tax = it.hasPrice ? "（税込）" : "";
    setFont(ctx, tier.price, "600");
    ctx.fontVariantCaps = "normal";
    const priceW = ctx.measureText(it.price).width;
    setFont(ctx, tier.period, "400");
    const taxW = tax ? ctx.measureText(tax).width + 6 : 0;
    const startX = center ? anchor - (priceW + taxW) / 2 : anchor;
    ty += priceH;
    ctx.textAlign = "left";
    setFont(ctx, tier.price, "600");
    ctx.fillStyle = INK;
    ctx.fillText(it.price, startX, ty - tier.price * 0.32);
    if (tax) {
      setFont(ctx, tier.period, "400");
      ctx.fillStyle = SUB;
      ctx.fillText(tax, startX + priceW + 6, ty - tier.price * 0.32);
    }

    /* 店舗別の価格は、アプリと同じ小さな印（badge）で添える */
    if (it.exceptions.length) {
      const size = Math.max(12, tier.period - 1);
      setFont(ctx, size, "500");
      const label = it.exceptions.join("／");
      const w = ctx.measureText(label).width + 20;
      const h = size * 1.1 + 8;
      const bx = center ? cx + cw / 2 - w / 2 : anchor;
      ty += 8;
      ctx.fillStyle = T.stone100;
      roundRect(ctx, bx, ty, w, h, h / 2);
      ctx.fill();
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 1;
      roundRect(ctx, bx + 0.5, ty + 0.5, w - 1, h - 1, h / 2);
      ctx.stroke();
      ctx.fillStyle = T.stone600;
      ctx.textAlign = "center";
      ctx.fillText(label, bx + w / 2, ty + h / 2 + size * 0.36);
      ctx.textAlign = "left";
    }
    ctx.textAlign = "left";
  });

  /* ── 下の帯。アプリの面の区切りと同じ薄い線＋補足の文章 ── */
  const fy = PAPER_H - FOOTER_H;
  ctx.fillStyle = T.line;
  ctx.fillRect(0, fy, PAPER_W, 1);
  setFont(ctx, 12, "400");
  ctx.fillStyle = SUB;
  ctx.fillText("※販売期間・価格は変更になる場合があります。", 0, PAPER_H - 8);
  ctx.textAlign = "right";
  ctx.fillStyle = FAINT;
  ctx.fillText("Age.3", PAPER_W, PAPER_H - 8);
  ctx.textAlign = "left";

  return canvas;
}

/* ------------------------------ PDFに包む ------------------------------ */

function bytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/**
 * JPEG 1枚を、A4たて1ページのPDFにする。
 * PDFの中では JPEG をそのまま持てる（DCTDecode）ので、画質を落とさずに包める。
 */
export function jpegToA4Pdf(jpeg: Uint8Array, wpx: number, hpx: number): Blob {
  const W = 595.28; // 210mm をポイントで
  const H = 841.89; // 297mm
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (u: Uint8Array) => {
    parts.push(u);
    pos += u.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = pos;
    push(bytes(`${n} 0 obj\n${body}\n`));
    if (stream) {
      push(bytes("stream\n"));
      push(stream);
      push(bytes("\nendstream\n"));
    }
    push(bytes("endobj\n"));
  };

  push(bytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  );
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${wpx} /Height ${hpx} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    jpeg
  );
  const content = `q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ`;
  obj(5, `<< /Length ${content.length} >>`, bytes(content));

  const xref = pos;
  let x = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  x += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(bytes(x));

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** canvas → JPEG のバイト列 */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像を作れませんでした"));
          return;
        }
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
      },
      "image/jpeg",
      quality
    );
  });
}

/** ふつうのダウンロードとして保存する */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
