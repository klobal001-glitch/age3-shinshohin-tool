import { ItemRecord, StoreData } from "@/lib/genba/types";

export type Store = {
  id: string;
  name: string;
  /** 店舗バッジの色（既存の共有資料と同じ配色） */
  color: string;
};

/** 視察する直営3店舗 */
export const STORES: Store[] = [
  { id: "ginza", name: "銀座", color: "#1f3350" },
  { id: "asakusa", name: "浅草", color: "#2f8f9d" },
  { id: "harajuku", name: "原宿", color: "#4a90c2" },
];

export type CheckItem = {
  /** 見出し */
  title: string;
  /** 見出しの下に出す確認の観点 */
  hint: string;
  /** 数える・順番に見る項目は箇条書きで出す */
  points?: string[];
  /**
   * メモ欄に最初から入れておく見出し。
   * 現場で「何を書くか」を思い出さずに済むよう、書き込む先を用意しておく。
   * 触らずに離れたときは消えるので、記録には残らない。
   */
  memoTemplate?: string;
};

/**
 * 現場チェックの10項目。
 *
 * 並び・文言は会長・専務に共有済みの出張企画資料／現場チェックシートに合わせてある。
 * 増減や言い換えは業務に直結するので、変更するときは必ず確認を取ること。
 * （旧「オペレーション（ピーク時の動き・レジ導線等）」は松下専務の担当のため入れていない）
 */
export const CHECK_ITEMS: CheckItem[] = [
  {
    title: "店頭ファーストインプレッション",
    hint: "何m先から気づくか／入りたくなるか／撮りたくなるか",
  },
  {
    title: "ポスター・POP",
    hint: "サイズ・高さ・反射・読める距離・英語の見やすさ・統一感・古いPOP",
  },
  {
    title: "メニュー",
    hint: "注文しやすさ・人気商品の目立ち・写真・価格・英語表記",
  },
  {
    title: "チラシ配布",
    hint: "断られる率・立ち位置・タイミング・声掛け・スタッフ差",
    memoTemplate: ["断られる率：", "立ち位置：", "タイミング：", "声掛け：", "スタッフ差："].join("\n"),
  },
  {
    title: "お客様インタビュー",
    hint: "詳しくは別紙アンケート用紙で。ここには要点だけ書く",
    points: [
      "何を見て来店したか（チラシ／SNS／Google・口コミ／通りがかり／紹介／テレビ・雑誌）",
      "気になった点",
      "食べたいと思ったか",
      "価格の印象",
    ],
  },
  {
    title: "商品確認（実食）",
    hint: "盛り付け・量・ソース・揚げ色・温度・提供時間・写真との差・味のばらつき",
  },
  {
    title: "店舗環境",
    hint: "BGM・香り・清潔感・ゴミ箱・イートイン導線・サイン・照明・外観",
  },
  {
    title: "SNS・口コミ施策（数える）",
    hint: "良し悪しの判断ではなく、数を数えて記録する",
    points: [
      "レビュー／インスタ案内POP・QRの有無と枚数",
      "QRを読むと正しいリンクに飛ぶか",
      "フォトスポットの有無",
      "お客10人中 何人が写真を撮ったか",
      "レビュー依頼の声掛けがあるか",
    ],
  },
  {
    title: "ブランド統一",
    hint: "ロゴ・色・フォント・接客・制服・ブランドメッセージに店舗差がないか",
  },
  {
    title: "海外・外国人対応",
    hint: "言葉が通じなくても注文できるか",
    points: [
      "英語メニュー・英語表記の有無",
      "写真・番号・指さしで注文できる作りか",
      "価格が数字で分かるか",
      "外国人客が注文で詰まっていないか",
      "英語での会話確認は「要確認」→ 英語話者スタッフ／専務へ",
    ],
  },
];

export const PRIO_LABELS: Record<"A" | "B" | "C", { label: string; note: string; color: string }> = {
  A: { label: "A", note: "すぐ対応", color: "#c0392b" },
  B: { label: "B", note: "要注意", color: "#e0872a" },
  C: { label: "C", note: "中長期", color: "#3a9d5d" },
};

export function createEmptyItem(): ItemRecord {
  return { done: false, prio: "", memo: "", photos: [] };
}

export function createEmptyStoreData(): StoreData {
  return {
    visitDate: "",
    visitMemo: "",
    items: CHECK_ITEMS.map(() => createEmptyItem()),
  };
}

/**
 * 保存済みの JSON を、いまの項目数・項目順に合わせて読み直す。
 * 項目が増えた・保存が壊れていた場合でも画面が落ちないようにする。
 */
export function normalizeStoreData(raw: unknown): StoreData {
  const base = createEmptyStoreData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<StoreData>;
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    visitDate: typeof r.visitDate === "string" ? r.visitDate : "",
    visitMemo: typeof r.visitMemo === "string" ? r.visitMemo : "",
    items: CHECK_ITEMS.map((_, i) => {
      const it = items[i] as Partial<ItemRecord> | undefined;
      if (!it || typeof it !== "object") return createEmptyItem();
      const prio = it.prio === "A" || it.prio === "B" || it.prio === "C" ? it.prio : "";
      return {
        done: it.done === true,
        prio,
        memo: typeof it.memo === "string" ? it.memo : "",
        photos: Array.isArray(it.photos)
          ? it.photos.filter(
              (p): p is { path: string; url: string } =>
                !!p && typeof p === "object" && typeof (p as { url?: unknown }).url === "string"
            )
          : [],
      };
    }),
  };
}

/** その店舗で「見た」にチェックが入っている項目数 */
export function countDone(data: StoreData): number {
  return data.items.filter((it) => it.done).length;
}

/** 記入が1つでもあるか（レポートで「記入なし」を出すため） */
export function hasAnyInput(item: ItemRecord): boolean {
  return item.done || item.prio !== "" || item.memo.trim() !== "" || item.photos.length > 0;
}
