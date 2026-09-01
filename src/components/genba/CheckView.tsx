"use client";

import { useState } from "react";
import { CHECK_ITEMS, PRIO_LABELS, STORES, countDone } from "@/lib/genba/checkItems";
import { lineTextFor, sendToLine, visitText } from "@/lib/genba/shareText";
import { Photo, Prio, Visit, VisitData } from "@/lib/genba/types";
import { PhotoStrip } from "@/components/genba/PhotoStrip";

const PRIO_KEYS: ("A" | "B" | "C")[] = ["A", "B", "C"];

function storeOf(storeId: string) {
  return STORES.find((s) => s.id === storeId) ?? STORES[0];
}

/** 9/2 のように短く出す */
function shortDate(date: string) {
  const [, m, d] = date.split("-");
  return m && d ? `${Number(m)}/${Number(d)}` : date;
}

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 訪問の一覧と、訪問を足すところ */
function VisitBar({
  visits,
  visitId,
  onSelect,
  onAdd,
}: {
  visits: Visit[];
  visitId: string;
  onSelect: (id: string) => void;
  onAdd: (storeId: string, date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(STORES[0].id);
  const [date, setDate] = useState(todayISO);

  return (
    <div className="rounded-2xl border border-[#e3e8ee] bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {visits.map((v) => {
          const store = storeOf(v.storeId);
          const on = v.id === visitId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              aria-pressed={on}
              className={`rounded-xl border px-3 py-2 text-left text-[13px] leading-tight font-extrabold transition ${
                on ? "border-transparent text-white" : "border-[#e3e8ee] bg-white text-[#5a6b7c]"
              }`}
              style={on ? { background: store.color } : undefined}
            >
              {store.name}　{shortDate(v.date)}
              <span className="block text-[10.5px] font-semibold opacity-80 tabular-nums">
                {countDone(v)} / {CHECK_ITEMS.length}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-dashed border-[#c6d2dd] px-3 py-2 text-[13px] font-bold text-[#5a6b7c]"
        >
          ＋ 訪問を追加
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#e3e8ee] pt-3">
          <div className="min-w-[120px] flex-1">
            <label className="mb-0.5 block text-[11px] font-bold text-[#5a6b7c]" htmlFor="add-store">
              店舗
            </label>
            <select
              id="add-store"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
            >
              {STORES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}店
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-0.5 block text-[11px] font-bold text-[#5a6b7c]" htmlFor="add-date">
              訪問日
            </label>
            <input
              id="add-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onAdd(storeId, date);
              setOpen(false);
            }}
            className="rounded-xl bg-[#1f3350] px-5 py-2.5 text-sm font-extrabold text-white"
          >
            追加する
          </button>
        </div>
      )}
    </div>
  );
}

