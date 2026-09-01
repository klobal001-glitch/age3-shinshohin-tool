"use client";

import { useState } from "react";
import { isImageUrl, linkLabel, toDownloadUrl, toThumbnailUrl } from "@/lib/imageUrl";
import { inputCls } from "./PriceInput";

/** 登録済みリンクの右に並ぶ小さなボタン */
export const linkBtnCls =
  "shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs text-stone-600 transition hover:border-amber-500 hover:text-amber-700";

/**
 * ビジュアルの登録済みリンク1行。
 *
 * 普段はURLを出さず、サムネイル＋ファイル名だけを見せる（長いURLは邪魔なため）。
 * 「保存」でその場にダウンロード、「開く」で元のページ、「編集」でURL入力欄に戻る。
 * Dropbox/Google Drive の共有リンクは表示用・保存用にそれぞれ読み替える。
 */
export function VisualLinkRow({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const [editing, setEditing] = useState(false);
  const url = value.trim();
  const showThumb = !broken && isImageUrl(url);
  const { name, host } = linkLabel(url);

  /* URLが空のときと編集中は、これまで通りの入力欄を出す */
  if (editing || !url) {
    return (
      <div className="mb-2 flex items-center gap-2">
        <input
          /* 「編集」で入力欄に戻したときだけ、そのまま打てるよう focus を移す */
          autoFocus={editing}
          className={inputCls}
          placeholder="https://..."
          value={value}
          onChange={(e) => {
            setBroken(false);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={() => setEditing(false)}
        />
        <button
          type="button"
          title="このリンクを消す"
          className="shrink-0 rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-2">
      {showThumb ? (
        <a href={url} target="_blank" rel="noreferrer" title="別タブで開く" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toThumbnailUrl(url)}
            alt=""
            className="h-12 w-12 rounded border border-stone-200 bg-stone-50 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            onLoad={() => setBroken(false)}
          />
        </a>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-stone-300 bg-stone-50 text-lg text-stone-300">
          🔗
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-stone-700" title={url}>
          {name}
        </div>
        {host && <div className="truncate text-xs text-stone-400">{host}</div>}
      </div>

      <a
        href={toDownloadUrl(url)}
        download
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="このファイルを保存する"
      >
        ⬇ 保存
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="置き場所を別タブで開く"
      >
        開く
      </a>
      <button
        type="button"
        title="URLを直す"
        className="shrink-0 rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-700"
        onClick={() => setEditing(true)}
      >
        編集
      </button>
      <button
        type="button"
        title="このリンクを消す"
        className="shrink-0 rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
