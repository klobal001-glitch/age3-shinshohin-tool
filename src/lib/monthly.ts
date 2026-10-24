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
 * 月別の商品一覧
 *
 * 選んだ月に**売っている商品**を、いまデータベースに入っている内容だけから
 * 組み立てる。毎月20日ごろのリーダー共有と、店頭掲示のA4に使う。
 *
 * 決めごと
 * - **表示のために期間や価格を足さない・直さない。** 空欄は空欄のまま
 *   「未入力」と出す。推測で埋めると、掲示物に嘘が載る。
 * - **一覧は1つ。**「販売期間がその月と重なる商品」をぜんぶ出す。
 *   その月に発売が始まるものには「今月発売」、前の月から続いているものには
 *   「◯月から継続」と付けて見分ける（年をまたぐときは年も出す）。
 * - 年をまたぐ回（2026年12月〜2027年1月）は、2026年12月は「今月発売」、
 *   2027年1月は「2026年12月から継続」として、**どちらの月にも1枚ずつ**出る。
 * - 同じ商品が同じ月に2枚出ないようにする（回が重なっているときは1つにまとめる）。
 * - 期間が入っていない商品は、どの月にも出さない（**勝手に期間を決めない**）。
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
  /** この月に売っているか（継続販売中を含む）。一覧に出るものは必ず true */
  onSaleThisMonth: boolean;
  /** 前の月から続いているときの、売り始めた年月。今月発売なら null */
  continuedFrom: { year: number; month: number } | null;
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

/**
 * 販売期間がその月と重なるか。
 *
 * **ここだけが「その月に売っているか」の判定。**一覧も、複数月の資料も、
 * 必ずこれを通す（判定が2か所にあると、片方だけ直して食い違う）。
 * 終わりが入っていない／継続販売中なら、まだ続いているものとして扱う。
 */
export function overlapsMonth(
  p: { releaseDate: string; endDate: string; ongoing: boolean },
  year: number,
  month: number
): boolean {
  if (!p.releaseDate) return false;
  const first = monthStart(year, month);
  const last = monthEnd(year, month);
  return p.releaseDate <= last && (p.ongoing || !p.endDate || p.endDate >= first);
}

/**
 * その月に売っている商品を集める。廃盤は出さない。
 *
 * 「販売期間がその月と重なるか」だけで決める。発売開始か継続かは、
 * 出すか出さないかには関わらない（見分けの印としてだけ使う）。
 */
export function collectMonth(src: Source, year: number, month: number): MonthEntry[] {
  const ym = ymKey(year, month);
  const out: MonthEntry[] = [];

  for (const product of src.products) {
    const info = src.getInfo(product.id);
    if (info.discontinued) continue;

    for (const entry of listRuns(info)) {
      if (!entry.releaseDate) continue; // 期間が入っていない回は月に割り当てられない
      const starts = entry.releaseDate.slice(0, 7) === ym;
      const onSale = overlapsMonth(entry, year, month);
      if (!onSale) continue;

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
        continuedFrom: starts
          ? null
          : {
              year: Number(entry.releaseDate.slice(0, 4)),
              month: Number(entry.releaseDate.slice(5, 7)),
            },
      });
    }
  }

  /* 同じ商品が2枚出ないようにする。回が重なっているときは、
     その月に発売が始まる回を優先し、なければ発売日がいちばん新しい回を残す。
     **どちらを残しても、その回に入っている中身はそのまま出す（作り変えない）** */
  const one = new Map<string, MonthEntry>();
  for (const e of out) {
    const cur = one.get(e.product.id);
    if (!cur) {
      one.set(e.product.id, e);
      continue;
    }
    if (e.startsThisMonth !== cur.startsThisMonth) {
      one.set(e.product.id, e.startsThisMonth ? e : cur);
    } else {
      one.set(e.product.id, e.releaseDate > cur.releaseDate ? e : cur);
    }
  }

  /* 今月発売を先に、そのあと継続。それぞれ発売日の早い順、同じ日なら名前順 */
  return [...one.values()].sort(
    (a, b) =>
      Number(b.startsThisMonth) - Number(a.startsThisMonth) ||
      a.releaseDate.localeCompare(b.releaseDate) ||
      a.product.name.localeCompare(b.product.name, "ja")
  );
}

/* ------------------------------------------------------------------ *
 * 複数の月をまとめる（海外チームへ送る商品予定の資料で使う）
 *
 * 決めごと
 * - **選んだ月のどれかと販売期間が重なる商品を、もれなく拾う。**
 *   11月から1月までを選んだなら、12月に始まる商品も、
 *   11月から続いて1月まで売る商品も、ぜんぶ入る。
 * - **同じ商品の同じ回を、2件に増やさない。**どの月で見つかっても1件にまとめ、
 *   その商品がどの月に売っているかを覚えておく。
 *   （別の販売回は別の期間なので、別の1件として出す）
 * - 月を選んだだけでは「出してよい」とは決めない。**資料に入れる商品は人が選ぶ。**
 * ------------------------------------------------------------------ */

export interface YearMonth {
  year: number;
  month: number;
}

/** 商品1件と、選んだ月のうちその商品を売っている月 */
export interface RangeEntry {
  entry: MonthEntry;
  /** 選んだ月のうち、売っている月（選んだ順＝古い順） */
  months: YearMonth[];
}

