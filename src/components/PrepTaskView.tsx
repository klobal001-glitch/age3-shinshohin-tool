"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import ProductPicker from "./ProductPicker";
import Icon from "@/components/Icon";
import ProductThumb from "@/components/ProductThumb";
import {
  badge,
  btn,
  card,
  cardHead,
  chip,
  field,
  focusRing,
  h3,
  muted,
  TASK_ROW_LEGEND,
  taskRow,
} from "@/lib/ui";
import { TASK_GROUPS } from "@/lib/prepTasks";
import { computeDeadline, daysDiffFromToday, diffLabel, formatJpDate } from "@/lib/deadline";
import { Milestone, ProductInfo, StoreId, TaskGroup, TaskItem } from "@/lib/types";
import { canSkipTask, isLinkedTaskDone, skipKey } from "@/lib/stats";
import { PriceInput } from "./PriceInput";
import { VisualLinkRow } from "./VisualLinkRow";
import {
  UBER_RATE,
  autoUberPrice,
  createDefaultProductInfo,
  effectiveUberPrice,
  formatYen,
  patchStorePrice,
} from "@/lib/productInfo";
import RunTabs, { PastRunNotice, runView } from "./RunTabs";

/** 並べ替え・絞り込みボタンの共通スタイル。実体は @/lib/ui の chip */
const ctrlCls = chip;

/**
 * タスク名と、そのうしろの小さな注記。
 *
 * 「自動入力欄へ」のような案内をタスク名と同じ大きさ・濃さで書くと、
 * 見なければいけないタスク名そのものが読み取りにくくなる。
 * 注記は一段小さく・薄くして、タスク名が先に目に入るようにする。
 */
function TaskLabel({ task, className = "" }: { task: TaskItem; className?: string }) {
  return (
    <span className={`min-w-0 ${className}`}>
      {task.label}
      {task.note && (
        <span className="ml-1.5 whitespace-nowrap align-middle text-xs font-normal text-stone-400">
          🔗 {task.note}
        </span>
      )}
    </span>
  );
}

function leafKey(groupId: string, milestoneId: string, taskId: string, childId?: string) {
  return childId
    ? `${groupId}|${milestoneId}|${taskId}|${childId}`
    : `${groupId}|${milestoneId}|${taskId}`;
}

/**
 * 画像を貼る連動タスクの行（レシピ作成）。
 *
 * ビジュアルの欄と同じ操作にしてある。URLを貼って Enter で登録され、
 * 1枚でも入っていればチェックが付く（チェック自体は保存していない）。
 */
function LinkedImageRow({
  task,
  links,
  onChange,
}: {
  task: TaskItem;
  links: string[];
  onChange: (links: string[]) => void;
}) {
  const done = links.some((l) => l.trim());

  /** 追加欄の中身を登録して空にする。まとめて貼り付けてもよい */
  const commit = (el: HTMLInputElement) => {
    const added = el.value.split(/\s+/).map((v) => v.trim()).filter(Boolean);
    if (added.length === 0) return;
    onChange([...links, ...added]);
    el.value = "";
  };

  return (
    <div className={taskRow(done ? "done" : "todo", "px-3 py-2.5")}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs font-semibold text-white ${
            done ? "bg-emerald-600" : "border border-stone-300 bg-white"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        <TaskLabel
          task={task}
          className={`flex-1 ${done ? "text-stone-400 line-through" : "text-stone-700"}`}
        />
        {/* スマホでは注記を下の行に落とす。横に並べたままだとタスク名が1文字ずつ折り返される */}
        <span className="basis-full pl-7 text-xs text-stone-400 sm:basis-auto sm:pl-0">
          画像を貼ると完了になります
        </span>
      </div>
      <div className="mt-2 pl-7">
        {links.map((l, i) => (
          <VisualLinkRow
            key={i}
            value={l}
            onChange={(v) => onChange(links.map((x, j) => (j === i ? v : x)))}
            onRemove={() => onChange(links.filter((_, j) => j !== i))}
          />
        ))}
        <input
          className="w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 placeholder:text-stone-400 focus:border-solid focus:border-amber-500 focus:text-stone-800 focus:outline-none"
          placeholder="レシピ画像のURLを貼って Enter（複数まとめて貼ってもOK）"
          aria-label="レシピ画像のリンクを追加"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            commit(e.currentTarget);
          }}
          onBlur={(e) => commit(e.currentTarget)}
        />
      </div>
    </div>
  );
}

