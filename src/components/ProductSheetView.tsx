"use client";

import { useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import ProductPicker from "./ProductPicker";
import {
  UBER_RATE,
  autoUberPrice,
  effectiveUberPrice,
  formatYen,
  ingredientsProgress,
  optionalProgress,
  parsePriceInput,
  requiredProgress,
} from "@/lib/productInfo";
import { GENRE_LABELS } from "@/lib/types";

function Section({
  icon,
  title,
  progress,
  children,
}: {
  icon: string;
  title: string;
  progress?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-stone-800">
          <span>{icon}</span>
          {title}
        </h3>
        {progress && <span className="text-xs text-stone-400">{progress}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-600">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-stone-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

/** 「¥」を左に固定した数値専用の価格入力欄 */
function PriceInput({
  value,
  placeholder,
  muted,
  onChange,
}: {
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

/** 元価格＋そのUber価格（自動計算）のセット */
function PriceBlock({
  label,
  base,
  uber,
  onBase,
  onUber,
}: {
  label: string;
  base: number | null;
  uber: number | null;
  onBase: (v: number | null) => void;
  onUber: (v: number | null) => void;
}) {
  const auto = autoUberPrice(base);
  const isManual = uber !== null;

  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <Field label={label}>
        <PriceInput value={base} placeholder="950" onChange={onBase} />
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

export default function ProductSheetView({ app }: { app: ReturnType<typeof useAppData> }) {
  const { selectedProduct, getInfo, updateInfo, resetProductInfo } = app;
  const [copyMsg, setCopyMsg] = useState("");

  if (!selectedProduct) {
    return <ProductPicker app={app} />;
  }

  const info = getInfo(selectedProduct.id);
  const req = requiredProgress(info);
  const opt = optionalProgress(info);
  const ing = ingredientsProgress(info);

  const patch = (p: Partial<typeof info>) => updateInfo(selectedProduct.id, p);

  const updateIngredient = (idx: number, patchRow: Partial<(typeof info.ingredients)[number]>) => {
    const next = info.ingredients.map((row, i) => (i === idx ? { ...row, ...patchRow } : row));
    patch({ ingredients: next });
  };

  const addIngredient = () =>
    patch({ ingredients: [...info.ingredients, { nameJa: "", nameEn: "", amount: "", specs: [] }] });

  const removeIngredient = (idx: number) =>
    patch({ ingredients: info.ingredients.filter((_, i) => i !== idx) });

  const updateVisual = (key: string, links: string[]) => {
    patch({
      visualDownloads: info.visualDownloads.map((v) => (v.key === key ? { ...v, links } : v)),
    });
  };

  const buildExportText = () => {
    const lines = [
      `【${info.nameJa || selectedProduct.name}】`,
      `ジャンル：${selectedProduct.genre ? GENRE_LABELS[selectedProduct.genre] : "（指定なし）"}`,
      `発売日：${info.releaseDate || "―"}　販売終了日：${info.endDate || "―"}`,
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

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="print:hidden">
        <ProductPicker app={app} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
            必須 {req.filled}/{req.total}（{req.total ? Math.round((req.filled / req.total) * 100) : 0}%）
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
            任意 {opt.filled}/{opt.total}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
            材料 {ing.filled}/{ing.total}件
          </span>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          必須が揃うと100%です。詳細スペック・使用材料＋手順・各ビジュアルDL・SNS/PR文面などの「任意」は、空でもOKです。
        </p>
      </div>

      <Section icon="🧾" title="基本データ">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NOアルコール・NOポーク">
            <div className="flex gap-2">
              <button
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
          <Field label="品名（日本語）">
            <input className={inputCls} value={info.nameJa} onChange={(e) => patch({ nameJa: e.target.value })} />
          </Field>
          <Field label="発売日">
            <input
              type="date"
              className={inputCls}
              value={info.releaseDate}
              onChange={(e) => patch({ releaseDate: e.target.value })}
            />
          </Field>
          <Field label="販売終了日">
            <input
              type="date"
              className={inputCls}
              value={info.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </Field>
          <Field label="英語（品名）" hint="担当AIが記入・空欄でOK">
            <input className={inputCls} value={info.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} />
          </Field>
        </div>
        <Field label="紹介文（日本語）">
          <textarea
            rows={2}
            className={inputCls}
            value={info.descriptionJa}
            onChange={(e) => patch({ descriptionJa: e.target.value })}
          />
        </Field>
        <Field label="英語（紹介文）" hint="担当AIが記入・空欄でOK">
          <textarea
            rows={2}
            className={inputCls}
            value={info.descriptionEn}
            onChange={(e) => patch({ descriptionEn: e.target.value })}
          />
        </Field>
        <Field label="Instagram投稿文（日本語・全角140字以内）" hint={`${info.instagramPost.length} / 140`}>
          <textarea
            rows={3}
            maxLength={140}
            className={inputCls}
            value={info.instagramPost}
            onChange={(e) => patch({ instagramPost: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <PriceBlock
            label="販売価格（銀座・原宿・浅草・飛騨高山／税込）"
            base={info.priceTokyo}
            uber={info.priceTokyoUber}
            onBase={(v) => patch({ priceTokyo: v })}
            onUber={(v) => patch({ priceTokyoUber: v })}
          />
          <PriceBlock
            label="販売価格（嘉麻／税込）"
            base={info.priceKama}
            uber={info.priceKamaUber}
            onBase={(v) => patch({ priceKama: v })}
            onUber={(v) => patch({ priceKamaUber: v })}
          />
        </div>
      </Section>

      <Section icon="🥘" title="材料（ingredients）" progress={`${ing.filled}/${ing.total}（登録${info.ingredients.length}件）`}>
        <p className="text-xs text-stone-400">
          品目ごとに「品名・分量・詳細スペック（商品名/メーカー/原材料/アレルゲン等）」を入れます。「＋材料を追加」で増やせます。
        </p>
        {info.ingredients.map((row, idx) => (
          <div key={idx} className="rounded-lg border border-stone-200 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-stone-600">
              材料 {idx + 1}
              <button className="text-xs text-red-500 hover:underline" onClick={() => removeIngredient(idx)}>
                削除
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="品名（日本語）">
                <input
                  className={inputCls}
                  value={row.nameJa}
                  onChange={(e) => updateIngredient(idx, { nameJa: e.target.value })}
                />
              </Field>
              <Field label="品名（英語）">
                <input
                  className={inputCls}
                  value={row.nameEn}
                  onChange={(e) => updateIngredient(idx, { nameEn: e.target.value })}
                />
              </Field>
              <Field label="分量">
                <input
                  className={inputCls}
                  value={row.amount}
                  onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                />
              </Field>
            </div>
            <button
              className="mt-2 text-xs text-amber-700 hover:underline"
              onClick={() => updateIngredient(idx, { specs: [...row.specs, ""] })}
            >
              ＋ 詳細スペックを追加（任意）
            </button>
            {row.specs.map((s, si) => (
              <input
                key={si}
                className={`${inputCls} mt-2`}
                value={s}
                placeholder="商品名/メーカー/原材料/アレルゲン等"
                onChange={(e) => {
                  const specs = row.specs.map((v, i) => (i === si ? e.target.value : v));
                  updateIngredient(idx, { specs });
                }}
              />
            ))}
          </div>
        ))}
        <button
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          onClick={addIngredient}
        >
          ＋ 材料を追加
        </button>
      </Section>

      <Section icon="👩‍🍳" title="作り方（How to make）">
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
          <textarea
            rows={2}
            className={inputCls}
            value={info.recipeNotes}
            onChange={(e) => patch({ recipeNotes: e.target.value })}
          />
        </Field>
      </Section>

      <Section icon="🖼️" title="ビジュアルダウンロード（各サイズ）">
        <p className="text-xs text-stone-400">
          各サイズのデータ置き場（Dropbox / Google Drive など）のリンクを貼ります。
        </p>
        {info.visualDownloads.map((v) => (
          <div key={v.key} className="rounded-lg border border-stone-200 p-3">
            <div className="mb-1 text-sm font-medium text-stone-600">
              {v.label} {v.size && <span className="text-xs text-stone-400">（{v.size}）</span>}
            </div>
            {v.links.map((l, li) => (
              <input
                key={li}
                className={`${inputCls} mb-2`}
                placeholder="https://..."
                value={l}
                onChange={(e) => {
                  const links = v.links.map((x, i) => (i === li ? e.target.value : x));
                  updateVisual(v.key, links);
                }}
              />
            ))}
            <button
              className="text-xs text-amber-700 hover:underline"
              onClick={() => updateVisual(v.key, [...v.links, ""])}
            >
              ＋ リンクを追加
            </button>
          </div>
        ))}
      </Section>

      <Section icon="📣" title="紹介文各種（SNS・PR）">
        <Field label="Instagram 投稿文章（本文＋ハッシュタグ）">
          <textarea rows={3} className={inputCls} value={info.igCaption} onChange={(e) => patch({ igCaption: e.target.value })} />
        </Field>
        <Field label="X（旧Twitter）文章">
          <textarea rows={2} className={inputCls} value={info.xCaption} onChange={(e) => patch({ xCaption: e.target.value })} />
        </Field>
        <Field label="Threads 文章">
          <textarea rows={2} className={inputCls} value={info.threadsCaption} onChange={(e) => patch({ threadsCaption: e.target.value })} />
        </Field>
        <Field label="取引先・関係者への一斉メール（件名＋本文）">
          <textarea rows={3} className={inputCls} value={info.pressEmail} onChange={(e) => patch({ pressEmail: e.target.value })} />
        </Field>
        <Field label="PR TIMES 記事URL">
          <input className={inputCls} value={info.prTimesUrl} onChange={(e) => patch({ prTimesUrl: e.target.value })} />
        </Field>
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
        ※これは「1商品に必要な情報一式」を集めるための入力式の下書きシートです。入力内容はこの端末に自動保存され、「コピー用に書き出し」でスプレッドシートやメールに貼れます。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
