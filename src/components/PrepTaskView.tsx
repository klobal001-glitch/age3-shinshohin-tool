"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import ProductPicker from "./ProductPicker";
import { TASK_GROUPS, countGroupLeaves, countLeaves } from "@/lib/prepTasks";
import { computeDeadline, daysDiffFromToday, diffLabel, formatJpDate } from "@/lib/deadline";
import { Milestone, TaskGroup, TaskItem } from "@/lib/types";

/** 並べ替え・絞り込みボタンの共通スタイル */
function ctrlCls(active: boolean) {
  return `rounded-lg border px-3 py-1.5 text-sm transition ${
    active
      ? "border-stone-700 bg-stone-700 font-medium text-white"
      : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
  }`;
}

function leafKey(groupId: string, milestoneId: string, taskId: string, childId?: string) {
  return childId
    ? `${groupId}|${milestoneId}|${taskId}|${childId}`
    : `${groupId}|${milestoneId}|${taskId}`;
}

/** 締め切り1区切りぶんのカード。完了済みは折りたたんだ状態で開く */
function MilestoneCard({
  group,
  milestone,
  deadline,
  checked,
  total,
  showGroupName,
  isChecked,
  onToggle,
}: {
  group: TaskGroup;
  milestone: Milestone;
  deadline: Date | null;
  checked: number;
  total: number;
  showGroupName?: boolean;
  isChecked: (t: TaskItem, childId?: string) => boolean;
  onToggle: (t: TaskItem, childId?: string) => void;
}) {
  const done = total > 0 && checked === total;
  const [open, setOpen] = useState(!done);
  const dl = diffLabel(daysDiffFromToday(deadline));

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200">
      <button
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 bg-stone-50 px-3 py-2.5 text-left hover:bg-stone-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="w-4 shrink-0 text-xs text-stone-400">{open ? "▾" : "▸"}</span>
        {showGroupName && (
          <span className="text-xs text-stone-500">
            {group.icon} {group.title}
          </span>
        )}
        <span className="text-sm font-medium text-stone-800">{milestone.label}</span>
        <span className="text-sm tabular-nums text-stone-500">{formatJpDate(deadline)}</span>
        {dl && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
              dl.overdue ? "bg-red-100 text-red-700" : "bg-stone-200 text-stone-700"
            }`}
          >
            {dl.text}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {done && <span className="text-xs font-medium text-emerald-600">完了</span>}
          <span className="text-xs tabular-nums text-stone-500">
            {checked}/{total}
          </span>
        </span>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {milestone.tasks.map((t) =>
            t.children && t.children.length > 0 ? (
              <div key={t.id} className="px-3 py-2">
                <div className="text-sm text-stone-700">{t.label}</div>
                <div className="mt-1 flex flex-wrap gap-2 pl-1">
                  {t.children.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-amber-600"
                        checked={isChecked(t, c.id)}
                        onChange={() => onToggle(t, c.id)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-amber-50/60"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
                  checked={isChecked(t)}
                  onChange={() => onToggle(t)}
                />
                <span className={isChecked(t) ? "text-stone-400 line-through" : "text-stone-700"}>
                  {t.label}
                </span>
              </label>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function PrepTaskView({ app }: { app: ReturnType<typeof useAppData> }) {
  const { selectedProduct, getInfo, getTaskState, toggleTask, resetProductTasks } = app;
  const [sortMode, setSortMode] = useState<"group" | "deadline">("group");
  const [hideCompleted, setHideCompleted] = useState(false);

  const info = selectedProduct ? getInfo(selectedProduct.id) : null;
  const taskState = selectedProduct ? getTaskState(selectedProduct.id) : {};
  const releaseDate = info?.releaseDate ?? "";
  const endDate = info?.endDate ?? "";
  const ongoing = info?.ongoing ?? false;

  const patchDates = (release: string, end: string) => {
    if (!selectedProduct) return;
    app.updateInfo(selectedProduct.id, { releaseDate: release, endDate: end });
  };

  const isLeafChecked = (groupId: string, milestoneId: string, task: TaskItem, childId?: string) =>
    !!taskState[leafKey(groupId, milestoneId, task.id, childId)];

  const milestoneProgress = (group: TaskGroup, m: Milestone) => {
    let checked = 0;
    const total = countLeaves(m);
    for (const t of m.tasks) {
      if (t.children && t.children.length > 0) {
        for (const c of t.children) {
          if (isLeafChecked(group.id, m.id, t, c.id)) checked++;
        }
      } else if (isLeafChecked(group.id, m.id, t)) {
        checked++;
      }
    }
    return { checked, total };
  };

  const groupProgress = (group: TaskGroup) => {
    const total = countGroupLeaves(group);
    let checked = 0;
    for (const m of group.milestones) checked += milestoneProgress(group, m).checked;
    return { checked, total };
  };

  // グループ数・タスク数がごく少数のため useMemo は使わず毎回計算する
  const flatMilestones: { group: TaskGroup; milestone: Milestone; deadline: Date | null }[] = [];
  for (const g of TASK_GROUPS) {
    for (const m of g.milestones) {
      flatMilestones.push({ group: g, milestone: m, deadline: computeDeadline(m.rule, releaseDate, endDate, ongoing) });
    }
  }
  if (sortMode === "deadline") {
    flatMilestones.sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity));
  }

  // この商品ぜんぶの進み具合と、いちばん急ぐ未完了の区切り
  const overall = { checked: 0, total: 0 };
  for (const g of TASK_GROUPS) {
    const gp = groupProgress(g);
    overall.checked += gp.checked;
    overall.total += gp.total;
  }
  const overallPct = overall.total ? Math.round((overall.checked / overall.total) * 100) : 0;

  const pending = flatMilestones
    .map((f) => ({ ...f, ...milestoneProgress(f.group, f.milestone) }))
    .filter((f) => f.deadline && !(f.total > 0 && f.checked === f.total));
  pending.sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0));
  const first = pending[0];
  const nextUp = first ? { ...first, label: diffLabel(daysDiffFromToday(first.deadline)) } : null;

  if (!selectedProduct || !info) {
    return <ProductPicker app={app} />;
  }

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="print:hidden">
        <ProductPicker app={app} />
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-stone-100 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-800">準備タスクの進み具合</h2>
          <span className="ml-auto text-sm tabular-nums text-stone-600">
            {overall.checked}/{overall.total}（{overallPct}%）
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full rounded-full ${overallPct === 100 ? "bg-emerald-500" : "bg-amber-600"}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>

          {nextUp ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="text-xs font-medium text-amber-800">次にやること</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-stone-800">
                  {nextUp.group.icon} {nextUp.group.title}
                </span>
                <span className="text-sm text-stone-700">{nextUp.milestone.label}</span>
                <span className="text-sm tabular-nums text-stone-600">
                  {formatJpDate(nextUp.deadline)}
                </span>
                {nextUp.label && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                      nextUp.label.overdue ? "bg-red-100 text-red-700" : "bg-white text-stone-700"
                    }`}
                  >
                    {nextUp.label.text}
                  </span>
                )}
                <span className="text-xs tabular-nums text-stone-500">
                  残り {nextUp.total - nextUp.checked}件
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {info.releaseDate
                ? "この商品の準備タスクはすべて完了しています。"
                : "発売月を設定すると、締め切りが自動で計算されます。"}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4 border-t border-stone-200 pt-3">
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">発売月</span>
              <input
                type="month"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                value={info.releaseDate ? info.releaseDate.slice(0, 7) : ""}
                onChange={(e) => patchDates(e.target.value ? `${e.target.value}-01` : "", info.endDate)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">販売終了月（G-5用）</span>
              {info.ongoing ? (
                <span className="inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                  継続販売中
                </span>
              ) : (
                <input
                  type="month"
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
                  value={info.endDate ? info.endDate.slice(0, 7) : ""}
                  onChange={(e) => patchDates(info.releaseDate, e.target.value ? `${e.target.value}-01` : "")}
                />
              )}
            </label>
            <span className="text-xs text-stone-400">この2つから締め切りを計算します</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="w-16 shrink-0 text-sm text-stone-500">並べ替え</span>
            <button className={ctrlCls(sortMode === "group")} onClick={() => setSortMode("group")}>
              グループ別
            </button>
            <button className={ctrlCls(sortMode === "deadline")} onClick={() => setSortMode("deadline")}>
              締め切りが近い順
            </button>
            <button
              className={`${ctrlCls(hideCompleted)} ml-auto`}
              onClick={() => setHideCompleted((v) => !v)}
            >
              {hideCompleted ? "✓ 未完了だけ表示中" : "未完了だけ表示"}
            </button>
          </div>
        </div>
      </div>

      {!info.releaseDate && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          発売月を設定すると、各タスクの締め切りが自動計算されます。
        </p>
      )}

      {sortMode === "group"
        ? TASK_GROUPS.map((group) => {
            const gp = groupProgress(group);
            const pct = gp.total ? Math.round((gp.checked / gp.total) * 100) : 0;
            const cards = group.milestones
              .map((m) => ({ m, mp: milestoneProgress(group, m) }))
              .filter(({ mp }) => !(hideCompleted && mp.total > 0 && mp.checked === mp.total));
            if (cards.length === 0) return null;
            return (
              <section key={group.id} className="overflow-hidden rounded-xl border border-stone-300 bg-white">
                <div className="flex items-center gap-3 border-b border-stone-300 bg-stone-100 px-5 py-3">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800">
                    <span aria-hidden>{group.icon}</span>
                    {group.title}
                  </h3>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-stone-300 sm:block">
                      <span
                        className={`block h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-600"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-xs tabular-nums text-stone-600">
                      {gp.checked}/{gp.total}
                    </span>
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  {cards.map(({ m, mp }) => (
                    <MilestoneCard
                      key={m.id}
                      group={group}
                      milestone={m}
                      deadline={computeDeadline(m.rule, info.releaseDate, info.endDate, info.ongoing)}
                      checked={mp.checked}
                      total={mp.total}
                      isChecked={(t, childId) => isLeafChecked(group.id, m.id, t, childId)}
                      onToggle={(t, childId) =>
                        toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id, childId))
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })
        : (
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
            <div className="flex items-center gap-3 border-b border-stone-300 bg-stone-100 px-5 py-3">
              <h3 className="text-base font-semibold text-stone-800">締め切りが近い順</h3>
              <span className="ml-auto text-xs text-stone-500">グループをまたいで並べています</span>
            </div>
            <div className="space-y-3 p-4">
              {flatMilestones
                .map(({ group, milestone: m, deadline }) => ({
                  group,
                  m,
                  deadline,
                  mp: milestoneProgress(group, m),
                }))
                .filter(({ mp }) => !(hideCompleted && mp.total > 0 && mp.checked === mp.total))
                .map(({ group, m, deadline, mp }) => (
                  <MilestoneCard
                    key={`${group.id}-${m.id}`}
                    group={group}
                    milestone={m}
                    deadline={deadline}
                    checked={mp.checked}
                    total={mp.total}
                    showGroupName
                    isChecked={(t, childId) => isLeafChecked(group.id, m.id, t, childId)}
                    onToggle={(t, childId) =>
                      toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id, childId))
                    }
                  />
                ))}
            </div>
          </section>
        )}

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          onClick={() => window.print()}
        >
          🖨 印刷 / PDF保存
        </button>
        <button
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          onClick={() => {
            if (confirm("この商品の進捗をリセットします。よろしいですか？")) {
              resetProductTasks(selectedProduct.id);
            }
          }}
        >
          この商品の進捗をリセット
        </button>
      </div>

      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-stone-500">
        ※これは新商品1つ分の準備業務（G-1〜G-5）です。締め切りは発売月から自動計算した目安（前々月＝2か月前／前月＝1か月前）。G-5「販売終了後」は「販売終了月」を選ぶと月末の日付が出ます。チェックはこの端末に保存されます。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
