"use client";

import { useState } from "react";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { useAppData } from "@/hooks/useAppData";
import { SALE_STATUS_LABEL, isInactive, saleStatus } from "@/lib/saleStatus";
import Icon from "@/components/Icon";
import { badge, btn, card, field, focusRing } from "@/lib/ui";

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

/**
 * 情報シート・準備タスクの先頭に置く、商品の見出し。
 *
 * 商品を切り替えるのは「商品を変える」から開く一覧（ProductSwitcher）に任せる。
 * ここに常に出しておくのは、今どの商品を見ているかとジャンルだけ。
 * 追加・改名・廃盤・削除は日々の入力では使わないので「商品の管理」に畳んである。
 */
export default function ProductPicker({
  app,
  onOpenSwitcher,
}: {
  app: ReturnType<typeof useAppData>;
  onOpenSwitcher?: () => void;
}) {
  const {
    selectedProduct,
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
  const [showManage, setShowManage] = useState(false);

  if (!selectedProduct) {
    return (
      <div className={`${card} p-4 text-sm text-stone-500`}>
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

  const submitAdd = () => {
    if (!newName.trim()) return;
    addProduct(newName.trim(), null);
    setNewName("");
    setAdding(false);
  };

  const submitRename = () => {
    if (!renameValue.trim()) return;
    renameProduct(selectedProduct.id, renameValue.trim());
    setRenaming(false);
  };

  return (
    <div className={`${card} p-3 sm:p-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* PCは左のリストからも選べるが、押せば検索付きの一覧も開けるようにしておく。
           スマホの切り替えは上の帯（Header）にあるので、ここには出さない */}
        <button
          type="button"
          onClick={onOpenSwitcher}
          className={`hidden min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-lg font-semibold text-stone-900 transition hover:bg-stone-100 md:flex ${focusRing}`}
        >
          <span className="min-w-0 truncate">{selectedProduct.name}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-stone-500">
            商品を変える
            <Icon name="chevronDown" className="h-3.5 w-3.5" />
          </span>
        </button>
        {isInactive(status) && <span className={badge()}>{SALE_STATUS_LABEL[status]}</span>}

        <label className="flex min-w-0 items-center gap-2 text-sm text-stone-500">
          <span className="shrink-0">ジャンル</span>
          <select
            className={`${field} w-auto min-w-0`}
            value={selectedProduct.genre ?? ""}
            onChange={(e) => changeGenre(selectedProduct.id, (e.target.value || null) as Genre)}
          >
            {GENRE_OPTIONS.map((g) => (
              <option key={g.label} value={g.value ?? ""}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`${btn("quiet")} ml-auto md:hidden`}
          onClick={() => setShowManage((v) => !v)}
          aria-expanded={showManage}
        >
          商品の管理
          <Icon
            name="chevronDown"
            className={`h-4 w-4 transition-transform ${showManage ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className={`${showManage ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 md:ml-auto md:flex md:w-auto`}
        >
          <button className={btn("secondary")} onClick={() => setAdding((v) => !v)}>
            <Icon name="plus" className="h-4 w-4" />
            商品を追加
          </button>
          <button
            className={btn("secondary")}
            onClick={() => {
              setRenameValue(selectedProduct.name);
              setRenaming((v) => !v);
            }}
          >
            名前を変える
          </button>
          <button
            className={discontinued ? btn("primary") : btn("secondary")}
            onClick={toggleDiscontinued}
          >
            {discontinued ? "廃盤をやめる" : "廃盤にする"}
          </button>
          <span className="mx-1 hidden h-5 w-px bg-stone-200 sm:block" aria-hidden />
          {/* 押し間違いを避けるため、削除だけは枠のない控えめな表示にしている */}
          <button
            className={btn("danger")}
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
        <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3">
          <input
            autoFocus
            className={`${field} flex-1`}
            placeholder="新しい商品名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAdd()}
          />
          <button className={btn("primary")} onClick={submitAdd}>
            追加する
          </button>
        </div>
      )}

      {renaming && (
        <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3">
          <input
            autoFocus
            className={`${field} flex-1 ${focusRing}`}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
          />
          <button className={btn("primary")} onClick={submitRename}>
            保存する
          </button>
        </div>
      )}
    </div>
  );
}
