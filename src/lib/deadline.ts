import { DeadlineRule } from "./types";

// "YYYY-MM-DD" → Date（ローカル日付として扱う）
function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function formatJpDate(d: Date | null): string {
  if (!d) return "―";
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

export function computeDeadline(
  rule: DeadlineRule,
  releaseDate: string,
  endDate: string,
  ongoing = false
): Date | null {
  if (rule.type === "monthsBefore") {
    const base = parseDate(releaseDate);
    if (!base) return null;
    const target = addMonths(base, -rule.months);
    return new Date(target.getFullYear(), target.getMonth(), rule.day);
  }
  if (rule.type === "endOfMonth") {
    // 継続販売中の商品には「販売終了月末」の締め切りは存在しない
    if (rule.useEndDate && ongoing) return null;
    const base = parseDate(rule.useEndDate ? endDate : releaseDate) ?? parseDate(releaseDate);
    if (!base) return null;
    return endOfMonth(base);
  }
  // weekBeforeWeekday / afterRule は現行データでは使用していないため
  // 未実装（今後の拡張用に型だけ残しています）
  return null;
}

export function daysDiffFromToday(target: Date | null): number | null {
  if (!target) return null;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
}

export function diffLabel(days: number | null): { text: string; overdue: boolean } | null {
  if (days === null) return null;
  if (days < 0) return { text: `${-days}日 遅れ`, overdue: true };
  if (days === 0) return { text: "本日締切", overdue: true };
  return { text: `あと${days}日`, overdue: false };
}
