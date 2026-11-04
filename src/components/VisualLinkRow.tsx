"use client";

import { useRef,useState } from "react";
import { isImageUrl, linkLabel, toDownloadUrl, toThumbnailUrl } from "@/lib/imageUrl";
import { inputCls } from "./PriceInput";
import { focusRing } from "@/lib/ui";
import {archiveArtwork,readSavedArtwork,savedArtwork,useStoredArtwork} from '@/lib/storedArtwork';

/** 登録済みリンクの右に並ぶ小さなボタン */
export const linkBtnCls =
  `inline-flex min-h-10 shrink-0 items-center rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-600 transition hover:border-amber-500 hover:text-amber-700 md:min-h-0 ${focusRing}`;

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
  const fileInput=useRef<HTMLInputElement>(null);
  const url = value.trim();
  const stored=useStoredArtwork(url,isImageUrl(url)&&!editing);
  const showThumb = (!!stored.saved||!broken) && isImageUrl(url);
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
    <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-2">
      {showThumb ? (
        <a href={url} target="_blank" rel="noreferrer" title="別タブで開く" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stored.saved?.previewUrl??toThumbnailUrl(url)}
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

      <div className="min-w-0 flex-1 basis-40">
        <div className="truncate text-sm text-stone-700" title={url}>
          {name}
        </div>
        {host && <div className="truncate text-xs text-stone-400">{host}</div>}
        {isImageUrl(url)&&<div className={`text-xs ${stored.status==='saved'?'text-emerald-700':stored.status==='error'?'text-red-700':'text-stone-500'}`}>
          {stored.status==='saved'?'画像保存済み':stored.status==='saving'?'画像を共有保存中…':stored.status==='error'?`リンクのみ登録：${stored.error}`:'リンク登録済み・画像の保存確認中'}
          {stored.status==='error'&&<button type="button" className="ml-2 min-h-11 underline" onClick={()=>void archiveArtwork(url).catch(()=>{})}>再試行</button>}
        </div>}
      </div>
      <input type="file" ref={fileInput} className="hidden" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const source=`inside:artwork/${crypto.randomUUID()}/${encodeURIComponent(file.name)}`;onChange(source);setBroken(false);void archiveArtwork(source,file).catch(()=>{});e.target.value='';}}/>
      <button type="button" className={linkBtnCls} onClick={()=>fileInput.current?.click()}>画像を差し替え</button>

      <a
        href={stored.saved?'#':url.startsWith('inside:')?undefined:toDownloadUrl(url)}
        download
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="このファイルを保存する"
        onClick={stored.saved?async e=>{e.preventDefault();try{const saved=await savedArtwork(url,true);if(!saved)throw new Error('画像が見つかりません。');const object=URL.createObjectURL(await readSavedArtwork(saved));const a=document.createElement('a');a.href=object;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(object),60000);}catch{alert('保存画像を読み込めませんでした。時間を置いて再試行してください。');}}:undefined}
      >
        ⬇ 保存
      </a>
      {!url.startsWith('inside:')&&<a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="置き場所を別タブで開く"
      >
        開く
      </a>}
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
