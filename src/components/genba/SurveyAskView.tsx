"use client";

import { useState } from "react";
import { STORES } from "@/lib/genba/checkItems";
import { SURVEY_QUESTIONS, createEmptyAnswer, hasAnyAnswer } from "@/lib/genba/survey";
import { SurveyAnswer } from "@/lib/genba/types";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * お客様にスマホを渡して答えてもらうための画面。
 *
 * 来店客の8割が外国のお客様なので、英語を大きく・日本語を小さく、
 * 1問ずつだけ出して、押したら次へ進む。設問ごとに色を変えて、
 * 画面が切り替わったこと・どこまで進んだかが一目で分かるようにしている。
 */
export function SurveyAskView({
  storeId,
  onChangeStore,
  onSubmit,
  onExit,
}: {
  storeId: string;
  onChangeStore: (id: string) => void;
  onSubmit: (storeId: string, answeredOn: string, data: SurveyAnswer) => Promise<boolean>;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<SurveyAnswer>(createEmptyAnswer);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const q = SURVEY_QUESTIONS[step];
  const last = step === SURVEY_QUESTIONS.length - 1;

  async function finish(next: SurveyAnswer) {
    if (!hasAnyAnswer(next)) {
      // 何も答えないまま最後まで来たときは、記録せずに最初へ戻す
      reset();
      return;
    }
    setBusy(true);
    const ok = await onSubmit(storeId, todayISO(), next);
    setBusy(false);
    setFailed(!ok);
    setDone(true);
  }

  function choose(optionId: string) {
    const next = { ...answer, [q.key]: answer[q.key] === optionId ? "" : optionId };
    setAnswer(next);
    // 国名を書いてもらう設問だけは、書く時間が要るので自動では進まない
    if (q.writeIn) return;
    window.setTimeout(() => {
      if (last) finish(next);
      else setStep((s) => s + 1);
    }, 220);
  }

  function goNext() {
    if (last) finish(answer);
    else setStep((s) => s + 1);
  }

  function reset() {
    setAnswer(createEmptyAnswer());
    setStep(0);
    setDone(false);
    setFailed(false);
  }

  /* ---------------- お礼の画面 ---------------- */
  if (done) {
    return (
      <div className="min-h-screen bg-[#f6f8fa]">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-4 text-3xl font-extrabold text-[#1f3350]">Thank you!</h1>
          <p className="mt-1 text-sm text-[#5a6b7c]">ご協力ありがとうございました。</p>

          <div className="mt-7 rounded-2xl border border-[#e3e8ee] bg-white p-5">
            <div className="text-4xl">🎁</div>
            <p className="mt-2 text-lg font-bold text-[#26313d]">A small gift for you!</p>
            <p className="text-xs text-[#5a6b7c]">お礼にアクリルキーホルダーをどうぞ</p>
          </div>

          {failed && (
            <p className="mt-5 rounded-xl border border-[#c0392b] bg-white px-4 py-3 text-[13px] font-bold text-[#c0392b]">
              電波が届かず、この端末に保存しました。電波の良い場所で開くと送られます。
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-2xl bg-[#1f3350] px-6 py-5 text-lg font-extrabold text-white"
          >
            次の方へ
            <span className="block text-xs font-semibold opacity-75">Next customer</span>
          </button>
          <button type="button" onClick={onExit} className="mt-3 py-2 text-[13px] font-bold text-[#5a6b7c]">
            終了する
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- 設問の画面 ---------------- */
  return (
    <div className="min-h-screen bg-[#f6f8fa]">
      {/* 上の細い帯：店舗と、いま何問目か */}
      <div className="sticky top-0 z-10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <select
            value={storeId}
            onChange={(e) => onChangeStore(e.target.value)}
            aria-label="店舗"
            className="rounded-lg border border-[#e3e8ee] bg-white px-2 py-1 text-[12px] font-bold text-[#5a6b7c]"
          >
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}店
              </option>
            ))}
          </select>

          <div className="flex flex-1 justify-center gap-1.5" aria-hidden="true">
            {SURVEY_QUESTIONS.map((item, i) => (
              <span
                key={item.key}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === step ? 26 : 10,
                  background: i <= step ? item.color : "#dde5ec",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onExit}
            aria-label="アンケートを終了する"
            className="px-1 text-lg leading-none font-bold text-[#8c9aa8]"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-28">
        {/* 設問 */}
        <div className="pt-7 pb-5">
          <div
            className="text-[12px] font-bold tracking-widest uppercase"
            style={{ color: q.color }}
          >
            Question {q.no} / {SURVEY_QUESTIONS.length}
          </div>
          <h1 className="mt-1 text-[26px] leading-tight font-extrabold text-[#1f3350]">{q.en}</h1>
          <p className="mt-1 text-[13px] text-[#5a6b7c]">{q.ja}</p>
        </div>

        {/* 選択肢 */}
        <div className="grid gap-2.5">
          {q.options.map((o) => {
            const on = answer[q.key] === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => choose(o.id)}
                className="flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition"
                style={{
                  borderColor: on ? q.color : "#e3e8ee",
                  background: on ? q.color : "#ffffff",
                  color: on ? "#ffffff" : "#26313d",
                }}
              >
                <span
                  className="grid h-11 w-11 flex-none place-items-center rounded-xl text-2xl"
                  style={{ background: on ? "rgba(255,255,255,.2)" : "#f2f6f9" }}
                  aria-hidden="true"
                >
                  {o.emoji}
                </span>
                <span className="leading-tight">
                  <span className="block text-[18px] font-extrabold">{o.en}</span>
                  <span className={`block text-[11.5px] ${on ? "text-white/85" : "text-[#5a6b7c]"}`}>
                    {o.ja}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* 国名の記入（Q2 のみ） */}
        {q.writeIn && (
          <div className="mt-4">
            <label htmlFor="ask-country" className="mb-1 block leading-tight">
              <span className="block text-[15px] font-bold text-[#26313d]">Country name</span>
              <span className="block text-[11px] font-semibold text-[#5a6b7c]">国名（任意）</span>
            </label>
            <input
              id="ask-country"
              type="text"
              value={answer.country}
              placeholder="e.g. Taiwan"
              onChange={(e) => setAnswer((prev) => ({ ...prev, country: e.target.value }))}
              className="w-full rounded-xl border-2 border-[#e3e8ee] bg-white px-4 py-3 text-base"
            />
          </div>
        )}
      </div>

      {/* 下の操作 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#e3e8ee] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
            className="rounded-xl border border-[#e3e8ee] px-4 py-3 text-sm font-bold text-[#5a6b7c] disabled:opacity-35"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={busy}
            className="flex-1 rounded-xl px-4 py-3.5 text-base font-extrabold text-white disabled:opacity-60"
            style={{ background: q.color }}
          >
            {busy ? "送信中…" : last ? "Finish  完了" : "Next  →"}
          </button>
        </div>
      </div>
    </div>
  );
}
