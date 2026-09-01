"use client";

import { useMemo, useState } from "react";
import { CHECK_ITEMS, PRIO_LABELS, STORES, hasAnyInput } from "@/lib/genba/checkItems";
import { ItemRecord, Prio, StoreData } from "@/lib/genba/types";

type Entry = { index: number; item: ItemRecord };
type Group = { key: Prio; label: string; note: string; color: string; entries: Entry[] };

/** 1店舗分を優先度ごとにまとめる。優先度が付いていない気づきは最後に回す。 */
function groupsOf(data: StoreData): Group[] {
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

/** 会長・専務へそのまま送れる、文字だけのまとめ */
function buildText(storeMap: Record<string, StoreData>): string {
  const lines: string[] = ["【Age.3 現場チェック結果】", "視察：2026/9/2〜9/5　銀座・浅草・原宿", "━━━━━━━━━━━━━"];
  for (const store of STORES) {
    const data = storeMap[store.id];
    if (!data) continue;
    const date = data.visitDate || "未定";
    lines.push(`■ ${store.name}店　訪問日：${date}${data.visitMemo ? `（${data.visitMemo}）` : ""}`);
    const groups = groupsOf(data);
    if (groups.length === 0) {
      lines.push("　（記入なし）");
    } else {
      for (const g of groups) {
        for (const e of g.entries) {
          const head = `　${e.item.done ? "✓" : "□"}[${e.item.prio || "-"}] ${CHECK_ITEMS[e.index].title}`;
          const memo = e.item.memo.trim() ? `：${e.item.memo.trim()}` : "";
          const photo = e.item.photos.length > 0 ? ` 📷${e.item.photos.length}` : "";
          lines.push(head + memo + photo);
        }
      }
    }
    lines.push("━━━━━━━━━━━━━");
  }
  lines.push("※現場メモの下書きです。共有・提出前に上長の確認をお願いします。");
  return lines.join("\n");
}

export function ReportView({ storeMap }: { storeMap: Record<string, StoreData> }) {
  const [copied, setCopied] = useState("");

  const totals = useMemo(() => {
    const t = { A: 0, B: 0, C: 0, photos: 0 };
    for (const store of STORES) {
      const data = storeMap[store.id];
      if (!data) continue;
      for (const item of data.items) {
        if (item.prio) t[item.prio] += 1;
        t.photos += item.photos.length;
      }
    }
    return t;
  }, [storeMap]);

  async function copyText() {
    const text = buildText(storeMap);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("コピーしました。LINEやメールに貼り付けてください。");
    } catch {
      window.prompt("下の内容を選択してコピーしてください：", text);
      setCopied("");
      return;
    }
    window.setTimeout(() => setCopied(""), 3000);
  }

  return (
    <div className="space-y-4">
      <section className="no-print rounded-2xl border border-[#e3e8ee] bg-white p-4">
        <h2 className="text-[15px] font-extrabold text-[#1f3350]">改善レポート</h2>
        <p className="text-[11.7px] text-[#5a6b7c]">
          現場チェックの記入内容を、店舗ごと・優先度A→B→C の順に並べたものです。そのまま印刷（PDF保存）して共有できます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-[#1f3350] px-4 py-2.5 text-sm font-extrabold text-white"
          >
            印刷 / PDFで保存
          </button>
          <button
            type="button"
            onClick={copyText}
            className="rounded-xl bg-[#2f8f9d] px-4 py-2.5 text-sm font-extrabold text-white"
          >
            文字だけコピー
          </button>
          {copied && <span className="self-center text-[12.5px] font-bold text-[#2f8f9d]">{copied}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-bold">
          {(["A", "B", "C"] as const).map((k) => (
            <span
              key={k}
              className="rounded-lg px-3 py-1.5 text-white"
              style={{ background: PRIO_LABELS[k].color }}
            >
              {k}（{PRIO_LABELS[k].note}） {totals[k]}件
            </span>
          ))}
          <span className="rounded-lg border border-[#e3e8ee] px-3 py-1.5 text-[#5a6b7c]">写真 {totals.photos}枚</span>
        </div>
      </section>

      {STORES.map((store) => {
        const data = storeMap[store.id];
        const groups = data ? groupsOf(data) : [];
        return (
          <section key={store.id} className="print-block rounded-2xl border border-[#e3e8ee] bg-white p-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e3e8ee] pb-3">
              <span
                className="grid h-9 w-14 flex-none place-items-center rounded-lg text-[13px] font-extrabold text-white"
                style={{ background: store.color }}
              >
                {store.name}
              </span>
              <span className="text-[13px] font-bold text-[#1f3350]">
                訪問日：{data?.visitDate || "____/__/__"}
              </span>
              {data?.visitMemo && <span className="text-[12.5px] text-[#5a6b7c]">{data.visitMemo}</span>}
            </div>

            {groups.length === 0 ? (
              <p className="pt-3 text-[13px] text-[#5a6b7c]">まだ記入がありません。</p>
            ) : (
              groups.map((g) => (
                <div key={g.key || "none"} className="pt-4">
                  <h3 className="text-[13px] font-extrabold" style={{ color: g.color }}>
                    {g.label}
                    <span className="ml-2 font-semibold text-[#5a6b7c]">
                      {g.note}・{g.entries.length}件
                    </span>
                  </h3>
                  <ul className="mt-2 space-y-3">
                    {g.entries.map((e) => (
                      <li
                        key={e.index}
                        className="print-block rounded-xl border-l-4 bg-[#fbfcfd] p-3"
                        style={{ borderLeftColor: g.color }}
                      >
                        <div className="text-[14px] font-extrabold">
                          <span className="mr-1.5 text-[#5a6b7c] tabular-nums">{e.index + 1}.</span>
                          {CHECK_ITEMS[e.index].title}
                        </div>
                        {e.item.memo.trim() ? (
                          <p className="mt-1 text-[13px] whitespace-pre-wrap">{e.item.memo}</p>
                        ) : (
                          <p className="mt-1 text-[12.5px] text-[#5a6b7c]">（メモなし）</p>
                        )}
                        {e.item.photos.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {e.item.photos.map((p) => (
                              // 静的書き出しのため next/image ではなく img を使う
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={p.path}
                                src={p.url}
                                alt={`${CHECK_ITEMS[e.index].title}の現場写真`}
                                className="h-28 w-28 rounded-lg border border-[#e3e8ee] object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        );
      })}

      <p className="pb-6 text-center text-[11.5px] leading-relaxed text-[#9aa7b3]">
        このレポートは現場メモの下書きです。共有・提出の前に、必ずご自身と上長（松下専務・中嶋会長）の目でご確認ください。
      </p>
    </div>
  );
}
