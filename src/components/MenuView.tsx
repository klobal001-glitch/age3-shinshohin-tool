"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { TabKey } from "./Header";
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
import { badge, btn, card, chip, focusRing, h2, h3, muted } from "@/lib/ui";

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className={`${card} p-4`}>
      <div className={`text-3xl font-bold tabular-nums ${tone === "danger" ? "text-red-600" : "text-stone-800"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm leading-snug text-stone-500">{label}</div>
    </div>
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
    <div className="space-y-4">
      <div>
        <h2 className={h2}>こんにちは。今日の状況です</h2>
        <p className="mt-1 text-sm text-stone-500">
          商品ごとの「商品情報シート」と「準備タスク（G-1〜G-5）」をまとめて管理します。
          {/* スマホには左のリストが無いので、案内の書き方を画面幅で変える */}
          <span className="hidden md:inline">左のリストから商品を選ぶか、</span>
          下の一覧から商品を直接開けます。
        </p>
      </div>

      {/* いちばん急ぐ1件だけを大きく出す。数字の一覧を眺めても「次に何をするか」は分からないため */}
      {next && (
        <div className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3">
            <span aria-hidden>👉</span>
            <h3 className={h3}>次にやること</h3>
            <span className={badge(next.days <= 0 ? "danger" : "good", "ml-auto tabular-nums")}>
              {next.days < 0
                ? `${-next.days}日遅れ`
                : next.days === 0
                  ? "本日締切"
                  : `あと${next.days}日`}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold text-stone-900">{next.product.name}</div>
              <div className="mt-0.5 text-sm text-stone-600">
                {next.group.icon} {next.group.title}
                <span className="mx-1.5 text-stone-400">/</span>
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
              このタスクを開く →
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録商品数" value={String(stats.productCount)} />
        <StatCard label="情報シート平均入力率" value={`${stats.avgInfoFill}%`} />
        <StatCard label="準備タスク平均完了率" value={`${stats.avgTaskCompletion}%`} />
        <StatCard
          label="期限超過のタスク"
          value={String(stats.overdueTaskCount)}
          tone={stats.overdueTaskCount > 0 ? "danger" : undefined}
        />
      </div>

      <div className={`${card} p-4`}>
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden>⏰</span>
          <h3 className={h3}>直近の締め切り</h3>
        </div>
        <p className={`mb-3 ${muted}`}>
          継続販売中の商品と、発売から1年以上が経過した商品は表示していません（各商品の準備タスク画面では従来どおり確認できます）。
        </p>
        {nearestDeadlines.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">
            発売月が設定されている商品がまだありません。準備タスクで発売月を設定すると、ここに締め切りが表示されます。
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {nearestDeadlines.slice(0, 8).map((e) => (
              <button
                key={`${e.product.id}-${e.group.id}-${e.milestone.id}`}
                onClick={() => openTasks(e.product.id)}
                className={`flex min-h-12 w-full flex-wrap items-center gap-2 rounded-lg px-1 py-2 text-left text-sm hover:bg-amber-50 ${focusRing}`}
              >
                <span className="min-w-[9rem] font-medium text-stone-800">{e.product.name}</span>
                <span className="text-stone-400">
                  {e.group.icon} {e.milestone.label}（{formatJpDate(e.deadline)}）
                </span>
                <span className={badge(e.days <= 0 ? "danger" : "good", "ml-auto shrink-0 tabular-nums")}>
                  {e.days < 0 ? `${-e.days}日遅れ` : e.days === 0 ? "本日締切" : `あと${e.days}日`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`${card} p-4`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span aria-hidden>📋</span>
          <h3 className={h3}>商品一覧</h3>
          <span className="text-xs tabular-nums text-stone-400">{productRows.length}件</span>
          <div className="ml-auto flex gap-2">
            <button
              className={chip(productSort === "progress")}
              onClick={() => setProductSort("progress")}
            >
              進捗が低い順
            </button>
            <button className={chip(productSort === "name")} onClick={() => setProductSort("name")}>
              名前順
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {productRows.map(({ product, info, task, status }) => (
                <tr key={product.id} className="hover:bg-amber-50">
                  <td className="w-full py-2 pr-3">
                    <button
                      onClick={() => openProduct(product.id)}
                      className={`min-h-11 text-left font-medium hover:text-amber-700 hover:underline md:min-h-0 ${focusRing} ${
                        isInactive(status) ? "text-stone-400" : "text-stone-800"
                      }`}
                    >
                      {product.name}
                    </button>
                    {isInactive(status) && (
                      <span className={badge("neutral", "ml-2")}>{SALE_STATUS_LABEL[status]}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-500">情報 {info}%</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-500">準備 {task}%</td>
                  {/* 狭い画面では横に入りきらないので、ジャンルは省く */}
                  <td className="hidden whitespace-nowrap py-2 text-right text-xs text-stone-400 sm:table-cell">
                    {product.genre ? GENRE_LABELS[product.genre] : "未分類"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className={`rounded-lg bg-amber-50 p-3 ${muted}`}>
        ※各シートは情報を集める・進行を管理するための下書き／目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。入力・チェックは共有データベースに自動保存されます。
      </p>
    </div>
  );
}
