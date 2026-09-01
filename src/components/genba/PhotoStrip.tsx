"use client";

import { useRef, useState } from "react";
import { removePhoto, uploadPhoto } from "@/lib/genba/photos";
import { Photo } from "@/lib/genba/types";

/**
 * 項目に添付した現場写真の一覧と、追加・削除。
 *
 * 写真は Supabase Storage に入るので、iMac で撮り込んだものも
 * スマホで撮ったものも、全員が同じものを見られる。
 */
export function PhotoStrip({
  storeId,
  itemIndex,
  photos,
  onChange,
}: {
  storeId: string;
  itemIndex: number;
  photos: Photo[];
  onChange: (next: Photo[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    const added: Photo[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await uploadPhoto(storeId, itemIndex, file));
      } catch (e) {
        console.error("写真のアップロードに失敗しました", e);
        setError("写真を送れませんでした。電波の良いところでもう一度お試しください。");
      }
    }
    if (added.length > 0) onChange([...photos, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove(photo: Photo) {
    if (!window.confirm("この写真を削除します。よろしいですか？")) return;
    onChange(photos.filter((p) => p.path !== photo.path));
    await removePhoto(photo);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <div key={photo.path} className="group relative">
            <a href={photo.url} target="_blank" rel="noreferrer">
              {/* 静的書き出しのため next/image ではなく img を使う */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="現場写真"
                className="h-20 w-20 rounded-lg border border-[#e3e8ee] object-cover"
              />
            </a>
            <button
              type="button"
              onClick={() => handleRemove(photo)}
              aria-label="この写真を削除"
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full border border-[#e3e8ee] bg-white text-xs font-bold text-[#c0392b] shadow-sm"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-20 w-20 rounded-lg border-2 border-dashed border-[#e3e8ee] bg-white text-[11px] font-bold text-[#5a6b7c] disabled:opacity-60"
        >
          {busy ? "送信中…" : (
            <>
              <span className="block text-lg leading-none">＋</span>
              写真を追加
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="mt-2 text-xs font-bold text-[#c0392b]">{error}</p>}
    </div>
  );
}
