"use client";

import { parsePriceInput } from "@/lib/productInfo";

/** 入力欄の共通スタイル。情報シートと準備タスクで同じ見た目にする */
export const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

/** 「¥」を左に固定した数値専用の価格入力欄 */
export function PriceInput({
  id,
  value,
  placeholder,
  muted,
  onChange,
}: {
  id?: string;
  value: number | null;
  placeholder?: string;
  muted?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
        ¥
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={`${inputCls} pl-7 tabular-nums ${muted ? "text-stone-500" : ""}`}
        placeholder={placeholder}
        value={value === null ? "" : value.toLocaleString("ja-JP")}
        onChange={(e) => onChange(parsePriceInput(e.target.value))}
      />
    </div>
  );
}
