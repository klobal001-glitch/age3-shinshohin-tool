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
import { badge, btn, card, chip, focusRing, h2, h3, meter, muted } from "@/lib/ui";

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
  const m = pct !== undefined ? meter(pct, "mt-3") : null;
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-baseline gap-0.5">
        <span
          className={`text-2xl font-semibold tabular-nums sm:text-3xl ${
            tone === "danger" ? "text-red-600" : "text-stone-900"
          }`}
        >
          {value}
        </span>
        {suffix && <span className="text-sm font-medium text-stone-400">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs leading-snug text-stone-500">{label}</div>
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
  const m = meter(pct, "w-14");
  return (
    <span className="hidden items-center gap-2 sm:flex">
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
    <div className="space-y-5">
      <div>
        <h2 className={h2}>今日の状況</h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">
          商品ごとの「商品情報シート」と「準備タスク（G-1〜G-5）」をまとめて管理します。
          {/* スマホには左のリストが無いので、案内の書き方を画面幅で変える */}
          <span className="hidden md:inline">左のリストから商品を選ぶか、</span>
          下の一覧から商品を直接開けます。
        </p>
      </div>

      {/* いちばん急ぐ1件だけを大きく出す。数字の一覧を眺めても「次に何をするか」は分からないため */}
      {next && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
            <Icon name="arrowRight" className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-stone-800">次にやること</h3>
            <DueBadge days={next.days} extra="ml-auto" />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-stone-900">
                {next.product.name}
              </div>
              <div className="mt-1 text-sm text-stone-600">
                {next.group.icon} {next.group.title}
                <span className="mx-1.5 text-stone-300">/</span>
                {next.milestone.label}（{formatJpDate(next.deadline)}）
              </div>
              <div className="mt-0.5 text-xs tabular-nums text-stone-500">
                このまとまりの残り {next.total - next.checked}件
              </div>
            </div>
            <button
              className={`${btn("primary")} w-full sm:w-auto`}
              onClick={() => openTasks(next.product.id)}
            >
              このタスクを開く
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録商品数" value={String(stats.productCount)} suffix="件" />
        <StatCard
          label="情報シート平均入力率"
          value={String(stats.avgInfoFill)}
          suffix="%"
          pct={stats.avgInfoFill}
        />
        <StatCard
          label="準備タスク平均完了率"
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

      <div className={card}>
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
          <Icon name="calendar" className="h-4 w-4 text-stone-400" />
          <h3 className={h3}>直近の締め切り</h3>
        </div>
        <div className="p-4 pt-3">
          <p className={`mb-2 ${muted}`}>
            継続販売中の商品と、発売から1年以上が経過した商品は表示していません（各商品の準備タスク画面では従来どおり確認できます）。
          </p>
          {nearestDeadlines.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">
              発売月が設定されている商品がまだありません。準備タスクで発売月を設定すると、ここに締め切りが表示されます。
            </p>
          ) : (
            <div className="-mx-1 divide-y divide-stone-100">
              {nearestDeadlines.slice(0, 8).map((e) => (
                <button
                  key={`${e.product.id}-${e.group.id}-${e.milestone.id}`}
                  onClick={() => openTasks(e.product.id)}
                  className={`flex min-h-12 w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-stone-50 ${focusRing}`}
                >
                  <span className="min-w-[9rem] font-medium text-stone-800">{e.product.name}</span>
                  <span className="text-xs text-stone-500">
                    {e.group.icon} {e.milestone.label}（{formatJpDate(e.deadline)}）
                  </span>
                  <DueBadge days={e.days} extra="ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
          <h3 className={h3}>商品一覧</h3>
          <span className="text-xs tabular-nums text-stone-400">{productRows.length}件</span>
          <div className="ml-auto flex gap-1.5">
            <button
              className={chip(productSort === "progress", "min-h-9 px-2.5 text-xs")}
              onClick={() => setProductSort("progress")}
            >
              進捗が低い順
            </button>
            <button
              className={chip(productSort === "name", "min-h-9 px-2.5 text-xs")}
              onClick={() => setProductSort("name")}
            >
              名前順
            </button>
          </div>
        </div>
        <div className="max-h-[26rem] overflow-y-auto px-2 py-1">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {productRows.map(({ product, info, task, status }) => (
                <tr key={product.id} className="transition hover:bg-stone-50">
                  <td className="w-full py-1.5 pl-2 pr-3">
                    <button
                      onClick={() => openProduct(product.id)}
                      className={`min-h-11 text-left font-medium transition hover:text-amber-700 md:min-h-0 ${focusRing} ${
                        isInactive(status) ? "text-stone-400" : "text-stone-800"
                      }`}
                    >
                      {product.name}
                    </button>
                    {isInactive(status) && (
                      <span className={badge("neutral", "ml-2")}>{SALE_STATUS_LABEL[status]}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className="text-xs text-stone-400 sm:hidden">情報 {info}%</span>
                    <MiniMeter pct={info} />
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className="text-xs text-stone-400 sm:hidden">準備 {task}%</span>
                    <MiniMeter pct={task} />
                  </td>
                  {/* 狭い画面では横に入りきらないので、ジャンルは省く */}
                  <td className="hidden whitespace-nowrap py-1.5 pr-2 text-right text-xs text-stone-400 sm:table-cell">
                    {product.genre ? GENRE_LABELS[product.genre] : "未分類"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className={`rounded-lg border border-stone-200 bg-stone-50 p-3 ${muted}`}>
        ※各シートは情報を集める・進行を管理するための下書き／目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。入力・チェックは共有データベースに自動保存されます。
      </p>
    </div>
  );
}