export function sortMonths(ms: YearMonth[]): YearMonth[] {
  return [...ms].sort((a, b) => a.year - b.year || a.month - b.month);
}

/** 選んだ月すべてをまとめて、売っている商品を集める */
export function collectRange(src: Source, months: YearMonth[]): RangeEntry[] {
  const map = new Map<string, RangeEntry>();
  for (const m of sortMonths(months)) {
    for (const e of collectMonth(src, m.year, m.month)) {
      const k = entryKey(e) + "|" + e.releaseDate;
      const cur = map.get(k);
      if (cur) cur.months.push(m);
      else map.set(k, { entry: e, months: [m] });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      a.entry.releaseDate.localeCompare(b.entry.releaseDate) ||
      a.entry.product.name.localeCompare(b.entry.product.name, "ja")
  );
}

/**
 * 「選んだ期間のうち、いつ売っているか」の言い方。
 *
 * 選んだ月が続いていれば「11月〜1月」、飛んでいれば「11月・1月」。
 * 年は付けない（資料のいちばん上に「2026年11月 〜 2027年1月」と出しているので、
 * ここで年まで書くと字が増えて読みにくい）。
 */
export function rangeMonthsLabel(months: YearMonth[], selected: YearMonth[]): string {
  const all = sortMonths(selected);
  const idx = (m: YearMonth) => all.findIndex((x) => x.year === m.year && x.month === m.month);
  const nums = sortMonths(months).map(idx).filter((i) => i >= 0).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const i of nums) {
    const g = groups[groups.length - 1];
    if (g && i === g[g.length - 1] + 1) g.push(i);
    else groups.push([i]);
  }
  return groups
    .map((g) =>
      g.length === 1
        ? `${all[g[0]].month}月`
        : `${all[g[0]].month}月〜${all[g[g.length - 1]].month}月`
    )
    .join("・");
}

/** 選んだ期間そのものの言い方（資料の題）。「2026年11月 〜 2027年1月」 */
export function rangeTitle(selected: YearMonth[]): string {
  const all = sortMonths(selected);
  if (all.length === 0) return "";
  const a = all[0];
  const b = all[all.length - 1];
  if (a.year === b.year && a.month === b.month) return ymLabel(a.year, a.month);
  const to = a.year === b.year ? `${b.month}月` : ymLabel(b.year, b.month);
  return `${ymLabel(a.year, a.month)} 〜 ${to}`;
}

/**
 * 海外チームへの資料に出せる材料がそろっているか。
 *
 * **価格は見ない。**この資料に価格は載せないため。
 * 正式な商品画像が無いものは「未確認」として、まとめて選ぶ対象にしない
 * （画像のない枠を資料に並べない。代わりの画像も作らない）。
 */
export function scheduleReady(e: MonthEntry): boolean {
  return !!e.image && hasPeriod(e) && !isTentativeName(e.product.name);
}

/** 資料に出せない理由 */
export function missingForSchedule(e: MonthEntry): string[] {
  const out: string[] = [];
  if (!e.image) out.push("正式な商品画像が未登録");
  if (!hasPeriod(e)) out.push("販売期間が未入力");
  if (isTentativeName(e.product.name)) out.push("商品名が仮");
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

/**
 * 前の月から続いている商品の、売り始めた月の言い方。
 *
 * 同じ年なら「3月から継続」、年をまたいでいれば「2026年12月から継続」。
 * **見ている月の年と比べて決める**ので、年をまたいだことが必ず分かる。
 * 今月発売の商品は null（印を付けない）。
 */
export function continuedText(e: MonthEntry, year: number): string | null {
  if (!e.continuedFrom) return null;
  const c = e.continuedFrom;
  return c.year === year ? `${c.month}月から継続` : `${c.year}年${c.month}月から継続`;
}

/**
 * 同じことを、店頭に貼る紙の言い方で。
 * 「継続」は社内の言葉なので、お客さまが読んで自然な言い方にする。
 */
export function posterContinuedText(e: MonthEntry, year: number): string | null {
  if (!e.continuedFrom) return null;
  const c = e.continuedFrom;
  const when = c.year === year ? `${c.month}月` : `${c.year}年${c.month}月`;
  return `${when}から引き続き販売中`;
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

/**
 * LINEなどへ送るときの、短い案内文。
 *
 * 選んだ月と、選んだ商品の中身に合わせて言い方を変える。
 * **ぜんぶその月に発売を始める商品なら「新商品一覧」、
 * 続いている商品が混ざっていれば「商品一覧」**。嘘にならない言い方を選ぶ。
 * 文面は送る前に画面で直せる（ここで作るのは最初の下書き）。
 */
export function shareMessageText(
  year: number,
  month: number,
  entries: MonthEntry[],
  today: Date = new Date()
): string {
  const when = year === today.getFullYear() ? `${month}月` : `${year}年${month}月`;
  const allNew = entries.length > 0 && entries.every((e) => e.startsThisMonth);
  const what = allNew ? `${when}の新商品一覧` : `${when}の商品一覧`;
  return [
    "お疲れ様です！",
    `${what}を共有します。`,
    "販売期間・価格をご確認のうえ、各店での準備をお願いいたします。",
  ].join("\n");
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
