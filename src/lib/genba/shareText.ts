import { CHECK_ITEMS, PRIO_LABELS, STORES, Store, hasAnyInput } from "@/lib/genba/checkItems";
import { ItemRecord, Prio, StoreData } from "@/lib/genba/types";

export type Entry = { index: number; item: ItemRecord };
export type Group = { key: Prio; label: string; note: string; color: string; entries: Entry[] };

/** 1店舗分を優先度ごとにまとめる。優先度が付いていない気づきは最後に回す。 */
export function groupsOf(data: StoreData): Group[] {
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

/** LINEやメールにそのまま貼れる、1店舗ぶんのまとめ */
export function storeText(store: Store, data: StoreData): string {
  const lines = [
    `【Age.3 現場チェック】${store.name}店`,
    `訪問日：${data.visitDate || "未定"}${data.visitMemo ? `（${data.visitMemo}）` : ""}`,
    "━━━━━━━━━━━━━",
  ];
  const groups = groupsOf(data);
  if (groups.length === 0) {
    lines.push("　（記入なし）");
  } else {
    for (const g of groups) for (const e of g.entries) lines.push(lineOf(e));
  }
  lines.push("━━━━━━━━━━━━━", FOOTER);
  return lines.join("\n");
}

/** 3店舗ぶんをまとめたもの（改善レポート用） */
export function allStoresText(storeMap: Record<string, StoreData>): string {
  const lines = ["【Age.3 現場チェック結果】", "視察：2026/9/2〜9/5　銀座・浅草・原宿", "━━━━━━━━━━━━━"];
  for (const store of STORES) {
    const data = storeMap[store.id];
    if (!data) continue;
    lines.push(`■ ${store.name}店　訪問日：${data.visitDate || "未定"}${data.visitMemo ? `（${data.visitMemo}）` : ""}`);
    const groups = groupsOf(data);
    if (groups.length === 0) {
      lines.push("　（記入なし）");
    } else {
      for (const g of groups) for (const e of g.entries) lines.push(lineOf(e));
    }
    lines.push("━━━━━━━━━━━━━");
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
