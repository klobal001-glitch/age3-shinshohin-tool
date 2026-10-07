"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProductInfo } from "@/lib/types";
import { isBlankIngredientRow } from "@/lib/productInfo";
import { isFullBleed, pickProductThumb } from "@/lib/visualThumb";
import { toThumbnailUrl } from "@/lib/imageUrl";
import { photoThumbUrl } from "./IngredientPhoto";
import { btn } from "@/lib/ui";

/**
 * 詳細スペックの見出し。この言葉のうしろに「：」が続いたら、そこから新しい行にする。
 * スプレッドシートから貼ったスペックは1行に全部つながっていて、そのままでは読めないため。
 */
const SPEC_LABELS = [
  "商品名",
  "表記名",
  "ブランド",
  "メーカー",
  "原材料名",
  "原材料",
  "用途区分",
  "形状",
  "内容総量",
  "内容量",
  "固形量",
  "規格",
  "特徴",
  "それ以外",
  "保存方法",
  "使用目安",
  "使用方法",
  "注意事項",
  "補足",
  "開封前賞味期限",
  "賞味期限",
  "栄養成分",
  "アレルゲン",
  "原産国",
  "用途",
  "Product Name",
  "Label Name",
  "Brand",
  "Manufacturer",
  "Ingredients",
  "Category",
  "Form",
  "Net Weight",
  "Drained Weight",
  "Features",
  "Usage",
  "Storage",
  "Use",
  "Allergens",
  "Allergen",
  "Country of Origin",
  "Caution",
  "Note",
  "Additional Information",
  "Shelf Life Before Opening",
  "Recommended Usage",
  "Nutrition",
];

/**
 * 詰まったスペックの文章を、読める形に折り返す。
 * 元のデータは変えない。提出シートに出すときだけ通す。
 */
export function formatSpecText(raw: string): string {
  let t = raw.replace(/\r/g, " ").trim();
  if (!t) return "";

  /* 「---」は日本語と英語の境目 */
  t = t.replace(/\s*-{3,}\s*/g, "\n\n");
  /* 箇条書きの「・」と注記の「※」は、そこから新しい行にする */
  t = t.replace(/\s*・\s*/g, "\n・");
  t = t.replace(/\s*※\s*/g, "\n※");
  /* 「商品名：」のような見出しは行の先頭に出す。かっこの中のものは折らない */
  for (const label of SPEC_LABELS) {
    /* 見出しの前の空白だけを詰める（改行は残す）。コロンのあとの空白は1つにそろえる */
    t = t.replace(new RegExp(`(?<![（(\\w])[^\\S\\n]*(${label})[^\\S\\n]*([:：])[^\\S\\n]*`, "g"), "\n$1$2 ");
  }

  return t
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim();
}

