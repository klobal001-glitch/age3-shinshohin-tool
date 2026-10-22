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
import Icon from "@/components/Icon";
import { TabKey } from "@/components/Header";
import { badge, btn, card, cardHead, chip, eyebrow, focusRing, h2, h3, muted } from "@/lib/ui";

/* ------------------------------------------------------------------ *
 * 月別の新商品一覧
 *
 * 毎月20日ごろ、翌月・翌々月の商品をリーダーへ共有するための画面。
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
  const [mode, setMode] = useState<"start" | "onsale">("start");
  /** 掲示に出す商品。商品データベースには書かず、この端末にだけ覚える */
  const [picks, setPicks] = useLocalStorageState<Record<string, string[]>>("poster_picks", {});
  const [posterOpen, setPosterOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  const all = useMemo(() => collectMonth(src, year, month), [src, year, month]);
  const starts = useMemo(() => all.filter((e) => e.startsThisMonth), [all]);
  const onSale = useMemo(() => all.filter((e) => e.onSaleThisMonth), [all]);

  /** その年の月ごとの「発売開始」件数。月ボタンの下に出す */
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

  const readyList = starts.filter(posterReady);
  const posterEntries = starts.filter(isPicked);
  const needCheck = starts.filter((e) => missingForPoster(e).length > 0);
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

  const list = mode === "start" ? starts : onSale;

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
        <h1 className={h2}>月別の新商品</h1>
        <p className={`mt-1 ${muted}`}>
          毎月20日ごろに、翌月・翌々月の商品をリーダーへ共有するための画面です。
          出している内容は、いま商品データベースに入っているものだけです（空欄は「未入力」と出ます）。
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
                <span className="text-sm font-medium tabular-nums">{m}</span>
                <span className={`text-xs tabular-nums ${on ? "text-white/80" : "text-stone-400"}`}>
                  {n > 0 ? `${n}件` : "—"}
                </span>
              </button>
            );
          })}
        </div>

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

      {/* 発売開始 / 販売中 の切り替え。2つを混ぜない */}
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-2 gap-px bg-stone-200">
          {([
            { k: "start" as const, t: "この月に発売開始", s: "新商品", n: starts.length },
            { k: "onsale" as const, t: "この月に販売中", s: "継続販売も含む", n: onSale.length },
          ]).map((o) => {
            const on = mode === o.k;
            return (
              <button
                key={o.k}
                type="button"
                onClick={() => setMode(o.k)}
                aria-pressed={on}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-2 py-3 transition ${focusRing} ${
                  on ? "bg-amber-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span className="text-sm font-semibold">{o.t}</span>
                <span className={`text-xs ${on ? "text-white/80" : "text-stone-400"}`}>
                  {o.s}・{o.n}件
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          <h2 className={h3}>
            {ymLabel(year, month)}
            {mode === "start" ? "に発売開始する新商品" : "に販売中の商品"}
            <span className="ml-2 text-sm font-normal tabular-nums text-stone-500">
              {list.length}件
            </span>
          </h2>

          {mode === "start" && (
            <p className={`mt-1 ${muted}`}>
              この月に販売が始まるものだけです。前の月から続けて売っている商品は、
              右の「この月に販売中」に出ます。
            </p>
          )}
          {mode === "onsale" && (
            <p className={`mt-1 ${muted}`}>
              この月に店頭にある商品です（前の月から続いているもの・継続販売中のものを含む）。
              この月に発売が始まるものには「今月発売」と付けています。
            </p>
          )}

          {list.length === 0 ? (
            <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
              この月に当てはまる商品は登録されていません。
            </p>
          ) : mode === "onsale" ? (
            <ul className="mt-4 space-y-3">
              {list.map((e) => (
                <EntryCard
                  key={entryKey(e) + e.releaseDate}
                  e={e}
                  showPick={false}
                  picked={false}
                  onPick={() => undefined}
                  onOpen={(tab) => openDetail(e, tab)}
                />
              ))}
            </ul>
          ) : (
            /* 掲示に出せるものと、まだ決まっていないものを混ぜない */
            <>
              <Group
                title="内容がそろっている"
                note="写真・商品名・販売期間・価格がすべて入っています。"
                items={readyList}
                empty="そろっている商品はまだありません。"
                isPicked={isPicked}
                togglePick={togglePick}
                openDetail={openDetail}
              />
              <Group
                title="未確定・未入力あり"
                note="空欄や仮の名前が残っています。掲示に出すかどうかは、内容を確かめてご自身で決めてください。"
                items={needCheck}
                empty="ありません。"
                isPicked={isPicked}
                togglePick={togglePick}
                openDetail={openDetail}
              />
            </>
          )}
        </div>
      </div>

      {/* 掲示と共有 */}
      <div className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className={h3}>掲示・共有</h2>
        </div>
        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <div className={eyebrow}>店頭に貼る（1か月につき1枚）</div>
            <p className={`mt-1 ${muted}`}>
              A4たて1枚のPDFにします。載せるのは 写真・商品名・販売期間・価格 だけで、
              社内の準備状況・担当・原価・仕入は入りません。
              <strong className="text-stone-700">
                　どれを貼るかはご自身で選んでください。
              </strong>
              アプリは「公開してよい商品」を勝手に決めません。
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btn("secondary")}
                disabled={readyList.length === 0}
                onClick={() => setPicks({ ...picks, [key]: readyList.map(entryKey) })}
              >
                そろっている{readyList.length}件にチェック
              </button>
              <button
                type="button"
                className={btn("quiet")}
                disabled={picked.length === 0}
                onClick={() => setPicks({ ...picks, [key]: [] })}
              >
                すべて外す
              </button>
              <span className="text-sm tabular-nums text-stone-600">
                選択 {posterEntries.length}件
              </span>
              <button
                type="button"
                className={btn("primary", "ml-auto")}
                disabled={posterEntries.length === 0}
                onClick={() => setPosterOpen(true)}
              >
                {ymLabel(year, month)}のA4掲示を作る
              </button>
            </div>

            {posterEntries.length > POSTER_MAX && (
              <p className="mt-2 text-sm font-medium text-red-600">
                1枚に載せられるのは{POSTER_MAX}件までです。{posterEntries.length}
                件選ばれているので、チェックを減らしてください。
              </p>
            )}
          </div>

          <div className="border-t border-stone-100 pt-4">
            <div className={eyebrow}>リーダーグループへ共有（翌月＋翌々月）</div>
            <p className={`mt-1 ${muted}`}>
              {ymLabel(next1.year, next1.month)}（{shareMonths[0].entries.length}件）と
              {ymLabel(next2.year, next2.month)}（{shareMonths[1].entries.length}件）を
              1つにまとめます。スマホで読める形です。送信はしません。
            </p>
            <button
              type="button"
              className={btn("secondary", "mt-3")}
              onClick={() => setShareOpen(true)}
            >
              共有プレビューを開く
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
            {ymLabel(year, month)}に発売開始する商品のうち、掲示に出すための材料がそろっていないものです。
            そろっていない理由は、いまデータベースが空欄のところです。
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

      {/* 内部の準備状況 */}
      <div className={`${card} overflow-hidden`}>
        <div className={cardHead}>
          <h2 className={h3}>内部の準備状況</h2>
          <span className={badge("neutral", "ml-auto")}>共有物には入りません</span>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <p className={muted}>
            この月に発売開始する商品の、社内の進み具合です。
            担当者はデータベースに項目がないため、すべて「未指定」と出しています。
            かっこ内は役割の目安で、実際の担当を決めるものではありません。
            期限は<strong className="text-stone-700">発売月から計算した目安</strong>
            で、ご自身で決めた期限ではありません。
            チェックが付いていないものが、必ずしも終わっていないとは限りません。
          </p>

          {starts.length === 0 ? (
            <p className="text-sm text-stone-500">この月に発売開始する商品はありません。</p>
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
    </div>
  );
}

/* 「そろっている」「未確定・未入力あり」の2つに分けて並べる */
function Group({
  title,
  note,
  items,
  empty,
  isPicked,
  togglePick,
  openDetail,
}: {
  title: string;
  note: string;
  items: MonthEntry[];
  empty: string;
  isPicked: (e: MonthEntry) => boolean;
  togglePick: (e: MonthEntry) => void;
  openDetail: (e: MonthEntry, tab: TabKey) => void;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-stone-800">
        {title}
        <span className="ml-2 font-normal tabular-nums text-stone-500">{items.length}件</span>
      </h3>
      <p className={`mt-0.5 ${muted}`}>{note}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((e) => (
            <EntryCard
              key={entryKey(e) + e.releaseDate}
              e={e}
              showPick
              picked={isPicked(e)}
              onPick={() => togglePick(e)}
              onOpen={(tab) => openDetail(e, tab)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ 1件のカード ------------------------------ */

function EntryCard({
  e,
  showPick,
  picked,
  onPick,
  onOpen,
}: {
  e: MonthEntry;
  showPick: boolean;
  picked: boolean;
  onPick: () => void;
  onOpen: (tab: TabKey) => void;
}) {
  const note = labelNote(e.runLabel);
  const miss = missingForPoster(e);

  return (
    <li className="rounded-xl bg-stone-50 p-3">
      <div className="flex gap-3">
        <MonthlyPhoto
          image={e.image}
          className="h-20 w-20 shrink-0 rounded-lg bg-white object-contain p-1"
          fontSize={11}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-stone-900">{e.product.name}</span>
            {e.startsThisMonth && <span className={badge("accent")}>今月発売</span>}
            {e.ongoing && <span className={badge("neutral")}>継続販売</span>}
            {note.confirmed && <span className={badge("good")}>本人確定（データの表記）</span>}
            {isTentativeName(e.product.name) && (
              <span className={badge("warn")}>商品名が仮</span>
            )}
          </div>

          <dl className="mt-1.5 space-y-0.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-stone-500">販売期間</dt>
              <dd className={hasPeriod(e) ? "text-stone-800" : "font-medium text-amber-700"}>
                {periodText(e)}
                {!hasPeriod(e) && "（未入力）"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-stone-500">価格</dt>
              <dd
                className={
                  hasPrice(e.fields) ? "tabular-nums text-stone-800" : "font-medium text-amber-700"
                }
              >
                {priceText(e.fields)}
                {hasPrice(e.fields) ? "（税込）" : "（未入力）"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-stone-500">対象店舗</dt>
              <dd className="text-stone-800">{storeText(e.fields)}</dd>
            </div>
            {e.runLabel && (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-stone-500">販売の回</dt>
                <dd className="text-stone-600">{e.runLabel}</dd>
              </div>
            )}
          </dl>

          {e.imageFromOtherRun && (
            <p className="mt-1.5 text-xs text-amber-700">
              この回のビジュアルは未登録のため、前の回の画像を出しています。
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2">
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
