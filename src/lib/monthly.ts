import {
  Genre,
  Product,
  ProductInfo,
  ProductRun,
  StoreId,
  STORE_IDS,
  STORE_LABELS,
} from "./types";
import { listRuns, runFieldsOf, RunField } from "./productRun";
import { formatPrice, isRequiredVisualKey } from "./productInfo";
import { CardImage, pickCardImage, pickProductThumb } from "./visualThumb";
import { TASK_GROUPS } from "./prepTasks";
import { isLinkedTaskDone, isTaskSkipped } from "./stats";
import { computeDeadline, daysDiffFromToday } from "./deadline";

/* ------------------------------------------------------------------ *
 * 月別の新商品一覧
 *
 * 毎月20日ごろに、翌月・翌々月の商品をリーダーへ共有する。そのための
 * 「その月ぶんの商品」を、いまデータベースに入っている内容だけから組み立てる。
 *
 * 決めごと
 * - **表示のために期間や価格を足さない・直さない。** 空欄は空欄のまま
 *   「未入力」と出す。推測で埋めると、掲示物に嘘が載る。
 * - 「この月に発売開始」と「この月に販売中」は別もの。混ぜない。
 * - 年をまたぐ回（2026年12月〜2027年1月）は、発売開始は2026年12月だけ、
 *   販売中は2026年12月と2027年1月の両方に出る。
 * - 廃盤の商品は出さない。
 * ------------------------------------------------------------------ */

