import { useAppData } from "@/hooks/useAppData";
import {
  effectiveUberPrice,
  optionalProgress,
  requiredProgress,
  isStorePriceFilled,
} from "./productInfo";
import { TASK_GROUPS } from "./prepTasks";
import { computeDeadline, daysDiffFromToday, isReleasedLongAgo } from "./deadline";
import { Genre, Product, ProductInfo, StoreId, TaskGroup, TaskItem, Milestone } from "./types";

type App = ReturnType<typeof useAppData>;
type TaskState = Record<string, boolean>;

function leafKey(groupId: string, milestoneId: string, taskId: string, childId?: string) {
  return childId
    ? `${groupId}|${milestoneId}|${taskId}|${childId}`
    : `${groupId}|${milestoneId}|${taskId}`;
}

/**
 * 「今回は作らない」の印を置くキー。
 *
 * ポスターやパネルは、商品によっては作らない店舗がある。作らないものが
 * 未完了として残り続けると、遅れの数字が実態と合わなくなるので、
 * 対象外にできるようにしてある。対象外にしたタスクは分母から外す。
 *
 * チェックと同じ `task_state` に、ぶつからない接頭辞を付けて入れている
 * （テーブルは増やしていない）。
 */
export function skipKey(groupId: string, milestoneId: string, taskId: string) {
  return `skip|${groupId}|${milestoneId}|${taskId}`;
}

/** 制作・入稿がある項目だけ「今回は作らない」にできる */
export function canSkipTask(task: TaskItem) {
  /* 2026年9月、制作・入稿のある9件だけから全タスクに広げた。
     レギュラー商品には新商品の準備タスクの大半が当てはまらず、
     未完了のまま残って期限超過の数字が実態と合わなかったため。
     情報シートと連動するタスク（価格・レシピ画像など）だけは、
     シート側の入力がそのまま状態になるので対象外にする。 */
  return !task.linkedField;
}

export function isTaskSkipped(
  taskState: TaskState,
  groupId: string,
  milestoneId: string,
  task: TaskItem
) {
  return canSkipTask(task) && Boolean(taskState[skipKey(groupId, milestoneId, task.id)]);
}

/** 商品情報シートの入力率（必須＋任意項目を合算）。必須の数はジャンルで変わる */
export function infoFillRate(info: ProductInfo, genre: Genre): number {
  const req = requiredProgress(info, genre);
  const opt = optionalProgress(info, genre);
  const total = req.total + opt.total;
  if (!total) return 0;
  return Math.round(((req.filled + opt.filled) / total) * 100);
}

/**
 * 情報シートと連動するタスクが済んでいるか。
 * チェックの保存先ではなく、シートの値を見る（食い違わないようにするため）
 */
export function isLinkedTaskDone(task: TaskItem, info: ProductInfo): boolean {
  switch (task.linkedField) {
    case "noAlcoholPork":
      return info.noAlcoholPork !== null;
    /* レシピは画像が1枚でも貼られていれば完了 */
    case "recipeImages":
      return info.recipeImages.some((l) => l.trim());
    /* 取り扱いのない店舗は、価格が無くても済んだものとして数える */
    case "priceBase":
      return info.priceBase !== null || info.priceBaseNotSold;
    /* Uber は元価格からの自動計算でも埋まったとみなす */
    case "priceBaseUber":
      return (
        info.priceBaseNotSold || effectiveUberPrice(info.priceBaseUber, info.priceBase) !== null
      );
    default: {
      /* 店舗別の価格（`priceStore:kama` のような形）。
         標準価格から埋まったことにはしない。その店の欄そのものを見る
         （入力率の数え方＝`isStorePriceFilled` と揃えている） */
      const field = task.linkedField ?? "";
      if (field.startsWith("priceStore:")) {
        return isStorePriceFilled(info, field.slice("priceStore:".length) as StoreId);
      }
      if (field.startsWith("priceStoreUber:")) {
        const sp = info.priceByStore[field.slice("priceStoreUber:".length) as StoreId];
        if (!sp) return false;
        return sp.notSold || effectiveUberPrice(sp.uber, sp.price) !== null;
      }
      return false;
    }
  }
}

/** 1商品ぶんの準備タスク完了状況（全グループ合算） */
export function taskCompletion(
  taskState: TaskState,
  info: ProductInfo
): { checked: number; total: number } {
  let checked = 0;
  let total = 0;
  for (const g of TASK_GROUPS) {
    for (const m of g.milestones) {
      for (const t of m.tasks) {
        /* 「今回は作らない」にしたものは、そもそも数えない（子のあるなしを問わず） */
        if (isTaskSkipped(taskState, g.id, m.id, t)) continue;
        if (t.children && t.children.length > 0) {
          for (const c of t.children) {
            total++;
            if (taskState[leafKey(g.id, m.id, t.id, c.id)]) checked++;
          }
        } else {
          total++;
          if (t.linkedField ? isLinkedTaskDone(t, info) : taskState[leafKey(g.id, m.id, t.id)]) {
            checked++;
          }
        }
      }
    }
  }
  return { checked, total };
}

