"use client";

import { useAppData } from "@/hooks/useAppData";
import { TabKey } from "./Header";
import ProductPicker from "./ProductPicker";

export default function MenuView({
  app,
  onNavigate,
}: {
  app: ReturnType<typeof useAppData>;
  onNavigate: (t: TabKey) => void;
}) {
  const cards: { tab: TabKey; icon: string; title: string; desc: string }[] = [
    {
      tab: "sheet",
      icon: "📝",
      title: "商品情報シート",
      desc: "品名・紹介文・材料・価格・ビジュアルDL・SNS/PR文章など、1商品に必要な情報を空欄から埋めていく入力シート。",
    },
    {
      tab: "tasks",
      icon: "✅",
      title: "準備タスク（G-1〜G-5）",
      desc: "撮影・PR TIMES・広告・海外FC・販売終了まで。発売月から締め切りを自動計算していく進行表。",
    },
    {
      tab: "gallery",
      icon: "🖼",
      title: "ビジュアル一覧",
      desc: "各商品のInstagram1枚目をまとめて一覧。クリックでその商品の情報シートを開きます。",
    },
  ];

  return (
    <div className="space-y-4">
      <ProductPicker app={app} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-stone-500">② 使うものを選んでください</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <button
              key={c.tab}
              onClick={() => onNavigate(c.tab)}
              className="rounded-xl border border-amber-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md hover:border-amber-400"
            >
              <div className="text-2xl">{c.icon}</div>
              <div className="mt-2 font-semibold text-stone-800">{c.title}</div>
              <p className="mt-1 text-sm text-stone-500">{c.desc}</p>
              <div className="mt-3 text-sm font-medium text-amber-700">開く →</div>
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-stone-500">
        ※各シートは情報を集める・進行を管理するための下書き／目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。入力・チェックはこの端末に自動保存されます。
      </p>
    </div>
  );
}
