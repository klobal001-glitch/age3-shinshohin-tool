"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useLocalStorageState } from "@/lib/storage";
import MonthlyPhoto from "@/components/MonthlyPhoto";
import { formatJpDate, diffLabel } from "@/lib/deadline";
import {
  MonthEntry,
  collectMonth,
  collectYears,
  continuedText,
  entryKey,
  hasPeriod,
  hasPrice,
  isTentativeName,
  labelNote,
  missingFields,
  missingForPoster,
  monthFromNow,
  periodText,
  posterReady,
  prepByRole,
  priceText,
  productsWithoutPeriod,
  storeText,
  ymKey,
  ymLabel,
} from "@/lib/monthly";
import MonthlyPoster, { POSTER_MAX } from "@/components/MonthlyPoster";
import MonthlyShareSheet from "@/components/MonthlyShareSheet";
import ScheduleSheet from "@/components/ScheduleSheet";
import Icon from "@/components/Icon";
import { TabKey } from "@/components/Header";
import { badge, btn, card, cardHead, chip, focusRing, h2, h3, muted } from "@/lib/ui";

/* ------------------------------------------------------------------ *
 * 月別の商品一覧
 *
 * 選んだ月に**売っている商品**を1つの一覧に出す。
 * その月に発売が始まるものも、前の月から続いているものも、同じ一覧に並ぶ。
 * 見分けは「今月発売」「◯月から継続」の印で付ける。
 *
 * 開いた直後は**翌月**を出す。1つ押せば翌々月に移れる。
 *
 * 出している内容は、すべていまデータベースに入っているもの。
 * **空欄は「未入力」とそのまま出す。**推測で埋めない。
 * ------------------------------------------------------------------ */

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function MonthlyView({
  app,
  onNavigate,
}: {
  app: ReturnType<typeof useAppData>;
  onNavigate: (t: TabKey) => void;
}) {
  const next1 = monthFromNow(1);
  const next2 = monthFromNow(2);

  const [year, setYear] = useState(next1.year);
  const [month, setMonth] = useState(next1.month);
  /** 掲示に出す商品。商品データベースには書かず、この端末にだけ覚える */
  const [picks, setPicks] = useLocalStorageState<Record<string, string[]>>("poster_picks", {});
  const [posterOpen, setPosterOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** 海外チームへ送る商品予定（複数月） */
  const [scheduleOpen, setScheduleOpen] = useState(false);
  /** 社内の準備状況は、ふだんは閉じておく（この画面の主役ではない） */
  const [prepOpen, setPrepOpen] = useState(false);
  const [openPrep, setOpenPrep] = useState<string | null>(null);
  const [showNoPeriod, setShowNoPeriod] = useState(false);

  /* 選んでいる月が画面の外にあると、何月を見ているか分からなくなるので寄せる */
  const monthRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = monthRowRef.current?.querySelector(`[data-month="${month}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [month, year]);

  const src = useMemo(
    () => ({ products: app.products, getInfo: app.getInfo }),
    [app.products, app.getInfo]
  );

  const years = useMemo(() => {
    const list = collectYears(src);
    for (const y of [next1.year, next2.year]) if (!list.includes(y)) list.push(y);
    return [...new Set(list)].sort((a, b) => a - b);
  }, [src, next1.year, next2.year]);

  /** 選んだ月に売っている商品（発売開始も継続も同じ一覧） */
  const all = useMemo(() => collectMonth(src, year, month), [src, year, month]);
  /** 内部の準備状況は「この月に発売を始める商品」だけが対象 */
  const starts = useMemo(() => all.filter((e) => e.startsThisMonth), [all]);

  /** 月ボタンの下に出す数。**その月に発売を始める商品の数**（毎月ほぼ同じになる
      「販売中の総数」を出しても、どの月に何かあるのか分からないため） */
  const countByMonth = useMemo(
    () => MONTHS.map((m) => collectMonth(src, year, m).filter((e) => e.startsThisMonth).length),
    [src, year]
  );

  const key = ymKey(year, month);
  const picked = picks[key] ?? [];
  const isPicked = (e: MonthEntry) => picked.includes(entryKey(e));
  const togglePick = (e: MonthEntry) => {
    const k = entryKey(e);
    const next = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k];
    setPicks({ ...picks, [key]: next });
  };

  /* 掲示に出せる／出せないの区別も、一覧と同じ「その月に売っている商品」で見る */
  const readyList = all.filter(posterReady);
  const posterEntries = all.filter(isPicked);
  const needCheck = all.filter((e) => missingForPoster(e).length > 0);
  /** 一括チェックは「この月に発売を始める、内容がそろっている商品」だけ。
      通年の商品まで一度に入れると、1枚に載る数をすぐ超えてしまう。
      続いている商品を貼りたいときは、一覧で1つずつチェックしてもらう */
  const newReady = readyList.filter((e) => e.startsThisMonth);
  const noPeriod = useMemo(() => productsWithoutPeriod(src), [src]);

  /** リーダー共有は「翌月＋翌々月に発売開始するもの」 */
  /* next1 / next2 は毎回作り直されるので、年と月の数字だけを見る */
  const n1y = next1.year;
  const n1m = next1.month;
  const n2y = next2.year;
  const n2m = next2.month;
  const shareMonths = useMemo(
    () =>
      [
        { year: n1y, month: n1m },
        { year: n2y, month: n2m },
      ].map((m) => ({
        year: m.year,
        month: m.month,
        entries: collectMonth(src, m.year, m.month).filter((e) => e.startsThisMonth),
      })),
    [src, n1y, n1m, n2y, n2m]
  );

  const openDetail = (e: MonthEntry, tab: TabKey) => {
    app.setSelectedId(e.product.id);
    app.setRunTab(e.current ? null : { productId: e.product.id, label: e.runLabel });
    onNavigate(tab);
  };

  return (
    <div className="space-y-6">
      <div>
        {/* スマホの下端のタブは6つで埋まっているので、戻り道をここに置く */}
        <button
          type="button"
          onClick={() => onNavigate("menu")}
          className={`${btn("quiet")} -ml-2 mb-1 md:hidden`}
        >
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          ホームへ戻る
        </button>
        <h1 className={h2}>販売スケジュール</h1>
        <p className={`mt-1 ${muted}`}>
          月ごとに、売っている商品を見られます。店頭のA4と、海外チームへ送る資料もここから作れます。
        </p>
      </div>

      {/* 年と月 */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="scroll-x-clean flex items-center gap-2 overflow-x-auto">
          <span className="w-8 shrink-0 text-xs text-stone-500">年</span>
          {years.map((y) => (
            <button key={y} type="button" className={chip(y === year)} onClick={() => setYear(y)}>
              {y}年
            </button>
          ))}
        </div>

        <div ref={monthRowRef} className="scroll-x-clean mt-3 flex items-start gap-1.5 overflow-x-auto">
          <span className="w-8 shrink-0 pt-3 text-xs text-stone-500">月</span>
          {MONTHS.map((m, i) => {
            const on = m === month;
            const n = countByMonth[i];
            return (
              <button
                key={m}
                type="button"
                data-month={m}
                onClick={() => setMonth(m)}
                className={`flex min-h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border transition ${focusRing} ${
                  on
                    ? "border-amber-700 bg-amber-700 text-white shadow-xs"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span className="text-base font-bold tabular-nums leading-none">{m}</span>
                <span
                  className={`mt-0.5 text-[11px] tabular-nums ${on ? "text-white/80" : "text-stone-400"}`}
                >
                  {n > 0 ? `${n}件` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 pl-10 text-xs text-stone-400">
          数字は、その月に発売を始める商品の数です。
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="w-8 shrink-0 text-xs text-stone-500" />
          <button
            type="button"
            className={chip(year === next1.year && month === next1.month, "", "sm")}
            onClick={() => {
              setYear(next1.year);
              setMonth(next1.month);
            }}
          >
            翌月（{ymLabel(next1.year, next1.month)}）
          </button>
          <button
            type="button"
            className={chip(year === next2.year && month === next2.month, "", "sm")}
            onClick={() => {
              setYear(next2.year);
              setMonth(next2.month);
            }}
          >
            翌々月（{ymLabel(next2.year, next2.month)}）
          </button>
        </div>
      </div>

      {/* その月に売っている商品。発売開始も継続も1つの一覧 */}
      <div className={`${card} overflow-hidden`}>
        <div className={`${cardHead} flex-wrap`}>
          <h2 className="flex items-baseline gap-2 tracking-tight">
            <span className="text-[22px] font-bold tabular-nums text-stone-900 sm:text-[26px]">
              {year}年{month}月
            </span>
            <span className="text-sm font-medium text-stone-500">に販売する商品</span>
          </h2>
          <span className="ml-auto shrink-0 text-sm text-stone-500">
            <strong className="text-lg font-bold tabular-nums text-stone-800">{all.length}</strong>
            件
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <p className={muted}>
            販売期間が{ymLabel(year, month)}と重なる商品です。
          </p>

          {all.length === 0 ? (
            <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
              この月に販売する商品は登録されていません。
            </p>
          ) : (
            /* 掲示に出せるものと、まだ決まっていないものを混ぜない */
            <>
              <Group
                title="内容がそろっている"
                note="写真・商品名・販売期間・価格が入っています。"
                items={readyList}
                empty="そろっている商品はまだありません。"
                year={year}
                foldOngoing
                isPicked={isPicked}
                togglePick={togglePick}
                openDetail={openDetail}
              />
              <Group
                title="未確定・未入力あり"
                note="空欄や仮の名前が残っています。出すかどうかはご自身で決めてください。"
                items={needCheck}
                empty="ありません。"
                year={year}
                isPicked={isPicked}
                togglePick={togglePick}
                openDetail={openDetail}
              />
            </>
          )}
        </div>
      </div>

      {/* つくる：店頭A4 ／ 海外チームへ ／ リーダー共有 */}
      <div className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className={h3}>つくる</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {/* 店頭に貼るA4（価格あり） */}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-[15px] font-bold text-stone-900">店頭に貼る</h3>
              <span className="text-xs text-stone-500">A4たて1枚・価格あり</span>
            </div>
            <p className={`mt-1 ${muted}`}>
              貼る商品はご自身で選んでください。作ったあとの画面から、同じ内容を画像にしてLINEで送れます。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btn("secondary")}
                disabled={newReady.length === 0}
                onClick={() => setPicks({ ...picks, [key]: newReady.map(entryKey) })}
              >
                今月発売をえらぶ（{newReady.length}）
              </button>
              <button
                type="button"
                className={btn("quiet")}
                disabled={picked.length === 0}
                onClick={() => setPicks({ ...picks, [key]: [] })}
              >
                すべて外す
              </button>
              <span className="text-sm text-stone-600">
                選択{" "}
                <strong className="text-base font-bold tabular-nums text-stone-900">
                  {posterEntries.length}
                </strong>
                件
              </span>
              <button
                type="button"
                className={btn("primary", "ml-auto")}
                disabled={posterEntries.length === 0}
                onClick={() => setPosterOpen(true)}
              >
                A4をつくる
              </button>
            </div>
            {posterEntries.length > POSTER_MAX && (
              <p className="mt-2 text-sm font-medium text-red-600">
                1枚に載るのは{POSTER_MAX}件までです。チェックを減らしてください。
              </p>
            )}
          </div>

          {/* 海外チームへ送る商品予定（価格なし・複数月） */}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-[15px] font-bold text-stone-900">海外チームへ送る</h3>
              <span className="text-xs text-stone-500">商品予定・複数月えらべます</span>
              <span className={badge("neutral", "ml-2")}>価格は載せません</span>
            </div>
            <p className={`mt-1 ${muted}`}>
              月を選び、入れる商品を1件ずつ選んで、PDFにします。はじめは1件も入っていません。
            </p>
            <button
              type="button"
              className={btn("secondary", "mt-3")}
              onClick={() => setScheduleOpen(true)}
            >
              資料をつくる
            </button>
          </div>

          {/* リーダーへ共有 */}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-[15px] font-bold text-stone-900">リーダーへ共有</h3>
              <span className="text-xs text-stone-500">
                {ymLabel(next1.year, next1.month)}＋{ymLabel(next2.year, next2.month)}
              </span>
            </div>
            <p className={`mt-1 ${muted}`}>スマホで読める形にまとめます。送信はしません。</p>
            <button
              type="button"
              className={btn("secondary", "mt-3")}
              onClick={() => setShareOpen(true)}
            >
              共有を見る
            </button>
          </div>
        </div>
      </div>

      {/* 要確認 */}
      <div className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className={h3}>
            要確認
            <span className="ml-2 text-sm font-normal tabular-nums text-stone-500">
              {needCheck.length}件
            </span>
          </h2>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <p className={muted}>
            掲示に出すための材料がそろっていない商品です。
          </p>
          {needCheck.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              この月は、掲示に必要な項目がすべて入っています。
            </p>
          ) : (
            <ul className="space-y-2">
              {needCheck.map((e) => (
                <li
                  key={entryKey(e) + "miss"}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-50 p-3"
                >
                  <span className="text-sm font-semibold text-stone-800">{e.product.name}</span>
                  <span className="text-sm text-amber-800">
                    {missingForPoster(e).join("／")}
                  </span>
                  <button
                    type="button"
                    className={btn("quiet", "ml-auto")}
                    onClick={() => openDetail(e, "sheet")}
                  >
                    シートをひらく
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className={`${btn("quiet")} px-0`}
            onClick={() => setShowNoPeriod((v) => !v)}
          >
            <Icon
              name={showNoPeriod ? "chevronDown" : "chevronRight"}
              className="h-4 w-4"
            />
            販売期間が入っていない商品（{noPeriod.length}件）
          </button>
          {showNoPeriod && (
            <div className="rounded-xl bg-stone-50 p-3">
              <p className={muted}>
                発売日が入っていないので、どの月にも出せません。月が決まったら入れてください。
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-700">
                {noPeriod.map((p) => (
                  <li key={p.product.id}>{p.product.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 社内の準備状況。この画面の主役ではないので、ふだんは閉じておく */}
      <div className={`${card} overflow-hidden`}>
        <button
          type="button"
          onClick={() => setPrepOpen((v) => !v)}
          className={`flex w-full items-center gap-2.5 px-5 py-4 text-left sm:px-6 ${focusRing}`}
        >
          <Icon
            name={prepOpen ? "chevronDown" : "chevronRight"}
            className="h-4 w-4 shrink-0 text-stone-400"
          />
          <h2 className={h3}>社内の準備状況</h2>
          <span className={badge("neutral", "ml-auto")}>共有物には入りません</span>
        </button>
        {prepOpen && (
        <div className="space-y-3 border-t border-stone-100 p-4 sm:p-5">
          <p className={muted}>
            この月に<strong className="text-stone-700">発売を始める</strong>商品の進み具合です。
            担当はデータベースに項目がないため、すべて「未指定」と出しています（かっこ内は役割の目安）。
            期限は<strong className="text-stone-700">発売月から計算した目安</strong>で、
            ご自身で決めた期限ではありません。
          </p>

          {starts.length === 0 ? (
            <p className="text-sm text-stone-500">この月に発売を始める商品はありません。</p>
          ) : (
            <ul className="space-y-2">
              {starts.map((e) => {
                const k = entryKey(e);
                const open = openPrep === k;
                const taskState = e.current
                  ? app.getTaskState(e.product.id)
                  : e.run?.taskState ?? {};
                const roles = prepByRole(e, taskState);
                const miss = missingFields(e);
                const totalLeft = roles.reduce((s, r) => s + (r.total - r.checked), 0);
                return (
                  <li key={k + "prep"} className="rounded-xl bg-stone-50">
                    <button
                      type="button"
                      onClick={() => setOpenPrep(open ? null : k)}
                      className={`flex w-full items-center gap-2 px-3 py-3 text-left ${focusRing}`}
                    >
                      <Icon
                        name={open ? "chevronDown" : "chevronRight"}
                        className="h-4 w-4 shrink-0 text-stone-400"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">
                        {e.product.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-stone-500">
                        残り {totalLeft}件
                      </span>
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-stone-200 px-3 py-3">
                        {roles.map((r) => {
                          const d = r.next?.days ?? null;
                          const lab = diffLabel(d);
                          return (
                            <div key={r.role} className="rounded-lg bg-white p-3">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-sm font-semibold text-stone-800">
                                  {r.title}
                                </span>
                                <span className="text-xs text-stone-500">
                                  担当：未指定（{r.guide}）
                                </span>
                                <span className="ml-auto text-xs tabular-nums text-stone-500">
                                  {r.checked}/{r.total}
                                </span>
                              </div>
                              {r.next ? (
                                <div className="mt-1.5 space-y-0.5 text-sm text-stone-700">
                                  <div>
                                    <span className="text-stone-500">次の行動：</span>
                                    {r.next.taskLabel}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2">
                                    <span className="text-stone-500">期限の目安：</span>
                                    <span className="tabular-nums">
                                      {r.next.milestoneLabel}
                                      {r.next.deadline ? `（${formatJpDate(r.next.deadline)}）` : ""}
                                    </span>
                                    {lab && (
                                      <span
                                        className={badge(lab.overdue ? "danger" : "neutral")}
                                      >
                                        {lab.text}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-stone-400">
                                    ご自身で決めた期限：未登録
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-1.5 text-sm text-emerald-700">
                                  この区分のチェックはすべて付いています。
                                </p>
                              )}
                            </div>
                          );
                        })}

                        <div className="rounded-lg bg-white p-3">
                          <div className="text-sm font-semibold text-stone-800">不足している項目</div>
                          {miss.length === 0 ? (
                            <p className="mt-1 text-sm text-emerald-700">空欄はありません。</p>
                          ) : (
                            <p className="mt-1 text-sm text-stone-700">{miss.join("／")}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={btn("secondary")}
                              onClick={() => openDetail(e, "sheet")}
                            >
                              シートをひらく
                            </button>
                            <button
                              type="button"
                              className={btn("secondary")}
                              onClick={() => openDetail(e, "tasks")}
                            >
                              準備タスクをひらく
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}
      </div>

      {posterOpen && (
        <MonthlyPoster
          year={year}
          month={month}
          entries={posterEntries}
          onClose={() => setPosterOpen(false)}
        />
      )}
      {shareOpen && (
        <MonthlyShareSheet months={shareMonths} onClose={() => setShareOpen(false)} />
      )}
      {scheduleOpen && (
        <ScheduleSheet
          app={app}
          years={years}
          startYear={year}
          onClose={() => setScheduleOpen(false)}
        />
      )}
    </div>
  );
}

/* 「そろっている」「未確定・未入力あり」の2つに分けて並べる。
   通年・継続販売の商品は毎月ずっと同じ顔ぶれなので、たたんで下に置く
   （数には入れたままで、開けばいつでも掲示に選べる） */
function Group({
  title,
  note,
  items,
  empty,
  year,
  foldOngoing = false,
  isPicked,
  togglePick,
  openDetail,
}: {
  title: string;
  note: string;
  items: MonthEntry[];
  empty: string;
  year: number;
  foldOngoing?: boolean;
  isPicked: (e: MonthEntry) => boolean;
  togglePick: (e: MonthEntry) => void;
  openDetail: (e: MonthEntry, tab: TabKey) => void;
}) {
  const [openAll, setOpenAll] = useState(false);
  /* 通年・継続販売（この月に始まったわけではないもの）をたたむ */
  const folded = foldOngoing ? items.filter((e) => e.ongoing && !e.startsThisMonth) : [];
  const front = items.filter((e) => !folded.includes(e));
  const row = (e: MonthEntry) => (
    <EntryCard
      key={entryKey(e) + e.releaseDate}
      e={e}
      year={year}
      showPick
      picked={isPicked(e)}
      onPick={() => togglePick(e)}
      onOpen={(tab) => openDetail(e, tab)}
    />
  );

  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-stone-800">
        {title}
        <span className="ml-2 font-normal text-stone-500">
          <strong className="font-bold tabular-nums text-stone-700">{items.length}</strong>件
        </span>
      </h3>
      <p className={`mt-0.5 ${muted}`}>{note}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">{empty}</p>
      ) : (
        <>
          {front.length > 0 && <ul className="mt-2.5 space-y-3.5">{front.map(row)}</ul>}
          {folded.length > 0 && (
            <>
              <button
                type="button"
                className={`${btn("quiet")} mt-2 px-0`}
                onClick={() => setOpenAll((v) => !v)}
              >
                <Icon name={openAll ? "chevronDown" : "chevronRight"} className="h-4 w-4" />
                通年・継続販売の商品（{folded.length}件）
              </button>
              {openAll ? (
                <ul className="mt-2.5 space-y-3.5">{folded.map(row)}</ul>
              ) : (
                <p className="mt-1 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">
                  終わりを決めずに、ずっと売っている商品です。この月も売っています。
                  掲示に出したいときは、ここを開いてチェックしてください。
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------ 1件のカード ------------------------------ */

function EntryCard({
  e,
  year,
  showPick,
  picked,
  onPick,
  onOpen,
}: {
  e: MonthEntry;
  /** いま見ている年。継続の印に年を出すかどうかの判断に使う */
  year: number;
  showPick: boolean;
  picked: boolean;
  onPick: () => void;
  onOpen: (tab: TabKey) => void;
}) {
  const note = labelNote(e.runLabel);
  const miss = missingForPoster(e);
  const price = priceText(e.fields);
  const ok = hasPrice(e.fields);
  /* 「銀座 ¥1,200／嘉麻 ¥900」のように店ごとに並ぶときは、大きくすると折り返して読みにくい。
     ひとつの値のときだけ大きく出す */
  const bigPrice = ok && /^[¥฿][\d,]+$/.test(price);

  return (
    <li className="rounded-xl bg-stone-50 p-4 sm:p-5">
      <div className="flex gap-4">
        <MonthlyPhoto
          image={e.image}
          className="h-24 w-24 shrink-0 rounded-xl bg-white object-contain p-1.5 sm:h-28 sm:w-28"
          fontSize={11}
        />

        <div className="min-w-0 flex-1">
          {/* 1段目：この月での扱い。今月発売はオレンジで塗り、継続は白い印にして区別する */}
          <div className="flex flex-wrap items-center gap-1.5">
            {e.startsThisMonth ? (
              <span className="inline-flex items-center rounded-full bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white">
                今月発売
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-200">
                {continuedText(e, year)}
              </span>
            )}
            {note.confirmed && <span className={badge("good")}>本人確定（データの表記）</span>}
            {isTentativeName(e.product.name) && <span className={badge("warn")}>商品名が仮</span>}
          </div>

          {/* 2段目：商品名。この一覧でいちばん大きい文字 */}
          <h4 className="mt-1.5 text-[17px] font-bold leading-snug tracking-tight text-stone-900 sm:text-xl">
            {e.product.name}
          </h4>

          {/* 3段目：数字。販売期間と価格は、ひと目で読めるよう太く大きく */}
          <div className="mt-2 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="shrink-0 text-xs text-stone-400 sm:w-14">販売期間</span>
              <span
                className={`text-[15px] font-semibold tabular-nums ${
                  hasPeriod(e) ? "text-stone-800" : "text-amber-700"
                }`}
              >
                {periodText(e)}
                {!hasPeriod(e) && "（未入力）"}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="shrink-0 text-xs text-stone-400 sm:w-14">価格</span>
              {bigPrice ? (
                <span className="text-[22px] font-bold leading-tight tabular-nums text-stone-900 sm:text-[26px]">
                  {price}
                  <span className="ml-1 text-xs font-normal text-stone-400">（税込）</span>
                </span>
              ) : (
                <span
                  className={`text-[15px] font-semibold tabular-nums ${
                    ok ? "text-stone-800" : "text-amber-700"
                  }`}
                >
                  {price}
                  {ok ? "（税込）" : "（未入力）"}
                </span>
              )}
            </div>
          </div>

          {/* 4段目：補足。読む順をはっきりさせるため、ここから先は小さく薄く */}
          <dl className="mt-2.5 space-y-0.5 text-xs leading-relaxed text-stone-400">
            <div className="flex flex-wrap gap-x-2">
              <dt className="shrink-0 sm:w-14">対象店舗</dt>
              <dd className="text-stone-500">{storeText(e.fields)}</dd>
            </div>
            {e.runLabel && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="shrink-0 sm:w-14">販売の回</dt>
                <dd className="min-w-0">{e.runLabel}</dd>
              </div>
            )}
          </dl>

          {e.imageFromOtherRun && (
            <p className="mt-2 text-xs text-amber-700">
              この回のビジュアルは未登録のため、前の回の画像を出しています。
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2.5">
        {showPick && (
          <label
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm md:min-h-0 ${
              miss.length > 0 ? "text-stone-400" : "text-stone-700"
            }`}
          >
            <input
              type="checkbox"
              className="h-5 w-5 accent-amber-700 md:h-4 md:w-4"
              checked={picked}
              disabled={!e.image}
              onChange={onPick}
            />
            店頭掲示に出す
          </label>
        )}
        {showPick && miss.length > 0 && (
          <span className="text-xs text-amber-700">未入力：{miss.join("／")}</span>
        )}
        <button type="button" className={btn("quiet", "ml-auto")} onClick={() => onOpen("sheet")}>
          詳細をひらく
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
