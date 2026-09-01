"use client";

import { useState } from "react";
import { CHECK_ITEMS, PRIO_LABELS, STORES, countDone } from "@/lib/genba/checkItems";
import { sendToLine, storeText } from "@/lib/genba/shareText";
import { Photo, Prio, StoreData } from "@/lib/genba/types";
import { PhotoStrip } from "@/components/genba/PhotoStrip";

const PRIO_KEYS: ("A" | "B" | "C")[] = ["A", "B", "C"];

function StoreTabs({
  storeId,
  onChange,
  doneOf,
}: {
  storeId: string;
  onChange: (id: string) => void;
  doneOf: (id: string) => number;
}) {
  return (
    <div className="flex gap-2">
      {STORES.map((s) => {
        const on = s.id === storeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`flex-1 rounded-xl border px-2 py-2 text-center text-sm font-extrabold transition ${
              on ? "border-transparent text-white" : "border-[#e3e8ee] bg-white text-[#5a6b7c]"
            }`}
            style={on ? { background: s.color } : undefined}
          >
            {s.name}
            <span className="block text-[10.5px] font-semibold opacity-80">
              {doneOf(s.id)}/{CHECK_ITEMS.length} 済
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CheckView({
  storeId,
  onChangeStore,
  data,
  getDone,
  onUpdateStore,
  onUpdateItem,
}: {
  storeId: string;
  onChangeStore: (id: string) => void;
  data: StoreData;
  getDone: (id: string) => number;
  onUpdateStore: (patch: { visitDate?: string; visitMemo?: string }) => void;
  onUpdateItem: (
    index: number,
    patch: { done?: boolean; prio?: Prio; memo?: string; photos?: Photo[] },
    immediate?: boolean
  ) => void;
}) {
  const store = STORES.find((s) => s.id === storeId) ?? STORES[0];
  const done = countDone(data);
  const [message, setMessage] = useState("");

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  }

  async function handleSendLine() {
    const result = await sendToLine(storeText(store, data));
    if (result === "copied") {
      flash("記録が長いのでコピーしました。LINEを開いて貼り付けてください。");
    } else if (result === "opened") {
      flash("LINEを開きました。送り先を選んでください。");
    }
  }

  async function handleCopy() {
    const text = storeText(store, data);
    try {
      await navigator.clipboard.writeText(text);
      flash("コピーしました。LINEやメールに貼り付けてください。");
    } catch {
      window.prompt("下の記録をコピーしてください：", text);
    }
  }

  return (
    <div className="space-y-4">
      <StoreTabs storeId={storeId} onChange={onChangeStore} doneOf={getDone} />

      {/* 訪問日・時間帯メモ */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e8ee] bg-white p-4">
        <div
          className="grid h-11 w-11 flex-none place-items-center rounded-xl text-sm font-extrabold text-white"
          style={{ background: store.color }}
        >
          {store.name}
        </div>
        <div className="min-w-[130px] flex-1">
          <label className="mb-0.5 block text-[11px] font-bold text-[#5a6b7c]" htmlFor="visit-date">
            訪問日
          </label>
          <input
            id="visit-date"
            type="date"
            value={data.visitDate}
            onChange={(e) => onUpdateStore({ visitDate: e.target.value })}
            className="w-full rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
          />
        </div>
        <div className="min-w-[160px] flex-2">
          <label className="mb-0.5 block text-[11px] font-bold text-[#5a6b7c]" htmlFor="visit-memo">
            時間帯・メモ（任意）
          </label>
          <input
            id="visit-memo"
            type="text"
            value={data.visitMemo}
            placeholder="例：11:30 ピーク時に訪問"
            onChange={(e) => onUpdateStore({ visitMemo: e.target.value })}
            className="w-full rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
          />
        </div>
      </div>

      {/* 進捗 */}
      <div className="flex items-center gap-3 rounded-xl border border-[#e3e8ee] bg-white px-4 py-3">
        <span className="text-[12.5px] font-extrabold whitespace-nowrap text-[#1f3350]">
          {done} / {CHECK_ITEMS.length}
        </span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9eef3]">
          <span
            className="block h-full bg-[#2f8f9d] transition-[width] duration-200"
            style={{ width: `${(done / CHECK_ITEMS.length) * 100}%` }}
          />
        </span>
      </div>

      {/* 10項目 */}
      {CHECK_ITEMS.map((item, i) => {
        const rec = data.items[i];
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

            {/* 優先度 */}
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
              className="mt-2 min-h-[64px] w-full resize-y rounded-lg border border-[#e3e8ee] bg-[#fbfcfd] px-3 py-2 text-base"
            />

            <PhotoStrip
              storeId={storeId}
              itemIndex={i}
              photos={rec.photos}
              onChange={(photos) => onUpdateItem(i, { photos }, true)}
            />
          </section>
        );
      })}

      {/* この店舗ぶんの記録を、そのままLINEで送れるようにする */}
      <section className="no-print rounded-2xl border border-[#e3e8ee] bg-white p-4">
        <h2 className="text-[15px] font-extrabold text-[#1f3350]">{store.name}店の記録を送る</h2>
        <p className="text-[11.7px] text-[#5a6b7c]">
          いまこの画面に入力した{store.name}店ぶんを、優先度つきの文章にしてLINEに送ります。
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

      <p className="pb-6 text-center text-[11.5px] leading-relaxed text-[#9aa7b3]">
        記録は現場メモの下書きです。共有・提出の前に、必ずご自身と上長（松下専務・中嶋会長）の目でご確認ください。
      </p>
    </div>
  );
}