/** 英語のかたまりが始まる目印 */
const EN_HEAD = /(?<![（(\w])\s*(Product Name|Label Name|Manufacturer|Ingredients)\s*:/;

/**
 * スペックの文章を、日本語のかたまりと英語のかたまりに分ける。
 *
 * 入力は1つの欄に日本語と英語をまとめて貼ってあり、間に「---」が入っていることが多い。
 * 提出先が国内か海外かで要るほうが違うので、出すときに分けられるようにする。
 */
export function splitSpecByLanguage(raw: string): { ja: string; en: string } {
  const t = raw.replace(/\r/g, " ").trim();
  if (!t) return { ja: "", en: "" };

  /* 「---」があれば、そこが境目 */
  const parts = t.split(/\s*-{3,}\s*/);
  if (parts.length >= 2) {
    return { ja: formatSpecText(parts[0]), en: formatSpecText(parts.slice(1).join(" ")) };
  }

  /* 無ければ、英語の見出しが始まるところで分ける */
  const at = t.search(EN_HEAD);
  if (at > 0) return { ja: formatSpecText(t.slice(0, at)), en: formatSpecText(t.slice(at)) };
  if (at === 0) return { ja: "", en: formatSpecText(t) };

  return { ja: formatSpecText(t), en: "" };
}

/** 画像のそばに添える注意書き */
const PACKAGE_NOTE_JA = "※パッケージは変更になる場合がございます。";
const PACKAGE_NOTE_EN = "*Packaging may change without notice.";

/**
 * 材料の「提出シート」。
 *
 * 入力用の表は、欄が細くて写真も小さく、人に渡すには向かない。
 * デザイン班や事務に渡すときに見たいのは「どの食材を・何グラム・どんな商品か」なので、
 * それを大きく並べ直して、そのまま紙やPDFにできるようにする。
 *
 * - いちばん上に完成品の絵を出す（何の商品の材料かが一目で分かる）
 * - 材料の写真は切り取らない。パッケージの文字まで見えないと、買う人が迷うため
 * - スペックの文章は見出しごとに折り返す（`formatSpecText`）
 * - 日本語と英語は分けて出せる（国内に出すか、海外に出すかで要るほうが違う）
 *
 * 画面の後ろ側は刷らない（globals.css の `body.submit-open` を参照）。
 */
export function IngredientSubmitSheet({
  productName,
  info,
  onClose,
}: {
  productName: string;
  info: ProductInfo;
  onClose: () => void;
}) {
  /* 空の行は渡さない */
  const list = useMemo(() => info.ingredients.filter((r) => !isBlankIngredientRow(r)), [info.ingredients]);
  const card = useMemo(() => pickProductThumb(info), [info]);
  /** どちらの言語で出すか。both = 両方並べる */
  const [lang, setLang] = useState<"both" | "ja" | "en">("both");
  const showJa = lang !== "en";
  const showEn = lang !== "ja";
  const paperRef = useRef<HTMLDivElement>(null);

  /**
   * 印刷する。
   *
   * 中身の量を見て、A4で1枚に収めるか2枚にするかを自動で決める。
   * 1枚に押し込むために文字が読めなくなるのは本末転倒なので、
   * 縮める下限（MIN_SCALE）を決めてあり、それより小さくはしない。
   * 下限でも1枚に入らないときは2枚にする。行の途中で改ページしない指定は globals.css 側。
   * （A4 = 210×297mm。余白10mmを引いた中身の大きさを px に直した値）
   */
  const printSheet = () => {
    const paper = paperRef.current;
    if (!paper) {
      window.print();
      return;
    }
    const PAGE_W = 718; // 190mm
    const PAGE_H = 1048; // 277mm
    /* これ以上小さくすると紙の上で読めない（説明文がおよそ7ポイントになる大きさ） */
    const MIN_SCALE = 0.85;
    /* 2枚に収まったと見なす高さ。改ページの余りがあるので2枚ぶんより少し小さく見る */
    const TWO_PAGES = PAGE_H * 1.9;
    const keep = { width: paper.style.width, maxWidth: paper.style.maxWidth, zoom: paper.style.zoom };
    /* 画面の見た目は変えずに、刷るときだけ少し詰めて組み直す（globals.css の .compact） */
    paper.classList.add("compact");

    /**
     * 縮尺 z で刷ったときの高さ。
     * 幅を PAGE_W / z で組んでから z 倍に縮めるので、刷り上がりの幅はいつも紙いっぱいになる。
     * 単純に縮めるだけだと右側が余って、文字だけが無駄に小さくなる。
     */
    const heightAt = (z: number) => {
      const w = PAGE_W / z;
      paper.style.width = `${w}px`;
      paper.style.maxWidth = `${w}px`;
      paper.style.zoom = "1";
      return paper.scrollHeight * z;
    };

    const full = heightAt(1);

    /** limit の高さに収まる、いちばん大きい縮尺。下限でも収まらなければ 0 */
    const fit = (limit: number) => {
      if (full <= limit) return 1;
      if (heightAt(MIN_SCALE) > limit) return 0;
      let lo = MIN_SCALE;
      let hi = 1;
      let found = MIN_SCALE;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        if (heightAt(mid) <= limit) {
          found = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return found;
    };

    /* まず1枚、無理なら2枚、それでも無理ならいちばん小さい大きさで刷る */
    const best = fit(PAGE_H) || fit(TWO_PAGES) || MIN_SCALE;

    paper.style.width = `${PAGE_W / best}px`;
    paper.style.maxWidth = `${PAGE_W / best}px`;
    paper.style.zoom = String(best);
    window.print();
    window.setTimeout(() => {
      paper.classList.remove("compact");
      paper.style.width = keep.width;
      paper.style.maxWidth = keep.maxWidth;
      paper.style.zoom = keep.zoom;
    }, 300);
  };

  useEffect(() => {
    document.body.classList.add("submit-open");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("submit-open");
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copyText = async () => {
    const lines = list.map((r, i) => {
      const spec = r.specs
        .filter((s) => s.trim())
        .map((s) => {
          const pair = splitSpecByLanguage(s);
          return [showJa ? pair.ja : "", showEn ? pair.en : ""].filter(Boolean).join("\n\n");
        })
        .join("\n");
      const name = [showJa ? r.nameJa : "", showEn && r.nameEn ? r.nameEn : ""]
        .filter(Boolean)
        .join(" / ");
      const note = showJa ? PACKAGE_NOTE_JA : PACKAGE_NOTE_EN;
      return [`${i + 1}. ${name}　${r.amount}`, spec, note].filter(Boolean).join("\n");
    });
    try {
      await navigator.clipboard.writeText(`【${productName}】材料\n\n${lines.join("\n\n")}`);
      alert("文字をコピーしました");
    } catch {
      alert("コピーできませんでした");
    }
  };

  const today = new Date().toLocaleDateString("ja-JP");

  return createPortal(
    <div className="submit-sheet fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 p-3 sm:p-6">
      <div
        ref={paperRef}
        className="submit-paper mx-auto w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl sm:p-8"
      >
        {/* 上の操作。紙には出さない */}
        <div className="sheet-controls mb-5 flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" className={btn("primary")} onClick={printSheet}>
            🖨 印刷・PDFで保存
          </button>
          <button type="button" className={btn("secondary")} onClick={copyText}>
            📋 文字をコピー
          </button>
          {/* 出す言語。国内に渡すか海外に渡すかで、要るほうだけにできる */}
          <div className="flex items-center gap-1 rounded-full bg-stone-100 p-1">
            {(
              [
                ["both", "両方"],
                ["ja", "日本語"],
                ["en", "English"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  lang === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
                onClick={() => setLang(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={`${btn("quiet")} ml-auto`} onClick={onClose}>
            閉じる
          </button>
        </div>

        {/* 見出し。完成品の絵を添えて、何の材料かを一目で分かるようにする */}
        <div className="sheet-title mb-5 flex items-center gap-4 border-b border-stone-200 pb-4">
          {card && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={toThumbnailUrl(card.url)}
              alt=""
              className={`sheet-cover h-32 w-32 shrink-0 rounded-xl border border-stone-200 bg-white md:h-56 md:w-56 ${
                isFullBleed(card) ? "object-cover" : "object-contain p-1"
              }`}
            />
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
              {showJa || !info.nameEn ? productName : info.nameEn}
            </h2>
            {showEn && info.nameEn && showJa && (
              <p className="mt-1 text-sm text-stone-500">{info.nameEn}</p>
            )}
            <p className="mt-2 text-xs text-stone-400">
              {lang === "en"
                ? `Ingredient sheet　${today}　${list.length} items`
                : `材料シート（提出用）　${today}　全${list.length}品`}
            </p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl bg-stone-100 px-4 py-8 text-center text-sm text-stone-500">
            {lang === "en" ? "No ingredients yet." : "材料がまだ入っていません。"}
          </p>
        ) : (
          <div className="space-y-3">
            {/* 見出し。画面が広いときだけ出す */}
            <div className="ing-head hidden gap-3 border-b border-stone-300 pb-1 text-xs font-medium text-stone-400 md:grid md:grid-cols-[24px_152px_140px_64px_1fr]">
              <span className="md:border-r md:border-stone-200/70 md:pr-3" />
              <span className="md:border-r md:border-stone-200/70 md:pr-3">{lang === "en" ? "Photo" : "写真"}</span>
              <span className="md:border-r md:border-stone-200/70 md:pr-3">{lang === "en" ? "Item" : "品名"}</span>
              <span className="md:border-r md:border-stone-200/70 md:pr-3">{lang === "en" ? "Amount" : "分量"}</span>
              <span>{lang === "en" ? "Details" : "詳細スペック"}</span>
            </div>

            {list.map((r, i) => {
              const hasSpec = r.specs.some((x) => x.trim());
              return (
              <div
                key={i}
                className="ing-row grid grid-cols-[124px_1fr] items-start gap-3 rounded-xl border border-stone-200 p-3 md:grid-cols-[24px_152px_140px_64px_1fr] md:items-stretch md:gap-3 md:rounded-none md:border-0 md:border-b md:border-stone-200 md:p-0 md:pb-4 md:pt-3"
              >
                <span className="col-span-2 text-xs tabular-nums text-stone-400 md:col-span-1 md:border-r md:border-stone-200/70 md:pr-3">
                  {i + 1}
                </span>

                <div className="md:border-r md:border-stone-200/70 md:pr-3">
                  {/* 詳しい説明が無い材料は、場所を取らないよう写真を小さくする */}
                  {r.photoUrl ? (
                    /* 切り取らずに全体を出す。パッケージの文字まで見えないと買うときに迷う */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photoThumbUrl(r.photoUrl, 480, "contain")}
                      alt=""
                      className={`ing-photo rounded-lg border border-stone-200 bg-white object-contain p-1 ${
                        hasSpec
                          ? "h-[124px] w-[124px] md:h-[152px] md:w-[152px]"
                          : "ing-photo-sm h-[80px] w-[80px] md:h-[96px] md:w-[96px]"
                      }`}
                    />
                  ) : (
                    <span className="ing-photo ing-photo-sm flex h-[80px] w-[80px] items-center justify-center rounded-lg border border-dashed border-stone-200 text-[10px] text-stone-300 md:h-[96px] md:w-[96px]">
                      写真なし
                    </span>
                  )}
                  {/* 中身は同じでも袋や瓶の見た目は変わるので、買う人が迷わないよう添える。
                      ただし詳細スペックが無い材料（揚げパンなど、仕入れの袋物ではないもの）には出さない */}
                  {r.photoUrl && hasSpec && (
                    <div className="ing-photo-note mt-1 w-[124px] md:w-[152px]">
                      {showJa && (
                        <p className="text-[9px] leading-tight text-stone-400">{PACKAGE_NOTE_JA}</p>
                      )}
                      {showEn && (
                        <p className="text-[9px] leading-tight text-stone-400">{PACKAGE_NOTE_EN}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 md:border-r md:border-stone-200/70 md:pr-3">
                  {showJa && (
                    <p className="text-[15px] font-semibold leading-snug text-stone-900">{r.nameJa}</p>
                  )}
                  {showEn && r.nameEn && (
                    <p
                      className={
                        showJa
                          ? "text-xs leading-snug text-stone-500"
                          : "text-[15px] font-semibold leading-snug text-stone-900"
                      }
                    >
                      {r.nameEn}
                    </p>
                  )}
                  {!showJa && !r.nameEn && (
                    <p className="text-[15px] font-semibold leading-snug text-stone-900">{r.nameJa}</p>
                  )}
                  {/* 画面が狭いときは分量を品名の下に出す（横に並べると文字が潰れるため） */}
                  <p className="ing-amount-sp mt-1 text-sm font-semibold tabular-nums text-amber-800 md:hidden">
                    {r.amount}
                  </p>
                </div>

                <p className="ing-amount hidden text-sm font-semibold tabular-nums text-amber-800 md:block md:border-r md:border-stone-200/70 md:pr-3">
                  {r.amount}
                </p>

                <div className="col-span-2 min-w-0 space-y-2 md:col-span-1">
                  {r.specs.filter((s) => s.trim()).length === 0 ? (
                    <span className="text-xs text-stone-300">—</span>
                  ) : (
                    r.specs
                      .filter((s) => s.trim())
                      .map((s, si) => {
                        const pair = splitSpecByLanguage(s);
                        /* 選んだ言語のほうが書かれていないときは、書いてあるほうを出す
                           （何も出ないと「スペックが無い」と読み違えるため） */
                        const jaBlock = showJa && pair.ja;
                        const enBlock = showEn && pair.en;
                        const fallback = !jaBlock && !enBlock ? pair.ja || pair.en : "";
                        return (
                          <div key={si} className="ing-spec-pair space-y-2">
                            {jaBlock && (
                              <div>
                                {enBlock && (
                                  <p className="mb-0.5 text-[10px] font-semibold text-stone-400">
                                    日本語
                                  </p>
                                )}
                                <p className="ing-spec whitespace-pre-wrap text-[11px] leading-relaxed text-stone-600">
                                  {pair.ja}
                                </p>
                              </div>
                            )}
                            {enBlock && (
                              <div>
                                {jaBlock && (
                                  <p className="mb-0.5 text-[10px] font-semibold text-stone-400">
                                    English
                                  </p>
                                )}
                                <p className="ing-spec whitespace-pre-wrap text-[11px] leading-relaxed text-stone-600">
                                  {pair.en}
                                </p>
                              </div>
                            )}
                            {fallback && (
                              <p className="ing-spec whitespace-pre-wrap text-[11px] leading-relaxed text-stone-600">
                                {fallback}
                              </p>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
