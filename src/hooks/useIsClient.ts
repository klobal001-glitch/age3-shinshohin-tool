"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * サーバーレンダリングとクライアントの初回ハイドレーションでは false を返し、
 * ハイドレーション完了後に true へ切り替わる（setState をエフェクト内で
 * 呼ばずに済むよう useSyncExternalStore を利用）。
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
