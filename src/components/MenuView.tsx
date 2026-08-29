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
import { GENRE_LABELS } from "@/lib/types";
import { formatJpDate } from "@/lib/deadline";

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <div className={`text-3xl font-bold ${tone === "danger" ? "text-red-600" : "text-stone-800"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
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

  const productRows = useMemo(() => {
    const rows = products.map((p) => {
      const info = infoFillRate(getInfo(p.id));
      const t = taskCompletion(getTaskState(p.id));
      const task = t.total ? Math.round((t.checked / t.total) * 100) : 0;
      return { product: p, info, task };
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-stone-800">こんにちは。今日の状況です</h2>
        <p className="mt-1 text-sm text-stone-500">
          商品ごとの「商品情報シート」と「準備タスク（G-1〜G-5）」をまとめて管理します。左のリストから商品を選ぶか、下の一覧から直接開けます。
        </p>
      </div>

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

      <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <span>⏰</span>
          <h3 className="font-semibold text-stone-800">直近の締め切り</h3>
        </div>
        <p className="mb-3 text-xs text-stone-400">
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
                onClick={() => openProduct(e.product.id)}
                className="flex w-full flex-wrap items-center gap-2 py-2 text-left text-sm hover:bg-amber-50"
              >
                <span className="min-w-[9rem] font-medium text-stone-800">{e.product.name}</span>
                <span className="text-stone-400">
                  {e.group.icon} {e.milestone.label}（{formatJpDate(e.deadline)}）
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.days < 0
                      ? "bg-red-100 text-red-700"
                      : e.days === 0
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {e.days < 0 ? `${-e.days}日遅れ` : e.days === 0 ? "本日締切" : `あと${e.days}日`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span>📋</span>
          <h3 className="font-semibold text-stone-800">商品一覧</h3>
          <span className="text-xs text-stone-400">{productRows.length}件</span>
          <div className="ml-auto flex gap-1">
            <button
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                productSort === "progress" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
              }`}
              onClick={() => setProductSort("progress")}
            >
              進捗が低い順
            </button>
            <button
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                productSort === "name" ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
              }`}
              onClick={() => setProductSort("name")}
            >
              名前順
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {productRows.map(({ product, info, task }) => (
                <tr key={product.id} className="hover:bg-amber-50">
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => openProduct(product.id)}
                      className="font-medium text-stone-800 hover:text-amber-700 hover:underline"
                    >
                      {product.name}
                    </button>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-500">情報 {info}%</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-stone-500">準備 {task}%</td>
                  <td className="whitespace-nowrap py-2 text-right text-xs text-stone-400">
                    {product.genre ? GENRE_LABELS[product.genre] : "未分類"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-stone-500">
        ※各シートは情報を集める・進行を管理するための下書き／目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。入力・チェックは共有データベースに自動保存されます。
      </p>
    </div>
  );
}
