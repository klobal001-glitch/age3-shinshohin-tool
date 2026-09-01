import { CHECK_ITEMS, PRIO_LABELS, STORES, hasAnyInput } from "@/lib/genba/checkItems";
import { ItemRecord, Prio, Visit, VisitData } from "@/lib/genba/types";

export type Entry = { index: number; item: ItemRecord };
export type Group = { key: Prio; label: string; note: string; color: string; entries: Entry[] };

/** 1店舗分を優先度ごとにまとめる。優先度が付いていない気づきは最後に回す。 */
export function groupsOf(data: VisitData): Group[] {
  const entries: Entry[] = data.items
    .map((item, index) => ({ index, item }))
    .filter((e) => hasAnyInput(e.item));

  const groups: Group[] = (["A", "B", "C"] as const).map((key) => ({
    key,
    label: `優先度 ${key}`,
    note: PRIO_LABELS[key].note,
    color: PRIO_LABELS[key].color,
    entries: entries.filter((e) => e.item.prio === key),
  }));
  groups.push({
    key: "",
    label: "その他の気づき",
    note: "優先度なし",
    color: "#77828d",
    entries: entries.filter((e) => e.item.prio === ""),
  });
  return groups.filter((g) => g.entries.length > 0);
}

function lineOf(entry: Entry): string {
  const head = `${entry.item.done ? "✓" : "□"}[${entry.item.prio || "-"}] ${CHECK_ITEMS[entry.index].title}`;
  const memo = entry.item.memo.trim() ? `：${entry.item.memo.trim()}` : "";
  const photo = entry.item.photos.length > 0 ? ` 📷${entry.item.photos.length}` : "";
  return "　" + head + memo + photo;
}

const FOOTER = "※現場メモの下書きです。共有・提出前に上長の確認をお願いします。";

/** いま開いている画面のURL（写真をまとめて見てもらうときの案内先） */
function appUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname;
}

/** 写真のURLを、項目ごとにまとめて並べる */
function photoLines(data: VisitData): string[] {
  const lines: string[] = [];
  data.items.forEach((item, index) => {
    if (item.photos.length === 0) return;
    lines.push(`${index + 1}. ${CHECK_ITEMS[index].title}`);
    for (const p of item.photos) lines.push(p.url);
  });
  if (lines.length === 0) return [];
  return ["📷 写真", ...lines];
}

function storeName(storeId: string): string {
  return (STORES.find((s) => s.id === storeId) ?? STORES[0]).name;
}

function head(data: VisitData): string[] {
  const lines = [
    `【Age.3 現場チェック】${storeName(data.storeId)}店`,
    `訪問日：${data.date}${data.memo ? `（${data.memo}）` : ""}`,
    "━━━━━━━━━━━━━",
  ];
  const groups = groupsOf(data);
  if (groups.length === 0) {
    lines.push("　（記入なし）");
  } else {
    for (const g of groups) for (const e of g.entries) lines.push(lineOf(e));
  }
  lines.push("━━━━━━━━━━━━━");
  return lines;
}

/** LINEやメールにそのまま貼れる、訪問1回ぶんのまとめ（写真はURLで付ける） */
export function visitText(data: VisitData): string {
  const photos = photoLines(data);
  return [...head(data), ...photos, ...(photos.length ? ["━━━━━━━━━━━━━"] : []), FOOTER].join("\n");
}

/**
 * 写真が多いと LINE の本文に収まらないので、
 * そのときは写真のURLを1本ずつではなく、画面へのリンク1本にまとめる。
 */
export function visitTextCompact(data: VisitData): string {
  const count = data.items.reduce((n, it) => n + it.photos.length, 0);
  const lines = head(data);
  if (count > 0) {
    const url = appUrl();
    lines.push(`📷 写真${count}枚は現場チェックで見られます${url ? "：\n" + url : ""}`, "━━━━━━━━━━━━━");
  }
  lines.push(FOOTER);
  return lines.join("\n");
}

/** 全訪問をまとめたもの（改善レポート用）。店舗ごとに、日付順で並べる */
export function allVisitsText(visits: Visit[]): string {
  const lines = ["【Age.3 現場チェック結果】", "━━━━━━━━━━━━━"];
  for (const store of STORES) {
    const mine = visits.filter((v) => v.storeId === store.id);
    if (mine.length === 0) continue;
    for (const v of mine) {
      lines.push(`■ ${store.name}店　${v.date}${v.memo ? `（${v.memo}）` : ""}`);
      const groups = groupsOf(v);
      if (groups.length === 0) {
        lines.push("　（記入なし）");
      } else {
        for (const g of groups) for (const e of g.entries) lines.push(lineOf(e));
      }
      lines.push("━━━━━━━━━━━━━");
    }
  }
  lines.push(FOOTER);
  return lines.join("\n");
}

/**
 * LINEに送る。スマホではLINEの送り先選択がそのまま開く。
 *
 * 長い記録はLINE側で切られてしまうので、その場合は送らずにコピーする。
 * どちらになったかを呼び出し側で伝えられるよう、結果を返す。
 */
const LINE_TEXT_LIMIT = 1000;

/** LINEに渡す本文。長いときは写真URLを画面へのリンク1本にまとめる。 */
export function lineTextFor(data: VisitData): string {
  const full = visitText(data);
  if (full.length <= LINE_TEXT_LIMIT) return full;
  return visitTextCompact(data);
}

export async function sendToLine(text: string): Promise<"opened" | "copied" | "failed"> {
  if (text.length <= LINE_TEXT_LIMIT) {
    const url = "https://line.me/R/share?text=" + encodeURIComponent(text);
    const w = window.open(url, "_blank");
    if (!w) window.location.href = url;
    return "opened";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    window.prompt("下の記録をコピーして、LINEに貼り付けてください：", text);
    return "failed";
  }
}
