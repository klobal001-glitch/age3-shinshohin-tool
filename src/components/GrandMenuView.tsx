"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useGrandMenu } from "@/hooks/useGrandMenu";
import {
  GrandMenuRow,
  IssueState,
  currentIssueId,
  daysUntil,
  issueInStore,
  issueState,
  scopeTextOf,
  sortByNewest,
  sortStores,
  storeTabs,
} from "@/lib/grandMenu";
import { STORE_IDS, STORE_LABELS, StoreId } from "@/lib/types";
import { todayKey } from "@/lib/saleStatus";
import { isImageUrl, toThumbnailUrl } from "@/lib/imageUrl";
import { uploadProductPhoto } from "@/components/IngredientPhoto";
import { badge, btn, chip, field, focusRing, muted, scrollRow } from "@/lib/ui";

/**
 * グランドメニュー（お店で配る二つ折りの手元メニュー）の号を並べる画面。
 *
 * 2026年9月15日、松尾さんの依頼で追加した。
 * 「今どの号を配っているか」「次はいつ入稿か」がひと目で分かることだけを狙っている。
 *
 * 2026年11月6日、「使いにくい。お店でタブを分けるとか、最新が上にくるとか」
 * との指摘で作り直した。使いにくかった原因は3つあった。
 *   1. 8号ぶんの入力フォームが全部開きっぱなしで、縦に長く、絵を探せない
 *      → **畳んでおいて、絵と号数だけ出す。直すときだけ開く**
 *   2. 配布開始日が空の号が下に沈み、いちばん新しい vol.23 が最下段にいた
 *      → 号数を主にした並べ替えにした（`sortByNewest`）
 *   3. 店がぜんぶ混ざっていて、飛騨高山の号を探すのに全部見るしかなかった
 *      → 上にお店のタブを置いた。全店共通の号はどのタブにも出る
 *
 * 色の意味は他の画面と同じ。
 * 橙＝これから手を付けるもの（入稿がまだ）／緑＝進んでいる・配っている／灰＝終わった号。
 */

const STATE_LABEL: Record<IssueState, string> = {
  submit: "入稿がまだ",
  waiting: "入稿ずみ・配布前",
  current: "いま配っている号",
  past: "終わった号",
  undated: "日付がまだ",
};

function StateBadge({ state, days }: { state: IssueState; days: number | null }) {
  if (state === "submit") {
    const text =
      days === null ? "入稿がまだ" : days < 0 ? `入稿日を${-days}日過ぎています` : days === 0 ? "本日入稿" : `入稿まであと${days}日`;
    return <span className={badge(days !== null && days < 0 ? "danger" : "warn", "shrink-0 tabular-nums")}>{text}</span>;
  }
  if (state === "past" || state === "undated") {
    return <span className={badge("neutral", "shrink-0")}>{STATE_LABEL[state]}</span>;
  }
  return <span className={badge("good", "shrink-0")}>{STATE_LABEL[state]}</span>;
}

/** 入力欄1つ分。ラベルを上に小さく置く */
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      <input
        type={type}
        className={field}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/**
 * 配る店を押して選ぶ。
 *
 * 前は文字の自由入力だった（「銀座店」「銀座店・浅草店・原宿店」など）。
 * 書き方がそろわないので絞り込みに使えず、打ち間違いにも気づけなかった。
 * 押して選ぶ形にすると、上のタブとそのままつながる。
 * **どれも押していない＝全店共通**。いちばん多い形を初期値にしてある。
 */
