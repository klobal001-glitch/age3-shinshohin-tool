"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { TabKey } from "./Header";
import Icon from "@/components/Icon";
import {
  BACKLOG_MONTHS,
  backlogPerProduct,
  collectDeadlines,
  computeDashboardStats,
  infoFillRate,
  nearestPerProduct,
  taskCompletion,
} from "@/lib/stats";
import { SALE_STATUS_LABEL, isInactive, saleStatus, todayKey } from "@/lib/saleStatus";
import { GENRE_LABELS } from "@/lib/types";
import { formatJpDate } from "@/lib/deadline";
import { badge, chip, focusRing, meter } from "@/lib/ui";

/**
 * ホーム画面の見た目について（2026年9月14日）
 *
 * 松尾さんの指示：「Appleのサイトを参考に」→ 余白と文字を Apple 風にしたところ、
 * **「色が必要」**との指摘。白とグレーだけでは寒々しく、どこを見ればよいかも
 * 分からなかった。**余白は Apple 風のまま、色を戻した。**
 *
 * - 余白・大きな見出し・大きな角丸・枠線なしは Apple 風のまま
 * - **色は意味のあるところにだけ入れる。** 意味はタスクの色分けと同じ：
 *   橙＝いま手を付けるもの／緑＝進んでいるもの／赤＝遅れているもの
 * - **「次にやること」は橙で塗る。** この画面でいちばん見てほしい1枚なので、
 *   面ごと橙にして白文字にした（この画面で塗るのはここだけ）
 * - 数字のタイルは、数字とうっすらした地に色を付ける
 * - 締め切りの行は、左に遅れ具合の色の線を入れる
 *
 * 中身・押したときの動きは今までと同じ。見た目だけを変えている。
 */

/** 面。枠線を引かず、白＋うっすらした影で浮かせる */
const surface = "rounded-2xl bg-white shadow-sm sm:rounded-3xl";

/** 面の外に置く小見出し */
const sectionTitle = "text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl";

type StatTone = "plain" | "info" | "task" | "danger";

/**
 * 数字のタイル。数字を大きく、ラベルは小さく下に置く。
 * 進み具合が分かるものには細い棒を足して、数字だけを睨まなくても済むようにする。
 *
 * 色の意味はタスクの色分けと同じ。
 * info（シートの入力）＝橙／task（タスクの進み）＝緑／danger（遅れ）＝赤。
 */