/**
 * 価格の連動タスクが、情報シートのどの価格欄を指しているか。
 *
 * store … 店舗別の価格（null なら標準価格）／isUber … Uber価格の欄かどうか
 */
function parsePriceLink(
  field: string | undefined
): { store: StoreId | null; isUber: boolean } | null {
  if (!field) return null;
  if (field === "priceBase") return { store: null, isUber: false };
  if (field === "priceBaseUber") return { store: null, isUber: true };
  if (field.startsWith("priceStore:"))
    return { store: field.slice("priceStore:".length) as StoreId, isUber: false };
  if (field.startsWith("priceStoreUber:"))
    return { store: field.slice("priceStoreUber:".length) as StoreId, isUber: true };
  return null;
}

/**
 * 価格を入れる連動タスクの行。
 *
 * 情報シートの価格欄と1対1で、ここに入れた数字はそのままシートに入る
 * （持ち主はシート側の値だけ。2か所で持たないので食い違わない）。
 * Uber価格は元価格 × 1.4 の自動計算で、直接入れると手入力に切り替わる。
 */
function LinkedPriceRow({
  task,
  info,
  onPatch,
}: {
  task: TaskItem;
  info: ProductInfo;
  onPatch: (patch: Partial<ProductInfo>) => void;
}) {
  const link = parsePriceLink(task.linkedField);
  if (!link) return null;

  /* 標準価格は info の欄、店舗別は priceByStore の中を見る */
  const cur = link.store
    ? info.priceByStore[link.store] ?? { price: null, uber: null, notSold: false }
    : { price: info.priceBase, uber: info.priceBaseUber, notSold: info.priceBaseNotSold };

  const notSold = cur.notSold;
  const base = cur.price;
  const isUber = link.isUber;
  const uberExplicit = isUber ? cur.uber : null;
  const value = isUber ? effectiveUberPrice(uberExplicit, base) : base;
  /* 店舗別は「欄そのものが埋まっているか」で数える（標準価格から埋まったことにはしない） */
  const filledHere = link.store ? !!info.priceByStore[link.store] : true;
  const done = filledHere && (notSold || value !== null);
  const isManual = isUber && uberExplicit !== null;

  /* 入力された値を、標準価格か店舗別の欄のどちらかに書き戻す */
  const writePrice = (v: number | null) => {
    const change = isUber ? { uber: v } : { price: v };
    if (link.store) {
      onPatch({ priceByStore: patchStorePrice(info, link.store, change) });
      return;
    }
    onPatch(isUber ? { priceBaseUber: v } : { priceBase: v });
  };

  return (
    <div className={taskRow(done ? "done" : "todo", "px-3 py-2.5")}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs font-semibold text-white ${
            done ? "bg-emerald-600" : "border border-stone-300 bg-white"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        <TaskLabel task={task} className={done ? "text-stone-400 line-through" : "text-stone-700"} />
        {isUber &&
          (isManual ? (
            <>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">
                手入力
              </span>
              <button
                type="button"
                className="text-xs text-amber-700 hover:underline"
                onClick={() => writePrice(null)}
              >
                自動に戻す
              </button>
            </>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              自動（× {UBER_RATE}）
            </span>
          ))}
      </div>
      <div className="mt-2 max-w-[220px] pl-7">
        {notSold ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
            この店舗では取り扱いません
          </div>
        ) : (
          <PriceInput
            value={value}
            muted={isUber && !isManual}
            placeholder={isUber ? "元価格を入れると自動計算" : "950"}
            onChange={writePrice}
          />
        )}
      </div>
      {isUber && isManual && base !== null && (
        <p className="mt-1 pl-7 text-xs text-stone-400">
          自動計算なら {formatYen(autoUberPrice(base))} です。
        </p>
      )}
    </div>
  );
}

