"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header, ViewId } from "@/components/genba/Header";
import { CheckView } from "@/components/genba/CheckView";
import { SurveyView } from "@/components/genba/SurveyView";
import { SurveyAskView } from "@/components/genba/SurveyAskView";
import { ReportView } from "@/components/genba/ReportView";
import { useGenbaData } from "@/hooks/useGenbaData";
import { CHECK_ITEMS, STORES } from "@/lib/genba/checkItems";
import { useIsClient } from "@/hooks/useIsClient";
import { Visit } from "@/lib/genba/types";


/**
 * 現場チェック（直営店の視察記録・アンケート集計・改善レポート）。
 * 新商品ツールとは別の画面・別のデータで、同じ場所に置いてあるだけ。
 */
export default function GenbaPage() {
  const isClient = useIsClient();
  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fa] text-[#8c9aa8]">
        読み込み中…
      </div>
    );
  }
  return <GenbaShell />;
}

/** URL の末尾（#survey など）で開く画面を決める。現場でアンケートだけ開きたいとき用 */
const VIEW_IDS: ViewId[] = ["check", "survey", "report"];

function viewFromHash(): ViewId {
  if (typeof window === "undefined") return "check";
  const id = window.location.hash.replace("#", "") as ViewId;
  return VIEW_IDS.includes(id) ? id : "check";
}

