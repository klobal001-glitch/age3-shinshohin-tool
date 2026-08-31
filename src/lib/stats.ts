import { useAppData } from "@/hooks/useAppData";
import { requiredProgress, optionalProgress } from "./productInfo";
import { TASK_GROUPS } from "./prepTasks";
import { computeDeadline, daysDiffFromToday, isReleasedLongAgo } from "./deadline";
import { Genre, Product, ProductInfo, TaskGroup, Milestone } from "./types";

type App = ReturnType<typeof useAppData>;
type TaskState = Record<string, boolean>;

function leafKey(groupId: string, milestoneId: string, taskId: string, childId?: string) {
  return childId
    ? `${groupId}|${milestoneId}|${taskId}|${childId}`
    : `${groupId}|${milestoneId}|${taskId}`;
}

/** 商品情報シートの入力率（必須＋任意項目を合算）。必須の数はジャンルで変わる */
export function infoFillRate(info: ProductInfo, genre: Genre): number {
  const req = requiredProgress(info, genre);
  const opt = optionalProgress(info);
  const total = req.total + opt.total;
  if (!total) return 0;
  return Math.round(((req.filled + opt.filled) / total) * 100);
}

/** 1商品ぶんの準備タスク完了状況（全グループ合算） */
export function taskCompletion(taskState: TaskState): { checked: number; total: number } {
  let checked = 0;
  let total = 0;
  for (const g of TASK_GROUPS) {
    for (const m of g.milestones) {
      for (const t of m.tasks) {
        if (t.children && t.children.length > 0) {
          for (const c of t.children) {
            total++;
            if (taskState[leafKey(g.id, m.id, t.id, c.id)]) checked++;
          }
        } else {
          total++;
          if (taskState[leafKey(g.id, m.id, t.id)]) checked++;
        }
      }
    }
  }
  return { checked, total };
}

function milestoneCheckState(group: TaskGroup, m: Milestone, taskState: TaskState) {
  let checked = 0;
  let total = 0;
  for (const t of m.tasks) {
    if (t.children && t.children.length > 0) {
      for (const c of t.children) {
        total++;
        if (taskState[leafKey(group.id, m.id, t.id, c.id)]) checked++;
      }
    } else {
      total++;
      if (taskState[leafKey(group.id, m.id, t.id)]) checked++;
    }
  }
  return { checked, total };
}

export interface DeadlineEntry {
  product: Product;
  group: TaskGroup;
  milestone: Milestone;
  deadline: Date;
  days: number;
  checked: number;
  total: number;
}

/** ダッシュボードで締め切りを追わなくなるまでの期間（発売日から） */
export const DEADLINE_TRACKING_MONTHS = 12;

/**
 * 全商品ぶんの「未完了マイルストーン」を締め切りが近い順（延滞が大きい順）に並べる。
 *
 * 次の商品は対象外にしている（商品ごとの準備タスク画面には従来どおり表示される）:
 * - 廃盤の商品 … もう作らないため
 * - 継続販売中のレギュラー商品 … 発売準備の締め切りという概念がないため
 * - 発売から1年以上が経過した商品 … 過ぎた締め切りを延々と催促しても意味がないため
 */
export function collectDeadlines(app: App): DeadlineEntry[] {
  const entries: DeadlineEntry[] = [];
  for (const p of app.products) {
    const info = app.getInfo(p.id);
    if (info.discontinued) continue; // 廃盤は締め切りを追わない
    if (!info.releaseDate) continue;
    if (info.ongoing) continue;
    if (isReleasedLongAgo(info.releaseDate, DEADLINE_TRACKING_MONTHS)) continue;
    const taskState = app.getTaskState(p.id);
    for (const g of TASK_GROUPS) {
      for (const m of g.milestones) {
        const deadline = computeDeadline(m.rule, info.releaseDate, info.endDate, info.ongoing);
        if (!deadline) continue;
        const { checked, total } = milestoneCheckState(g, m, taskState);
        if (total > 0 && checked === total) continue; // 完了済みは除外
        const days = daysDiffFromToday(deadline) ?? 0;
        entries.push({ product: p, group: g, milestone: m, deadline, days, checked, total });
      }
    }
  }
  entries.sort((a, b) => a.days - b.days);
  return entries;
}

/** 商品ごとに最も緊急な（締め切りが近い）マイルストーンだけを残す */
export function nearestPerProduct(entries: DeadlineEntry[]): DeadlineEntry[] {
  const seen = new Map<string, DeadlineEntry>();
  for (const e of entries) {
    const cur = seen.get(e.product.id);
    if (!cur || e.days < cur.days) seen.set(e.product.id, e);
  }
  return Array.from(seen.values()).sort((a, b) => a.days - b.days);
}

export interface DashboardStats {
  productCount: number;
  avgInfoFill: number;
  avgTaskCompletion: number;
  overdueTaskCount: number;
}

export function computeDashboardStats(app: App, deadlines: DeadlineEntry[]): DashboardStats {
  /* 廃盤はもう作らないので、現行の商品だけで平均を出す */
  const products = app.products.filter((p) => !app.getInfo(p.id).discontinued);
  let infoSum = 0;
  let taskChecked = 0;
  let taskTotal = 0;
  for (const p of products) {
    infoSum += infoFillRate(app.getInfo(p.id), p.genre);
    const ts = taskCompletion(app.getTaskState(p.id));
    taskChecked += ts.checked;
    taskTotal += ts.total;
  }
  const overdueTaskCount = deadlines
    .filter((e) => e.days < 0)
    .reduce((sum, e) => sum + (e.total - e.checked), 0);

  return {
    productCount: products.length,
    avgInfoFill: products.length ? Math.round(infoSum / products.length) : 0,
    avgTaskCompletion: taskTotal ? Math.round((taskChecked / taskTotal) * 100) : 0,
    overdueTaskCount,
  };
}
