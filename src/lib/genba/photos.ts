import { supabase } from "@/lib/supabaseClient";
import { Photo } from "@/lib/genba/types";

/** 現場写真を入れる Supabase Storage のバケット名（supabase/schema.sql で作成） */
export const PHOTO_BUCKET = "genba-photos";

/** 長辺の上限。スマホの写真はそのままだと数MBあるので、送る前に縮める。 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * 画像を長辺 MAX_EDGE まで縮めて JPEG にする。
 * 変換できない形式（HEIC など、ブラウザが読めないもの）は元のまま返す。
 */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_200_000) {
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
    // 縮められなくても、そのまま送れば写真は残る
    return file;
  }
}

function extensionOf(file: File, blob: Blob): string {
  if (blob.type === "image/jpeg") return "jpg";
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-z0-9]{1,5}$/i.test(fromName)) return fromName.toLowerCase();
  return "jpg";
}

/**
 * 写真を1枚アップロードして、保存用の情報を返す。
 * 失敗したときは呼び出し側で伝えられるよう、例外をそのまま投げる。
 */
export async function uploadPhoto(storeId: string, itemIndex: number, file: File): Promise<Photo> {
  const blob = await shrink(file);
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${storeId}/${itemIndex + 1}/${stamp}-${rand}.${extensionOf(file, blob)}`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** 写真を1枚消す。ストレージ側が消せなくても、記録からは外す。 */
export async function removePhoto(photo: Photo): Promise<void> {
  if (!photo.path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]);
  if (error) console.error("写真の削除に失敗しました", error);
}
