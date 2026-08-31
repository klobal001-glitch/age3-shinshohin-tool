import { ProductInfo } from "./types";

/**
 * 商品の販売状態。
 *
 * - retired … 廃盤。作らなくなった商品（「廃盤にする」を押したもの）
 * - ended   … 販売終了日を過ぎた商品
 * - active  … 販売中
 *
 * 見た目を薄くする判定はアプリのあちこちで使うので、必ずここを通すこと。
 */
export type SaleStatus = "active" | "ended" | "retired";

export const SALE_STATUS_LABEL: Record<Exclude<SaleStatus, "active">, string> = {
  retired: "廃盤",
  ended: "販売終了",
};

/** 今日の日付（YYYY-MM-DD）。締め切り計算と同じ形式に揃える */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function saleStatus(info: ProductInfo, today: string = todayKey()): SaleStatus {
  if (info.discontinued) return "retired";
  /* 継続販売中は終了日を見ない。終了日「当日」はまだ売っているので過ぎていない扱い */
  if (!info.ongoing && info.endDate && info.endDate < today) return "ended";
  return "active";
}

/**
 * 販売中ではない（＝薄く見せる）か。
 * 型を絞り込めるようにしておくと、呼び出し側で SALE_STATUS_LABEL を引ける。
 */
export function isInactive(status: SaleStatus): status is Exclude<SaleStatus, "active"> {
  return status !== "active";
}
