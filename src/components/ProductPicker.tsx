"use client";

import { useState } from "react";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { useAppData } from "@/hooks/useAppData";
import { SALE_STATUS_LABEL, isInactive, saleStatus } from "@/lib/saleStatus";

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: null, label: "（指定なし）" },
  { value: "regular_sweet", label: GENRE_LABELS.regular_sweet },
  { value: "regular_savory", label: GENRE_LABELS.regular_savory },
  { value: "sweets_sand", label: GENRE_LABELS.sweets_sand },
  { value: "fruit_sand", label: GENRE_LABELS.fruit_sand },
  { value: "single", label: GENRE_LABELS.single },
  { value: "shop_limited", label: GENRE_LABELS.shop_limited },
  { value: "season", label: GENRE_LABELS.season },
];

export default function ProductPicker({ app }: { app: ReturnType<typeof useAppData> }) {
  const {
    products,
    selectedProduct,
    setSelectedId,
    addProduct,
    renameProduct,
    changeGenre,
    deleteProduct,
    getInfo,
    updateInfo,
  } = app;
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  if (!selectedProduct) {
    return (
      <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-500">
        商品がありません。「＋ 商品を追加」から登録してください。
      </div>
    );
  }

  const info = getInfo(selectedProduct.id);
  const discontinued = info.discontinued;
  const status = saleStatus(info);

  /** 廃盤にする／戻す。データは消さず、現行の一覧と集計から外すだけ */
  const toggleDiscontinued = () => {
    if (!discontinued) {
      const ok = confirm(
        `「${selectedProduct.name}」を廃盤にします。\n\n` +
          "入力した情報と準備タスクのチェックは残ります。\n" +
          "商品リストとビジュアル一覧には「廃盤」と付いたまま残りますが、\n" +
          "締め切り一覧・平均入力率・メニューの商品一覧からは外れます。\n" +
          "いつでも戻せます。よろしいですか？"
      );
      if (!ok) return;
    }
    updateInfo(selectedProduct.id, { discontinued: !discontinued });
  };

  return (
    <div className="rounded-xl border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="hidden text-lg font-bold text-stone-900 md:block">
          {selectedProduct.name}
        </h2>
        {isInactive(status) && (
          <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {SALE_STATUS_LABEL[status]}
          </span>
        )}
        <select
          className="min-w-[220px] rounded-lg border border-stone-300 px-3 py-1.5 text-sm md:hidden"
          value={selectedProduct.id}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <span className="text-sm text-stone-500">ジャンル：</span>
        <select
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          value={selectedProduct.genre ?? ""}
          onChange={(e) => changeGenre(selectedProduct.id, (e.target.value || null) as Genre)}
        >
          {GENRE_OPTIONS.map((g) => (
            <option key={g.label} value={g.value ?? ""}>
              {g.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            onClick={() => setAdding((v) => !v)}
          >
            ＋ 商品を追加
          </button>
          <button
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
            onClick={() => {
              setRenameValue(selectedProduct.name);
              setRenaming((v) => !v);
            }}
          >
            名前を変える
          </button>
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              discontinued
                ? "border-amber-300 bg-amber-50 font-medium text-amber-800 hover:bg-amber-100"
                : "border-stone-300 hover:bg-stone-50"
            }`}
            onClick={toggleDiscontinued}
          >
            {discontinued ? "廃盤をやめる" : "廃盤にする"}
          </button>
          <span className="mx-1 hidden h-5 w-px bg-stone-200 sm:block" aria-hidden />
          {/* 押し間違いを避けるため、削除だけは枠のない控えめな表示にしている */}
          <button
            className="rounded px-2 py-1.5 text-sm text-stone-400 underline-offset-4 hover:text-red-600 hover:underline"
            onClick={() => {
              if (
                confirm(
                  `「${selectedProduct.name}」を削除します。入力した情報と準備タスクのチェックもすべて消えます。よろしいですか？`
                )
              ) {
                deleteProduct(selectedProduct.id);
              }
            }}
          >
            この商品を削除
          </button>
        </div>
      </div>

      {adding && (
        <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
          <input
            autoFocus
            className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
            placeholder="新しい商品名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                addProduct(newName.trim(), null);
                setNewName("");
                setAdding(false);
              }
            }}
          />
          <button
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
            onClick={() => {
              if (newName.trim()) {
                addProduct(newName.trim(), null);
                setNewName("");
                setAdding(false);
              }
            }}
          >
            追加する
          </button>
        </div>
      )}

      {renaming && (
        <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
          <input
            autoFocus
            className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                renameProduct(selectedProduct.id, renameValue.trim());
                setRenaming(false);
              }
            }}
          />
          <button
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
            onClick={() => {
              if (renameValue.trim()) {
                renameProduct(selectedProduct.id, renameValue.trim());
                setRenaming(false);
              }
            }}
          >
            保存する
          </button>
        </div>
      )}
    </div>
  );
}
