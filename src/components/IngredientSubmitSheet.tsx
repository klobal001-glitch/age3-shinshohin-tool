"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { IngredientRow } from "@/lib/types";
import { isBlankIngredientRow } from "@/lib/productInfo";
import { photoThumbUrl } from "./IngredientPhoto";
import { btn } from "@/lib/ui";

/**
 * 材料の「提出シート」。
 *
 * 入力用の表は、欄が細くて写真も小さく、人に渡すには向かない。
 * デザイン班や事務に渡すときに見たいのは「どの食材を・何グラム・どんな商品か」の
 * 4つだけなので、その4つを大きく並べ直して、そのまま紙やPDFにできるようにする。
 *
 * 画面の後ろ側は刷らない（globals.css の `body.submit-open` を参照）。
 */
export function IngredientSubmitSheet({
  productName,
  productNameEn,
  rows,
  onClose,
}: {
  productName: string;
  productNameEn: string;
  rows: IngredientRow[];
  onClose: () => void;
}) {
  /* 空の行は渡さない */
  const list = useMemo(() => rows.filter((r) => !isBlankIngredientRow(r)), [rows]);

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
      const spec = r.specs.filter((s) => s.trim()).join("\n");
      return [
        `${i + 1}. ${r.nameJa}${r.nameEn ? `（${r.nameEn}）` : ""}　${r.amount}`,
        spec,
      ]
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

        <div className="mb-5 border-b border-stone-200 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">{productName}</h2>
          {productNameEn && <p className="mt-1 text-sm text-stone-500">{productNameEn}</p>}
          <p className="mt-2 text-xs text-stone-400">材料シート（提出用）　{today}　全{list.length}品</p>
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl bg-stone-100 px-4 py-8 text-center text-sm text-stone-500">
            材料がまだ入っていません。
          </p>
        ) : (
          <div className="space-y-3">
            {/* 見出し。画面が広いときだけ出す */}
            <div className="hidden gap-4 border-b border-stone-200 pb-1 text-xs font-medium text-stone-400 md:grid md:grid-cols-[28px_96px_1fr_84px_1.6fr]">
              <span />
              <span>写真</span>
              <span>品名</span>
              <span>分量</span>
              <span>詳細スペック</span>
            </div>

            {list.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[72px_1fr] items-start gap-3 rounded-xl border border-stone-200 p-3 md:grid-cols-[28px_96px_1fr_84px_1.6fr] md:gap-4 md:rounded-none md:border-0 md:border-b md:border-stone-100 md:p-0 md:pb-3"
              >
                <span className="col-span-2 text-xs tabular-nums text-stone-400 md:col-span-1 md:pt-1">
                  {i + 1}
                </span>

                {r.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoThumbUrl(r.photoUrl, 240)}
                    alt=""
                    className="h-[72px] w-[72px] rounded-lg border border-stone-200 object-cover md:h-24 md:w-24"
                  />
                ) : (
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-stone-200 text-[10px] text-stone-300 md:h-24 md:w-24">
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
                          {s}
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
