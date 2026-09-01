"use client";

import { useState } from "react";
import { Header, ViewId } from "@/components/genba/Header";
import { CheckView } from "@/components/genba/CheckView";
import { SurveyView } from "@/components/genba/SurveyView";
import { SurveyAskView } from "@/components/genba/SurveyAskView";
import { ReportView } from "@/components/genba/ReportView";
import { useGenbaData } from "@/hooks/useGenbaData";
import { STORES } from "@/lib/genba/checkItems";
import { useIsClient } from "@/hooks/useIsClient";


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

function GenbaShell() {
  const [view, setView] = useState<ViewId>("check");
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
      </main>
    </div>
  );
}
