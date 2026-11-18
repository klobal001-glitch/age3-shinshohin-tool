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
/* アプリの画面（globals.css の --font-sans）とまったく同じ並びにする。
   **ヒラギノ角ゴが先頭。**数字と漢字を同じ書体でそろえるため
   （-apple-system を先頭にすると、数字だけ SF Pro になって不揃いに見える）。
   あちらを直したら、ここも必ず同じにすること */
const FONT =
  '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", ' +
  '"Noto Sans CJK JP", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, ' +
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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
  /** 「3月から引き続き販売中」など。今月発売の商品は null */
  note: string | null;
  photo: PhotoState | null;
}

/** カードの下に添える小さな印。継続のお知らせ → 店舗別の価格 の順 */
function badgesOf(it: PosterItem): string[] {
  return [...(it.note ? [it.note] : []), ...(it.exceptions.length ? [it.exceptions.join("／")] : [])];
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
  /* 肩書き。薄いと読めないので、濃く・太く・少し大きく出す */
  setFont(ctx, 15, "700");
  ctx.fillStyle = INK;
  ctx.letterSpacing = "0.04em";
  ctx.fillText("商品のご案内", logoW + 12, 8 + logoH - 5);
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
  put("の商品", 24, "600", SUB);

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
    setFont(ctx, tier.name, "700");
    const nameLines = wrap(ctx, it.name, textW);
    ctx.letterSpacing = "0px";
    const nameH = nameLines.length * tier.name * 1.25;
    const periodH = tier.period * 1.5;
    const priceH = tier.price * 1.35;
    const badges = badgesOf(it);
    const badgeSize = Math.max(12, tier.period - 1);
    const badgeOne = badgeSize * 1.1 + 8;
    /* 印は縦に積む。1つにつき高さ badgeOne ＋ 間隔4 */
    const badgeH = badges.length ? badges.length * badgeOne + (badges.length - 1) * 4 : 0;
    const blockH = nameH + 6 + periodH + 6 + priceH + (badgeH ? 8 + badgeH : 0);

    let ty = center ? boxY + boxH + 16 : cy + (ch - blockH) / 2;

    ctx.letterSpacing = "-0.01em";
    setFont(ctx, tier.name, "700");
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
    setFont(ctx, tier.price, "700");
    ctx.fontVariantCaps = "normal";
    const priceW = ctx.measureText(it.price).width;
    setFont(ctx, tier.period, "400");
    const taxW = tax ? ctx.measureText(tax).width + 6 : 0;
    const startX = center ? anchor - (priceW + taxW) / 2 : anchor;
    ty += priceH;
    ctx.textAlign = "left";
    setFont(ctx, tier.price, "700");
    ctx.fillStyle = INK;
    ctx.fillText(it.price, startX, ty - tier.price * 0.32);
    if (tax) {
      setFont(ctx, tier.period, "400");
      ctx.fillStyle = SUB;
      ctx.fillText(tax, startX + priceW + 6, ty - tier.price * 0.32);
    }

    /* 継続のお知らせと店舗別の価格は、アプリと同じ小さな印（badge）で添える */
    if (badges.length) {
      setFont(ctx, badgeSize, "500");
      ty += 8;
      badges.forEach((label, bi) => {
        const w = ctx.measureText(label).width + 20;
        const h = badgeOne;
        const bx = center ? cx + cw / 2 - w / 2 : anchor;
        const by = ty + bi * (h + 4);
        ctx.fillStyle = T.stone100;
        roundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = T.line;
        ctx.lineWidth = 1;
        roundRect(ctx, bx + 0.5, by + 0.5, w - 1, h - 1, h / 2);
        ctx.stroke();
        ctx.fillStyle = T.stone600;
        ctx.textAlign = "center";
        ctx.fillText(label, bx + w / 2, by + h / 2 + badgeSize * 0.36);
        ctx.textAlign = "left";
      });
    }
    ctx.textAlign = "left";
  });

  /* ── 下の帯。アプリの面の区切りと同じ薄い線＋補足の文章 ── */
  const fy = PAPER_H - FOOTER_H;
  ctx.fillStyle = T.line;
  ctx.fillRect(0, fy, PAPER_W, 1);
  /* お断りの一文。見落とされては困るので、濃く・太く出す */
  setFont(ctx, 14, "600");
  ctx.fillStyle = INK;
  ctx.fillText("※販売期間・価格は変更になる場合があります。", 0, PAPER_H - 8);
  ctx.textAlign = "right";
  setFont(ctx, 12, "400");
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
  return jpegsToA4Pdf([{ jpeg, wpx, hpx }]);
}

