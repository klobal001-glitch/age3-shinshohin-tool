"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import MonthlyPhoto from "@/components/MonthlyPhoto";
import { useAppData } from "@/hooks/useAppData";
import {
  MonthEntry,
  RangeEntry,
  YearMonth,
  collectRange,
  entryKey,
  missingForSchedule,
  monthFromNow,
  periodText,
  rangeMonthsLabel,
  rangeTitle,
  scheduleReady,
  sortMonths,
  ymKey,
  ymLabel,
} from "@/lib/monthly";
import {
  PhotoState,
  SCHEDULE_MAX,
  SCHEDULE_PER_PAGE,
  ScheduleItem,
  canvasToJpeg,
  drawSchedulePages,
  jpegsToA4Pdf,
  loadPhoto,
  saveBlob,
} from "@/lib/posterPdf";
import { toThumbnailUrl } from "@/lib/imageUrl";
import { fileToPosterPhoto, rememberPhoto, storedPhoto } from "@/lib/posterPhotoStore";
import { GENRE_LABELS } from "@/lib/types";
import { badge, btn, muted } from "@/lib/ui";

/* ------------------------------------------------------------------ *
 * 海外チームへ送る「商品予定」の資料
 *
 * 流れは3つだけ：**① 月を選ぶ → ② 入れる商品を選ぶ → ③ PDFを保存**
 *
 * 大事な決めごと
 * - **月を選んだだけでは「出してよい」とは決めない。**
 *   資料に入れる商品は、かならず1件ずつチェックしてもらう。
 *   初めから入っているチェックは1つもない。
 * - **価格は載せない。**店頭に貼るA4（価格あり）とは別の用途。
 *   資料に渡す値（ScheduleItem）に価格の項目そのものが無い。
 * - 選んだ月のどれかと販売期間が重なる商品は、続いているものも含めて拾う。
 *   どの月に売っているかは「11月〜1月」のように資料にも出す。
 * - **通年・レギュラー・店舗限定の商品を、シーズンの資料に紛れ込ませない。**
 *   ずっと売っている商品（抹茶ブリュレ＝浅草限定の通年、バナナブリュレ＝レギュラー など）は
 *   別のグループにたたんで置き、一括で選ぶ対象にもしない。
 *   入れるときは自分で開いてチェックし、そのことが画面にも出る。
 * - 送信はしない。保存したPDFを誰に送るかは、ご自身の操作。
 * ------------------------------------------------------------------ */

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function ScheduleSheet({
  app,
  years,
  startYear,
  onClose,
}: {
  app: ReturnType<typeof useAppData>;
  years: number[];
  startYear: number;
  onClose: () => void;
}) {
  /* ① 月を選ぶ */
  const [year, setYear] = useState(startYear);
  const [picked, setPicked] = useState<YearMonth[]>([]);
  /* ② 入れる商品（商品の鍵の一覧）。初めは空＝何も入っていない */
  const [chosen, setChosen] = useState<string[]>([]);
  /* ③ 資料 */
  const [pages, setPages] = useState<string[] | null>(null);
  const [showAlways, setShowAlways] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const src = useMemo(
    () => ({ products: app.products, getInfo: app.getInfo }),
    [app.products, app.getInfo]
  );
  const months = useMemo(() => sortMonths(picked), [picked]);
  const rows = useMemo(
    () => (months.length ? collectRange(src, months) : []),
    [src, months]
  );

  const keyOf = (r: RangeEntry) => entryKey(r.entry) + "|" + r.entry.releaseDate;
  const ready = rows.filter((r) => scheduleReady(r.entry));
  const notReady = rows.filter((r) => !scheduleReady(r.entry));
  /* シーズン・期間限定の商品と、通年の商品を分ける。
     「ジャンルがシーズン」か「販売の終わりが決まっている」ものを期間限定とみなす。
     ずっと売っている通年・レギュラー・店舗限定は、下にたたんで置く（件数には入れたまま）。
     **シーズンの資料に勝手に混ざらないようにするための切り分け** */
  const isLimited = (r: RangeEntry) => r.entry.genre === "season" || !r.entry.ongoing;
  const limited = ready.filter(isLimited);
  const always = ready.filter((r) => !isLimited(r));
  /** 一括で選ぶのは「ジャンルがシーズン」の商品だけ */
  const seasonOnly = ready.filter((r) => r.entry.genre === "season");
  /* 選んでいる月に出てくるものだけを数える（月を変えたら自動で外れる） */
  const inDoc = rows.filter((r) => chosen.includes(keyOf(r)));
  /** 通年・レギュラーを自分で入れたときは、そのことを画面に出す */
  const alwaysInDoc = inDoc.filter((r) => !isLimited(r));

  const toggleMonth = (m: number) => {
    const k = ymKey(year, m);
    setPages(null);
    setPicked((cur) =>
      cur.some((x) => ymKey(x.year, x.month) === k)
        ? cur.filter((x) => ymKey(x.year, x.month) !== k)
        : [...cur, { year, month: m }]
    );
  };
  const isMonthOn = (m: number) => picked.some((x) => x.year === year && x.month === m);

  const toggleOne = (r: RangeEntry) => {
    const k = keyOf(r);
    setPages(null);
    setChosen((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  };

  /* 写真が「資料に入れられるか」を調べる（店頭A4と同じ調べ方） */
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [reload, setReload] = useState(0);
  const photoUrls = inDoc
    .map((r) => (r.entry.image ? toThumbnailUrl(r.entry.image.url) : ""))
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    let cancelled = false;
    const list = photoUrls.split("|").filter(Boolean);
    /* 調べることが無いときも、前の結果が残らないように空で入れ直す */
    Promise.all(
      list.map(async (u) => [u, await loadPhoto(storedPhoto(u) ?? u)] as const)
    ).then((res) => {
      if (cancelled) return;
      const map: Record<string, PhotoState> = {};
      for (const [u, st] of res) map[u] = st;
      setPhotos(map);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrls, reload]);

  const photoOf = (e: MonthEntry): PhotoState | null =>
    e.image ? photos[toThumbnailUrl(e.image.url)] ?? null : null;
  /* まだ調べ終わっていない写真があるか（調べ終わるまでは保存させない） */
  const checking = inDoc.some((r) => !!r.entry.image && !photoOf(r.entry));
  const blocked = inDoc.filter((r) => {
    const st = photoOf(r.entry);
    return !!st && !st.readable;
  });

  /** 手元の正式写真を読み込んで、この端末にだけ覚える（データベースには書かない） */
  const pickPhoto = async (url: string, file: File | null) => {
    if (!file) return;
    setErr(null);
    try {
      rememberPhoto(url, await fileToPosterPhoto(file));
      setPages(null);
      setReload((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "写真を読み込めませんでした");
    }
  };

  const title = rangeTitle(months);
  const fileBase = months.length
    ? `Age3_${ymKey(months[0].year, months[0].month)}_${ymKey(
        months[months.length - 1].year,
        months[months.length - 1].month
      )}_schedule`
    : "Age3_schedule";

  const buildItems = (): ScheduleItem[] =>
    inDoc.map((r) => ({
      name: r.entry.product.name,
      period: periodText(r.entry),
      months: rangeMonthsLabel(r.months, months),
      photo: photoOf(r.entry),
    }));

  /** ② のあと、できあがりを見てもらう */
  const makePreview = async () => {
    setBusy(true);
    setErr(null);
    try {
      const canvases = await drawSchedulePages(title, buildItems(), 120);
      setPages(canvases.map((c) => c.toDataURL("image/jpeg", 0.9)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "資料を作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  /** ③ 見たとおりのものをPDFで保存する */
  const savePdf = async () => {
    setBusy(true);
    setErr(null);
    try {
      const canvases = await drawSchedulePages(title, buildItems(), 200);
      const jpegs = await Promise.all(
        canvases.map(async (c) => ({
          jpeg: await canvasToJpeg(c, 0.9),
          wpx: c.width,
          hpx: c.height,
        }))
      );
      saveBlob(jpegsToA4Pdf(jpegs), `${fileBase}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "PDFを作れませんでした");
    } finally {
      setBusy(false);
    }
  };

  const step = (n: number, label: string, note?: string) => (
    <div className="flex items-baseline gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
        {n}
      </span>
      <h3 className="text-base font-bold tracking-tight text-stone-900">{label}</h3>
      {note && <span className="text-xs text-stone-500">{note}</span>}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-auto bg-stone-200 p-4 sm:p-6">
      <div className="mx-auto max-w-[860px] space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onClose} className={btn("secondary")}>
            <Icon name="close" className="h-4 w-4" />
            閉じる
          </button>
          <span className="text-sm font-semibold text-stone-700">海外チームへ送る商品予定</span>
          <span className={badge("neutral", "ml-auto")}>価格は載せません</span>
        </div>

        {/* ① 月を選ぶ */}
        <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          {step(1, "月を選ぶ", "いくつでも。年をまたいでも選べます")}
          <div className="scroll-x-clean mt-3 flex items-center gap-2 overflow-x-auto">
            <span className="w-8 shrink-0 text-xs text-stone-500">年</span>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`min-h-10 shrink-0 rounded-full border px-3 py-1 text-sm transition ${
                  y === year
                    ? "border-stone-800 bg-stone-800 font-medium text-white"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {y}年
              </button>
            ))}
          </div>
          <div className="scroll-x-clean mt-2 flex items-center gap-1.5 overflow-x-auto">
            <span className="w-8 shrink-0 text-xs text-stone-500">月</span>
            {MONTHS.map((m) => {
              const on = isMonthOn(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  aria-pressed={on}
                  className={`flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-base font-bold tabular-nums transition ${
                    on
                      ? "border-amber-700 bg-amber-700 text-white"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btn("secondary")}
              onClick={() => {
                setPages(null);
                setPicked([monthFromNow(1), monthFromNow(2), monthFromNow(3)]);
                setYear(monthFromNow(1).year);
              }}
            >
              翌月から3か月
            </button>
            {picked.length > 0 && (
              <button
                type="button"
                className={btn("quiet")}
                onClick={() => {
                  setPicked([]);
                  setPages(null);
                }}
              >
                月をすべて外す
              </button>
            )}
          </div>

          <p className="mt-3 text-sm text-stone-700">
            {months.length === 0 ? (
              <span className="text-stone-500">まだ月を選んでいません。</span>
            ) : (
              <>
                選んだ月：
                <strong className="font-bold">
                  {months.map((m) => ymLabel(m.year, m.month)).join("・")}
                </strong>
              </>
            )}
          </p>
        </section>

        {/* ② 入れる商品を選ぶ */}
        {months.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            {step(2, "入れる商品を選ぶ", "選んだものだけが資料に載ります")}
            <p className={`mt-1 ${muted}`}>
              {title}に売っている商品です（前の月から続いているものを含みます）。
              <strong className="text-stone-700">はじめは1件も入っていません。</strong>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btn("secondary")}
                disabled={seasonOnly.length === 0}
                onClick={() => {
                  setPages(null);
                  setChosen(seasonOnly.map(keyOf));
                }}
              >
                シーズン商品をえらぶ（{seasonOnly.length}）
              </button>
              {chosen.length > 0 && (
                <button
                  type="button"
                  className={btn("quiet")}
                  onClick={() => {
                    setChosen([]);
                    setPages(null);
                  }}
                >
                  すべて外す
                </button>
              )}
              <span className="ml-auto text-sm text-stone-600">
                資料に入れる{" "}
                <strong className="text-lg font-bold tabular-nums text-stone-900">
                  {inDoc.length}
                </strong>
                件
              </span>
            </div>

            {alwaysInDoc.length > 0 && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                通年・レギュラー・店舗限定の商品が{alwaysInDoc.length}件入っています（
                {alwaysInDoc.map((r) => r.entry.product.name).join("・")}）。
                シーズンのご案内として送るときは、外してください。
              </p>
            )}

            {inDoc.length > SCHEDULE_MAX && (
              <p className="mt-2 text-sm font-medium text-red-600">
                1つの資料に入るのは{SCHEDULE_MAX}件までです。チェックを減らしてください。
              </p>
            )}

            <ul className="mt-3 space-y-2.5">
              {limited.map((r) => (
                <Row
                  key={keyOf(r)}
                  r={r}
                  months={months}
                  on={chosen.includes(keyOf(r))}
                  onToggle={() => toggleOne(r)}
                />
              ))}
            </ul>

            {always.length > 0 && (
              <>
                <button
                  type="button"
                  className={`${btn("quiet")} mt-2 px-0`}
                  onClick={() => setShowAlways((v) => !v)}
                >
                  <Icon
                    name={showAlways ? "chevronDown" : "chevronRight"}
                    className="h-4 w-4"
                  />
                  通年・レギュラー・店舗限定の商品（{always.length}件）
                </button>
                {showAlways ? (
                  <ul className="mt-2 space-y-2.5">
                    {always.map((r) => (
                      <Row
                        key={keyOf(r)}
                        r={r}
                        months={months}
                        on={chosen.includes(keyOf(r))}
                        onToggle={() => toggleOne(r)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
                    終わりを決めずに、ずっと売っている商品です（レギュラー・店舗限定など）。
                    <strong className="text-stone-700">シーズンの資料には入りません。</strong>
                    それでも入れたいときは、ここを開いてえらんでください。
                  </p>
                )}
              </>
            )}

            {notReady.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3">
                <div className="text-sm font-semibold text-stone-800">
                  未確認（資料に入れられません）
                  <span className="ml-2 font-normal tabular-nums text-stone-500">
                    {notReady.length}件
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600">
                  正式な商品画像や販売期間が入っていない商品です。代わりの画像は作りません。
                  入れたいときは、商品のシートに正式な内容を入れてください。
                </p>
                <ul className="mt-2 space-y-1 text-sm text-stone-700">
                  {notReady.map((r) => (
                    <li key={keyOf(r)} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{r.entry.product.name}</span>
                      <span className="text-xs text-amber-800">
                        {missingForSchedule(r.entry).join("／")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ③ 資料を確認して保存 */}
        {months.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            {step(3, "資料を確認してPDFを保存")}
            <p className={`mt-1 ${muted}`}>
              載せるのは 写真・商品名・販売期間・売っている月 だけです。
              価格・担当・原価・仕入・社内の準備状況は入りません。送信はしません。
            </p>

            {blocked.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  写真{blocked.length}件が、このままでは資料に入りません
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600">
                  ふだんどおりダウンロードした正式写真を一度だけ読み込むと入ります。
                  読み込んだ写真はこのパソコンの中だけに覚えます（商品データベースには書きません）。
                </p>
                <ul className="mt-2 space-y-1.5">
                  {blocked.map((r) => {
                    const url = r.entry.image ? toThumbnailUrl(r.entry.image.url) : "";
                    return (
                      <li
                        key={keyOf(r) + "blk"}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2"
                      >
                        <span className="text-sm text-stone-800">{r.entry.product.name}</span>
                        <label className={`${btn("secondary")} ml-auto cursor-pointer`}>
                          写真を選ぶ
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(ev) => pickPhoto(url, ev.target.files?.[0] ?? null)}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btn("secondary")}
                disabled={inDoc.length === 0 || inDoc.length > SCHEDULE_MAX || busy || checking}
                onClick={makePreview}
              >
                {busy && !pages ? "作成中…" : "資料を見る"}
              </button>
              <button
                type="button"
                className={btn("primary")}
                disabled={
                  inDoc.length === 0 ||
                  inDoc.length > SCHEDULE_MAX ||
                  busy ||
                  checking ||
                  blocked.length > 0
                }
                onClick={savePdf}
              >
                {busy && pages ? "保存中…" : "PDFを保存"}
              </button>
              {inDoc.length > 0 && (
                <span className="text-xs text-stone-500">
                  A4たて{Math.max(1, Math.ceil(Math.min(inDoc.length, SCHEDULE_MAX) / SCHEDULE_PER_PAGE))}
                  ページ（1ページ{SCHEDULE_PER_PAGE}件）
                </span>
              )}
            </div>

            {err && <p className="mt-2 text-sm font-medium text-red-600">{err}</p>}

            {pages && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-stone-500">
                  これがPDFになります（{pages.length}ページ）。内容を確かめてから保存してください。
                </p>
                {pages.map((p, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={p}
                    alt={`資料 ${i + 1}ページ目`}
                    className="w-full rounded-lg bg-white shadow-md ring-1 ring-stone-300"
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>,
    document.body
  );
}

/* 1件ぶんの行。画像・商品名・販売期間が中心。価格は出さない */
function Row({
  r,
  months,
  on,
  onToggle,
}: {
  r: RangeEntry;
  months: YearMonth[];
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={`rounded-xl p-3 transition ${on ? "bg-amber-50" : "bg-stone-50"}`}>
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-amber-700"
          checked={on}
          onChange={onToggle}
        />
        <MonthlyPhoto
          image={r.entry.image}
          className="h-20 w-20 shrink-0 rounded-lg bg-white object-contain p-1"
          fontSize={11}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold leading-snug tracking-tight text-stone-900">
            {r.entry.product.name}
          </span>
          <span className="mt-1 block text-sm font-semibold tabular-nums text-stone-700">
            {periodText(r.entry)}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-200">
              {rangeMonthsLabel(r.months, months)}に販売
            </span>
            {/* どの区分の商品か。シーズンかどうかをひと目で分かるようにする */}
            <span
              className={
                r.entry.genre === "season"
                  ? "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                  : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-stone-500"
              }
            >
              {r.entry.genre ? GENRE_LABELS[r.entry.genre] : "未分類"}
            </span>
          </span>
        </span>
      </label>
    </li>
  );
}
