"use client";

import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import ProductPicker from "./ProductPicker";
import {
  DEFAULT_INGREDIENT_ROWS,
  UBER_RATE,
  autoUberPrice,
  effectiveUberPrice,
  formatYen,
  ingredientsProgress,
  isBlankIngredientRow,
  optionalProgress,
  parsePriceInput,
  requiredProgress,
} from "@/lib/productInfo";
import { GENRE_LABELS } from "@/lib/types";
import { isImageUrl, linkLabel, toDownloadUrl, toThumbnailUrl } from "@/lib/imageUrl";

/** 入力シートの区切り。番号付きの見出し帯で「島」の境目をはっきりさせる */
function Section({
  id,
  step,
  icon,
  title,
  progress,
  done,
  children,
}: {
  id: string;
  step: number;
  icon: string;
  title: string;
  progress?: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 overflow-hidden rounded-xl border border-stone-300 bg-white">
      <div className="flex items-center gap-3 border-b border-stone-300 bg-stone-100 px-5 py-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums text-white ${
            done ? "bg-emerald-600" : "bg-stone-700"
          }`}
        >
          {step}
        </span>
        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800">
          <span aria-hidden>{icon}</span>
          {title}
        </h3>
        {progress && (
          <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-500">{progress}</span>
        )}
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

/** 上に貼り付いている進捗パネルの下にセクション見出しが来るように送る */
function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  const panel = document.getElementById("sheet-progress");
  const offset = (panel?.offsetHeight ?? 0) + 12;
  const scroller = el.closest(".md\\:overflow-y-auto") as HTMLElement | null;
  if (scroller) {
    scroller.scrollTo({ top: el.offsetTop - scroller.offsetTop - offset, behavior: "smooth" });
  } else {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  }
}

/** シートが縦に長いので、上から探せるように使うスクロール先の一覧 */
type SectionTab = { id: string; label: string; filled: number; total: number };

/** 進捗パネルの下に来ている見出しを「今いるセクション」とみなす */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join(",");

  useEffect(() => {
    const panel = document.getElementById("sheet-progress");
    const scroller = panel?.closest(".md\\:overflow-y-auto") as HTMLElement | null;
    const target: HTMLElement | Window = scroller ?? window;

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (panel?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    target.addEventListener("scroll", onScroll, { passive: true });
    /* 画面が狭いときは中の枠ではなくページ全体が動くので、両方を見る */
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}

/**
 * 上部のタブ。押すとその見出しまでスクロールし、今いるセクションに下線が付く。
 * 中身は隠さない（1ページに全部あるほうが「未入力だけ表示」や⌘F検索が効くため）。
 */
function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const active = useActiveSection(tabs.map((t) => t.id));

  return (
    <nav
      aria-label="シート内の移動"
      className="mt-3 flex gap-1 overflow-x-auto border-b border-amber-200 print:hidden"
    >
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        const done = t.total > 0 && t.filled === t.total;
        return (
          <button
            key={t.id}
            type="button"
            aria-current={isActive ? "true" : undefined}
            onClick={() => scrollToSection(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-1.5 text-xs transition ${
              isActive
                ? "border-amber-600 font-medium text-amber-900"
                : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
            }`}
          >
            {i + 1}. {t.label}
            <span className={`ml-1.5 tabular-nums ${done ? "text-emerald-600" : "text-stone-400"}`}>
              {t.filled}/{t.total}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** 必須項目の入力済み／未入力を示す小さな点。緑＝入力済み、赤＝未入力 */