/**
 * 画像を1枚ずつA4たての1ページにして、1つのPDFにまとめる。
 *
 * 複数ページでも、**ページの区切りは絵の区切りそのもの**なので、
 * 文字が途中で切れたり、商品が改ページで分断されたりすることがない。
 */
export function jpegsToA4Pdf(
  pages: { jpeg: Uint8Array; wpx: number; hpx: number }[],
  landscape = false
): Blob {
  if (pages.length === 0) throw new Error("ページがありません");
  /* たては 210mm×297mm。よこは縦横を入れ替えるだけ（絵も横長で描いてある） */
  const W = landscape ? 841.89 : 595.28; // 210mm をポイントで
  const H = landscape ? 595.28 : 841.89; // 297mm
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

  /* 物の番号：1=目次 2=ページの束 3以降は1ページにつき3つ（ページ・画像・中身） */
  const n = pages.length;
  const pageObj = (k: number) => 3 + k * 3;
  const imgObj = (k: number) => 4 + k * 3;
  const contentObj = (k: number) => 5 + k * 3;
  const last = 2 + n * 3;

  push(bytes("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, k) => `${pageObj(k)} 0 R`).join(" ")}] /Count ${n} >>`
  );
  pages.forEach((pg, k) => {
    obj(
      pageObj(k),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
        `/Resources << /XObject << /Im0 ${imgObj(k)} 0 R >> >> /Contents ${contentObj(k)} 0 R >>`
    );
    obj(
      imgObj(k),
      `<< /Type /XObject /Subtype /Image /Width ${pg.wpx} /Height ${pg.hpx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>`,
      pg.jpeg
    );
    const content = `q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ`;
    obj(contentObj(k), `<< /Length ${content.length} >>`, bytes(content));
  });

  const xref = pos;
  let x = `xref\n0 ${last + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= last; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  x += `trailer\n<< /Size ${last + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
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

/**
 * 掲示の絵を、そのまま画像ファイル（JPEG）にする。
 * LINEなどへ送るとき、PDFは相手の端末で開きにくいので画像で渡す。
 * 中身はPDFと同じ絵を同じ手順で描いているので、**紙とズレることはない**。
 */
export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像を作れませんでした"))),
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

/* ------------------------------------------------------------------ *
 * 販売予定表・商品カードの形（A4たて・複数ページ）
 *
 * 店頭に貼るA4とは**用途が別**。
 * - **価格は載せない。**ScheduleItem に価格の項目そのものを作っていないので、
 *   あとからうっかり混ざることもない。
 * - 載せるのは 正式な商品画像・日本語の商品名・販売期間・選んだ期間のうち売っている月 だけ。
 *   担当・原価・仕入・社内の準備状況・内部メモは、渡す値に含めていない。
 * - 1ページ4件（2列×2段）。**写真をできるだけ大きく出すための枚数。**
 *   5件目からは次のページになる。
 *   **ページの区切りは絵の区切りそのもの**なので、商品が改ページで切れない。
 * ------------------------------------------------------------------ */

/** 資料に載せる1件。**価格の項目は作らない**（この資料に価格は出さないため） */
export interface ScheduleItem {
  name: string;
  /** 2026年11月1日 〜 2027年1月31日 */
  period: string;
  /** 選んだ期間のうち、売っている月。「11月〜1月」など */
  months: string;
  photo: PhotoState | null;
}

/** 1ページに載せる件数と、1つの資料の上限 */
export const SCHEDULE_PER_PAGE = 4;
export const SCHEDULE_MAX_PAGES = 8;
export const SCHEDULE_MAX = SCHEDULE_PER_PAGE * SCHEDULE_MAX_PAGES;

const SCH_HEADER_H = 118;
const SCH_FOOTER_H = 30;

/** 1ページぶんを描く */
async function drawSchedulePage(
  title: string,
  items: ScheduleItem[],
  page: number,
  pages: number,
  dpi: number
): Promise<HTMLCanvasElement> {
  const s = dpi / 96;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(A4_W * s);
  canvas.height = Math.round(A4_H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を用意できませんでした");

  ctx.fillStyle = T.canvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s, s);
  ctx.translate(PAPER_X, PAPER_Y);
  ctx.textBaseline = "alphabetic";

  /* ── 見出し。店頭A4と同じ組み方にして、同じ店の資料だと分かるようにする ── */
  const logo = await loadLogo();
  const logoH = 22;
  const logoW = (logoH * 1052) / 336;
  if (logo) ctx.drawImage(logo, 0, 8, logoW, logoH);
  /* 肩書き。薄いと読めないので、濃く・太く・少し大きく出す */
  setFont(ctx, 15, "700");
  ctx.fillStyle = INK;
  ctx.letterSpacing = "0.04em";
  ctx.fillText("商品予定のご案内", logoW + 12, 8 + logoH - 5);
  ctx.letterSpacing = "0px";

  ctx.letterSpacing = "-0.02em";
  setFont(ctx, 34, "700");
  ctx.fillStyle = INK;
  ctx.fillText(title, 0, 88);
  const tW = ctx.measureText(title).width;
  ctx.letterSpacing = "0px";
  setFont(ctx, 20, "600");
  ctx.fillStyle = SUB;
  ctx.fillText("の商品", tW + 12, 88);

  ctx.fillStyle = T.amber700;
  ctx.fillRect(0, SCH_HEADER_H - 14, 56, 3);
  ctx.fillStyle = T.line;
  ctx.fillRect(56, SCH_HEADER_H - 13, PAPER_W - 56, 1);

  /* ── 商品 ── */
  const cols = 2;
  const rows = 2;
  const gridH = PAPER_H - SCH_HEADER_H - SCH_FOOTER_H;
  const cellW = PAPER_W / cols;
  const cellH = gridH / rows;

  items.slice(0, SCHEDULE_PER_PAGE).forEach((it, i) => {
    const cx = (i % cols) * cellW;
    const cy = SCH_HEADER_H + Math.floor(i / cols) * cellH;
    const pad = 7;
    const x = cx + pad;
    const y = cy + pad;
    const w = cellW - pad * 2;
    const h = cellH - pad * 2;

    withCardShadow(ctx, () => {
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, x, y, w, h, 16);
      ctx.fill();
    });
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
    ctx.stroke();

    const ip = 14;
    const ix = x + ip;
    const iw = w - ip * 2;
    /* 写真をいちばん大きく取る。残りで名前（2行まで）・期間・月の印がちょうど収まる高さ */
    const ih = 272;
    const iy = y + ip;

    /* 写真。切り取らず、枠の中に収める（パッケージの文字が欠けないように） */
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 8);
    ctx.clip();
    ctx.fillStyle = T.stone50;
    ctx.fillRect(ix, iy, iw, ih);
    const ph = it.photo;
    if (ph?.readable && ph.img) {
      const nw = ph.img.naturalWidth || 1;
      const nh = ph.img.naturalHeight || 1;
      const k = Math.min((iw - 8) / nw, (ih - 8) / nh);
      ctx.drawImage(ph.img, ix + (iw - nw * k) / 2, iy + (ih - nh * k) / 2, nw * k, nh * k);
    } else {
      setFont(ctx, 12, "400");
      ctx.fillStyle = FAINT;
      ctx.textAlign = "center";
      ctx.fillText(ph ? "画像を読み込めません" : "画像未登録", ix + iw / 2, iy + ih / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    let ty = iy + ih + 12;

    /* 商品名。2行まで */
    ctx.letterSpacing = "-0.01em";
    setFont(ctx, 20, "700");
    ctx.fillStyle = INK;
    const lines = wrap(ctx, it.name, iw).slice(0, 2);
    for (const ln of lines) {
      ty += 20 * 1.25;
      ctx.fillText(ln, ix, ty - 20 * 0.3);
    }
    ctx.letterSpacing = "0px";

    /* 販売期間 */
    ty += 10;
    setFont(ctx, 14, "500");
    ctx.fillStyle = SUB;
    ty += 14 * 1.4;
    ctx.fillText(it.period, ix, ty - 14 * 0.38);

    /* 選んだ期間のうち売っている月 */
    if (it.months) {
      const size = 13;
      setFont(ctx, size, "500");
      const label = it.months;
      const bw = ctx.measureText(label).width + 20;
      const bh = size * 1.1 + 8;
      const by = ty + 8;
      ctx.fillStyle = T.stone100;
      roundRect(ctx, ix, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 1;
      roundRect(ctx, ix + 0.5, by + 0.5, bw - 1, bh - 1, bh / 2);
      ctx.stroke();
      ctx.fillStyle = T.stone600;
      ctx.textAlign = "center";
      ctx.fillText(label, ix + bw / 2, by + bh / 2 + size * 0.36);
      ctx.textAlign = "left";
    }
  });

  /* ── 下の帯 ── */
  const fy = PAPER_H - SCH_FOOTER_H;
  ctx.fillStyle = T.line;
  ctx.fillRect(0, fy, PAPER_W, 1);
  /* お断りの一文。見落とされては困るので、濃く・太く出す */
  setFont(ctx, 14, "600");
  ctx.fillStyle = INK;
  ctx.fillText("※販売期間は変更になる場合があります。", 0, PAPER_H - 8);
  setFont(ctx, 12, "400");
  ctx.textAlign = "center";
  ctx.fillStyle = FAINT;
  ctx.fillText(`${page} / ${pages}`, PAPER_W / 2, PAPER_H - 8);
  ctx.textAlign = "right";
  ctx.fillText("Age.3", PAPER_W, PAPER_H - 8);
  ctx.textAlign = "left";

  return canvas;
}

/** 資料のページをぜんぶ描く。7件目から次のページになる */
export async function drawSchedulePages(
  title: string,
  items: ScheduleItem[],
  dpi = 200
): Promise<HTMLCanvasElement[]> {
  const use = items.slice(0, SCHEDULE_MAX);
  const pages = Math.max(1, Math.ceil(use.length / SCHEDULE_PER_PAGE));
  const out: HTMLCanvasElement[] = [];
  for (let k = 0; k < pages; k++) {
    out.push(
      await drawSchedulePage(
        title,
        use.slice(k * SCHEDULE_PER_PAGE, (k + 1) * SCHEDULE_PER_PAGE),
        k + 1,
        pages,
        dpi
      )
    );
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 年間カレンダー（A4よこ）
 *
 * 1枚で「どの月に何が出るか」をひと目で見せるための形。
 * 月ごとの枠を並べ、その中に商品を小さく積む。
 * 商品カードの資料（A4たて・1ページ4件）とは**別の形**で、中身は同じ値から作る。
 *
 * 決めごと
 * - **価格・担当・原価・仕入・社内の準備状況は載せない**（商品カードの資料と同じ）。
 * - 日本語の下に英語を小さく添える。**訳すのは決まっている言葉だけ**で、
 *   商品名は訳さない（英語名が入っていない商品は、英語名を出さない）。
 * - 写真が読めない商品は、絵を作らずに「準備中／In preparation」の枠で出す。
 * - 枠に入りきらない商品は「ほか◯品」と数で出す。勝手に減らしたように見せない。
 * ------------------------------------------------------------------ */

/** A4よこ。たての縦横を入れ替えただけ */
export const A4_LAND_W = A4_H;
export const A4_LAND_H = A4_W;
export const PAPER_LW = 1047; // 277mm
export const PAPER_LH = 718; // 190mm

/** 1ページに並べる月の数（4列×3段） */
export const CAL_COLS = 4;
export const CAL_ROWS = 3;
export const CAL_MONTHS_PER_PAGE = CAL_COLS * CAL_ROWS;

export interface CalendarItem {
  /** 日本語の商品名 */
  name: string;
  /** 正式な英語名。入っていなければ空 */
  nameEn: string;
  /** 選んだ期間のうち売っている月。「11月〜1月」 */
  months: string;
  /** その英語。「Nov.–Jan.」 */
  monthsEn: string;
  photo: PhotoState | null;
}

export interface CalendarMonth {
  year: number;
  month: number;
  items: CalendarItem[];
}

const CAL_HEADER_H = 104;
const CAL_FOOTER_H = 28;
const CAL_GAP = 10;
const CAL_BAR_H = 34;

/** 1行に収まらない文字は、後ろを「…」にして切る */
function clip1(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxW) out = out.slice(0, -1);
  return out + "…";
}

/** 月の枠を1つ描く */
function drawCalendarCell(
  ctx: CanvasRenderingContext2D,
  m: CalendarMonth,
  x: number,
  y: number,
  w: number,
  h: number
) {
  /* 枠 */
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = T.line;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10);
  ctx.stroke();

  /* 月の帯。濃い地に白文字で、月が先に目に入るようにする */
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, CAL_BAR_H);
  ctx.restore();

  setFont(ctx, 20, "700");
  ctx.fillStyle = "#ffffff";
  ctx.letterSpacing = "-0.02em";
  const mLabel = `${m.month}月`;
  ctx.fillText(mLabel, x + 12, y + CAL_BAR_H / 2 + 7);
  const mW = ctx.measureText(mLabel).width;
  ctx.letterSpacing = "0px";
  setFont(ctx, 11, "500");
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(String(m.year), x + 12 + mW + 6, y + CAL_BAR_H / 2 + 6);
  setFont(ctx, 11, "500");
  ctx.textAlign = "right";
  ctx.fillText(EN_MONTH_NAMES[m.month - 1] ?? "", x + w - 12, y + CAL_BAR_H / 2 + 6);
  ctx.textAlign = "left";

  /* 中身 */
  const pad = 8;
  const ix = x + pad;
  const iw = w - pad * 2;
  const top = y + CAL_BAR_H + pad;
  const avail = h - CAL_BAR_H - pad * 2;
  const rowH = 46;
  const fits = Math.max(1, Math.floor(avail / rowH));
  const extra = m.items.length - fits;
  /* 「ほか◯品」を出すぶん、1行ぶん空ける */
  const show = extra > 0 ? m.items.slice(0, Math.max(0, fits - 1)) : m.items.slice(0, fits);

  if (m.items.length === 0) {
    setFont(ctx, 11, "400");
    ctx.fillStyle = FAINT;
    ctx.fillText("この月の商品はありません", ix, top + 16);
    setFont(ctx, 9, "400");
    ctx.fillText("No items for this month", ix, top + 30);
    return;
  }

  show.forEach((it, i) => {
    const ry = top + i * rowH;
    /* Instagram の画像は縦長（1080×1350）。枠も縦長にすると、同じ幅でも大きく見える */
    const tw0 = 32;
    const th0 = 40;
    /* 写真。切り取らず枠に収める（パッケージの文字が欠けないように） */
    ctx.save();
    roundRect(ctx, ix, ry, tw0, th0, 6);
    ctx.clip();
    ctx.fillStyle = T.stone50;
    ctx.fillRect(ix, ry, tw0, th0);
    const ph = it.photo;
    if (ph?.readable && ph.img) {
      const nw = ph.img.naturalWidth || 1;
      const nh = ph.img.naturalHeight || 1;
      const k = Math.min(tw0 / nw, th0 / nh);
      ctx.drawImage(ph.img, ix + (tw0 - nw * k) / 2, ry + (th0 - nh * k) / 2, nw * k, nh * k);
    }
    ctx.restore();
    if (!(ph?.readable && ph.img)) {
      /* 絵が無いときは破線の枠に「準備中」。代わりの絵は作らない */
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = T.amber700;
      ctx.lineWidth = 1;
      roundRect(ctx, ix + 0.5, ry + 0.5, tw0 - 1, th0 - 1, 6);
      ctx.stroke();
      ctx.restore();
      setFont(ctx, 8, "600");
      ctx.fillStyle = T.amber700;
      ctx.textAlign = "center";
      ctx.fillText("準備中", ix + tw0 / 2, ry + th0 / 2 - 1);
      setFont(ctx, 6, "400");
      ctx.fillText("in prep.", ix + tw0 / 2, ry + th0 / 2 + 9);
      ctx.textAlign = "left";
    }

    const tx = ix + tw0 + 8;
    const tw = iw - tw0 - 8;
    setFont(ctx, 12, "700");
    ctx.fillStyle = INK;
    ctx.letterSpacing = "-0.01em";
    ctx.fillText(clip1(ctx, it.name, tw), tx, ry + 12);
    ctx.letterSpacing = "0px";
    if (it.nameEn) {
      setFont(ctx, 9, "400");
      ctx.fillStyle = SUB;
      ctx.fillText(clip1(ctx, it.nameEn, tw), tx, ry + 24);
    }
    if (it.months) {
      setFont(ctx, 9, "600");
      ctx.fillStyle = T.amber700;
      const jp = it.months;
      ctx.fillText(clip1(ctx, jp, tw), tx, ry + 36);
      const jw = ctx.measureText(jp).width;
      if (it.monthsEn && jw + 8 < tw) {
        setFont(ctx, 8, "400");
        ctx.fillStyle = FAINT;
        ctx.fillText(clip1(ctx, it.monthsEn, tw - jw - 8), tx + jw + 8, ry + 36);
      }
    }
  });

  if (extra > 0) {
    const ry = top + show.length * rowH;
    setFont(ctx, 10, "600");
    ctx.fillStyle = SUB;
    ctx.fillText(`ほか${extra}品`, ix, ry + 12);
    setFont(ctx, 8, "400");
    ctx.fillStyle = FAINT;
    ctx.fillText(`${extra} more`, ix, ry + 24);
  }
}

const EN_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 年間カレンダーを1ページぶん描く */
async function drawYearCalendarPage(
  title: string,
  titleEn: string,
  months: CalendarMonth[],
  page: number,
  pages: number,
  dpi: number
): Promise<HTMLCanvasElement> {
  const s = dpi / 96;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(A4_LAND_W * s);
  canvas.height = Math.round(A4_LAND_H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を用意できませんでした");

  ctx.fillStyle = T.canvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(s, s);
  ctx.translate(PAPER_X, PAPER_Y);
  ctx.textBaseline = "alphabetic";

  /* ── 見出し ── */
  const logo = await loadLogo();
  const logoH = 20;
  const logoW = (logoH * 1052) / 336;
  if (logo) ctx.drawImage(logo, 0, 2, logoW, logoH);
  setFont(ctx, 11, "700");
  ctx.fillStyle = T.amber700;
  ctx.letterSpacing = "0.12em";
  ctx.fillText("SEASON SANDWICH", logoW + 10, 2 + logoH - 5);
  ctx.letterSpacing = "0px";

  /* 右上の断り書き。見落とされては困るので、濃い地に白で出す */
  const bw = 282;
  const bh = 48;
  const bx = PAPER_LW - bw;

  /* 題。**右上の断り書きに重ならないところまでしか書かない。**
     書体によって字の幅が変わる（Macのヒラギノは幅が広い）ので、
     入る大きさになるまで1ptずつ小さくする */
  const titleText = `シーズン揚げサンド　販売予定　${title}`;
  const titleMax = bx - 20;
  ctx.letterSpacing = "-0.02em";
  let tSize = 27;
  setFont(ctx, tSize, "700");
  while (tSize > 16 && ctx.measureText(titleText).width > titleMax) {
    tSize -= 1;
    setFont(ctx, tSize, "700");
  }
  ctx.fillStyle = INK;
  ctx.fillText(clip1(ctx, titleText, titleMax), 0, 56);
  ctx.letterSpacing = "0px";

  const subText = `Seasonal Fried Sandwich　Sales Plan　${titleEn}`;
  setFont(ctx, 12, "500");
  ctx.fillStyle = SUB;
  ctx.fillText(clip1(ctx, subText, titleMax), 0, 76);

  ctx.fillStyle = INK;
  roundRect(ctx, bx, 6, bw, bh, 8);
  ctx.fill();
  setFont(ctx, 13, "700");
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText("販売予定（変更の可能性あり）", bx + bw / 2, 26);
  setFont(ctx, 10, "400");
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText("Sales plan (subject to change)", bx + bw / 2, 41);
  ctx.textAlign = "left";

  ctx.fillStyle = T.amber700;
  ctx.fillRect(0, CAL_HEADER_H - 14, 56, 3);
  ctx.fillStyle = T.line;
  ctx.fillRect(56, CAL_HEADER_H - 13, PAPER_LW - 56, 1);

  /* ── 月の枠 ── */
  const rows = Math.max(1, Math.ceil(months.length / CAL_COLS));
  const gridH = PAPER_LH - CAL_HEADER_H - CAL_FOOTER_H;
  const cellW = (PAPER_LW - CAL_GAP * (CAL_COLS - 1)) / CAL_COLS;
  const even = (gridH - CAL_GAP * (rows - 1)) / rows;

  /* 段の高さは、その段でいちばん品数が多い月に合わせる。
     商品が少ないときに、空っぽの大きな枠が並ばないようにするため。
     全部を足しても紙に収まらないときは、これまでどおり等分にする
     （入りきらないぶんは枠の中で「ほか◯品」と数で出る） */
  const needs = Array.from({ length: rows }, (_, r) => {
    const inRow = months.slice(r * CAL_COLS, (r + 1) * CAL_COLS);
    const most = Math.max(1, ...inRow.map((m) => m.items.length));
    return CAL_BAR_H + 16 + Math.min(most, 4) * 46;
  });
  const total = needs.reduce((a, b) => a + b, 0) + CAL_GAP * (rows - 1);
  const heights = total <= gridH ? needs : needs.map(() => even);

  let cy = CAL_HEADER_H;
  for (let r = 0; r < rows; r++) {
    const h = heights[r];
    months.slice(r * CAL_COLS, (r + 1) * CAL_COLS).forEach((m, i) => {
      drawCalendarCell(ctx, m, i * (cellW + CAL_GAP), cy, cellW, h);
    });
    cy += h + CAL_GAP;
  }

  /* ── 下の帯 ── */
  const fy = PAPER_LH - CAL_FOOTER_H;
  ctx.fillStyle = T.line;
  ctx.fillRect(0, fy, PAPER_LW, 1);
  setFont(ctx, 12, "600");
  ctx.fillStyle = INK;
  ctx.fillText("※販売期間は変更になる場合があります。写真はイメージです。", 0, PAPER_LH - 12);
  setFont(ctx, 9, "400");
  ctx.fillStyle = FAINT;
  ctx.fillText("Sales periods may change. Photos are for illustration only.", 0, PAPER_LH - 1);
  setFont(ctx, 10, "400");
  ctx.fillStyle = FAINT;
  ctx.textAlign = "center";
  ctx.fillText(`${page} / ${pages}`, PAPER_LW / 2, PAPER_LH - 6);
  ctx.textAlign = "right";
  ctx.fillText("Age.3", PAPER_LW, PAPER_LH - 6);
  ctx.textAlign = "left";

  return canvas;
}

/** 年間カレンダーのページをぜんぶ描く。13か月目から次のページになる */
export async function drawYearCalendarPages(
  title: string,
  titleEn: string,
  months: CalendarMonth[],
  dpi = 200
): Promise<HTMLCanvasElement[]> {
  const pages = Math.max(1, Math.ceil(months.length / CAL_MONTHS_PER_PAGE));
  const out: HTMLCanvasElement[] = [];
  for (let k = 0; k < pages; k++) {
    out.push(
      await drawYearCalendarPage(
        title,
        titleEn,
        months.slice(k * CAL_MONTHS_PER_PAGE, (k + 1) * CAL_MONTHS_PER_PAGE),
        k + 1,
        pages,
        dpi
      )
    );
  }
  return out;
}