function StatCard({
  label,
  value,
  suffix,
  pct,
  tone = "plain",
}: {
  label: string;
  value: string;
  suffix?: string;
  pct?: number;
  tone?: StatTone;
}) {
  const tones: Record<StatTone, { face: string; num: string; bar: string }> = {
    plain: { face: "bg-white", num: "text-stone-900", bar: "bg-stone-300" },
    info: { face: "bg-amber-50", num: "text-amber-700", bar: "bg-amber-500" },
    task: { face: "bg-emerald-50", num: "text-emerald-700", bar: "bg-emerald-500" },
    danger: { face: "bg-red-50", num: "text-red-600", bar: "bg-red-500" },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-2xl ${t.face} p-5 shadow-sm sm:rounded-3xl sm:p-6`}>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${t.num}`}>
          {value}
        </span>
        {suffix && <span className={`text-base font-medium ${t.num} opacity-60`}>{suffix}</span>}
      </div>
      <div className="mt-2 text-xs leading-snug text-stone-600 sm:text-sm">{label}</div>
      {pct !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** セクションの見出しに付ける、色の付いた四角いアイコン */
function SectionIcon({
  name,
  tone,
}: {
  name: "calendar" | "sheet";
  tone: "danger" | "info" | "plain";
}) {
  const face =
    tone === "danger"
      ? "bg-red-100 text-red-600"
      : tone === "info"
        ? "bg-amber-100 text-amber-700"
        : "bg-stone-100 text-stone-500";
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${face}`}>
      <Icon name={name} className="h-5 w-5" />
    </span>
  );
}

/** 残り日数の印。遅れ＝赤、当日＝橙、先＝緑 */
function DueBadge({ days, extra = "" }: { days: number; extra?: string }) {
  const tone = days < 0 ? "danger" : days === 0 ? "warn" : "good";
  const text = days < 0 ? `${-days}日遅れ` : days === 0 ? "本日締切" : `あと${days}日`;
  return <span className={badge(tone, `shrink-0 tabular-nums ${extra}`)}>{text}</span>;
}

/** ひと目で分かる細い進捗の棒（一覧の行で使う） */
function MiniMeter({ pct }: { pct: number }) {
  const m = meter(pct, "w-16");
  return (
    <span className="hidden items-center gap-2.5 sm:flex">
      <span className={m.track}>
        <span className={`block h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-stone-500">{pct}%</span>
    </span>
  );
}

export default function MenuView({
  app,
  onNavigate,
}: {
  app: ReturnType<typeof useAppData>;
  onNavigate: (t: TabKey) => void;
}) {
  const { products, getInfo, getTaskState, setSelectedId } = app;
  const [productSort, setProductSort] = useState<"progress" | "name">("progress");

  const deadlines = useMemo(() => collectDeadlines(app), [app]);
  const stats = useMemo(() => computeDashboardStats(app, deadlines), [app, deadlines]);
  /* 「次にやること」と「直近の締め切り」は過去分（2か月より前）を入れない。
     過去分は下の「過去分のタスク」に分けて出す（2026年9月18日・松尾さんの指示） */
  const nearestDeadlines = useMemo(
    () => nearestPerProduct(deadlines.filter((e) => !e.backlog)),
    [deadlines]
  );
  const backlogRows = useMemo(() => backlogPerProduct(deadlines), [deadlines]);
  const [showBacklog, setShowBacklog] = useState(false);

  const today = todayKey();

  const productRows = useMemo(() => {
    /* 廃盤はもう作らないので、この一覧にも出さない */
    const rows = products
      .filter((p) => !getInfo(p.id).discontinued)
      .map((p) => {
        const raw = getInfo(p.id);
        const info = infoFillRate(raw, p.genre);
        const t = taskCompletion(getTaskState(p.id), raw);
        const task = t.total ? Math.round((t.checked / t.total) * 100) : 0;
        return { product: p, info, task, status: saleStatus(raw, today) };
      });
    if (productSort === "name") {
      rows.sort((a, b) => a.product.name.localeCompare(b.product.name, "ja"));
    } else {
      rows.sort((a, b) => a.info + a.task - (b.info + b.task));
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, productSort]);

  const openProduct = (id: string) => {
    setSelectedId(id);
    onNavigate("sheet");
  };

  /* 締め切りはタスクの話なので、シートではなく準備タスクの画面へ送る */
  const openTasks = (id: string) => {
    setSelectedId(id);
    onNavigate("tasks");
  };

  /* 「次にやること」は、いちばん遅れている1件だけを大きく出す */
  const next = nearestDeadlines[0];

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* 画面のいちばん上。大きな見出しと、ひとことの説明だけを置く */}
      <div className="pt-1 sm:pt-4">
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900 sm:text-4xl">
          今日の状況
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone-500 sm:text-base">
          商品ごとの「商品情報シート」と「準備タスク」をまとめて管理します。
          {/* スマホには左のリストが無いので、案内の書き方を画面幅で変える */}
          <span className="hidden md:inline">左のリストから商品を選ぶか、</span>
          下の一覧から商品を直接開けます。
        </p>
      </div>

      {/* いちばん急ぐ1件だけを大きく出す。数字の一覧を眺めても「次に何をするか」は分からないため */}
      {next && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-6 shadow-md sm:rounded-3xl sm:p-8">
          <div className="flex items-center gap-2.5">
            <Icon name="arrowRight" className="h-4 w-4 text-white/80" />
            <span className="text-sm font-semibold text-white/90">次にやること</span>
            <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-white ring-1 ring-inset ring-white/30">
              {next.days < 0
                ? `${-next.days}日遅れ`
                : next.days === 0
                  ? "本日締切"
                  : `あと${next.days}日`}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {next.product.name}
              </div>
              <div className="mt-2 text-[15px] leading-relaxed text-white/90">
                {next.group.icon} {next.group.title}
                <span className="mx-2 text-white/50">/</span>
                {next.milestone.label}（{formatJpDate(next.deadline)}）
              </div>
              <div className="mt-1 text-sm tabular-nums text-white/75">
                このまとまりの残り {next.total - next.checked}件
              </div>
            </div>
            <button
              className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-6 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 active:bg-amber-100 sm:w-auto md:min-h-0 ${focusRing}`}
              onClick={() => openTasks(next.product.id)}
            >
              このタスクを開く
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        <StatCard label="登録商品数" value={String(stats.productCount)} suffix="件" />
        <StatCard
          label="シート 平均入力率"
          value={String(stats.avgInfoFill)}
          suffix="%"
          pct={stats.avgInfoFill}
          tone="info"
        />
        <StatCard
          label="タスク 平均完了率"
          value={String(stats.avgTaskCompletion)}
          suffix="%"
          pct={stats.avgTaskCompletion}
          tone="task"
        />
        <StatCard
          label={`期限超過のタスク（直近${BACKLOG_MONTHS}か月）`}
          value={String(stats.overdueTaskCount)}
          suffix="件"
          tone={stats.overdueTaskCount > 0 ? "danger" : "plain"}
        />
      </div>

      {/* 直近の締め切り。見出しは面の外に置き、面の中は行だけにする */}
      <section>
        <div className="mb-4 flex items-center gap-3 px-1">
          <SectionIcon name="calendar" tone="danger" />
          <h3 className={sectionTitle}>直近の締め切り</h3>
        </div>
        <p className="mb-4 px-1 text-sm leading-relaxed text-stone-500">
          締め切りが{BACKLOG_MONTHS}か月より前のものは、下の「過去分のタスク」に分けています。継続販売中の商品と、発売から1年以上が経過した商品は表示していません（各商品の準備タスク画面では従来どおり確認できます）。
        </p>
        <div className={`${surface} overflow-hidden`}>
          {nearestDeadlines.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm leading-relaxed text-stone-400">
              発売月が設定されている商品がまだありません。
              <br />
              準備タスクで発売月を設定すると、ここに締め切りが表示されます。
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {nearestDeadlines.slice(0, 8).map((e) => (
                <button
                  key={`${e.product.id}-${e.group.id}-${e.milestone.id}`}
                  onClick={() => openTasks(e.product.id)}
                  className={`flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-3.5 text-left transition hover:bg-stone-50 sm:px-6 ${focusRing}`}
                >
                  {/* 左の線で遅れ具合を出す。数字を読まなくても、色で並び具合が分かる */}
                  <span
                    className={`h-7 w-1.5 shrink-0 rounded-full ${
                      e.days < 0 ? "bg-red-500" : e.days === 0 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="min-w-[9rem] text-[15px] font-medium text-stone-900">
                    {e.product.name}
                  </span>
                  <span className="text-sm text-stone-500">
                    {e.group.icon} {e.milestone.label}（{formatJpDate(e.deadline)}）
                  </span>
                  <DueBadge days={e.days} extra="ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 過去分のタスク。数は見せるが、いま追いかける超過とは一緒にしない。
          いずれ埋める必要があるので、時間があるときに開けるよう一覧はたたんでおく */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
          <SectionIcon name="calendar" tone="plain" />
          <h3 className={sectionTitle}>過去分のタスク</h3>
          <span className="text-sm tabular-nums text-stone-400">
            {stats.backlogTaskCount}件（{stats.backlogProductCount}商品）
          </span>
          {backlogRows.length > 0 && (
            <button
              className={`ml-auto ${chip(showBacklog, "rounded-full", "sm")}`}
              onClick={() => setShowBacklog((v) => !v)}
            >
              {showBacklog ? "たたむ" : "一覧を見る"}
            </button>
          )}
        </div>
        <p className="mb-4 px-1 text-sm leading-relaxed text-stone-500">
          締め切りが{BACKLOG_MONTHS}か月より前に過ぎたタスクです。期限超過の数には入れていません。時間があるときに埋めていきます。
        </p>
        {showBacklog && (
          <div className={`${surface} overflow-hidden`}>
            {backlogRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm leading-relaxed text-stone-400">
                過去分のタスクはありません。
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {backlogRows.map((r) => (
                  <button
                    key={r.product.id}
                    onClick={() => openTasks(r.product.id)}
                    className={`flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-3.5 text-left transition hover:bg-stone-50 sm:px-6 ${focusRing}`}
                  >
                    <span className="h-7 w-1.5 shrink-0 rounded-full bg-stone-300" />
                    <span className="min-w-[9rem] text-[15px] font-medium text-stone-900">
                      {r.product.name}
                    </span>
                    <span className="text-sm text-stone-500">
                      いちばん古い締め切り {formatJpDate(r.oldest.deadline)}（{-r.oldest.days}日前）
                    </span>
                    <span className={badge("neutral", "ml-auto shrink-0 tabular-nums")}>
                      残り {r.remaining}件
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 商品一覧 */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
          <SectionIcon name="sheet" tone="info" />
          <h3 className={sectionTitle}>商品一覧</h3>
          <span className="text-sm tabular-nums text-stone-400">{productRows.length}件</span>
          <div className="ml-auto flex gap-2">
            <button
              className={chip(productSort === "progress", "rounded-full", "sm")}
              onClick={() => setProductSort("progress")}
            >
              進捗が低い順
            </button>
            <button
              className={chip(productSort === "name", "rounded-full", "sm")}
              onClick={() => setProductSort("name")}
            >
              名前順
            </button>
          </div>
        </div>
        <div className={`${surface} overflow-hidden`}>
          <div className="max-h-[30rem] overflow-y-auto">
            <table className="w-full">
              <tbody className="divide-y divide-stone-100">
                {productRows.map(({ product, info, task, status }) => (
                  <tr key={product.id} className="transition hover:bg-stone-50">
                    <td className="w-full py-2.5 pl-5 pr-3 sm:pl-7">
                      <button
                        onClick={() => openProduct(product.id)}
                        className={`min-h-11 text-left text-[15px] font-medium transition hover:text-amber-700 md:min-h-0 ${focusRing} ${
                          isInactive(status) ? "text-stone-400" : "text-stone-900"
                        }`}
                      >
                        {product.name}
                      </button>
                      {isInactive(status) && (
                        <span className={badge("neutral", "ml-2")}>{SALE_STATUS_LABEL[status]}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      <span className="text-xs text-stone-400 sm:hidden">情報 {info}%</span>
                      <MiniMeter pct={info} />
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      <span className="text-xs text-stone-400 sm:hidden">準備 {task}%</span>
                      <MiniMeter pct={task} />
                    </td>
                    {/* 狭い画面では横に入りきらないので、ジャンルは省く */}
                    <td className="hidden whitespace-nowrap py-2.5 pr-5 text-right text-xs text-stone-400 sm:table-cell sm:pr-7">
                      {product.genre ? GENRE_LABELS[product.genre] : "未分類"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="px-1 pb-2 text-xs leading-relaxed text-stone-400">
        ※各シートは情報を集める・進行を管理するための下書き／目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。入力・チェックは共有データベースに自動保存されます。
      </p>
    </div>
  );
}