function Dot({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
        filled ? "bg-emerald-500" : "bg-red-500"
      }`}
    />
  );
}

function Field({
  label,
  children,
  hint,
  filled,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** 渡すと必須項目として扱い、左に点を出す */
  filled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-600">
        {filled !== undefined && <Dot filled={filled} />}
        {label}
        {hint && <span className="ml-1 text-xs font-normal text-stone-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

/**
 * 中身の量に合わせて高さが伸びる文章欄。
 * 2〜3行の枠の中で長文をスクロールしながら書かなくて済むようにする。
 * rows で指定した高さを下限として、それより短くはならない。
 */
function AutoTextarea({
  rows,
  value,
  onChange,
  maxLength,
}: {
  rows: number;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const minHeightRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 最初の1回だけ、rows で決まる高さを下限として覚えておく
    if (minHeightRef.current === 0) minHeightRef.current = el.offsetHeight;
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.max(el.scrollHeight + border, minHeightRef.current)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      maxLength={maxLength}
      className={`${inputCls} resize-none overflow-hidden`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 表のセル。書き込める欄と分かるように、枠と白い背景を常に出す */
const cellCls =
  "w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm placeholder:text-stone-300 hover:border-stone-400 focus:border-amber-500 focus:outline-none";

/** 「¥」を左に固定した数値専用の価格入力欄 */
function PriceInput({
  id,
  value,
  placeholder,
  muted,
  onChange,
}: {
  id?: string;
  value: number | null;
  placeholder?: string;
  muted?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
        ¥
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={`${inputCls} pl-7 tabular-nums ${muted ? "text-stone-500" : ""}`}
        placeholder={placeholder}
        value={value === null ? "" : value.toLocaleString("ja-JP")}
        onChange={(e) => onChange(parsePriceInput(e.target.value))}
      />
    </div>
  );
}

/** 登録済みリンクの右に並ぶ小さなボタン */
const linkBtnCls =
  "shrink-0 rounded border border-stone-300 px-2.5 py-1 text-xs text-stone-600 transition hover:border-amber-500 hover:text-amber-700";

/**
 * ビジュアルの登録済みリンク1行。
 *
 * 普段はURLを出さず、サムネイル＋ファイル名だけを見せる（長いURLは邪魔なため）。
 * 「保存」でその場にダウンロード、「開く」で元のページ、「編集」でURL入力欄に戻る。
 * Dropbox/Google Drive の共有リンクは表示用・保存用にそれぞれ読み替える。
 */
function VisualLinkRow({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const [editing, setEditing] = useState(false);
  const url = value.trim();
  const showThumb = !broken && isImageUrl(url);
  const { name, host } = linkLabel(url);

  /* URLが空のときと編集中は、これまで通りの入力欄を出す */
  if (editing || !url) {
    return (
      <div className="mb-2 flex items-center gap-2">
        <input
          /* 「編集」で入力欄に戻したときだけ、そのまま打てるよう focus を移す */
          autoFocus={editing}
          className={inputCls}
          placeholder="https://..."
          value={value}
          onChange={(e) => {
            setBroken(false);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={() => setEditing(false)}
        />
        <button
          type="button"
          title="このリンクを消す"
          className="shrink-0 rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-2">
      {showThumb ? (
        <a href={url} target="_blank" rel="noreferrer" title="別タブで開く" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toThumbnailUrl(url)}
            alt=""
            className="h-12 w-12 rounded border border-stone-200 bg-stone-50 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            onLoad={() => setBroken(false)}
          />
        </a>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-dashed border-stone-300 bg-stone-50 text-lg text-stone-300">
          🔗
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-stone-700" title={url}>
          {name}
        </div>
        {host && <div className="truncate text-xs text-stone-400">{host}</div>}
      </div>

      <a
        href={toDownloadUrl(url)}
        download
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="このファイルを保存する"
      >
        ⬇ 保存
      </a>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={linkBtnCls}
        title="置き場所を別タブで開く"
      >
        開く
      </a>
      <button
        type="button"
        title="URLを直す"
        className="shrink-0 rounded px-2 py-1 text-xs text-stone-400 hover:text-stone-700"
        onClick={() => setEditing(true)}
      >
        編集
      </button>
      <button
        type="button"
        title="このリンクを消す"
        className="shrink-0 rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

/** 元価格＋そのUber価格（自動計算）のセット */
function PriceBlock({
  id,
  label,
  filled,
  base,
  uber,
  onBase,
  onUber,
}: {
  id: string;
  label: string;
  filled: boolean;
  base: number | null;
  uber: number | null;
  onBase: (v: number | null) => void;
  onUber: (v: number | null) => void;
}) {
  const auto = autoUberPrice(base);
  const isManual = uber !== null;

  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <Field label={label} filled={filled}>
        <PriceInput id={id} value={base} placeholder="950" onChange={onBase} />
      </Field>
      <div className="mt-3">
        <div className="mb-1 flex items-center gap-2">
          <label className="block text-sm font-medium text-stone-600">
            └ Uber Eats 価格（税込）
          </label>
          {isManual ? (
            <>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] text-stone-600">
                手入力
              </span>
              <button
                type="button"
                className="text-[11px] text-amber-700 hover:underline"
                onClick={() => onUber(null)}
              >
                自動に戻す
              </button>
            </>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
              自動（× {UBER_RATE}）
            </span>
          )}
        </div>
        <PriceInput
          value={effectiveUberPrice(uber, base)}
          muted={!isManual}
          placeholder={auto === null ? "元価格を入れると自動計算" : ""}
          onChange={onUber}
        />
        <p className="mt-1 text-xs text-stone-400">
          {isManual
            ? `自動計算なら ${auto === null ? "―" : formatYen(auto)} です。`
            : "元価格を変えると自動で更新されます。直接入力すると手入力に切り替わります。"}
        </p>
      </div>
    </div>
  );
}

/** 指定した入力欄まで画面を送って、カーソルを入れる */
function focusInput(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    try {
      (el as HTMLElement).focus({ preventScroll: true });
    } catch {
      (el as HTMLElement).focus();
    }
  }, 350);
}

export default function ProductSheetView({ app }: { app: ReturnType<typeof useAppData> }) {
  const { selectedProduct, getInfo, updateInfo, resetProductInfo, saveState, retrySave } = app;
  const [copyMsg, setCopyMsg] = useState("");
  /** 入力済みの項目を隠して、残っている必須項目だけを出す */
  const [onlyEmpty, setOnlyEmpty] = useState(false);

  if (!selectedProduct) {
    return <ProductPicker app={app} />;
  }

  const info = getInfo(selectedProduct.id);
  const req = requiredProgress(info);
  const opt = optionalProgress(info);
  const ing = ingredientsProgress(info);

  const patch = (p: Partial<typeof info>) => updateInfo(selectedProduct.id, p);

  /* ---------------- 必須項目の一覧（点の表示と「次の未入力へ」で使う） --------------- */

  const ingredientsFilled = info.ingredients.some((i) => i.nameJa && i.amount);
  const firstOpenIngredient = Math.max(
    0,
    info.ingredients.findIndex((i) => !(i.nameJa && i.amount))
  );
  const visualFilledOf = (links: string[]) => links.some((l) => l.trim());

  const requiredItems: { filled: boolean; focusId: string }[] = [
    { filled: !!info.nameJa, focusId: "f-nameJa" },
    { filled: !!info.releaseDate, focusId: "f-releaseDate" },
    { filled: info.noAlcoholPork !== null, focusId: "f-noAlcoholPork" },
    { filled: info.priceTokyo !== null, focusId: "f-priceTokyo" },
    { filled: info.priceKama !== null, focusId: "f-priceKama" },
    { filled: ingredientsFilled, focusId: `f-ing-ja-${firstOpenIngredient}` },
    ...info.visualDownloads.map((v) => ({
      filled: visualFilledOf(v.links),
      focusId: `f-visual-${v.key}`,
    })),
  ];

  const nextEmpty = requiredItems.find((r) => !r.filled);

  const jumpToNextEmpty = () => {
    if (!nextEmpty) return;
    focusInput(nextEmpty.focusId);
  };

  /** 「未入力だけ表示」がONのとき、埋まっている必須項目と任意項目は隠す */
  const showRequired = (filled: boolean) => !onlyEmpty || !filled;
  const showOptional = () => !onlyEmpty;

  // セクションごとの入力状況（見出しの右に出す目安）
  const BASIC_TOTAL = 9;
  const basicFilled = [
    !!info.nameJa,
    info.noAlcoholPork !== null,
    !!info.releaseDate,
    !!info.endDate || info.ongoing,
    !!info.nameEn,
    !!info.descriptionJa,
    !!info.descriptionEn,
    info.priceTokyo !== null,
    info.priceKama !== null,
  ].filter(Boolean).length;
  const howtoFilled = [!!info.howToVideoUrl, !!info.recipeNotes].filter(Boolean).length;
  const visualFilled = info.visualDownloads.filter((v) => visualFilledOf(v.links)).length;
  const snsFilled = [
    !!info.igCaption,
    !!info.xCaption,
    !!info.threadsCaption,
    !!info.pressEmail,
    !!info.prTimesUrl,
  ].filter(Boolean).length;

  /** 上部タブに出す、セクションごとの入力状況 */
  const sectionTabs: SectionTab[] = [
    { id: "sheet-basic", label: "基本データ", filled: basicFilled, total: BASIC_TOTAL },
    { id: "sheet-ingredients", label: "材料", filled: ing.filled, total: ing.total },
    { id: "sheet-howto", label: "作り方", filled: howtoFilled, total: 2 },
    { id: "sheet-visual", label: "ビジュアル", filled: visualFilled, total: info.visualDownloads.length },
    { id: "sheet-sns", label: "SNS・PR", filled: snsFilled, total: 5 },
  ];

  /* ---------------------------------- 材料 ---------------------------------- */

  const updateIngredient = (idx: number, patchRow: Partial<(typeof info.ingredients)[number]>) => {
    const next = info.ingredients.map((row, i) => (i === idx ? { ...row, ...patchRow } : row));
    patch({ ingredients: next });
  };

  const addIngredient = () =>
    patch({ ingredients: [...info.ingredients, { nameJa: "", nameEn: "", amount: "", specs: [] }] });

  const removeIngredient = (idx: number) =>
    patch({ ingredients: info.ingredients.filter((_, i) => i !== idx) });

  const blankIngredientCount = info.ingredients.filter(isBlankIngredientRow).length;

  /** 入力済みの行だけ残す。少なすぎるときは入力用の空行を DEFAULT_INGREDIENT_ROWS まで補う */
  const removeBlankIngredients = () => {
    const kept = info.ingredients.filter((row) => !isBlankIngredientRow(row));
    const rows = [...kept];
    while (rows.length < DEFAULT_INGREDIENT_ROWS) {
      rows.push({ nameJa: "", nameEn: "", amount: "", specs: [] });
    }
    patch({ ingredients: rows });
  };

  const blankIngredientsRemovable =
    info.ingredients.length -
    Math.max(info.ingredients.length - blankIngredientCount, DEFAULT_INGREDIENT_ROWS);

  /**
   * 表の中で Enter を押したときの動き。
   * 最後の行なら行を1つ増やして、同じ列の次の行にカーソルを移す。
   * （右のセルへは Tab。ブラウザ標準の動きをそのまま使う）
   */
  const onIngredientEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    column: "ja" | "en" | "amount" | "spec"
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const isLast = idx === info.ingredients.length - 1;
    if (isLast) addIngredient();
    const nextId = `f-ing-${column}-${idx + 1}`;
    window.setTimeout(() => document.getElementById(nextId)?.focus(), isLast ? 30 : 0);
  };

  /** 表のセルは specs の1つ目を扱う。2つ目以降は行の下に続けて出す */
  const setFirstSpec = (idx: number, value: string) => {
    const row = info.ingredients[idx];
    const specs = row.specs.length > 0 ? row.specs.map((s, i) => (i === 0 ? value : s)) : [value];
    updateIngredient(idx, { specs });
  };

  /* -------------------------------- ビジュアル -------------------------------- */

  const updateVisual = (key: string, links: string[]) => {
    patch({
      visualDownloads: info.visualDownloads.map((v) => (v.key === key ? { ...v, links } : v)),
    });
  };

  /**
   * 追加欄に入っている URL を登録して、欄を空にする。
   * 改行や空白で区切って複数まとめて貼り付けてもよい。
   */
  const commitVisualInput = (el: HTMLInputElement, key: string, links: string[]) => {
    const added = el.value.split(/\s+/).map((v) => v.trim()).filter(Boolean);
    if (added.length === 0) return;
    updateVisual(key, [...links, ...added]);
    el.value = "";
  };

  /** 貼り付けた URL を Enter で登録する */
  const onVisualPaste = (e: React.KeyboardEvent<HTMLInputElement>, key: string, links: string[]) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    commitVisualInput(e.currentTarget, key, links);
  };

  /* --------------------------------- 書き出し --------------------------------- */

  const buildExportText = () => {
    const lines = [
      `【${info.nameJa || selectedProduct.name}】`,
      `ジャンル：${selectedProduct.genre ? GENRE_LABELS[selectedProduct.genre] : "（指定なし）"}`,
      `発売日：${info.releaseDate || "―"}　販売終了日：${info.ongoing ? "継続販売中" : info.endDate || "―"}`,
      `NOアルコール・NOポーク：${info.noAlcoholPork === "mark" ? "マークを付ける" : info.noAlcoholPork === "nomark" ? "マークを付けない" : "未設定"}`,
      `品名（英語）：${info.nameEn}`,
      `紹介文（日本語）：${info.descriptionJa}`,
      `紹介文（英語）：${info.descriptionEn}`,
      `Instagram投稿文：${info.instagramPost}`,
      `販売価格（銀座・原宿・浅草・飛騨高山）：${formatYen(info.priceTokyo) || "―"}`,
      `　└ Uber：${formatYen(effectiveUberPrice(info.priceTokyoUber, info.priceTokyo)) || "―"}`,
      `販売価格（嘉麻）：${formatYen(info.priceKama) || "―"}`,
      `　└ Uber：${formatYen(effectiveUberPrice(info.priceKamaUber, info.priceKama)) || "―"}`,
      "",
      "■材料",
      ...info.ingredients
        .filter((i) => i.nameJa)
        .map((i) => `・${i.nameJa}（${i.nameEn}） ${i.amount}`),
      "",
      `作り方動画：${info.howToVideoUrl}`,
      "",
      "■SNS/PR文章",
      `Instagram：${info.igCaption}`,
      `X：${info.xCaption}`,
      `Threads：${info.threadsCaption}`,
      `関係者一斉メール：${info.pressEmail}`,
      `PR TIMES URL：${info.prTimesUrl}`,
    ];
    return lines.join("\n");
  };

  const copyForExport = async () => {
    try {
      await navigator.clipboard.writeText(buildExportText());
      setCopyMsg("コピーしました");
    } catch {
      setCopyMsg("コピーに失敗しました（ブラウザの権限をご確認ください）");
    }
    setTimeout(() => setCopyMsg(""), 2500);
  };

  const saveLabel =
    saveState === "saving"
      ? "保存中…"
      : saveState === "saved"
        ? "保存しました"
        : saveState === "error"
          ? "保存できませんでした"
          : "自動保存";
  const saveCls =
    saveState === "saving"
      ? "bg-amber-100 text-amber-800"
      : saveState === "saved"
        ? "bg-emerald-100 text-emerald-700"
        : saveState === "error"
          ? "bg-red-100 text-red-700"
          : "bg-stone-100 text-stone-500";

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="print:hidden">
        <ProductPicker app={app} />
      </div>

      <div
        id="sheet-progress"
        className="sticky top-0 z-20 rounded-xl border border-amber-200 bg-amber-50/95 p-4 backdrop-blur print:static print:bg-white"
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-amber-200 px-3 py-1 font-medium text-amber-900">
            必須 {req.filled}/{req.total}（{req.total ? Math.round((req.filled / req.total) * 100) : 0}%）
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-stone-600">
            任意 {opt.filled}/{opt.total}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-3 print:hidden">
            <span className={`rounded-full px-3 py-1 text-xs ${saveCls}`}>{saveLabel}</span>
            {saveState === "error" && (
              <button
                type="button"
                className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                onClick={retrySave}
              >
                再試行
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-600"
                checked={onlyEmpty}
                onChange={(e) => setOnlyEmpty(e.target.checked)}
              />
              未入力だけ表示
            </label>
            <button
              type="button"
              disabled={!nextEmpty}
              onClick={jumpToNextEmpty}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-default disabled:bg-stone-300"
            >
              {nextEmpty ? "次の未入力へ →" : "必須はすべて入力済み"}
            </button>
          </div>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-amber-200/60">
          <div
            className={`h-full rounded-full transition-all ${
              req.filled === req.total ? "bg-emerald-600" : "bg-amber-600"
            }`}
            style={{ width: `${req.total ? (req.filled / req.total) * 100 : 0}%` }}
          />
        </div>

        <SectionTabs tabs={sectionTabs} />

        <details className="mt-2 print:hidden">
          <summary className="cursor-pointer list-none text-xs text-stone-400 hover:text-stone-600">
            数え方について
          </summary>
          <p className="mt-1 text-xs text-stone-400">
            必須が揃うと100%です。各サイズのビジュアルは、リンクが1つでも入っていれば充足とみなします。詳細スペック・使用材料＋手順・SNS/PR文面などの「任意」は、空でもOKです。
          </p>
        </details>
      </div>

      <Section
        id="sheet-basic"
        step={1}
        icon="🧾"
        title="基本データ"
        progress={`${basicFilled}/${BASIC_TOTAL}`}
        done={basicFilled === BASIC_TOTAL}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {showRequired(info.noAlcoholPork !== null) && (
            <Field label="NOアルコール・NOポーク" filled={info.noAlcoholPork !== null}>
              <div className="flex gap-2">
                <button
                  id="f-noAlcoholPork"
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    info.noAlcoholPork === "mark"
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-stone-300 text-stone-600"
                  }`}
                  onClick={() => patch({ noAlcoholPork: "mark" })}
                >
                  マークを付ける
                </button>
                <button
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    info.noAlcoholPork === "nomark"
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-stone-300 text-stone-600"
                  }`}
                  onClick={() => patch({ noAlcoholPork: "nomark" })}
                >
                  マークを付けない
                </button>
              </div>
            </Field>
          )}
          {showRequired(!!info.nameJa) && (
            <Field label="品名（日本語）" filled={!!info.nameJa}>
              <input
                id="f-nameJa"
                className={inputCls}
                value={info.nameJa}
                onChange={(e) => patch({ nameJa: e.target.value })}
              />
            </Field>
          )}
          {showRequired(!!info.releaseDate) && (
            <Field label="発売日" filled={!!info.releaseDate}>
              <input
                id="f-releaseDate"
                type="date"
                className={inputCls}
                value={info.releaseDate}
                onChange={(e) => patch({ releaseDate: e.target.value })}
              />
            </Field>
          )}
          {showOptional() && (
            <Field label="販売終了日">
              <label className="mb-2 flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  checked={info.ongoing}
                  onChange={(e) =>
                    patch({ ongoing: e.target.checked, endDate: e.target.checked ? "" : info.endDate })
                  }
                />
                継続販売中（終了日を決めない）
              </label>
              {info.ongoing ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  継続販売中 — 販売終了日は設定しません
                </div>
              ) : (
                <input
                  type="date"
                  className={inputCls}
                  value={info.endDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                />
              )}
            </Field>
          )}
          {showOptional() && (
            <Field label="英語（品名）" hint="担当AIが記入・空欄でOK">
              <input className={inputCls} value={info.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} />
            </Field>
          )}
        </div>
        {showOptional() && (
          <Field label="紹介文（日本語）" hint={`${info.descriptionJa.length} 字`}>
            <AutoTextarea
              rows={2}
              value={info.descriptionJa}
              onChange={(v) => patch({ descriptionJa: v })}
            />
          </Field>
        )}
        {showOptional() && (
          <Field label="英語（紹介文）" hint="担当AIが記入・空欄でOK">
            <AutoTextarea
              rows={2}
              value={info.descriptionEn}
              onChange={(v) => patch({ descriptionEn: v })}
            />
          </Field>
        )}
        {showOptional() && (
          <Field label="Instagram投稿文（日本語・全角140字以内）" hint={`${info.instagramPost.length} / 140`}>
            <AutoTextarea
              rows={3}
              maxLength={140}
              value={info.instagramPost}
              onChange={(v) => patch({ instagramPost: v })}
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {showRequired(info.priceTokyo !== null) && (
            <PriceBlock
              id="f-priceTokyo"
              label="販売価格（銀座・原宿・浅草・飛騨高山／税込）"
              filled={info.priceTokyo !== null}
              base={info.priceTokyo}
              uber={info.priceTokyoUber}
              onBase={(v) => patch({ priceTokyo: v })}
              onUber={(v) => patch({ priceTokyoUber: v })}
            />
          )}
          {showRequired(info.priceKama !== null) && (
            <PriceBlock
              id="f-priceKama"
              label="販売価格（嘉麻／税込）"
              filled={info.priceKama !== null}
              base={info.priceKama}
              uber={info.priceKamaUber}
              onBase={(v) => patch({ priceKama: v })}
              onUber={(v) => patch({ priceKamaUber: v })}
            />
          )}
        </div>
      </Section>

      <Section
        id="sheet-ingredients"
        step={2}
        icon="🥘"
        title="材料（ingredients）"
        progress={`${ing.filled}/${ing.total}（登録${info.ingredients.length}件）`}
        done={ingredientsFilled}
      >
        <p className="text-xs text-stone-400">
          品目ごとに「品名・分量・詳細スペック（商品名/メーカー/原材料/アレルゲン等）」を入れます。
          <kbd className="mx-1 rounded border border-stone-300 bg-stone-50 px-1 text-[11px]">Tab</kbd>
          で右のセル、最後の行で
          <kbd className="mx-1 rounded border border-stone-300 bg-stone-50 px-1 text-[11px]">Enter</kbd>
          を押すと行が増えます。
        </p>

        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-stone-400">
                <th className="w-8 pb-1" />
                <th className="px-0.5 pb-1">品名（日本語）</th>
                <th className="px-0.5 pb-1">品名（英語）</th>
                <th className="w-24 px-0.5 pb-1">分量</th>
                <th className="px-0.5 pb-1">詳細スペック（任意）</th>
                <th className="w-8 pb-1" />
              </tr>
            </thead>
            <tbody>
              {info.ingredients.map((row, idx) => (
                <tr key={idx} className="group align-top">
                  <td className="py-1 pr-1 text-center text-[11px] tabular-nums text-stone-400">
                    <span className="inline-block py-1.5">{idx + 1}</span>
                  </td>
                  <td className="px-0.5 py-1">
                    <input
                      id={`f-ing-ja-${idx}`}
                      className={cellCls}
                      value={row.nameJa}
                      onChange={(e) => updateIngredient(idx, { nameJa: e.target.value })}
                      onKeyDown={(e) => onIngredientEnter(e, idx, "ja")}
                    />
                  </td>
                  <td className="px-0.5 py-1">
                    <input
                      id={`f-ing-en-${idx}`}
                      className={cellCls}
                      value={row.nameEn}
                      onChange={(e) => updateIngredient(idx, { nameEn: e.target.value })}
                      onKeyDown={(e) => onIngredientEnter(e, idx, "en")}
                    />
                  </td>
                  <td className="px-0.5 py-1">
                    <input
                      id={`f-ing-amount-${idx}`}
                      className={cellCls}
                      value={row.amount}
                      onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                      onKeyDown={(e) => onIngredientEnter(e, idx, "amount")}
                    />
                  </td>
                  <td className="px-0.5 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        id={`f-ing-spec-${idx}`}
                        className={cellCls}
                        placeholder="任意"
                        value={row.specs[0] ?? ""}
                        onChange={(e) => setFirstSpec(idx, e.target.value)}
                        onKeyDown={(e) => onIngredientEnter(e, idx, "spec")}
                      />
                      <button
                        type="button"
                        title="スペックの行を足す"
                        className="shrink-0 rounded px-1.5 py-1 text-xs text-stone-300 transition hover:bg-amber-50 hover:text-amber-700 group-hover:text-stone-400"
                        onClick={() => updateIngredient(idx, { specs: [...row.specs, ""] })}
                      >
                        ＋
                      </button>
                    </div>
                    {row.specs.slice(1).map((s, si) => (
                      <input
                        key={si}
                        className={`${cellCls} mt-1`}
                        value={s}
                        placeholder="任意"
                        onChange={(e) => {
                          const specs = row.specs.map((v, i) => (i === si + 1 ? e.target.value : v));
                          updateIngredient(idx, { specs });
                        }}
                      />
                    ))}
                  </td>
                  <td className="py-1 pl-1 text-center">
                    <button
                      type="button"
                      title="この行を消す"
                      className="rounded px-2 py-1 text-stone-300 transition hover:bg-red-50 hover:text-red-600 group-hover:text-stone-400"
                      onClick={() => removeIngredient(idx)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            onClick={addIngredient}
          >
            ＋ 材料を追加
          </button>
          {blankIngredientsRemovable > 0 && (
            <button
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
              onClick={removeBlankIngredients}
            >
              空の行を消す（{blankIngredientsRemovable}行）
            </button>
          )}
        </div>
      </Section>

      <Section
        id="sheet-howto"
        step={3}
        icon="👩‍🍳"
        title="作り方（How to make）"
        progress={`${howtoFilled}/2`}
        done={howtoFilled === 2}
      >
        {onlyEmpty ? (
          <p className="text-xs text-stone-400">「未入力だけ表示」がONです。この欄はすべて任意なので隠しています。</p>
        ) : (
          <>
            <p className="text-xs text-stone-400">
              使用材料と手順は別ページで管理する想定です。ここには動画のURLとメモだけを入れます。
            </p>
            <Field label="作り方動画 YouTube URL">
              <input
                className={inputCls}
                value={info.howToVideoUrl}
                onChange={(e) => patch({ howToVideoUrl: e.target.value })}
              />
            </Field>
            <Field label="メモ（任意）">
              <AutoTextarea
                rows={2}
                value={info.recipeNotes}
                onChange={(v) => patch({ recipeNotes: v })}
              />
            </Field>
          </>
        )}
      </Section>

      <Section
        id="sheet-visual"
        step={4}
        icon="🖼️"
        title="ビジュアルダウンロード（各サイズ）"
        progress={`${visualFilled}/${info.visualDownloads.length}`}
        done={visualFilled === info.visualDownloads.length}
      >
        <p className="text-xs text-stone-400">
          各サイズのデータ置き場（Dropbox / Google Drive など）のリンクを、下の枠に貼って
          <kbd className="mx-1 rounded border border-stone-300 bg-stone-50 px-1 text-[11px]">Enter</kbd>
          を押すと登録されます。Enterを押さずに他の欄へ移っても登録されるので、貼ったURLが消えることはありません。
        </p>
        {info.visualDownloads
          .filter((v) => showRequired(visualFilledOf(v.links)))
          .map((v) => (
            <div key={v.key} className="rounded-lg border border-stone-200 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-stone-600">
                <Dot filled={visualFilledOf(v.links)} />
                {v.label} {v.size && <span className="text-xs font-normal text-stone-400">（{v.size}）</span>}
              </div>
              {v.links.map((l, li) => (
                <VisualLinkRow
                  key={li}
                  value={l}
                  onChange={(val) => updateVisual(v.key, v.links.map((x, i) => (i === li ? val : x)))}
                  onRemove={() => updateVisual(v.key, v.links.filter((_, i) => i !== li))}
                />
              ))}
              <input
                id={`f-visual-${v.key}`}
                className="w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 placeholder:text-stone-400 focus:border-solid focus:border-amber-500 focus:text-stone-800 focus:outline-none"
                placeholder="URLを貼って Enter（複数まとめて貼ってもOK）"
                aria-label={`${v.label}のリンクを追加`}
                onKeyDown={(e) => onVisualPaste(e, v.key, v.links)}
                onBlur={(e) => commitVisualInput(e.currentTarget, v.key, v.links)}
              />
            </div>
          ))}
        {onlyEmpty && visualFilled === info.visualDownloads.length && (
          <p className="text-xs text-stone-400">すべてのサイズにリンクが入っています。</p>
        )}
      </Section>

      <Section
        id="sheet-sns"
        step={5}
        icon="📣"
        title="紹介文各種（SNS・PR）"
        progress={`${snsFilled}/5`}
        done={snsFilled === 5}
      >
        {onlyEmpty ? (
          <p className="text-xs text-stone-400">「未入力だけ表示」がONです。この欄はすべて任意なので隠しています。</p>
        ) : (
          <>
            <Field label="Instagram 投稿文章（本文＋ハッシュタグ）">
              <AutoTextarea
                rows={3}
                value={info.igCaption}
                onChange={(v) => patch({ igCaption: v })}
              />
            </Field>
            <Field label="X（旧Twitter）文章">
              <AutoTextarea
                rows={2}
                value={info.xCaption}
                onChange={(v) => patch({ xCaption: v })}
              />
            </Field>
            <Field label="Threads 文章">
              <AutoTextarea
                rows={2}
                value={info.threadsCaption}
                onChange={(v) => patch({ threadsCaption: v })}
              />
            </Field>
            <Field label="取引先・関係者への一斉メール（件名＋本文）">
              <AutoTextarea
                rows={3}
                value={info.pressEmail}
                onChange={(v) => patch({ pressEmail: v })}
              />
            </Field>
            <Field label="PR TIMES 記事URL">
              <input className={inputCls} value={info.prTimesUrl} onChange={(e) => patch({ prTimesUrl: e.target.value })} />
            </Field>
          </>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          onClick={copyForExport}
        >
          📋 コピー用に書き出し
        </button>
        <button
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          onClick={() => window.print()}
        >
          🖨 印刷 / PDF保存
        </button>
        <button
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          onClick={() => {
            if (confirm("この商品の入力をリセットします。よろしいですか？")) {
              resetProductInfo(selectedProduct.id);
            }
          }}
        >
          この商品の入力をリセット
        </button>
        {copyMsg && <span className="text-sm text-emerald-600">{copyMsg}</span>}
      </div>

      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-stone-500">
        ※これは「1商品に必要な情報一式」を集めるための入力式の下書きシートです。入力内容は共有データベースに自動保存され、「コピー用に書き出し」でスプレッドシートやメールに貼れます。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
