"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { TabKey } from "./Header";
import Icon from "@/components/Icon";
import {
  collectDeadlines,
  computeDashboardStats,
  infoFillRate,
  nearestPerProduct,
  taskCompletion,
} from "@/lib/stats";
import { SALE_STATUS_LABEL, isInactive, saleStatus, todayKey } from "@/lib/saleStatus";
import { GENRE_LABELS } from "@/lib/types";
import { formatJpDate } from "@/lib/deadline";
import { badge, btn, chip, focusRing, meter } from "@/lib/ui";

/**
 * ホーム画面の見た目について（2026年9月14日）
 *
 * 松尾さんの指示：「Appleのサイトを参考に」。橙（ブランドの色）はそのままに、
 * **余白・文字の大きさ・面の形**だけを Apple のやり方に寄せている。
 *
 * - 地は白に近いグレー、載せる面は白。**枠線は引かず、余白と影で区切る**
 * - 見出しは大きく・字間を詰める。説明は薄いグレーで一段下げる
 * - 面の角丸は大きめ（2xl・3xl）。押すものは丸い（pill）
 * - セクションの見出しは**面の外**に置く。面の中は中身だけにする
 *
 * 中身・押したときの動きは今までと同じ。見た目だけを変えている。
 */

/** 面。枠線を引かず、白＋うっすらした影で浮かせる */
const surface = "rounded-2xl bg-white shadow-sm sm:rounded-3xl";

/** 面の外に置く小見出し */
const sectionTitle = "text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl";

/**
 * 数字のタイル。数字を大きく、ラベルは小さく下に置く。
 * 進み具合が分かるものには細い棒を足して、数字だけを睨まなくても済むようにする。
 */
function StatCard({
  label,
  value,
  suffix,
  pct,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  pct?: number;
  tone?: "danger";
}) {
  const m = pct !== undefined ? meter(pct, "mt-4") : null;
  return (
    <div className={`${surface} p-5 sm:p-6`}>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl ${
            tone === "danger" ? "text-red-600" : "text-stone-900"
          }`}
        >
          {value}
        </span>
        {suffix && <span className="text-base font-medium text-stone-400">{suffix}</span>}
      </div>
      <div className="mt-2 text-xs leading-snug text-stone-500 sm:text-sm">{label}</div>
      {m && (
        <div className={m.track}>
          <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
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
  const nearestDeadlines = useMemo(() => nearestPerProduct(deadlines), [deadlines]);

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
        <div className={`${surface} p-6 sm:p-8`}>
          <div className="flex items-center gap-2.5">
            <Icon name="arrowRight" className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-stone-500">次にやること</span>
            <DueBadge days={next.days} extra="ml-auto" />
          </div>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                {next.product.name}
              </div>
              <div className="mt-2 text-[15px] leading-relaxed text-stone-600">
                {next.group.icon} {next.group.title}
                <span className="mx-2 text-stone-300">/</span>
                {next.milestone.label}（{formatJpDate(next.deadline)}）
              </div>
              <div className="mt-1 text-sm tabular-nums text-stone-500">
                このまとまりの残り {next.total - next.checked}件
              </div>
            </div>
            <button
              className={`${btn("primary")} w-full rounded-full px-6 sm:w-auto`}
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
        />
        <StatCard
          label="タスク 平均完了率"
          value={String(stats.avgTaskCompletion)}
          suffix="%"
          pct={stats.avgTaskCompletion}
        />
        <StatCard
          label="期限超過のタスク"
          value={String(stats.overdueTaskCount)}
          suffix="件"
          tone={stats.overdueTaskCount > 0 ? "danger" : undefined}
        />
      </div>

      {/* 直近の締め切り。見出しは面の外に置き、面の中は行だけにする */}
      <section>
        <div className="mb-4 flex items-center gap-2.5 px-1">
          <Icon name="calendar" className="h-5 w-5 text-stone-400" />
          <h3 className={sectionTitle}>直近の締め切り</h3>
        </div>
        <p className="mb-4 px-1 text-sm leading-relaxed text-stone-500">
          継続販売中の商品と、発売から1年以上が経過した商品は表示していません（各商品の準備タスク画面では従来どおり確認できます）。
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
                  className={`flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-3.5 text-left transition hover:bg-stone-50 sm:px-7 ${focusRing}`}
                >
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

      {/* 商品一覧 */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
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