export function CheckView({
  visits,
  visitId,
  onSelectVisit,
  onAddVisit,
  onRemoveVisit,
  data,
  previous,
  onUpdateMemo,
  onUpdateItem,
}: {
  visits: Visit[];
  visitId: string;
  onSelectVisit: (id: string) => void;
  onAddVisit: (storeId: string, date: string) => void;
  onRemoveVisit: (id: string) => void;
  data: VisitData | null;
  /** 同じ店の前回の訪問。再訪のとき「前回の指摘」を出すために使う */
  previous: Visit | null;
  onUpdateMemo: (memo: string) => void;
  onUpdateItem: (
    index: number,
    patch: { done?: boolean; prio?: Prio; memo?: string; photos?: Photo[] },
    immediate?: boolean
  ) => void;
}) {
  const [message, setMessage] = useState("");

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function handleSendLine() {
    if (!data) return;
    const result = await sendToLine(lineTextFor(data));
    if (result === "copied") flash("記録が長いのでコピーしました。LINEを開いて貼り付けてください。");
    else if (result === "opened") flash("LINEを開きました。送り先を選んでください。");
  }

  async function handleCopy() {
    if (!data) return;
    const text = visitText(data);
    try {
      await navigator.clipboard.writeText(text);
      flash("コピーしました。LINEやメールに貼り付けてください。");
    } catch {
      window.prompt("下の記録をコピーしてください：", text);
    }
  }

  return (
    <div className="space-y-4">
      <VisitBar visits={visits} visitId={visitId} onSelect={onSelectVisit} onAdd={onAddVisit} />

      {!data ? (
        <p className="rounded-2xl border border-dashed border-[#e3e8ee] bg-white p-6 text-center text-[13px] text-[#5a6b7c]">
          まだ訪問がありません。上の「＋ 訪問を追加」から、行く店舗と日にちを入れてください。
          <br />
          同じ店に何度行っても、日ごとに別の記録として残ります。
        </p>
      ) : (
        <>
          {(() => {
            const store = storeOf(data.storeId);
            const done = countDone(data);
            return (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e8ee] bg-white p-4">
                  <div
                    className="grid h-11 flex-none place-items-center rounded-xl px-4 text-sm font-extrabold text-white"
                    style={{ background: store.color }}
                  >
                    {store.name}
                  </div>
                  <div className="text-[13px] font-bold text-[#1f3350]">{data.date}</div>
                  <div className="min-w-[160px] flex-1">
                    <label className="mb-0.5 block text-[11px] font-bold text-[#5a6b7c]" htmlFor="visit-memo">
                      時間帯・メモ
                    </label>
                    <input
                      id="visit-memo"
                      type="text"
                      value={data.memo}
                      placeholder="例：11:30 ピーク時に訪問"
                      onChange={(e) => onUpdateMemo(e.target.value)}
                      className="w-full rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`${store.name}店 ${data.date} の記録を削除します。よろしいですか？`)) {
                        onRemoveVisit(visitId);
                      }
                    }}
                    className="rounded-lg border border-[#e3e8ee] px-3 py-2 text-[11px] font-bold text-[#c0392b]"
                  >
                    この訪問を削除
                  </button>
                </div>

                {previous && (
                  <p className="rounded-xl border border-[#2f8f9d] bg-[#eef7f8] px-4 py-2.5 text-[12.5px] font-bold text-[#1f3350]">
                    {store.name}店は {shortDate(previous.date)} にも来ています。前回の指摘が各項目に出ます。直っていれば、そう書いてください。
                  </p>
                )}

                <div className="flex items-center gap-3 rounded-xl border border-[#e3e8ee] bg-white px-4 py-3">
                  <span className="text-[12.5px] font-extrabold whitespace-nowrap text-[#1f3350] tabular-nums">
                    {done} / {CHECK_ITEMS.length}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9eef3]">
                    <span
                      className="block h-full bg-[#2f8f9d] transition-[width] duration-200"
                      style={{ width: `${(done / CHECK_ITEMS.length) * 100}%` }}
                    />
                  </span>
                </div>

                {CHECK_ITEMS.map((item, i) => {
                  const rec = data.items[i];
                  const before = previous?.items[i];
                  const beforeWorth = before && (before.prio !== "" || before.memo.trim() !== "");
                  return (
                    <section key={item.title} className="rounded-2xl border border-[#e3e8ee] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[#1f3350] text-[12.5px] font-extrabold text-white">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-[15px] leading-snug font-extrabold">{item.title}</h3>
                          <p className="text-[11.7px] text-[#5a6b7c]">{item.hint}</p>
                        </div>
                        <label className="flex flex-none cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[#5a6b7c]">
                          <input
                            type="checkbox"
                            checked={rec.done}
                            onChange={(e) => onUpdateItem(i, { done: e.target.checked }, true)}
                            className="h-5 w-5 accent-[#2f8f9d]"
                          />
                          見た
                        </label>
                      </div>

                      {item.points && (
                        <ul className="mt-2 ml-10 list-disc space-y-0.5 text-[11.7px] text-[#5a6b7c]">
                          {item.points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}

                      {beforeWorth && previous && (
                        <div
                          className="mt-3 rounded-lg border-l-4 bg-[#f7fafb] px-3 py-2"
                          style={{
                            borderLeftColor: before.prio ? PRIO_LABELS[before.prio].color : "#c6d2dd",
                          }}
                        >
                          <div className="text-[10.5px] font-bold text-[#5a6b7c]">
                            前回（{shortDate(previous.date)}
                            {before.prio ? `・優先度${before.prio}` : ""}）の指摘
                          </div>
                          {before.memo.trim() && (
                            <p className="text-[12.5px] whitespace-pre-wrap text-[#26313d]">{before.memo}</p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        {PRIO_KEYS.map((key) => {
                          const on = rec.prio === key;
                          const meta = PRIO_LABELS[key];
                          return (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={on}
                              onClick={() => onUpdateItem(i, { prio: on ? "" : key }, true)}
                              className={`flex-1 rounded-lg border-2 px-1 py-2 text-center text-[12.5px] font-extrabold transition ${
                                on ? "border-transparent text-white" : "border-[#e3e8ee] bg-white text-[#5a6b7c]"
                              }`}
                              style={on ? { background: meta.color } : undefined}
                            >
                              {meta.label}
                              <small className="block text-[9.5px] font-semibold opacity-80">{meta.note}</small>
                            </button>
                          );
                        })}
                      </div>

                      <textarea
                        value={rec.memo}
                        placeholder="気づき・改善案をメモ"
                        onChange={(e) => onUpdateItem(i, { memo: e.target.value })}
                        onFocus={() => {
                          // 書き始めるときに見出しを用意する
                          if (item.memoTemplate && rec.memo === "") onUpdateItem(i, { memo: item.memoTemplate });
                        }}
                        onBlur={() => {
                          // 見出しのままなら記録に残さない
                          if (item.memoTemplate && rec.memo === item.memoTemplate) onUpdateItem(i, { memo: "" }, true);
                        }}
                        className={`mt-2 w-full resize-y rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base ${
                          item.memoTemplate ? "min-h-[150px]" : "min-h-[64px]"
                        }`}
                      />

                      <PhotoStrip
                        storeId={data.storeId}
                        itemIndex={i}
                        photos={rec.photos}
                        onChange={(photos) => onUpdateItem(i, { photos }, true)}
                      />
                    </section>
                  );
                })}

                <section className="no-print rounded-2xl border border-[#e3e8ee] bg-white p-4">
                  <h2 className="text-[15px] font-extrabold text-[#1f3350]">
                    {store.name}店 {shortDate(data.date)} の記録を送る
                  </h2>
                  <p className="text-[11.7px] text-[#5a6b7c]">
                    この訪問ぶんを、優先度つきの文章にしてLINEに送ります。写真はリンクで付きます。
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendLine}
                      className="rounded-xl bg-[#06C755] px-5 py-3 text-sm font-extrabold text-white"
                    >
                      LINEに送る
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="rounded-xl border border-[#e3e8ee] bg-white px-4 py-3 text-sm font-bold text-[#5a6b7c]"
                    >
                      文字をコピー
                    </button>
                    {message && <span className="text-[12.5px] font-bold text-[#2f8f9d]">{message}</span>}
                  </div>
                </section>
              </>
            );
          })()}
        </>
      )}

      <p className="pb-6 text-center text-[11.5px] leading-relaxed text-[#9aa7b3]">
        記録は現場メモの下書きです。共有・提出の前に、必ずご自身と上長（松下専務・中嶋会長）の目でご確認ください。
      </p>
    </div>
  );
}
