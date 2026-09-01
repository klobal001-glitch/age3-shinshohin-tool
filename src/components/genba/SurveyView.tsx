"use client";

import { useMemo, useState } from "react";
import { STORES } from "@/lib/genba/checkItems";
import { SURVEY_QUESTIONS, tally, tallyCountries } from "@/lib/genba/survey";
import { SurveyResponse } from "@/lib/genba/types";

/**
 * 設問1つ分の集計。
 * 1本のグラフに出るのは「回答数」という1種類の値だけなので、色は1色に統一し、
 * 件数と割合は数字でも併記する（色だけで読み取らせない）。
 */
function QuestionTally({ responses, index }: { responses: SurveyResponse[]; index: number }) {
  const q = SURVEY_QUESTIONS[index];
  const { rows, answered } = tally(responses, q);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="print-block rounded-2xl border border-[#e3e8ee] bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-[#1f3350] text-[11.5px] font-extrabold text-white">
          {q.no}
        </span>
        <h3 className="text-[15px] font-extrabold">{q.ja}</h3>
        <span className="text-[11.5px] text-[#5a6b7c]">{q.en}</span>
        <span className="ml-auto text-[11.5px] font-bold text-[#5a6b7c]">回答 {answered} 枚</span>
      </div>

      <table className="mt-3 w-full border-collapse">
        <caption className="sr-only">{q.ja}の回答数</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.option.id}>
              <th
                scope="row"
                className="w-[38%] py-1 pr-2 text-left align-middle text-[12.5px] font-semibold text-[#26313d]"
              >
                <span aria-hidden="true" className="mr-1">
                  {row.option.emoji}
                </span>
                {row.option.ja}
              </th>
              <td className="py-1 align-middle">
                <span className="block h-3.5 w-full rounded-sm bg-[#eef2f6]">
                  <span
                    className="block h-full rounded-sm bg-[#2f8f9d]"
                    style={{ width: `${(row.count / max) * 100}%` }}
                  />
                </span>
              </td>
              <td className="w-[86px] py-1 pl-2 text-right align-middle text-[12px] font-bold whitespace-nowrap text-[#5a6b7c] tabular-nums">
                {row.count} 枚
                <span className="ml-1 font-semibold">({Math.round(row.percent)}%)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SurveyView({
  responses,
  onStartAsking,
  onDelete,
}: {
  responses: SurveyResponse[];
  onStartAsking: () => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => (filter === "all" ? responses : responses.filter((r) => r.storeId === filter)),
    [responses, filter]
  );
  const countries = useMemo(() => tallyCountries(filtered), [filtered]);

  return (
    <div className="space-y-4">
      {/* お客様にスマホを渡して答えてもらう。回収した紙を入力するときも同じ画面を使う */}
      <section className="rounded-2xl border border-[#e3e8ee] bg-white p-4">
        <h2 className="text-[15px] font-extrabold text-[#1f3350]">お客様に答えてもらう</h2>
        <p className="text-[11.7px] text-[#5a6b7c]">
          この端末を渡すと、英語の大きな画面が1問ずつ出ます。回収した紙を入力するときも同じ画面が使えます。
        </p>
        <button
          type="button"
          onClick={onStartAsking}
          className="mt-3 w-full rounded-xl bg-[#2f8f9d] px-5 py-4 text-base font-extrabold text-white"
        >
          アンケートを始める
        </button>
      </section>

      <section className="rounded-2xl border border-[#e3e8ee] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-extrabold text-[#1f3350]">集計</h2>
          <div className="ml-auto flex gap-2">
            {[{ id: "all", name: "全店" }, ...STORES].map((s) => {
              const on = filter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilter(s.id)}
                  className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
                    on ? "border-[#1f3350] bg-[#1f3350] text-white" : "border-[#e3e8ee] bg-white text-[#5a6b7c]"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[#5a6b7c]">
          回収した用紙　
          <strong className="text-2xl font-extrabold text-[#1f3350] tabular-nums">{filtered.length}</strong> 枚
        </p>
      </section>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e3e8ee] bg-white p-6 text-center text-[13px] text-[#5a6b7c]">
          まだ回答がありません。上の欄から用紙を1枚ずつ入れると、ここに集計が出ます。
        </p>
      ) : (
        <>
          {SURVEY_QUESTIONS.map((q, i) => (
            <QuestionTally key={q.key} responses={filtered} index={i} />
          ))}

          {countries.length > 0 && (
            <section className="rounded-2xl border border-[#e3e8ee] bg-white p-4">
              <h3 className="text-[15px] font-extrabold text-[#1f3350]">記入された国名</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {countries.map((c) => (
                  <li
                    key={c.name}
                    className="rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-1.5 text-[12.5px] font-bold"
                  >
                    {c.name}
                    <span className="ml-1.5 font-semibold text-[#5a6b7c] tabular-nums">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-[#e3e8ee] bg-white p-4">
            <h3 className="text-[15px] font-extrabold text-[#1f3350]">入力した用紙（{filtered.length}枚）</h3>
            <ul className="mt-2 divide-y divide-[#e3e8ee]">
              {filtered.map((r, i) => {
                const store = STORES.find((s) => s.id === r.storeId);
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2 text-[12.5px]">
                    <span className="w-8 text-[#5a6b7c] tabular-nums">{i + 1}</span>
                    <span className="font-bold">{store?.name ?? r.storeId}</span>
                    <span className="text-[#5a6b7c]">{r.answeredOn || "日付なし"}</span>
                    <span className="truncate text-[#5a6b7c]">{r.data.country}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("この1枚を削除します。よろしいですか？")) onDelete(r.id);
                      }}
                      className="ml-auto rounded-md border border-[#e3e8ee] px-2 py-1 text-[11px] font-bold text-[#c0392b]"
                    >
                      削除
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
