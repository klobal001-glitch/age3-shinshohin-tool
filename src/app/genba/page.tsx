"use client";

import { useState } from "react";
import { Header, ViewId } from "@/components/genba/Header";
import { CheckView } from "@/components/genba/CheckView";
import { SurveyView } from "@/components/genba/SurveyView";
import { ReportView } from "@/components/genba/ReportView";
import { useGenbaData } from "@/hooks/useGenbaData";
import { useIsClient } from "@/hooks/useIsClient";
import { STORES, countDone } from "@/lib/genba/checkItems";

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
  const [storeId, setStoreId] = useState(STORES[0].id);
  const data = useGenbaData();

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#26313d]">
      <Header view={view} onChangeView={setView} saveState={data.saveState} onRetry={data.retrySave} />

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
            storeId={storeId}
            onChangeStore={setStoreId}
            data={data.getStore(storeId)}
            getDone={(id) => countDone(data.getStore(id))}
            onUpdateStore={(patch) => data.updateStore(storeId, patch)}
            onUpdateItem={(index, patch, immediate) => data.updateItem(storeId, index, patch, immediate)}
          />
        ) : view === "survey" ? (
          <SurveyView responses={data.responses} onAdd={data.addResponse} onDelete={data.deleteResponse} />
        ) : (
          <ReportView storeMap={data.storeMap} />
        )}
      </main>
    </div>
  );
}
