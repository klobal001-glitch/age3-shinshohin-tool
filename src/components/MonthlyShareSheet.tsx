"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import MonthlyPhoto from "@/components/MonthlyPhoto";
import {
  MonthEntry,
  hasPrice,
  missingForPoster,
  periodText,
  priceText,
  storeText,
  ymLabel,
} from "@/lib/monthly";
import { btn, muted } from "@/lib/ui";

/* ------------------------------------------------------------------ *
 * リーダーグループへの共有物（翌月＋翌々月）
 *
 * 毎月20日ごろに共有する「次の2か月で出る商品」のまとめ。
 * スマホで読むものなので、縦1列・大きめの文字にしてある。
 *
 * **社内の準備状況・担当・原価・仕入・内部メモは入れない。**
 * ここから自動で送信することはしない（送るのは人が決める）。
 * ------------------------------------------------------------------ */

export interface ShareMonth {
  year: number;
  month: number;
  entries: MonthEntry[];
}

/** LINE などにそのまま貼れる文字 */
export function shareText(months: ShareMonth[]): string {
  const lines: string[] = ["【Age.3】次の2か月の新商品"];
  for (const m of months) {
    lines.push("");
    lines.push(`■ ${ymLabel(m.year, m.month)}（${m.entries.length}件）`);
    if (m.entries.length === 0) {
      lines.push("　この月に発売開始する商品は登録されていません");
      continue;
    }
    for (const e of m.entries) {
      lines.push(`・${e.product.name}`);
      lines.push(`　販売期間：${periodText(e)}`);
      lines.push(`　価格：${priceText(e.fields)}${hasPrice(e.fields) ? "（税込）" : ""}`);
      lines.push(`　対象店舗：${storeText(e.fields)}`);
      const miss = missingForPoster(e);
      if (miss.length > 0) lines.push(`　※まだ決まっていません：${miss.join("／")}`);
    }
  }
  lines.push("");
  lines.push("※販売期間・価格は変更になる場合があります。");
  return lines.join("\n");
}

export default function MonthlyShareSheet({
  months,
  onClose,
}: {
  months: ShareMonth[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => shareText(months), [months]);

  useEffect(() => {
    document.body.classList.add("share-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("share-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("下の文字をコピーしてください", text);
    }
  };

  /* 刷るときに後ろの画面を消すため、画面のいちばん外側に出す（globals.css の body.share-open） */
  return createPortal(
    <div className="share-sheet fixed inset-0 z-50 overflow-auto bg-stone-200 p-4 sm:p-6">
      <div className="mx-auto mb-4 flex max-w-[520px] flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={onClose} className={btn("secondary")}>
          <Icon name="close" className="h-4 w-4" />
          閉じる
        </button>
        <button type="button" onClick={copy} className={btn("secondary")}>
          {copied ? "コピーしました" : "文字をコピー"}
        </button>
        <button type="button" onClick={() => window.print()} className={btn("primary", "ml-auto")}>
          印刷・PDFで保存
        </button>
      </div>

      <p className={`mx-auto mb-3 max-w-[520px] ${muted} print:hidden`}>
        リーダーグループへの共有用です。社内の準備状況・担当・原価・仕入・内部メモは入っていません。
        送信はこの画面では行いません。内容を確かめてから、ご自身で共有してください。
      </p>

      <div className="share-paper mx-auto max-w-[520px] rounded-2xl bg-white p-5 shadow-lg print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <h2 className="text-lg font-bold text-stone-900">Age.3　次の2か月の新商品</h2>

        {months.map((m) => (
          <section key={`${m.year}-${m.month}`} className="mt-5">
            <h3 className="border-b-2 border-stone-900 pb-1 text-base font-bold text-stone-900">
              {ymLabel(m.year, m.month)}
              <span className="ml-2 text-sm font-normal text-stone-500">{m.entries.length}件</span>
            </h3>

            {m.entries.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">
                この月に発売開始する商品は登録されていません。
              </p>
            ) : (
              <ul className="mt-3 space-y-4">
                {m.entries.map((e, i) => (
                  <li key={i} className="share-item flex gap-3">
                    <MonthlyPhoto
                      image={e.image}
                      className="h-24 w-24 shrink-0 rounded-lg bg-stone-100 object-contain p-1"
                      fontSize={11}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold leading-snug text-stone-900">
                        {e.product.name}
                      </div>
                      <dl className="mt-1 space-y-0.5 text-sm text-stone-700">
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-stone-500">販売期間</dt>
                          <dd>{periodText(e)}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-stone-500">価格</dt>
                          <dd className="tabular-nums">
                            {priceText(e.fields)}
                            {hasPrice(e.fields) && "（税込）"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-stone-500">対象店舗</dt>
                          <dd>{storeText(e.fields)}</dd>
                        </div>
                      </dl>
                      {missingForPoster(e).length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          ※まだ決まっていません：{missingForPoster(e).join("／")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="mt-6 border-t border-stone-200 pt-2 text-xs text-stone-500">
          ※販売期間・価格は変更になる場合があります。
        </p>
      </div>
    </div>,
    document.body
  );
}