function milestoneCheckState(
  group: TaskGroup,
  m: Milestone,
  taskState: TaskState,
  info: ProductInfo
) {
  let checked = 0;
  let total = 0;
  for (const t of m.tasks) {
    /* 「今回は作らない」にしたものは、締め切りの数にも入れない（子のあるなしを問わず） */
    if (isTaskSkipped(taskState, group.id, m.id, t)) continue;
    if (t.children && t.children.length > 0) {
      for (const c of t.children) {
        total++;
        if (taskState[leafKey(group.id, m.id, t.id, c.id)]) checked++;
      }
    } else {
      total++;
      /* 情報シートと連動するタスク（価格・レシピなど）は、シートの値を見る。
         準備タスク画面と同じ数え方にしないと、商品ページでは「完了」なのに
         ホームの期限超過には残り続ける（2026年9月に修正） */
      if (t.linkedField ? isLinkedTaskDone(t, info) : taskState[leafKey(group.id, m.id, t.id)]) {
        checked++;
      }
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
  /** 締め切りが「過去分」（今日から BACKLOG_MONTHS か月より前）かどうか */
  backlog: boolean;
}

/**
 * 「過去分」の線引き（2026年9月18日・松尾さんの指示）。
 * 締め切りが今日から数えて2か月より前のものは、期限超過の数には入れず、
 * 「過去分のタスク」として別に数える。いずれ埋める必要はあるので数は見せるが、
 * いま追いかける超過とは一緒にしない。
 */
export const BACKLOG_MONTHS = 2;

/** 締め切りが今日から BACKLOG_MONTHS か月より前なら true */
export function isBacklogDeadline(deadline: Date): boolean {
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth() - BACKLOG_MONTHS, now.getDate());
  return deadline.getTime() < limit.getTime();
}

/**
 * 発売月が今月以前の商品（もう発売している／今月発売する商品）は、
 * 準備タスクをすべて過去分にする（2026年9月19日・松尾さんの指示：
 * 「8月と9月の新商品のタスクは過去分にしたい」）。
 * 月が変われば線も動く（10月になれば10月発売の商品も過去分になる）。
 */
export function isReleasedByThisMonth(releaseDate: string): boolean {
  const m = /^(\d{4})-(\d{2})/.exec(releaseDate);
  if (!m) return false;
  const now = new Date();
  const ym = Number(m[1]) * 100 + Number(m[2]);
  const nowYm = now.getFullYear() * 100 + (now.getMonth() + 1);
  return ym <= nowYm;
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
        const { checked, total } = milestoneCheckState(g, m, taskState, info);
        /* 完了済みと、「今回は作らない」で中身が無くなった区切りは締め切りに出さない */
        if (total === 0 || checked === total) continue;
        const days = daysDiffFromToday(deadline) ?? 0;
        entries.push({
          product: p,
          group: g,
          milestone: m,
          deadline,
          days,
          checked,
          total,
          backlog: isBacklogDeadline(deadline) || isReleasedByThisMonth(info.releaseDate),
        });
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

/** 商品ごとの「過去分」のまとめ（残り件数と、いちばん古い締め切り） */
export interface BacklogRow {
  product: Product;
  remaining: number;
  oldest: DeadlineEntry;
}

/** 過去分の締め切りを商品ごとにまとめる。残りが多い順 */
export function backlogPerProduct(entries: DeadlineEntry[]): BacklogRow[] {
  const map = new Map<string, BacklogRow>();
  for (const e of entries) {
    if (!e.backlog) continue;
    const cur = map.get(e.product.id);
    const remaining = e.total - e.checked;
    if (!cur) {
      map.set(e.product.id, { product: e.product, remaining, oldest: e });
    } else {
      cur.remaining += remaining;
      if (e.days < cur.oldest.days) cur.oldest = e;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
}

export interface DashboardStats {
  productCount: number;
  avgInfoFill: number;
  avgTaskCompletion: number;
  /** 期限超過（締め切りが今日から BACKLOG_MONTHS か月以内のものだけ） */
  overdueTaskCount: number;
  /** 過去分（締め切りが BACKLOG_MONTHS か月より前）の未完了タスク数 */
  backlogTaskCount: number;
  /** 過去分を持つ商品の数 */
  backlogProductCount: number;
}

export function computeDashboardStats(app: App, deadlines: DeadlineEntry[]): DashboardStats {
  /* 廃盤はもう作らないので、現行の商品だけで平均を出す */
  const products = app.products.filter((p) => !app.getInfo(p.id).discontinued);
  let infoSum = 0;
  let taskChecked = 0;
  let taskTotal = 0;
  for (const p of products) {
    infoSum += infoFillRate(app.getInfo(p.id), p.genre);
    const ts = taskCompletion(app.getTaskState(p.id), app.getInfo(p.id));
    taskChecked += ts.checked;
    taskTotal += ts.total;
  }
  /* 期限超過は「直近2か月」だけ。それより前は過去分として別に数える */
  const overdueTaskCount = deadlines
    .filter((e) => e.days < 0 && !e.backlog)
    .reduce((sum, e) => sum + (e.total - e.checked), 0);
  const backlogEntries = deadlines.filter((e) => e.backlog);
  const backlogTaskCount = backlogEntries.reduce((sum, e) => sum + (e.total - e.checked), 0);
  const backlogProductCount = new Set(backlogEntries.map((e) => e.product.id)).size;

  return {
    productCount: products.length,
    avgInfoFill: products.length ? Math.round(infoSum / products.length) : 0,
    avgTaskCompletion: taskTotal ? Math.round((taskChecked / taskTotal) * 100) : 0,
    overdueTaskCount,
    backlogTaskCount,
    backlogProductCount,
  };
}
