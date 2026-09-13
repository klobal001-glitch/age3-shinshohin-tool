"use client";

import { useAppData } from "@/hooks/useAppData";
import { ProductInfo, ProductRun } from "@/lib/types";
import { focusRing } from "@/lib/ui";

/**
 * 「販売の回」の切り替え。
 *
 * 同じ商品でも、年やバージョン（ハロウィン仕様など）で出し直すことがある。
 * 1回ごとに変わるのは 発売月・販売終了月・ビジュアル・準備タスク の4つだけで、
 * 品名・材料・価格・レシピ・紹介文は商品で1つ（ものは同じなので）。
 *
 * シートでもタスクでも同じ場所（上の帯）に出す。どの回を見ているかが常に分かるように。
 */
export function runView(app: ReturnType<typeof useAppData>, info: ProductInfo | null) {
  const id = app.selectedProduct?.id ?? "";
  const viewing = app.runTab && app.runTab.productId === id ? app.runTab.label : null;
  const past: ProductRun | null =
    (viewing && info?.runs.find((r) => r.label === viewing)) || null;
  return {
    /** 今の回の名前。空なら回で分けていない */
    currentLabel: info?.runLabel ?? "",
    /** 過去の回を見ているなら、その中身 */
    past,
    /** 過去の回を見ているか */
    viewingPast: !!past,
    /** いま見ている回の名前 */
    viewingLabel: past ? past.label : info?.runLabel ?? "",
  };
}

export default function RunTabs({
  app,
  info,
  onAddRun,
}: {
  app: ReturnType<typeof useAppData>;
  info: ProductInfo;
  onAddRun: () => void;
}) {
  const id = app.selectedProduct?.id ?? "";
  const { currentLabel, viewingLabel } = runView(app, info);
  const hasRuns = !!currentLabel || info.runs.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      {hasRuns && (
        <>
          <button
            type="button"
            onClick={() => app.setRunTab(null)}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
              viewingLabel === currentLabel
                ? "border-amber-600 bg-amber-600 font-medium text-white"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {currentLabel || "今の回"}
            <span
              className={`ml-1.5 ${
                viewingLabel === currentLabel ? "text-amber-100" : "text-stone-400"
              }`}
            >
              今準備中
            </span>
          </button>
          {info.runs.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => app.setRunTab({ productId: id, label: r.label })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
                viewingLabel === r.label
                  ? "border-stone-600 bg-stone-600 font-medium text-white"
                  : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </>
      )}
      <button
        type="button"
        onClick={onAddRun}
        className={`rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700 ${focusRing}`}
      >
        ＋ 回を追加
      </button>
    </div>
  );
}

/** 過去の回を見ているときの注意書き。シートでもタスクでも同じ文にする */
export function PastRunNotice({ label, current }: { label: string; current: string }) {
  return (
    <p className="rounded-lg border border-stone-300 bg-stone-200/60 px-3 py-2 text-xs text-stone-700">
      <span className="font-medium">{label}</span>{" "}
      は終わった回です。見るだけで、直せません。
      締め切りの数・進捗・入力率は「{current || "今の回"}」を見ています。
    </p>
  );
}
