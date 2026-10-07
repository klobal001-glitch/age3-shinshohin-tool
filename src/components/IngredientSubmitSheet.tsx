"use client";

import { useEffect, useMemo } from "react";
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
        .map((s) => formatSpecText(s))
        .join("\n");
      return [`${i + 1}. ${r.nameJa}${r.nameEn ? `（${r.nameEn}）` : ""}　${r.amount}`, spec]
        .filter(Boolean)
        .join("\n");
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
      <div className="submit-paper mx-auto w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl sm:p-8">
        {/* 上の操作。紙には出さない */}
        <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" className={btn("primary")} onClick={() => window.print()}>
            🖨 印刷・PDFで保存
          </button>
          <button type="button" className={btn("secondary")} onClick={copyText}>
            📋 文字をコピー
          </button>
          <button type="button" className={`${btn("quiet")} ml-auto`} onClick={onClose}>
            閉じる
          </button>
        </div>

        {/* 見出し。完成品の絵を添えて、何の材料かを一目で分かるようにする */}
        <div className="mb-5 flex items-center gap-4 border-b border-stone-200 pb-4">
          {card && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={toThumbnailUrl(card.url)}
              alt=""
              className={`h-24 w-24 shrink-0 rounded-xl border border-stone-200 bg-white ${
                isFullBleed(card) ? "object-cover" : "object-contain p-1"
              }`}
            />
          )}
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{productName}</h2>
            {info.nameEn && <p className="mt-1 text-sm text-stone-500">{info.nameEn}</p>}
            <p className="mt-2 text-xs text-stone-400">
              材料シート（提出用）　{today}　全{list.length}品
            </p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl bg-stone-100 px-4 py-8 text-center text-sm text-stone-500">
            材料がまだ入っていません。
          </p>
        ) : (
          <div className="space-y-3">
            {/* 見出し。画面が広いときだけ出す */}
            <div className="hidden gap-4 border-b border-stone-200 pb-1 text-xs font-medium text-stone-400 md:grid md:grid-cols-[28px_112px_1fr_84px_1.6fr]">
              <span />
              <span>写真</span>
              <span>品名</span>
              <span>分量</span>
              <span>詳細スペック</span>
            </div>

            {list.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-stone-200 p-3 md:grid-cols-[28px_112px_1fr_84px_1.6fr] md:gap-4 md:rounded-none md:border-0 md:border-b md:border-stone-100 md:p-0 md:pb-3"
              >
                <span className="col-span-2 text-xs tabular-nums text-stone-400 md:col-span-1 md:pt-1">
                  {i + 1}
                </span>

                {r.photoUrl ? (
                  /* 切り取らずに全体を出す。パッケージの文字まで見えないと買うときに迷う */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoThumbUrl(r.photoUrl, 320)}
                    alt=""
                    className="h-[88px] w-[88px] rounded-lg border border-stone-200 bg-white object-contain p-1 md:h-28 md:w-28"
                  />
                ) : (
                  <span className="flex h-[88px] w-[88px] items-center justify-center rounded-lg border border-dashed border-stone-200 text-[10px] text-stone-300 md:h-28 md:w-28">
                    写真なし
                  </span>
                )}

                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug text-stone-900">{r.nameJa}</p>
                  {r.nameEn && <p className="text-xs leading-snug text-stone-500">{r.nameEn}</p>}
                  {/* 画面が狭いときは分量を品名の下に出す（横に並べると文字が潰れるため） */}
                  <p className="mt-1 text-sm font-semibold tabular-nums text-amber-800 md:hidden">
                    {r.amount}
                  </p>
                </div>

                <p className="hidden text-sm font-semibold tabular-nums text-amber-800 md:block md:pt-0.5">
                  {r.amount}
                </p>

                <div className="col-span-2 min-w-0 md:col-span-1">
                  {r.specs.filter((s) => s.trim()).length === 0 ? (
                    <span className="text-xs text-stone-300">—</span>
                  ) : (
                    r.specs
                      .filter((s) => s.trim())
                      .map((s, si) => (
                        <p
                          key={si}
                          className="whitespace-pre-wrap text-[11px] leading-relaxed text-stone-600"
                        >
                          {formatSpecText(s)}
                        </p>
                      ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