/** "2026-11" の形 */
export function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ymLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** その月の初日 / 末日（YYYY-MM-DD） */
export function monthStart(year: number, month: number): string {
  return `${ymKey(year, month)}-01`;
}
export function monthEnd(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${ymKey(year, month)}-${String(last).padStart(2, "0")}`;
}

/** 今日から n か月後の年月（n=1 なら翌月） */
export function monthFromNow(n: number, base: Date = new Date()): { year: number; month: number } {
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/* ------------------------------ 1件ぶん ------------------------------ */

/** その月に関係する「商品 × 販売の回」1件 */
export interface MonthEntry {
  product: Product;
  genre: Genre;
  /** 商品の本体（詳細を開くときに使う） */
  info: ProductInfo;
  /** 回の名前。空なら回で分けていない商品 */
  runLabel: string;
  /** 今準備中の回か */
  current: boolean;
  /** 控えの回そのもの（今の回なら null）。シート画面を開くときに使う */
  run: ProductRun | null;
  releaseDate: string;
  endDate: string;
  ongoing: boolean;
  /** この回ぶんの価格・ビジュアルなど */
  fields: Pick<ProductInfo, RunField>;
  /** 掲示に使う画像。この回に無ければ前の回の画像 */
  image: CardImage | null;
  /** 画像がこの回のものではなく、ほかの回から借りてきたか */
  imageFromOtherRun: boolean;
  /** この月に発売開始するか */
  startsThisMonth: boolean;
  /** この月に売っているか（継続販売中を含む） */
  onSaleThisMonth: boolean;
}

/** 回ごとの価格でも resolveStorePrice と同じ考え方で引く */
function resolveStorePriceOf(fields: Pick<ProductInfo, RunField>, store: StoreId) {
  return (
    fields.priceByStore[store] ?? {
      price: fields.priceBase,
      uber: fields.priceBaseUber,
      notSold: fields.priceBaseNotSold,
    }
  );
}

/** 期間が入っているか */
export function hasPeriod(e: { releaseDate: string; endDate: string; ongoing: boolean }): boolean {
  return !!e.releaseDate && (e.ongoing || !!e.endDate);
}

/**
 * 売る店の価格が入っているか。
 *
 * **「この店舗では取り扱いなし」にした店は数えない。**
 * 取り扱いなしの店だけに印が付いていて、売る店の価格が空のままだと、
 * 掲示には「未定」としか出せない。それを「そろっている」と数えないための判定。
 * 店ごとの値の引き方は、情報シートの resolveStorePrice とまったく同じにしてある。
 */
export function hasPrice(fields: Pick<ProductInfo, RunField>): boolean {
  return STORE_IDS.some((s) => {
    const sp = resolveStorePriceOf(fields, s);
    if (sp.notSold) return false;
    return sp.price !== null;
  });
}

/** 商品名が仮のものか（「(仮)」「（仮）」が付いている） */
export function isTentativeName(name: string): boolean {
  return /[（(]\s*仮[^）)]*[）)]/.test(name);
}

/**
 * 回の名前に書かれている「確定」などの表記。
 * アプリが勝手に確定と判断するのではなく、**データに書いてある言葉をそのまま拾う**。
 */
export function labelNote(runLabel: string): { confirmed: boolean; tentative: boolean } {
  return {
    confirmed: /確定/.test(runLabel) && !/未確定/.test(runLabel.replace(/本人確定/g, "")),
    tentative: /未確定|予定|仮/.test(runLabel),
  };
}

/** 掲示に出せる材料がそろっているか（チェックを一括で入れるときの目安にだけ使う） */
export function posterReady(e: MonthEntry): boolean {
  return !!e.image && hasPeriod(e) && hasPrice(e.fields) && !isTentativeName(e.product.name);
}

/** 掲示に出せない理由（そろっていないもの） */
export function missingForPoster(e: MonthEntry): string[] {
  const out: string[] = [];
  if (!e.image) out.push("正式な商品画像が未登録");
  if (!hasPeriod(e)) out.push("販売期間が未入力");
  if (!hasPrice(e.fields)) out.push("販売価格が未入力");
  if (isTentativeName(e.product.name)) out.push("商品名が仮");
  return out;
}

/* ------------------------------ 組み立て ------------------------------ */

type Source = {
  products: Product[];
  getInfo: (id: string) => ProductInfo;
};

/** その月に関係する商品を集める。廃盤は出さない */
export function collectMonth(src: Source, year: number, month: number): MonthEntry[] {
  const first = monthStart(year, month);
  const last = monthEnd(year, month);
  const ym = ymKey(year, month);
  const out: MonthEntry[] = [];

  for (const product of src.products) {
    const info = src.getInfo(product.id);
    if (info.discontinued) continue;

    for (const entry of listRuns(info)) {
      if (!entry.releaseDate) continue; // 期間が入っていない回は月に割り当てられない
      const starts = entry.releaseDate.slice(0, 7) === ym;
      const onSale =
        entry.releaseDate <= last && (entry.ongoing || !entry.endDate || entry.endDate >= first);
      if (!starts && !onSale) continue;

      const fields = runFieldsOf(info, entry.run);
      const own = pickCardImage({ ...info, visualDownloads: fields.visualDownloads });
      const borrowed = own ? null : pickProductThumb(info);

      out.push({
        product,
        genre: product.genre,
        info,
        runLabel: entry.label,
        current: entry.current,
        run: entry.run,
        releaseDate: entry.releaseDate,
        endDate: entry.endDate,
        ongoing: entry.ongoing,
        fields,
        image: own ?? borrowed,
        imageFromOtherRun: !own && !!borrowed,
        startsThisMonth: starts,
        onSaleThisMonth: onSale,
      });
    }
  }

  /* 発売日の早い順。同じ日なら名前順 */
  out.sort(
    (a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.product.name.localeCompare(b.product.name, "ja")
  );
  return out;
}

/** その回に出てくる年（年ボタンに出す）。商品データにある年だけを出す */
export function collectYears(src: Source): number[] {
  const set = new Set<number>();
  for (const product of src.products) {
    const info = src.getInfo(product.id);
    if (info.discontinued) continue;
    for (const entry of listRuns(info)) {
      if (!entry.releaseDate) continue;
      const y = Number(entry.releaseDate.slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
      if (!entry.ongoing && entry.endDate) {
        const y2 = Number(entry.endDate.slice(0, 4));
        if (Number.isFinite(y2)) for (let i = y; i <= y2 && i - y <= 5; i++) set.add(i);
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** 期間が入っていない商品（どの月にも出せない）。要確認の一覧に出す */
export function productsWithoutPeriod(src: Source): { product: Product; info: ProductInfo }[] {
  const out: { product: Product; info: ProductInfo }[] = [];
  for (const product of src.products) {
    const info = src.getInfo(product.id);
    if (info.discontinued) continue;
    if (!info.releaseDate && info.runs.every((r) => !r.releaseDate)) out.push({ product, info });
  }
  return out;
}

/* ------------------------------ 表示用の言い方 ------------------------------ */

const WD = ["日", "月", "火", "水", "木", "金", "土"];

/** 2026年11月1日(日) の形。日付が無ければ空 */
export function jpDate(d: string, withWeekday = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const base = `${y}年${mo}月${da}日`;
  if (!withWeekday) return base;
  return `${base}(${WD[new Date(y, mo - 1, da).getDay()]})`;
}

/** 掲示・共有に出す販売期間の言い方。入っていなければ「未定」 */
export function periodText(e: {
  releaseDate: string;
  endDate: string;
  ongoing: boolean;
}): string {
  if (!e.releaseDate) return "未定";
  const from = jpDate(e.releaseDate);
  if (e.ongoing) return `${from} 〜 （継続販売）`;
  if (!e.endDate) return `${from} 〜`;
  /* 同じ年なら、終わりの年は省く */
  const sameYear = e.releaseDate.slice(0, 4) === e.endDate.slice(0, 4);
  const to = sameYear ? jpDate(e.endDate).replace(/^\d{4}年/, "") : jpDate(e.endDate);
  return `${from} 〜 ${to}`;
}

/**
 * 掲示物に出す期間。紙のいちばん上に年月を大きく出しているので、
 * 同じ年の分は年を省いて短くする（「11月1日 〜 11月30日」）。
 * 年をまたぐときだけ、終わりの側に年を付ける。
 */
export function posterPeriodText(
  e: { releaseDate: string; endDate: string; ongoing: boolean },
  year: number
): string {
  if (!e.releaseDate) return "未定";
  const sameStart = e.releaseDate.slice(0, 4) === String(year);
  const from = sameStart ? jpDate(e.releaseDate).replace(/^\d{4}年/, "") : jpDate(e.releaseDate);
  if (e.ongoing) return `${from} 〜 （継続販売）`;
  if (!e.endDate) return `${from} 〜`;
  const sameEnd = e.endDate.slice(0, 4) === e.releaseDate.slice(0, 4);
  const to = sameEnd ? jpDate(e.endDate).replace(/^\d{4}年/, "") : jpDate(e.endDate);
  return `${from} 〜 ${to}`;
}

/** 価格の言い方。入っていなければ「未定」 */
export function priceText(fields: Pick<ProductInfo, RunField>): string {
  if (fields.priceBase !== null) return formatPrice(fields.priceBase);
  if (fields.priceBaseNotSold) return "取り扱いなし";
  /* 標準価格が無くても、店舗別に入っていればそれを出す。
     ただし「取り扱いなし」の店の価格は出さない（売らない店の値段は掲示しない） */
  const lines = STORE_IDS.map((s) => {
    const sp = fields.priceByStore[s];
    if (!sp || sp.notSold || sp.price === null) return null;
    return `${STORE_LABELS[s]} ${formatPrice(sp.price, s)}`;
  }).filter(Boolean) as string[];
  return lines.length ? lines.join("／") : "未定";
}

/** 標準と違う価格の店だけ（掲示物の注記に使う） */
export function priceExceptions(fields: Pick<ProductInfo, RunField>): string[] {
  const out: string[] = [];
  for (const s of STORE_IDS) {
    const sp = fields.priceByStore[s];
    if (!sp) continue;
    if (sp.notSold) continue;
    if (sp.price !== null && sp.price !== fields.priceBase) {
      out.push(`${STORE_LABELS[s]} ${formatPrice(sp.price, s)}`);
    }
  }
  return out;
}

/** 取り扱いのある店。全店なら「全店」 */
export function storeText(fields: Pick<ProductInfo, RunField>): string {
  const sold = STORE_IDS.filter((s) => !resolveStorePriceOf(fields, s).notSold);
  if (sold.length === STORE_IDS.length) return "全店";
  if (sold.length === 0) return "取り扱い店なし";
  return sold.map((s) => STORE_LABELS[s]).join("・");
}

/** 商品を見分けるための鍵（商品＋回）。掲示に出す／出さないの記録に使う */
export function entryKey(e: { product: Product; runLabel: string; current: boolean }): string {
  return `${e.product.id}|${e.current ? "" : e.runLabel}`;
}

/* ------------------------------------------------------------------ *
 * 内部の準備状況（共有物には出さない）
 *
 * 担当者はデータベースに項目が無い。**役割の目安だけを出し、
 * 「担当：未指定」と正直に書く。**ここで勝手に担当を決めない。
 * 期限も、発売月から計算した「目安」であることを必ず添える。
 * ------------------------------------------------------------------ */

export type PrepRole = "develop" | "visual" | "share";

export const PREP_ROLES: { key: PrepRole; title: string; guide: string; groups: string[] }[] = [
  { key: "develop", title: "商品開発", guide: "役割の目安：はるやさん", groups: ["a1"] },
  { key: "visual", title: "ビジュアル", guide: "役割の目安：川野さん", groups: ["g1"] },
  { key: "share", title: "確認・共有", guide: "役割の目安：松尾さん", groups: ["g2", "g4", "g5"] },
];

/** 不足している項目（内部の確認用。共有物には出さない） */
export function missingFields(e: MonthEntry): string[] {
  const out: string[] = [];
  if (!hasPeriod(e)) out.push("販売期間");
  if (!hasPrice(e.fields)) out.push("販売価格");
  if (!e.image) out.push("商品画像");
  if (e.imageFromOtherRun) out.push("この回のビジュアル（前の回の画像を表示中）");
  if (!e.fields.ingredients.some((r) => r.nameJa.trim())) out.push("材料");
  if (!e.fields.recipeImages.some((l) => l.trim())) out.push("レシピ");
  if (!e.fields.instagramPost.trim()) out.push("Instagram投稿文");
  const needed = e.fields.visualDownloads.filter((v) => isRequiredVisualKey(e.genre, v.key, v));
  const empty = needed.filter((v) => !v.links.some((l) => l.trim())).length;
  if (empty > 0) out.push(`ビジュアル ${empty}件`);
  return out;
}

/** 1区分ぶんの進み具合 */
export interface PrepRoleState {
  role: PrepRole;
  title: string;
  guide: string;
  checked: number;
  total: number;
  /** いちばん近い未完了の区切り（締め切りは発売月からの目安） */
  next: {
    groupTitle: string;
    groupIcon: string;
    milestoneLabel: string;
    taskLabel: string;
    deadline: Date | null;
    days: number | null;
  } | null;
}

/**
 * その回の準備タスクを、3つの区分にまとめる。
 * taskState はその回ぶん（今の回なら task_state テーブル、ほかの回は run.taskState）。
 */
export function prepByRole(
  e: MonthEntry,
  taskState: Record<string, boolean>
): PrepRoleState[] {
  const infoForLinked: ProductInfo = { ...e.info, ...e.fields };
  return PREP_ROLES.map((role) => {
    let checked = 0;
    let total = 0;
    let next: PrepRoleState["next"] = null;
    let nextTime = Infinity;

    for (const g of TASK_GROUPS) {
      if (!role.groups.includes(g.id)) continue;
      for (const m of g.milestones) {
        let mChecked = 0;
        let mTotal = 0;
        let firstOpen: string | null = null;
        for (const t of m.tasks) {
          if (isTaskSkipped(taskState, g.id, m.id, t)) continue;
          if (t.children && t.children.length > 0) {
            for (const c of t.children) {
              mTotal++;
              if (taskState[`${g.id}|${m.id}|${t.id}|${c.id}`]) mChecked++;
              else if (!firstOpen) firstOpen = `${t.label}（${c.label}）`;
            }
          } else {
            mTotal++;
            const done = t.linkedField
              ? isLinkedTaskDone(t, infoForLinked)
              : !!taskState[`${g.id}|${m.id}|${t.id}`];
            if (done) mChecked++;
            else if (!firstOpen) firstOpen = t.label;
          }
        }
        checked += mChecked;
        total += mTotal;
        if (mTotal === 0 || mChecked === mTotal || !firstOpen) continue;
        const deadline = computeDeadline(m.rule, e.releaseDate, e.endDate, e.ongoing);
        const time = deadline ? deadline.getTime() : Infinity - 1;
        if (time < nextTime) {
          nextTime = time;
          next = {
            groupTitle: g.title,
            groupIcon: g.icon,
            milestoneLabel: m.label,
            taskLabel: firstOpen,
            deadline,
            days: daysDiffFromToday(deadline),
          };
        }
      }
    }
    return { role: role.key, title: role.title, guide: role.guide, checked, total, next };
  });
}
