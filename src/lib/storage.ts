"use client";

import { useEffect, useState } from "react";

const PREFIX = "age3_";

function readRaw<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeRaw<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ストレージが使えない場合は何もしない
  }
}

/**
 * localStorage と同期する state。
 *
 * 呼び出し側（useIsClient などでクライアント確定後にのみマウントされる
 * コンポーネント）で使うことを前提に、初期値は lazy initializer で
 * localStorage から直接読み込みます。サーバーレンダリングされるツリーでは
 * 使用しないでください（hydration mismatch の原因になります）。
 */
export function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readRaw<T>(key, initial));

  useEffect(() => {
    writeRaw(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

export function clearAllData() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
