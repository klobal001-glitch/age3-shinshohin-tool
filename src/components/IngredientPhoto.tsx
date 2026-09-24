"use client";

import { useRef, useState } from "react";
import { IngredientRow } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ *
 * 写真の置き場（アップロードと削除）
 * ------------------------------------------------------------------ */

/**
 * 写真の保管場所（Supabase Storage のバケット）。
 *
 * 商品データベース専用の置き場はまだ作れていない（作るには Supabase の管理画面に
 * 入る必要がある）ため、現場チェックで使っている置き場の中に `product/` という
 * 部屋を作って間借りしている。専用の置き場ができたら、ここの2行を変えるだけでよい。
 */
export const PHOTO_BUCKET = "genba-photos";
const PRODUCT_PREFIX = "product";

/** 長辺の上限。スマホの写真はそのままだと数MBあるので、送る前に縮める。 */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.85;

export interface StoredPhoto {
  /** 画面に出すときのアドレス */
  url: string;
  /** 消すときに使う、保管場所の中の位置 */
  path: string;
}

/**
 * 画像を長辺 MAX_EDGE まで縮めて JPEG にする。
 * 変換できない形式（HEIC など、ブラウザが読めないもの）は元のまま返す。
 */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_000_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    return blob ?? file;
  } catch {
    /* 縮められなくても、そのまま送れば写真は残る */
    return file;
  }
}

function extensionOf(file: File, blob: Blob): string {
  if (blob.type === "image/jpeg") return "jpg";
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  return "jpg";
}

/** 保管場所の中で使える形に直す（日本語のIDでも壊れないように） */
function safe(part: string): string {
  const cleaned = part.replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || "x";
}

/**
 * 写真を1枚アップロードして、保存用の情報を返す。
 * 失敗したときは呼び出し側で伝えられるよう、例外をそのまま投げる。
 *
 * @param productId 商品のID
 * @param kind      何の写真か（材料なら "ing"）。置き場を分けるためだけに使う
 */
export async function uploadProductPhoto(
  productId: string,
  kind: string,
  file: File
): Promise<StoredPhoto> {
  const blob = await shrink(file);
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${PRODUCT_PREFIX}/${safe(productId)}/${safe(kind)}-${stamp}-${rand}.${extensionOf(
    file,
    blob
  )}`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** 写真を1枚消す。保管場所から消せなくても、画面の記録からは外す。 */
export async function removeProductPhoto(path: string): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("写真の削除に失敗しました", error);
}

/**
 * 一覧に並べる小さい画像のアドレス。
 * 原寸のまま並べると端末が重くなるので、Supabase の画像変換で小さく作り直したものを渡す。
 * 変換できない画像（HEIC など）は 400 が返るので、呼び出し側で元のアドレスに戻せるようにする。
 */
export function photoThumbUrl(url: string, size: number): string {
  const marker = "/storage/v1/object/public/";
  if (!url.includes(marker)) return url;
  const base = url.split("?")[0].replace(marker, "/storage/v1/render/image/public/");
  return `${base}?width=${size}&height=${size}&resize=cover&quality=70`;
}

/* ------------------------------------------------------------------ *
 * 材料1行ぶんの写真
 * ------------------------------------------------------------------ */

/**
 * 材料1行ぶんの写真。1行に1枚。
 *
 * パソコンに慣れていない人でも入れられるよう、次の3つをどれでも受ける。
 * - 枠を押して、スマホの写真／カメラから選ぶ（スマホでは「写真を撮る」も出る）
 * - パソコンから枠へドラッグして落とす
 * - 写真をコピーして枠の上で貼り付ける
 *
 * アドレス（URL）の貼り付けは求めない。貼る場所を探すところで手が止まるため。
 */
export function IngredientPhoto({
  productId,
  index,
  row,
  onChange,
}: {
  productId: string;
  index: number;
  row: IngredientRow;
  onChange: (change: Partial<IngredientRow>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  /* 画像の変換が効かない形式（HEICなど）のときは、元のアドレスに戻す */
  const [rawThumb, setRawThumb] = useState(false);

  const accept = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像を選んでください");
      return;
    }
    setError("");
    setBusy(true);
    try {
      /* 差し替えのときは、前の写真を置き場から消しておく（使わない写真を残さない） */
      const previous = row.photoPath;
      const saved = await uploadProductPhoto(productId, `ing${index + 1}`, file);
      onChange({ photoUrl: saved.url, photoPath: saved.path });
      setRawThumb(false);
      if (previous) void removeProductPhoto(previous);
    } catch (e) {
      console.error(e);
      setError("送れませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    const previous = row.photoPath;
    onChange({ photoUrl: "", photoPath: "" });
    setError("");
    if (previous) void removeProductPhoto(previous);
  };

  const commonDrop = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      void accept(e.dataTransfer.files?.[0]);
    },
    onPaste: (e: React.ClipboardEvent) => {
      const file = Array.from(e.clipboardData.files ?? [])[0];
      if (file) {
        e.preventDefault();
        void accept(file);
      }
    },
  };

  return (
    <div className="flex items-start gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          /* 同じ写真をもう一度選べるように空に戻す */
          e.target.value = "";
        }}
      />

      {row.photoUrl ? (
        <div className="relative">
          <button
            type="button"
            title="押すと写真を入れ替えます"
            disabled={busy}
            className={`block h-16 w-16 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 transition hover:border-amber-400 ${
              over ? "border-amber-500 ring-2 ring-amber-200" : ""
            }`}
            onClick={() => inputRef.current?.click()}
            {...commonDrop}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rawThumb ? row.photoUrl : photoThumbUrl(row.photoUrl, 160)}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setRawThumb(true)}
            />
          </button>
          <button
            type="button"
            title="この写真を消す"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white text-xs text-stone-500 shadow-sm transition hover:border-red-300 hover:text-red-600"
            onClick={clear}
          >
            ×
          </button>
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 text-[11px] text-stone-600">
              送信中
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          className={`flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px] transition ${
            over
              ? "border-amber-500 bg-amber-50 text-amber-800"
              : "border-stone-300 bg-white text-stone-400 hover:border-amber-400 hover:text-amber-700"
          }`}
          onClick={() => inputRef.current?.click()}
          {...commonDrop}
        >
          {busy ? (
            <span className="text-stone-500">送信中</span>
          ) : (
            <>
              <span aria-hidden className="text-base leading-none">
                📷
              </span>
              <span>写真</span>
            </>
          )}
        </button>
      )}

      {error && <p className="pt-1 text-[11px] leading-tight text-red-600">{error}</p>}
    </div>
  );
}