/** 情報シートと連動するタスクの選択肢 */
const LINKED_CHOICES: Record<string, { value: string; label: string }[]> = {
  noAlcoholPork: [
    { value: "mark", label: "マークを付ける" },
    { value: "nomark", label: "マークを付けない" },
  ],
};

/**
 * 情報シートと連動するタスクの行。
 *
 * ただのチェックだと「どちらにしたか」が分からないので、シートと同じ選択肢を出す。
 * 状態は情報シート側にしか無いため、どちらの画面で選んでも同じ結果になる。
 */
function LinkedChoiceRow({
  task,
  value,
  onChoose,
}: {
  task: TaskItem;
  value: string | null;
  onChoose: (value: string) => void;
}) {
  const choices = LINKED_CHOICES[task.linkedField ?? ""] ?? [];
  const answered = value !== null;

  return (
    <div className={taskRow(answered ? "done" : "todo", "px-3 py-2.5")}>
      <div className="flex items-start gap-3 text-sm">
        <span
          aria-hidden
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs font-semibold text-white ${
            answered ? "bg-emerald-600" : "border border-stone-300 bg-white"
          }`}
        >
          {answered ? "✓" : ""}
        </span>
        <TaskLabel task={task} className={answered ? "text-stone-400 line-through" : "text-stone-700"} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 pl-7">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              value === c.value
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
            onClick={() => onChoose(c.value)}
          >
            {c.label}
          </button>
        ))}
        <span className="self-center text-xs text-stone-400">
          情報シートの「NOアルコール・NOポーク」と連動します
        </span>
      </div>
    </div>
  );
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
  linkedValue,
  onLinkedChoose,
  info,
  onPatchInfo,
  isSkipped,
  onToggleSkip,
}: {
  group: TaskGroup;
  milestone: Milestone;
  deadline: Date | null;
  checked: number;
  total: number;
  showGroupName?: boolean;
  isChecked: (t: TaskItem, childId?: string) => boolean;
  onToggle: (t: TaskItem, childId?: string) => void;
  /** 情報シートと連動するタスクの、いま選ばれている値 */
  linkedValue: (t: TaskItem) => string | null;
  /** 連動するタスクで選び直したとき。情報シート側に書き込む */
  onLinkedChoose: (t: TaskItem, value: string) => void;
  /** 価格の連動タスクで使う、情報シートの中身と書き込み口 */
  info: ProductInfo | null;
  onPatchInfo: (patch: Partial<ProductInfo>) => void;
  /** その項目が「今回は作らない」になっているか */
  isSkipped: (t: TaskItem) => boolean;
  /** 「今回は作らない」を切り替える */
  onToggleSkip: (t: TaskItem) => void;
}) {
  const done = total > 0 && checked === total;
  const [open, setOpen] = useState(!done);
  const dl = diffLabel(daysDiffFromToday(deadline));

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 text-left transition hover:bg-stone-50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon
          name="chevronRight"
          className={`h-4 w-4 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
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
          {done ? (
            <span className="text-xs font-medium text-emerald-600">完了</span>
          ) : (
            /* 開かなくても、あと何件残っているかが分かるようにする */
            <span className={badge("warn", "tabular-nums")}>残り {total - checked}</span>
          )}
          <span className="text-xs tabular-nums text-stone-500">
            {checked}/{total}
          </span>
        </span>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {milestone.tasks.map((t) =>
            t.children && t.children.length > 0 ? (
              (() => {
                /* ポスターやパネルは、商品によっては作らない店舗がある。
                   「今回は作らない」にすると、この2つは分母から外れる */
                const skipped = isSkipped(t);
                /* 子が全部ついていれば「済み」。1つでも残っていれば「残り」 */
                const allDone = t.children!.every((c) => isChecked(t, c.id));
                return (
                  <div
                    key={t.id}
                    className={taskRow(skipped ? "skip" : allDone ? "done" : "todo", "px-3 py-2")}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <TaskLabel
                        task={t}
                        className={`text-sm ${skipped ? "text-stone-400 line-through" : "text-stone-700"}`}
                      />
                      {skipped && <span className={badge("neutral")}>今回は作らない</span>}
                      <button
                        type="button"
                        onClick={() => onToggleSkip(t)}
                        className={`ml-auto inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition sm:min-h-0 ${focusRing} ${
                          skipped
                            ? "border-amber-300 bg-amber-50 font-medium text-amber-800 hover:bg-amber-100"
                            : "border-stone-300 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-700"
                        }`}
                      >
                        {skipped ? "↩ 作る に戻す" : "今回は作らない"}
                      </button>
                    </div>
                    {!skipped && (
                      <div className="mt-1 flex flex-wrap gap-2 pl-1">
                        {t.children!.map((c) => (
                          <label
                            key={c.id}
                            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 sm:min-h-0"
                          >
                            <input
                              type="checkbox"
                              className={`h-5 w-5 sm:h-4 sm:w-4 ${
                                isChecked(t, c.id) ? "accent-emerald-600" : "accent-amber-700"
                              }`}
                              checked={isChecked(t, c.id)}
                              onChange={() => onToggle(t, c.id)}
                            />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : t.linkedField === "recipeImages" ? (
              info && (
                <LinkedImageRow
                  key={t.id}
                  task={t}
                  links={info.recipeImages}
                  onChange={(links) => onPatchInfo({ recipeImages: links })}
                />
              )
            ) : parsePriceLink(t.linkedField) ? (
              info && (
                <LinkedPriceRow key={t.id} task={t} info={info} onPatch={onPatchInfo} />
              )
            ) : t.linkedField ? (
              <LinkedChoiceRow
                key={t.id}
                task={t}
                value={linkedValue(t)}
                onChoose={(v) => onLinkedChoose(t, v)}
              />
            ) : (
              (() => {
                /* レギュラー商品には当てはまらないタスクがある。
                   「今回は作らない」で分母から外せる（2026年9月に全タスクへ拡大） */
                const skipped = isSkipped(t);
                return (
              <div
                key={t.id}
                /* 狭い画面では、右のボタンを下の行に落とす。
                   横に並べたままだとタスク名が1文字ずつ折り返されて読めなくなる */
                className={taskRow(
                  skipped ? "skip" : isChecked(t) ? "done" : "todo",
                  "flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-start sm:gap-3 sm:py-2.5"
                )}
              >
                {/* チェックの当たり判定はラベルまで。右のボタンは別扱いにする */}
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className={`mt-0.5 h-5 w-5 shrink-0 sm:h-4 sm:w-4 ${
                      isChecked(t) ? "accent-emerald-600" : "accent-amber-600"
                    }`}
                    checked={isChecked(t)}
                    onChange={() => onToggle(t)}
                    disabled={skipped}
                  />
                  <TaskLabel
                    task={t}
                    className={
                      skipped
                        ? "text-stone-400 line-through"
                        : isChecked(t)
                          ? "text-stone-400 line-through"
                          : "text-stone-700"
                    }
                  />
                  {skipped && <span className={badge("neutral", "shrink-0")}>今回は作らない</span>}
                </label>
                {t.links && t.links.length > 0 && (
                  <span className="flex flex-wrap gap-1.5 pl-8 sm:shrink-0 sm:justify-end sm:pl-0">
                    {t.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center rounded border border-stone-300 px-2.5 py-1 text-xs text-stone-600 transition hover:border-amber-500 hover:text-amber-700 sm:min-h-0"
                        title="別タブで開く"
                      >
                        {l.label} ↗
                      </a>
                    ))}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onToggleSkip(t)}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1 self-start rounded-lg border px-2.5 py-1 text-xs transition sm:min-h-0 ${focusRing} ${
                    skipped
                      ? "border-amber-300 bg-amber-50 font-medium text-amber-800 hover:bg-amber-100"
                      : "border-stone-300 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-700"
                  }`}
                >
                  {skipped ? "↩ やる に戻す" : "今回は作らない"}
                </button>
              </div>
                );
              })()
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function PrepTaskView({
  app,
  onOpenSwitcher,
}: {
  app: ReturnType<typeof useAppData>;
  onOpenSwitcher?: () => void;
}) {
  const { selectedProduct, getInfo, getTaskState, toggleTask, resetProductTasks, setProductTasks, saveState } =
    app;
  const [sortMode, setSortMode] = useState<"group" | "deadline">("group");
  const [hideCompleted, setHideCompleted] = useState(false);


  const info = selectedProduct ? getInfo(selectedProduct.id) : null;
  const liveTaskState = selectedProduct ? getTaskState(selectedProduct.id) : {};

  /* 販売の回。「今の回」は task_state 側で、締め切り・進捗の数え方はそちらだけを見る。
     終わった回は情報シートの runs に控えとして置いてある（見るだけ） */
  const run = runView(app, info);
  const viewingPastYear = run.viewingPast;
  const taskState = run.past ? run.past.taskState : liveTaskState;
  /* 発売月・販売終了月は「回」ごとに変わる。過去の回を見ているときはその回の日付を使う */
  const releaseDate = run.past ? run.past.releaseDate : info?.releaseDate ?? "";
  const endDate = run.past ? run.past.endDate : info?.endDate ?? "";
  const ongoing = run.past ? run.past.ongoing : info?.ongoing ?? false;

  /** 過去の年を見ているときは触らせない（数に入らないため） */
  const toggle = (key: string) => {
    if (viewingPastYear || !selectedProduct) return;
    toggleTask(selectedProduct.id, key);
  };

  /** 回の名前を変える。移行してきた「2025」のような名前を「2025 通常」に直すため */
  const renameRun = (label: string) => {
    if (!selectedProduct || !info) return;
    const next = prompt("この回の新しい名前", label)?.trim();
    if (!next || next === label) return;
    if (next === info.runLabel || info.runs.some((r) => r.label === next)) {
      alert(`「${next}」はすでにあります。`);
      return;
    }
    if (label === info.runLabel) {
      app.updateInfo(selectedProduct.id, { runLabel: next });
    } else {
      app.updateInfo(selectedProduct.id, {
        runs: info.runs.map((r) => (r.label === label ? { ...r, label: next } : r)),
      });
      app.setRunTab({ productId: selectedProduct.id, label: next });
    }
  };

  /**
   * 新しい「回」を始める。
   *
   * 同じ商品を出し直すとき（来年ぶん・ハロウィン仕様など）に押す。
   * いまの 発売月・販売終了月・ビジュアル・チェック を丸ごと「終わった回」として残し、
   * 新しい回を空から始める。やった記録は消さない。
   */
  const addRun = () => {
    if (!selectedProduct || !info) return;
    const next = prompt("新しく始める回の名前（例: 2026 ハロウィン）")?.trim();
    if (!next) return;
    if (next === info.runLabel || info.runs.some((r) => r.label === next)) {
      alert(`「${next}」はすでにあります。`);
      return;
    }
    let label = info.runLabel;
    if (!label) {
      label =
        prompt("いま入っている内容は、どの回のものですか？（例: 2026 通常）")?.trim() ?? "";
      if (!label) return;
    }
    if (
      !confirm(
        `「${selectedProduct.name}」に ${next} を追加します。\n\n` +
          `いまの 発売月・販売終了月・ビジュアル・チェック は「${label}」として残ります。\n` +
          `${next} は空から始まります（品名・材料・価格・レシピ・紹介文はそのままです）。\n\n` +
          "よろしいですか？"
      )
    )
      return;
    app.updateInfo(selectedProduct.id, {
      runLabel: next,
      runs: [
        {
          label,
          releaseDate: info.releaseDate,
          endDate: info.endDate,
          ongoing: info.ongoing,
          visuals: info.visualDownloads,
          taskState: liveTaskState,
        },
        ...info.runs,
      ],
      releaseDate: "",
      endDate: "",
      ongoing: false,
      visualDownloads: createDefaultProductInfo().visualDownloads,
    });
    setProductTasks(selectedProduct.id, {});
    app.setRunTab(null);
  };

  const patchDates = (release: string, end: string) => {
    if (!selectedProduct || run.viewingPast) return;
    app.updateInfo(selectedProduct.id, { releaseDate: release, endDate: end });
  };

  const isLeafChecked = (groupId: string, milestoneId: string, task: TaskItem, childId?: string) => {
    /* 連動タスクは保存済みのチェックではなく、情報シートの値を見る */
    if (!childId && task.linkedField) return info ? isLinkedTaskDone(task, info) : false;
    return !!taskState[leafKey(groupId, milestoneId, task.id, childId)];
  };

  /** 連動タスクで今選ばれている値 */
  const linkedValue = (task: TaskItem): string | null =>
    task.linkedField === "noAlcoholPork" ? (info?.noAlcoholPork ?? null) : null;

  /** 価格の連動タスクから、情報シートへ書き込む */
  const patchInfo = (patch: Partial<ProductInfo>) => {
    if (!selectedProduct || viewingPastYear) return;
    app.updateInfo(selectedProduct.id, patch);
  };

  /** 連動タスクで選び直したとき。情報シート側に書き込む */
  const chooseLinked = (task: TaskItem, value: string) => {
    if (!selectedProduct || viewingPastYear) return;
    if (task.linkedField === "noAlcoholPork") {
      app.updateInfo(selectedProduct.id, {
        noAlcoholPork: value as ProductInfo["noAlcoholPork"],
      });
    }
  };

  /** その項目が「今回は作らない」になっているか */
  const isSkipped = (groupId: string, milestoneId: string, t: TaskItem) =>
    canSkipTask(t) && Boolean(taskState[skipKey(groupId, milestoneId, t.id)]);

  const milestoneProgress = (group: TaskGroup, m: Milestone) => {
    let checked = 0;
    let total = 0;
    for (const t of m.tasks) {
      /* 「今回は作らない」にしたものは分母から外す（子のあるなしを問わず） */
      if (isSkipped(group.id, m.id, t)) continue;
      if (t.children && t.children.length > 0) {
        for (const c of t.children) {
          total++;
          if (isLeafChecked(group.id, m.id, t, c.id)) checked++;
        }
      } else {
        total++;
        if (isLeafChecked(group.id, m.id, t)) checked++;
      }
    }
    return { checked, total };
  };

  const groupProgress = (group: TaskGroup) => {
    let checked = 0;
    let total = 0;
    for (const m of group.milestones) {
      const mp = milestoneProgress(group, m);
      checked += mp.checked;
      total += mp.total;
    }
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
    return <ProductPicker app={app} onOpenSwitcher={onOpenSwitcher} />;
  }

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="print:hidden">
        <ProductPicker app={app} onOpenSwitcher={onOpenSwitcher} />
      </div>

      {/* 画面の上に貼り付く帯。
          下までスクロールしたときに「いま何の商品を見ているか」が分からなくなる、
          という指摘で入れた（2026年9月13日・松尾さん）。
          スマホでは商品名だけで1行を使う。右に数字を詰めると名前が数文字に潰れて、
          結局どの商品か分からなくなるため。数字と棒は下の行にまとめる */}
      <div className="sticky top-0 z-20 rounded-2xl bg-white/90 px-3 py-2.5 shadow-md backdrop-blur print:static print:bg-white print:shadow-none sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={onOpenSwitcher}
            className={`flex min-w-0 basis-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-stone-100 sm:flex-1 sm:basis-auto ${focusRing}`}
          >
            {info && <ProductThumb info={info} />}
            <span className="min-w-0 truncate text-sm font-semibold text-stone-900">
              {selectedProduct.name}
            </span>
            <Icon name="chevronDown" className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          </button>

          {/* 数字と棒。スマホではこの1行、PCでは商品名の右に並ぶ */}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {overall.total > overall.checked && (
              <span className={badge("warn", "shrink-0 tabular-nums")}>
                残り {overall.total - overall.checked}
              </span>
            )}
            <span className="shrink-0 text-xs tabular-nums text-stone-500">
              {overall.checked}/{overall.total}（{overallPct}%）
            </span>
            {saveState === "error" ? (
              <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-700 print:hidden">
                保存できませんでした
              </span>
            ) : saveState === "saving" ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 print:hidden">
                保存中…
              </span>
            ) : saveState === "saved" ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-700 print:hidden">
                保存しました
              </span>
            ) : null}
            <div className="ml-auto h-1 w-full min-w-[64px] max-w-[160px] overflow-hidden rounded-full bg-stone-200 sm:w-20">
              <div
                className={`h-full rounded-full transition-all ${overallPct === 100 ? "bg-emerald-500" : "bg-amber-600"}`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 販売の回。商品名のすぐ下に置いて、どの回を見ているかが常に分かるようにする
            （2026年9月13日・松尾さんの指示） */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-stone-200 pt-2">
          <span className="mr-0.5 text-xs text-stone-500">販売の回</span>
          <RunTabs app={app} info={info} onAddRun={addRun} onRenameRun={renameRun} />
        </div>
      </div>

      {run.viewingPast && (
        <PastRunNotice label={run.viewingLabel} current={run.currentLabel} />
      )}

      <div className={`overflow-hidden ${card}`}>
        <div className={`${cardHead} flex-wrap`}>
          <h2 className={h3}>準備タスクの進み具合</h2>
        </div>

        <div className="space-y-4 p-4">
          {nextUp ? (
            <div className="rounded-xl border-l-4 border-l-amber-500 bg-amber-50 p-3 shadow-sm">
              <div className="text-xs font-medium text-amber-700">次にやること</div>
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
          ) : releaseDate ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
              <Icon name="check" className="h-4 w-4" />
              この商品の準備タスクはすべて完了しています。
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-4 border-t border-stone-200 pt-3">
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">発売月</span>
              <input
                type="month"
                className={`${field} w-auto`}
                disabled={run.viewingPast}
                value={releaseDate ? releaseDate.slice(0, 7) : ""}
                onChange={(e) => patchDates(e.target.value ? `${e.target.value}-01` : "", endDate)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">販売終了月（G-5用）</span>
              {ongoing ? (
                <span className="inline-block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                  継続販売中
                </span>
              ) : (
                <input
                  type="month"
                  className={`${field} w-auto`}
                  disabled={run.viewingPast}
                  value={endDate ? endDate.slice(0, 7) : ""}
                  onChange={(e) => patchDates(releaseDate, e.target.value ? `${e.target.value}-01` : "")}
                />
              )}
            </label>
            <span className="text-xs text-stone-400">この2つから締め切りを計算します</span>
          </div>

          {/* 狭い画面では折り返さず横に流す */}
          <div className="scroll-x-clean flex items-center gap-2 overflow-x-auto print:hidden md:flex-wrap md:overflow-visible">
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
              {hideCompleted && <Icon name="check" className="h-3.5 w-3.5" />}
              {hideCompleted ? "未完了だけ表示中" : "未完了だけ表示"}
            </button>
          </div>

          {/* 色の意味。説明を読まなくても分かるよう、実物とまったく同じ色を並べる */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 print:hidden">
            {TASK_ROW_LEGEND.map((l) => (
              <span key={l.state} className="flex items-center gap-1.5">
                <span className={`h-4 w-6 shrink-0 rounded border-l-4 ${l.swatch}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!releaseDate && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4" />
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
              <section key={group.id} className={`overflow-hidden ${card}`}>
                <div className={cardHead}>
                  <h3 className={`flex items-center gap-2 ${h3}`}>
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
                      deadline={computeDeadline(m.rule, releaseDate, endDate, ongoing)}
                      checked={mp.checked}
                      total={mp.total}
                      isChecked={(t, childId) => isLeafChecked(group.id, m.id, t, childId)}
                      onToggle={(t, childId) => toggle(leafKey(group.id, m.id, t.id, childId))}
                      linkedValue={linkedValue}
                      onLinkedChoose={chooseLinked}
                      info={info}
                      onPatchInfo={patchInfo}
                      isSkipped={(t) => isSkipped(group.id, m.id, t)}
                      onToggleSkip={(t) => toggle(skipKey(group.id, m.id, t.id))}
                    />
                  ))}
                </div>
              </section>
            );
          })
        : (
          <section className={`overflow-hidden ${card}`}>
            <div className={cardHead}>
              <h3 className={h3}>締め切りが近い順</h3>
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
                    onToggle={(t, childId) => toggle(leafKey(group.id, m.id, t.id, childId))}
                    linkedValue={linkedValue}
                    onLinkedChoose={chooseLinked}
                    info={info}
                    onPatchInfo={patchInfo}
                    isSkipped={(t) => isSkipped(group.id, m.id, t)}
                    onToggleSkip={(t) => toggle(skipKey(group.id, m.id, t.id))}
                  />
                ))}
            </div>
          </section>
        )}

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button className={btn("secondary")} onClick={() => window.print()}>
          🖨 印刷 / PDF保存
        </button>
        {/* 再販・過去に売った商品は、もう全部終わっている。1つずつ押すと数十回保存が走るので
            まとめて完了にする（2026年9月13日・松尾さんの指示）。
            「今回は作らない」の印と、情報シートと連動するタスクは触らない */}
        <button
          className={btn("secondary")}
          disabled={viewingPastYear}
          onClick={() => {
            if (
              !confirm(
                `「${selectedProduct.name}」の準備タスクを、すべて完了にします。\n\n` +
                  "過去に売り終わった商品や、再販で前回ぶんが済んでいる商品に使ってください。\n" +
                  "「今回は作らない」にしたものはそのまま残ります。\n" +
                  "価格・レシピなど情報シートと連動する項目は、シート側の入力で決まります。\n\n" +
                  "よろしいですか？"
              )
            )
              return;
            const next: Record<string, boolean> = { ...taskState };
            for (const g of TASK_GROUPS) {
              for (const m of g.milestones) {
                for (const t of m.tasks) {
                  if (isSkipped(g.id, m.id, t)) continue;
                  if (t.linkedField) continue;
                  if (t.children && t.children.length > 0) {
                    for (const c of t.children) next[leafKey(g.id, m.id, t.id, c.id)] = true;
                  } else {
                    next[leafKey(g.id, m.id, t.id)] = true;
                  }
                }
              }
            }
            setProductTasks(selectedProduct.id, next);
          }}
        >
          <Icon name="check" className="h-4 w-4" />
          すべて完了にする
        </button>
        <button
          className={btn("danger")}
          disabled={viewingPastYear}
          onClick={() => {
            if (confirm("この商品の進捗をリセットします。よろしいですか？")) {
              resetProductTasks(selectedProduct.id);
            }
          }}
        >
          この商品の進捗をリセット
        </button>
      </div>

      <p className={`px-1 pb-2 ${muted}`}>
        ※これは新商品1つ分の準備業務（G-1〜G-5）です。締め切りは発売月から自動計算した目安（前々月＝2か月前／前月＝1か月前）。G-5「販売終了後」は「販売終了月」を選ぶと月末の日付が出ます。チェックは共有データベースに自動保存され、チーム全員が同じ状態を見ます。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