function StorePicker({ stores, onChange }: { stores: StoreId[]; onChange: (next: StoreId[]) => void }) {
  const all = stores.length === 0;
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-stone-500">配る店</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chip(all, "", "sm")} onClick={() => onChange([])}>
          全店共通
        </button>
        {STORE_IDS.map((id) => {
          const on = stores.includes(id);
          return (
            <button
              key={id}
              type="button"
              className={chip(on, "", "sm")}
              onClick={() => onChange(sortStores(on ? stores.filter((x) => x !== id) : [...stores, id]))}
            >
              {STORE_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 畳んだカードに出す、配る店の印 */
function StoreTags({ stores }: { stores: StoreId[] }) {
  if (stores.length === 0) return <span className={badge("neutral", "shrink-0")}>全店共通</span>;
  return (
    <>
      {sortStores(stores).map((id) => (
        <span key={id} className={badge("accent", "shrink-0")}>
          {STORE_LABELS[id]}
        </span>
      ))}
    </>
  );
}

/**
 * 貼られたURLから写真を選ぶ／ドラッグして入れるボタン。
 *
 * Dropbox や Google ドライブの共有リンクは、そのままでは画像ではなく
 * 「ページ」のアドレスなので、絵として出せず割れたマークになる。
 * URLを扱わずに済むよう、写真そのものを送れる入口をいちばん上に置く。
 */
function FlyerAddPhoto({
  issueId,
  vol,
  onAdd,
}: {
  issueId: string;
  vol: string;
  onAdd: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;
    setError("");
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of picked) {
        const saved = await uploadProductPhoto(`grandmenu-${issueId}`, vol || "flyer", f);
        urls.push(saved.url);
      }
      onAdd(urls);
    } catch (e) {
      console.error(e);
      setError("送れませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void accept(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        className={btn("secondary")}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "送信中…" : "📷 画像を選ぶ"}
      </button>
      <span className={muted}>スマホならその場で撮れます。まとめて選べます。</span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

/**
 * チラシを大きく見る窓。
 * 左右の矢印（←→）で次の面へ、Esc か外側を押すと閉じる。
 * 紙の面を1枚ずつ確かめたいので、ビジュアル一覧と同じ見せ方にしてある。
 */
function FlyerViewer({
  list,
  index,
  onClose,
  onMove,
}: {
  list: string[];
  index: number;
  onClose: () => void;
  onMove: (i: number) => void;
}) {
  /* 出せなかった画像を覚えておく。面を移れば、その面の結果で見直される */
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const url = list[index];
  const broken = !!failed[url];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove((index + 1) % list.length);
      if (e.key === "ArrowLeft") onMove((index - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    /* 開いている間は後ろの画面を動かさない */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, list.length, onClose, onMove]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/92 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="チラシを大きく見る"
    >
      {broken ? (
        <div
          className="rounded-xl bg-white px-6 py-8 text-center text-sm leading-relaxed text-stone-600 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          この画像は、このアドレスからは出せません。
          <br />
          下のボタンで置き場所を開いてください。
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`${btn("secondary")} mt-4 inline-flex`}
          >
            置き場所を開く
          </a>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={toThumbnailUrl(url)}
          alt=""
          className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
          onClick={(e) => e.stopPropagation()}
          onError={() => setFailed((prev) => ({ ...prev, [url]: true }))}
        />
      )}
      <button
        type="button"
        onClick={onClose}
        className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-stone-900/75 text-white shadow-lg ring-1 ring-white/40 transition hover:bg-stone-900 ${focusRing}`}
        aria-label="閉じる"
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove((index - 1 + list.length) % list.length);
            }}
            className={`absolute left-3 flex h-12 w-12 rotate-180 items-center justify-center rounded-full bg-stone-900/70 text-white shadow-lg ring-1 ring-white/30 transition hover:bg-stone-900 ${focusRing}`}
            aria-label="前の面"
          >
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMove((index + 1) % list.length);
            }}
            className={`absolute right-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-900/70 text-white shadow-lg ring-1 ring-white/30 transition hover:bg-stone-900 ${focusRing}`}
            aria-label="次の面"
          >
            <Icon name="arrowRight" className="h-5 w-5" />
          </button>
          <span className="absolute bottom-5 rounded-full bg-stone-900/70 px-3 py-1 text-xs tabular-nums text-white ring-1 ring-white/25">
            {index + 1} / {list.length}
          </span>
        </>
      )}
    </div>
  );
}

/** 絵が出せなかったときの代わりの面 */
function BrokenThumb({ failed }: { failed: boolean }) {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-xs leading-tight text-stone-500">
      <Icon name="close" className="h-4 w-4 text-stone-300" />
      {failed ? "絵を出せません（押すと開きます）" : "リンク"}
    </span>
  );
}

/**
 * 1号ぶんのチラシ。絵で並べる。
 * 「どの号だったか」は文字より絵のほうが早く分かるので、一覧は必ず絵で出す。
 *
 * compact … 畳んだカード用。横に流す小さな列。外すボタンは出さない
 * （見るだけの場面で「×」が並ぶと、押し間違いのもとになる）
 */
function FlyerImages({
  links,
  compact,
  onOpen,
  onRemove,
}: {
  links: string[];
  compact?: boolean;
  onOpen: (i: number) => void;
  onRemove?: (i: number) => void;
}) {
  /* 出せなかった画像。割れたマークのまま置かず、言葉に変える */
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  if (links.length === 0) {
    if (compact) {
      return <p className={muted}>チラシの画像がまだ入っていません</p>;
    }
    return (
      <p className="rounded-xl bg-stone-100 px-4 py-6 text-center text-xs leading-relaxed text-stone-500">
        まだ1枚も入っていません。上の「画像を選ぶ」から入れてください。
      </p>
    );
  }

  if (compact) {
    return (
      <div className={scrollRow}>
        {links.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className={`h-24 w-[72px] shrink-0 overflow-hidden rounded-lg bg-stone-100 ${focusRing}`}
            title="大きく見る"
          >
            {isImageUrl(url) && !failed[url] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={toThumbnailUrl(url)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => setFailed((prev) => ({ ...prev, [url]: true }))}
              />
            ) : (
              <BrokenThumb failed={!!failed[url]} />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {links.map((url, i) => (
        <div key={`${url}-${i}`} className="group relative">
          <button
            type="button"
            onClick={() => onOpen(i)}
            className={`block w-full overflow-hidden rounded-lg bg-stone-100 ${focusRing}`}
            title="大きく見る"
          >
            {isImageUrl(url) && !failed[url] ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={toThumbnailUrl(url)}
                alt=""
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
                onError={() => setFailed((prev) => ({ ...prev, [url]: true }))}
              />
            ) : (
              <span className="block aspect-[3/4] w-full">
                <BrokenThumb failed={!!failed[url]} />
              </span>
            )}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/55 text-white transition hover:bg-red-600"
              aria-label="この1枚を外す"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function GrandMenuView() {
  const { rows, loading, saveState, update, add, remove } = useGrandMenu();
  const today = todayKey();
  /* 大きく見ている画像。{どの号の何枚目} */
  const [viewer, setViewer] = useState<{ id: string; index: number } | null>(null);
  /* 選んでいるお店のタブ。"all" は全部 */
  const [tab, setTab] = useState<StoreId | "all">("all");
  /* 入力欄を開いている号。1つだけ開く（並べて直すことはないため） */
  const [editing, setEditing] = useState<string | null>(null);

  const tabs = useMemo(() => storeTabs(rows), [rows]);
  /* 号を消してタブが無くなったときは、黙って「すべて」に戻す */
  const activeTab: StoreId | "all" = tab !== "all" && tabs.includes(tab) ? tab : "all";

  const visible = useMemo(
    () => sortByNewest(activeTab === "all" ? rows : rows.filter((r) => issueInStore(r.data, activeTab))),
    [rows, activeTab]
  );
  /* 「いま配っている号」は、開いているタブの中で決める（店ごとに違うため） */
  const currentId = useMemo(() => currentIssueId(visible, today), [visible, today]);

  /* 入稿がまだの号のうち、入稿日がいちばん近いもの。上に大きく出す */
  const next = useMemo(() => {
    const yet = rows.filter((r) => r.data.submitDate && r.data.submitDate > today);
    yet.sort((a, b) => a.data.submitDate.localeCompare(b.data.submitDate));
    return yet[0] ?? null;
  }, [rows, today]);

  const saveLabel =
    saveState === "saving" ? "保存中…" : saveState === "saved" ? "保存しました" : saveState === "error" ? "保存できませんでした" : "";

  const countOf = (id: StoreId) => rows.filter((r) => issueInStore(r.data, id)).length;

  return (
    <div className="space-y-8 sm:space-y-12">
      <div className="pt-1 sm:pt-4">
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-stone-900 sm:text-4xl">
          グランドメニュー
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone-500 sm:text-base">
          お店で配る手元メニューを、号ごとに残しておく場所です。新しい号が上にきます。絵を押すと大きく見られます。
        </p>
      </div>

      {/* 次の入稿。いちばん近い1件だけを大きく出す（ホームの「次にやること」と同じ考え方） */}
      {next && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-6 shadow-md sm:rounded-3xl sm:p-8">
          <div className="flex items-center gap-2.5">
            <Icon name="calendar" className="h-4 w-4 text-white/80" />
            <span className="text-sm font-semibold text-white/90">次の入稿</span>
            <span className="ml-auto shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold tabular-nums text-white ring-1 ring-inset ring-white/30">
              あと{daysUntil(next.data.submitDate, today)}日
            </span>
          </div>
          <div className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {next.data.vol || "号数が未入力"}
            {next.data.title && <span className="ml-3 text-base font-medium text-white/80">{next.data.title}</span>}
          </div>
          <div className="mt-2 text-[15px] leading-relaxed text-white/90">
            入稿 {next.data.submitDate}
            <span className="mx-2 text-white/50">/</span>
            配布開始 {next.data.distributeDate || "未定"}
          </div>
        </div>
      )}

      {/* お店のタブ。全店共通の号は、どのお店にも入っている扱い */}
      {tabs.length > 0 && (
        <div className={`${scrollRow} px-1`}>
          <button className={chip(activeTab === "all")} onClick={() => setTab("all")}>
            すべて
            <span className="tabular-nums opacity-70">{rows.length}</span>
          </button>
          {tabs.map((id) => (
            <button key={id} className={chip(activeTab === id)} onClick={() => setTab(id)}>
              {STORE_LABELS[id]}
              <span className="tabular-nums opacity-70">{countOf(id)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1">
        <button
          className={`${btn("primary")} rounded-full px-6`}
          onClick={() => {
            void add().then((id) => setEditing(id));
          }}
        >
          <Icon name="plus" className="h-4 w-4" />
          号を追加
        </button>
        <span className="text-sm tabular-nums text-stone-400">
          {activeTab === "all" ? `${rows.length}号` : `${STORE_LABELS[activeTab]} ${visible.length}号`}
        </span>
        {saveLabel && (
          <span className={`ml-auto text-xs ${saveState === "error" ? "text-red-600" : "text-stone-400"}`}>
            {saveLabel}
          </span>
        )}
      </div>

      {loading ? (
        <p className="rounded-2xl bg-white p-10 text-center text-sm text-stone-400 shadow-sm">読み込み中…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-10 text-center text-sm leading-relaxed text-stone-500 shadow-sm">
          {rows.length === 0 ? (
            <>
              まだ1号も入っていません。
              <br />
              「号を追加」を押して、号数と配布開始日を入れてください。
            </>
          ) : (
            <>このお店で配る号は、まだ入っていません。</>
          )}
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((row: GrandMenuRow) => {
            const d = row.data;
            const state = issueState(d, today, row.id === currentId);
            const days = daysUntil(d.submitDate, today);
            const open = editing === row.id;
            return (
              <section
                key={row.id}
                className={`overflow-hidden rounded-2xl bg-white shadow-sm sm:rounded-3xl ${
                  state === "current" ? "ring-1 ring-emerald-300" : ""
                }`}
              >
                {/* 畳んだ見出し。号数と絵がいちばん大事なので、ここだけで分かるようにする */}
                <div className="space-y-3 p-5 sm:p-6">
                  {/* スマホでは号数と見出しを縦に積む。横に並べると見出しが「2026年11月…」で切れる */}
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
                      {d.vol || "号数が未入力"}
                    </h3>
                    {d.title && (
                      <span className="min-w-0 text-sm leading-relaxed text-stone-500 sm:flex-1 sm:truncate">
                        {d.title}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <StoreTags stores={d.stores} />
                    <StateBadge state={state} days={days} />
                    {/* 日付が1つも無いときはバッジで足りるので、「未定／未定」は出さない */}
                    {(d.distributeDate || d.submitDate) && (
                      <span className="text-xs tabular-nums text-stone-500">
                        配布 {d.distributeDate || "未定"}
                        <span className="mx-1.5 text-stone-300">/</span>
                        入稿 {d.submitDate || "未定"}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${btn("quiet")} ml-auto`}
                      onClick={() => setEditing(open ? null : row.id)}
                    >
                      {open ? "とじる" : "直す"}
                    </button>
                  </div>

                  <FlyerImages
                    links={d.links}
                    compact
                    onOpen={(i) => setViewer({ id: row.id, index: i })}
                  />

                  {/* 覚え書きは長いことがあるので、畳んだカードでは2行まで。
                      全文は「直す」を押したときの欄で読める */}
                  {!open && d.note && (
                    <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-stone-500">
                      {d.note}
                    </p>
                  )}
                </div>

                {/* 直すときだけ出す入力欄 */}
                {open && (
                  <div className="space-y-4 border-t border-stone-100 bg-stone-50/60 p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="号数" value={d.vol} placeholder="vol.14" onChange={(v) => update(row.id, { vol: v })} />
                      <Field
                        label="見出し"
                        value={d.title}
                        placeholder="2026年2月 グランドメニュー"
                        onChange={(v) => update(row.id, { title: v })}
                      />
                      <Field
                        label="入稿日（印刷所へ渡す日）"
                        type="date"
                        value={d.submitDate}
                        onChange={(v) => update(row.id, { submitDate: v })}
                      />
                      <Field
                        label="配布開始日"
                        type="date"
                        value={d.distributeDate}
                        onChange={(v) => update(row.id, { distributeDate: v })}
                      />
                    </div>

                    <StorePicker
                      stores={d.stores}
                      onChange={(nextStores) =>
                        update(row.id, { stores: nextStores, scope: scopeTextOf(nextStores) })
                      }
                    />

                    <div className="space-y-2">
                      <span className="block text-xs font-medium text-stone-500">
                        チラシの画像（押すと大きく見られます）
                      </span>
                      <FlyerAddPhoto
                        issueId={row.id}
                        vol={d.vol}
                        onAdd={(urls) => update(row.id, { links: [...d.links, ...urls] })}
                      />
                      <FlyerImages
                        links={d.links}
                        onOpen={(i) => setViewer({ id: row.id, index: i })}
                        onRemove={(i) => {
                          if (!confirm("この1枚を外します。よろしいですか？")) return;
                          update(row.id, { links: d.links.filter((_, k) => k !== i) });
                        }}
                      />
                      <input
                        className={field}
                        placeholder="または、置き場所のURLを貼って Enter（PDFなど）"
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const el = e.currentTarget;
                          const v = el.value.trim();
                          if (!v) return;
                          update(row.id, { links: [...d.links, v] });
                          el.value = "";
                        }}
                      />
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-stone-500">変更点・覚え書き</span>
                      <textarea
                        className={`${field} min-h-24 py-2`}
                        value={d.note}
                        placeholder="前の号から変えたところ、表紙の商品など"
                        onChange={(e) => update(row.id, { note: e.target.value })}
                      />
                    </label>

                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <button className={btn("secondary")} onClick={() => setEditing(null)}>
                        入力をとじる
                      </button>
                      <button
                        className={btn("danger")}
                        onClick={() => {
                          if (!confirm(`${d.vol || "この号"}を消します。よろしいですか？`)) return;
                          setEditing(null);
                          void remove(row.id);
                        }}
                      >
                        この号を消す
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className={`px-1 pb-2 ${muted}`}>
        ※号ごとの決めごと（配布日・入稿日）と、配った紙の絵を残しておくための場所です。入稿用の重いデータは Dropbox に置いたまま、ここにはそのリンクを貼ってください。
      </p>

      {viewer &&
        (() => {
          const hit = rows.find((r) => r.id === viewer.id);
          if (!hit || hit.data.links.length === 0) return null;
          return (
            <FlyerViewer
              list={hit.data.links}
              index={Math.min(viewer.index, hit.data.links.length - 1)}
              onClose={() => setViewer(null)}
              onMove={(i) => setViewer({ id: viewer.id, index: i })}
            />
          );
        })()}
    </div>
  );
}
