"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import ProductPicker from "./ProductPicker";
import { TASK_GROUPS, countGroupLeaves, countLeaves } from "@/lib/prepTasks";
import { computeDeadline, daysDiffFromToday, diffLabel, formatJpDate } from "@/lib/deadline";
import { Milestone, TaskGroup, TaskItem } from "@/lib/types";

function leafKey(groupId: string, milestoneId: string, taskId: string, childId?: string) {
  return childId
    ? `${groupId}|${milestoneId}|${taskId}|${childId}`
    : `${groupId}|${milestoneId}|${taskId}`;
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

  if (!selectedProduct || !info) {
    return <ProductPicker app={app} />;
  }

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="print:hidden">
        <ProductPicker app={app} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-stone-600">発売月</span>
            <input
              type="month"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              value={info.releaseDate ? info.releaseDate.slice(0, 7) : ""}
              onChange={(e) => patchDates(e.target.value ? `${e.target.value}-01` : "", info.endDate)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-stone-600">販売終了月（任意・G-5用）</span>
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
          <label className="ml-auto flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
            未完了だけ
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              sortMode === "group" ? "border-amber-600 bg-amber-600 text-white" : "border-stone-300 text-stone-600"
            }`}
            onClick={() => setSortMode("group")}
          >
            グループ別
          </button>
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              sortMode === "deadline" ? "border-amber-600 bg-amber-600 text-white" : "border-stone-300 text-stone-600"
            }`}
            onClick={() => setSortMode("deadline")}
          >
            締め切り順（全部）
          </button>
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
            return (
              <div key={group.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-stone-800">
                    <span>{group.icon}</span>
                    {group.title}
                  </h3>
                  <span className="text-xs text-stone-400">
                    {gp.checked}/{gp.total}（{gp.total ? Math.round((gp.checked / gp.total) * 100) : 0}%）
                  </span>
                </div>
                {group.milestones.map((m) => {
                  const deadline = computeDeadline(m.rule, info.releaseDate, info.endDate, info.ongoing);
                  const days = daysDiffFromToday(deadline);
                  const dl = diffLabel(days);
                  const mp = milestoneProgress(group, m);
                  if (hideCompleted && mp.checked === mp.total && mp.total > 0) return null;
                  return (
                    <div key={m.id} className="mb-4 rounded-lg border border-stone-100 last:mb-0">
                      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                        <span className="font-medium text-stone-700">
                          {m.label} ＝ {formatJpDate(deadline)}
                        </span>
                        {dl && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              dl.overdue ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {dl.text}
                          </span>
                        )}
                        {m.note && <span className="text-xs text-stone-400">{m.note}</span>}
                        <span className="ml-auto text-xs text-stone-400">
                          {mp.checked}/{mp.total}
                        </span>
                      </div>
                      <div className="divide-y divide-stone-100 px-3">
                        {m.tasks.map((t) =>
                          t.children && t.children.length > 0 ? (
                            <div key={t.id} className="py-2">
                              <div className="text-sm text-stone-700">{t.label}</div>
                              <div className="mt-1 flex gap-4 pl-4">
                                {t.children.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 text-sm text-stone-600">
                                    <input
                                      type="checkbox"
                                      checked={isLeafChecked(group.id, m.id, t, c.id)}
                                      onChange={() => toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id, c.id))}
                                    />
                                    {c.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <label key={t.id} className="flex items-center gap-2 py-2 text-sm text-stone-700">
                              <input
                                type="checkbox"
                                checked={isLeafChecked(group.id, m.id, t)}
                                onChange={() => toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id))}
                              />
                              {t.label}
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        : (
          <div className="rounded-xl border border-amber-200 bg-white p-4">
            {flatMilestones.map(({ group, milestone: m, deadline }) => {
              const days = daysDiffFromToday(deadline);
              const dl = diffLabel(days);
              const mp = milestoneProgress(group, m);
              if (hideCompleted && mp.checked === mp.total && mp.total > 0) return null;
              return (
                <div key={`${group.id}-${m.id}`} className="mb-4 rounded-lg border border-stone-100 last:mb-0">
                  <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                    <span className="text-stone-500">
                      {group.icon} {group.title} ／
                    </span>
                    <span className="font-medium text-stone-700">
                      {m.label} ＝ {formatJpDate(deadline)}
                    </span>
                    {dl && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          dl.overdue ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {dl.text}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-stone-400">
                      {mp.checked}/{mp.total}
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100 px-3">
                    {m.tasks.map((t) =>
                      t.children && t.children.length > 0 ? (
                        <div key={t.id} className="py-2">
                          <div className="text-sm text-stone-700">{t.label}</div>
                          <div className="mt-1 flex gap-4 pl-4">
                            {t.children.map((c) => (
                              <label key={c.id} className="flex items-center gap-2 text-sm text-stone-600">
                                <input
                                  type="checkbox"
                                  checked={isLeafChecked(group.id, m.id, t, c.id)}
                                  onChange={() => toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id, c.id))}
                                />
                                {c.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <label key={t.id} className="flex items-center gap-2 py-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={isLeafChecked(group.id, m.id, t)}
                            onChange={() => toggleTask(selectedProduct.id, leafKey(group.id, m.id, t.id))}
                          />
                          {t.label}
                        </label>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