function GenbaShell() {
  /**
   * 開く画面。#survey / #report を付けたURLを開くと、その画面から始まる。
   * お客様に渡す端末は /genba#survey をホーム画面に置いておけば、
   * 写真の多い現場チェックを通らずにアンケートを開ける。
   */
  const [view, setViewState] = useState<ViewId>(viewFromHash);
  const setView = (next: ViewId) => {
    setViewState(next);
    // 履歴を増やさずにURLだけ合わせる（戻るボタンの邪魔をしない）
    window.history.replaceState(null, "", next === "check" ? window.location.pathname : `#${next}`);
  };
  /** お客様に端末を渡している間は、ほかの画面を出さない */
  const [asking, setAsking] = useState(false);
  const [pickedVisit, setPickedVisit] = useState("");
  const data = useGenbaData();

  /** 選んでいる訪問。消えた場合は先頭に戻す */
  const visitId = data.visits.some((v) => v.id === pickedVisit)
    ? pickedVisit
    : (data.visits[0]?.id ?? "");
  const visit = visitId ? data.getVisit(visitId) : null;
  /** 上の帯に出す日程。追加した訪問から作るので、日程が変わっても直す必要がない */
  const period = (() => {
    if (data.visits.length === 0) return "";
    const fmt = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${y}年 ${Number(m)}月${Number(day)}日`;
    };
    const first = data.visits[0].date;
    const last = data.visits[data.visits.length - 1].date;
    return first === last ? fmt(first) : `${fmt(first)}〜${Number(last.split("-")[1])}月${Number(last.split("-")[2])}日`;
  })();
  /** アンケートは、いま開いている訪問の店舗として記録する */
  const surveyStoreId = visit?.storeId ?? STORES[0].id;

  if (asking) {
    return (
      <SurveyAskView
        storeId={surveyStoreId}
        onChangeStore={() => {}}
        onSubmit={data.addResponse}
        onExit={() => setAsking(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#26313d]">
      <Header
        view={view}
        onChangeView={setView}
        saveState={data.saveState}
        onRetry={data.retrySave}
        period={period}
      />

      <main className="mx-auto max-w-4xl px-4 py-4">
        {!data.shared && !data.loading && (
          <p className="no-print mb-3 rounded-xl border border-[#e0872a] bg-white px-4 py-2.5 text-center text-[12.5px] font-bold text-[#8a5a12]">
            いまは<span className="underline">この端末だけ</span>に保存しています。ほかの端末とは共有されていません。
          </p>
        )}
        {data.loading && (
          <p className="no-print mb-3 rounded-xl border border-[#e3e8ee] bg-white px-4 py-2 text-center text-[12.5px] font-bold text-[#5a6b7c]">
            共有データを読み込んでいます…
          </p>
        )}

        {view === "check" ? (
          <CheckView
            visits={data.visits}
            visitId={visitId}
            onSelectVisit={setPickedVisit}
            onAddVisit={(storeId, date) => setPickedVisit(data.addVisit(storeId, date))}
            onRemoveVisit={(id) => {
              data.removeVisit(id);
              setPickedVisit("");
            }}
            data={visit}
            previous={visitId ? data.previousVisit(visitId) : null}
            onUpdateMemo={(memo) => data.updateMemo(visitId, memo)}
            onUpdateItem={(index, patch, immediate) => data.updateItem(visitId, index, patch, immediate)}
          />
        ) : view === "survey" ? (
          <SurveyView responses={data.responses} onStartAsking={() => setAsking(true)} onDelete={data.deleteResponse} />
        ) : (
          <ReportView visits={data.visits} />
        )}

        <SubmitPanel visits={data.visits} />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------
   報告書を提出（1日の終わりに、その日の記録をPDFで出すパネル）
   ------------------------------------------------------------------ */

const META_KEY = "age3_report_meta";

type Meta = { from: string; to: string; name: string };

const PRIO_LABEL: Record<string, string> = {
  A: "A すぐ対応",
  B: "B 要注意",
  C: "C 中長期",
};

/** 出張の担当者。日付から初期値を入れる（あとから書き換えられる） */
const REPORTER_BY_DATE: { from: string; to: string; name: string }[] = [
  { from: "2026-09-02", to: "2026-09-04", name: "松尾 浩平" },
  { from: "2026-09-07", to: "2026-09-09", name: "川野" },
];

function defaultReporter(date: string): string {
  const hit = REPORTER_BY_DATE.find((r) => date >= r.from && date <= r.to);
  return hit ? hit.name : "";
}

function storeName(storeId: string): string {
  return STORES.find((s) => s.id === storeId)?.name ?? storeId;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(v: unknown): string {
  return esc(v).replace(/\n/g, "<br>");
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  const w = "日月火水木金土".charAt(new Date(`${date}T00:00:00`).getDay());
  return `${y}年${Number(m)}月${Number(d)}日（${w}）`;
}

/** メモの「15:14ー19:00」「9:00〜」などから時間を拾う */
function guessTimes(memo: string): { from: string; to: string } {
  const found = (memo || "").match(/(\d{1,2})\s*[:時]\s*(\d{0,2})/g) || [];
  const pick = (s: string) => {
    const m = s.match(/(\d{1,2})\s*[:時]\s*(\d{0,2})/);
    if (!m) return "";
    return `${`0${m[1]}`.slice(-2)}:${`${m[2] || "00"}00`.slice(0, 2)}`;
  };
  return { from: found[0] ? pick(found[0]) : "", to: found[1] ? pick(found[1]) : "" };
}

function readMeta(): Record<string, Meta> {
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMeta(id: string, meta: Meta) {
  try {
    const all = readMeta();
    all[id] = meta;
    window.localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    /* 保存できなくても報告書は出せるので黙って進む */
  }
}

const PRINT_CSS = `*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;padding:22px;background:#fff;color:#26313D;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;font-size:13px;line-height:1.8}
.w{max-width:820px;margin:0 auto}
.rl{width:52px;height:4px;background:#1F3350;margin-bottom:13px}
h1{font-size:22px;margin:0 0 5px;color:#1F3350;font-weight:800}
.su{font-size:13px;color:#5A6B7C;font-weight:700;margin:0 0 6px}
.mt{font-size:12.5px;color:#3C4A58;margin:0 0 13px}
.mt b{color:#1F3350}
.ks{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:0 0 13px}
.k{background:#FBFCFD;border:1px solid #E3E8EE;border-top:3px solid #1F3350;border-radius:4px;padding:9px 11px}
.k b{font-size:21px;font-weight:800;color:#1F3350;line-height:1.15;display:block}
.k b i{font-size:11px;font-style:normal;margin-left:2px}
.k s{font-size:11px;font-weight:700;text-decoration:none;display:block;margin-top:2px}
.al{border-left:4px solid #C0392B;background:#FDF4F2;padding:9px 13px;margin:0 0 13px;font-size:12px;border-radius:0 4px 4px 0}
.al b{color:#C0392B}
.sh{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid #1F3350;padding-bottom:6px}
.sh em{font-size:17px;font-weight:800;color:#1F3350;font-style:normal}
.sh span{font-size:12px;color:#5A6B7C;font-weight:700}
.sh b{margin-left:auto;font-size:13px;color:#1F3350}
.it{border-bottom:1px solid #EDF1F5;padding:9px 0;break-inside:avoid;page-break-inside:avoid}
.ih{display:flex;align-items:flex-start;gap:9px}
.no{flex:0 0 21px;height:21px;border-radius:50%;background:#1F3350;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}
.tl{font-size:13.5px;font-weight:800;color:#1F3350;line-height:1.45}
.sb{font-size:10.5px;color:#9AA7B3;margin-top:1px;line-height:1.5}
.cs{display:flex;gap:5px;margin:6px 0 0 30px;flex-wrap:wrap}
.cp{font-size:10px;font-weight:800;border-radius:4px;padding:2px 8px;border:1px solid #E3E8EE;color:#B4BEC8;background:#FBFCFD;white-space:nowrap;flex:0 0 auto}
.onA{background:#C0392B;border-color:#C0392B;color:#fff}
.onB{background:#A88700;border-color:#A88700;color:#fff}
.onC{background:#00879B;border-color:#00879B;color:#fff}
.sn{font-size:10px;font-weight:800;border-radius:4px;padding:2px 8px;background:#EAF4EF;color:#2E7D5B;border:1px solid #CBE5D8;white-space:nowrap;flex:0 0 auto}
.sn.no{background:#FDF4F2;color:#C0392B;border-color:#F0CFC8}
.mm{margin:6px 0 0 30px;background:#FBFCFD;border:1px solid #EDF1F5;border-radius:5px;padding:8px 11px;font-size:12px;line-height:1.78;color:#3C4A58}
.mm.em{color:#9AA7B3;background:#fff;border-style:dashed}
.ph{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0 0 30px}
.ph img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:3px;border:1px solid #E3E8EE;display:block;background:#EEF2F6}
.pn{margin:5px 0 0 30px;font-size:10px;color:#9AA7B3}
.wn{font-size:11px;color:#8C9AA8;border:1px dashed #D7DEE6;border-radius:4px;padding:9px 12px;margin:15px 0 0}
.ft{margin-top:13px;padding-top:8px;border-top:1px solid #EDF1F5;font-size:10.5px;color:#9AA7B3;display:flex;justify-content:space-between}
@page{size:A4;margin:12mm 11mm}
@media print{
body{padding:0;font-size:9.6px}
h1{font-size:18px}
.k b{font-size:17px}
.ph{grid-template-columns:repeat(6,1fr)}
.mm{font-size:9.2px;line-height:1.66}
.tl{font-size:10.6px}
.sb{font-size:8.4px}
.cp,.sn{font-size:8.4px}
.no{flex:0 0 17px;height:17px;font-size:9px}
}`;

/** 印刷用のレポートHTMLを組み立てる */
function buildReportHtml(visit: Visit, meta: Meta) {
  const jp = storeName(visit.storeId);
  const title = `${visit.date.replace(/-/g, "")}_${jp}_現場チェック報告`;
  const items = visit.items || [];

  let done = 0;
  let photos = 0;
  let countA = 0;
  let countB = 0;
  const missing: string[] = [];

  items.forEach((it, i) => {
    photos += it?.photos?.length || 0;
    if (it?.done) {
      done += 1;
      if (it.prio === "A") countA += 1;
      if (it.prio === "B") countB += 1;
    } else {
      missing.push(`${i + 1} ${CHECK_ITEMS[i]?.title ?? ""}`);
    }
  });

  const rows = items
    .map((it, i) => {
      const item = CHECK_ITEMS[i];
      const prio = it?.done ? it?.prio || "" : null;
      const seen = it?.done
        ? '<span class="sn">見た</span>'
        : '<span class="sn no">未記録</span>';
      const chips = (["A", "B", "C"] as const)
        .map((k) => `<span class="cp${prio === k ? ` on${k}` : ""}">${PRIO_LABEL[k]}</span>`)
        .join("");
      const all = it?.photos || [];
      const shown = all.filter((p) => p?.url && !/\.heic$/i.test(p.url));
      const imgs = shown.map((p) => `<img src="${esc(p.url)}">`).join("");
      const hidden = all.length - shown.length;
      return `<div class="it">
  <div class="ih"><div class="no">${i + 1}</div>
    <div><div class="tl">${esc(item?.title)}</div><div class="sb">${esc(item?.hint)}</div></div></div>
  <div class="cs">${seen}${chips}</div>
  <div class="mm${it?.memo ? "" : " em"}">${it?.memo ? nl2br(it.memo) : "記録なし"}</div>
  ${imgs ? `<div class="ph">${imgs}</div>` : ""}
  ${all.length ? `<div class="pn">写真 ${all.length}枚${hidden ? `　※うち${hidden}枚はHEIC形式のため画面には表示されません` : ""}</div>` : ""}
</div>`;
    })
    .join("");

  const today = formatDate(new Date().toISOString().slice(0, 10));
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${PRINT_CSS}</style></head><body><div class="w">
<div class="rl"></div>
<h1>現場チェック 実施報告　${esc(jp)}店</h1>
<p class="su">${esc(formatDate(visit.date))}</p>
<p class="mt"><b>業務時間</b>　${esc(meta.from || "—")} 〜 ${esc(meta.to || "—")}　　<b>報告者</b>　${esc(meta.name || "—")}　　<b>提出日</b>　${esc(today)}</p>
<div class="ks">
 <div class="k"><b>${done}<i>/ ${CHECK_ITEMS.length}</i></b><s>記録した項目</s></div>
 <div class="k"><b>${photos}<i>枚</i></b><s>現場写真</s></div>
 <div class="k"><b>${countA}<i>件</i></b><s>A すぐ対応</s></div>
 <div class="k"><b>${countB}<i>件</i></b><s>B 要注意</s></div>
</div>
${missing.length ? `<div class="al"><b>未記録が${missing.length}項目あります</b>　${esc(missing.join("／"))}</div>` : ""}
<div class="sh"><em>${esc(jp)}</em><span>${esc(visit.date)}</span><b>${done} / ${CHECK_ITEMS.length}</b></div>
${rows}
<div class="wn">本レポートは現場チェックの記録を書き出したものです。共有・提出の前に、必ずご自身と上長（松下専務・中嶋会長）の目でご確認ください。</div>
<div class="ft"><span>株式会社ANCHOR ／ Age.3　現場チェック 実施報告</span><span>${esc(jp)}店　${esc(visit.date)}　${esc(meta.name || "")}</span></div>
</div>
<script>
(function(){
  var imgs = Array.prototype.slice.call(document.images);
  var left = imgs.length;
  function go(){ setTimeout(function(){ window.focus(); window.print(); }, 300); }
  if(!left) return go();
  imgs.forEach(function(im){
    if(im.complete){ if(--left<=0) go(); return; }
    im.addEventListener("load", function(){ if(--left<=0) go(); });
    im.addEventListener("error", function(){ if(--left<=0) go(); });
  });
  setTimeout(go, 9000);
})();
<\/script></body></html>`;
  return { title, html, missing };
}

/** LINEに送る本文 */
function buildShareText(visit: Visit, meta: Meta): string {
  const jp = storeName(visit.storeId);
  const items = visit.items || [];
  const lines: string[] = [];
  lines.push(`【現場チェック 実施報告】${jp}店　${formatDate(visit.date)}`);
  lines.push(`業務時間：${meta.from || "—"}〜${meta.to || "—"}　報告者：${meta.name || "—"}`);

  const bucket: Record<string, string[]> = { A: [], B: [], C: [] };
  const missing: string[] = [];
  let done = 0;
  let photos = 0;
  items.forEach((it, i) => {
    photos += it?.photos?.length || 0;
    const label = `${i + 1} ${CHECK_ITEMS[i]?.title ?? ""}`;
    if (!it?.done) {
      missing.push(label);
      return;
    }
    done += 1;
    if (it.prio && bucket[it.prio]) bucket[it.prio].push(label);
  });

  lines.push(`記録 ${done}/${CHECK_ITEMS.length}　写真 ${photos}枚`);
  if (bucket.A.length) lines.push(`■ すぐ対応：\n・${bucket.A.join("\n・")}`);
  if (bucket.B.length) lines.push(`■ 要注意：\n・${bucket.B.join("\n・")}`);
  if (bucket.C.length) lines.push(`■ 中長期：\n・${bucket.C.join("\n・")}`);
  if (missing.length) lines.push(`■ 未記録：\n・${missing.join("\n・")}`);
  items.forEach((it, i) => {
    if (it?.done && it.memo) lines.push(`【${i + 1} ${CHECK_ITEMS[i]?.title ?? ""}】\n${it.memo}`);
  });
  lines.push("※提出前に上長（松下専務・中嶋会長）の確認をお願いします。");
  return lines.join("\n\n");
}

export function SubmitPanel({ visits }: { visits: Visit[] }) {
  const sorted = useMemo(
    () => [...(visits || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [visits]
  );

  const [visitId, setVisitId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const visit = useMemo(() => sorted.find((v) => v.id === visitId) ?? null, [sorted, visitId]);

  /** 一覧が来たら、いちばん新しい訪問を選ぶ */
  useEffect(() => {
    if (!visitId && sorted.length) setVisitId(sorted[0].id);
  }, [sorted, visitId]);

  /** 選んだ訪問に合わせて、時間と名前を入れ直す */
  useEffect(() => {
    if (!visit) return;
    const saved = readMeta()[visit.id];
    const guessed = guessTimes(visit.memo || "");
    setFrom(saved?.from || guessed.from || "");
    setTo(saved?.to || guessed.to || "");
    setName(saved?.name || defaultReporter(visit.date));
    setMessage("");
    setError(false);
  }, [visit]);

  const missing = useMemo(() => {
    if (!visit) return [] as string[];
    return (visit.items || [])
      .map((it, i) => (it?.done ? null : `${i + 1} ${CHECK_ITEMS[i]?.title ?? ""}`))
      .filter((x): x is string => x !== null);
  }, [visit]);

  const doneCount = useMemo(
    () => (visit?.items || []).filter((it) => it?.done).length,
    [visit]
  );

  const keep = useCallback(() => {
    if (visit) writeMeta(visit.id, { from, to, name });
  }, [visit, from, to, name]);

  const requireName = useCallback(() => {
    if (name.trim()) return false;
    setError(true);
    setMessage("お名前を入れてください。");
    return true;
  }, [name]);

  const onPdf = useCallback(() => {
    if (!visit || requireName()) return;
    keep();
    const { title, html } = buildReportHtml(visit, { from, to, name });
    const w = window.open("", "_blank");
    if (!w) {
      setError(true);
      setMessage("ポップアップがブロックされました。許可してからもう一度押してください。");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setError(false);
    setMessage(`「${title}.pdf」として保存できます。`);
  }, [visit, from, to, name, keep, requireName]);

  const onLine = useCallback(() => {
    if (!visit || requireName()) return;
    keep();
    const text = buildShareText(visit, { from, to, name });
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank");
    setError(false);
    setMessage("LINEを開きました。送り先を選んでください。");
  }, [visit, from, to, name, keep, requireName]);

  if (!sorted.length) return null;

  const field =
    "w-full rounded-lg border border-[#cfd8e1] bg-white px-3 py-2.5 text-[14px] text-[#26313d] outline-none focus:border-[#1f3350]";
  const label = "mb-1 block text-[11.5px] font-bold text-[#5a6b7c]";

  return (
    <section className="no-print mt-5 mb-8 rounded-2xl border border-[#e3e8ee] bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-[#1f3350]">報告書を提出</h2>
      <p className="mt-0.5 mb-3 text-[11.5px] leading-relaxed text-[#8c9aa8]">
        日と店舗を選び、時間とお名前を入れてください。誰が使っても同じ書式のPDFになります。
      </p>

      <label className={label} htmlFor="submit-visit">
        日付・店舗
      </label>
      <select
        id="submit-visit"
        className={`${field} mb-2.5`}
        value={visitId}
        onChange={(e) => setVisitId(e.target.value)}
      >
        {sorted.map((v) => (
          <option key={v.id} value={v.id}>
            {storeName(v.storeId)}　{v.date}（{(v.items || []).filter((it) => it?.done).length}/
            {CHECK_ITEMS.length}）
          </option>
        ))}
      </select>

      <label className={label} htmlFor="submit-from">
        業務時間
      </label>
      <div className="mb-2.5 flex items-center gap-2">
        <input
          id="submit-from"
          type="time"
          className={field}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={keep}
        />
        <span className="text-[#8c9aa8]">〜</span>
        <input
          type="time"
          aria-label="終了時刻"
          className={field}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={keep}
        />
      </div>

      <label className={label} htmlFor="submit-name">
        報告者
      </label>
      <input
        id="submit-name"
        type="text"
        placeholder="お名前"
        className={`${field} mb-3`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={keep}
      />

      {missing.length > 0 && (
        <div className="mb-3 rounded-r-lg border-l-4 border-[#c0392b] bg-[#fdf4f2] px-3 py-2.5 text-[12px] leading-relaxed text-[#c0392b]">
          <b>チェックされていない項目が{missing.length}つあります</b>
          <br />
          {missing.join("／")}
          <br />
          このまま提出もできます。
        </div>
      )}

      <button
        type="button"
        onClick={onPdf}
        className="w-full rounded-lg bg-[#1f3350] px-4 py-3.5 text-[15px] font-extrabold text-white active:opacity-80"
      >
        PDFで保存する
      </button>
      <button
        type="button"
        onClick={onLine}
        className="mt-2 w-full rounded-lg bg-[#06c755] px-4 py-3 text-[14px] font-extrabold text-white active:opacity-80"
      >
        LINEに送る
      </button>

      <p
        className={`mt-2 text-[11.5px] leading-relaxed ${error ? "text-[#c0392b]" : "text-[#8c9aa8]"}`}
      >
        {message ||
          `${doneCount}/${CHECK_ITEMS.length}項目・写真${(visit?.items || []).reduce((n, it) => n + (it?.photos?.length || 0), 0)}枚。PDFは印刷画面から「PDFに保存」で保存します。「背景のグラフィック」にチェックを入れてください。`}
      </p>
    </section>
  );
}
