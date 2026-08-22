"use client";

export default function HelpView() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-stone-800">使い方</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-600">
          <li>「🏠 メニュー」で商品を選ぶ（新商品は「＋ 商品を追加」）。</li>
          <li>「📝 商品情報シート」で品名・価格・材料・SNS文章などを入力する。</li>
          <li>「✅ 準備タスク」で発売月を設定すると、A-1〜G-5の締め切りが自動計算される。各タスクをチェックして進捗を管理する。</li>
          <li>「🖼 ビジュアル一覧」で全商品の発売時期・ジャンルを俯瞰できる。カードをクリックすると商品情報シートに飛ぶ。</li>
          <li>入力・チェックはこの端末のブラウザに自動保存されます。別の端末では表示されないため、共有が必要な場合は「コピー用に書き出し」や印刷（PDF）をご利用ください。</li>
        </ol>
      </div>
      <div className="rounded-xl border border-amber-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-stone-800">締め切りの計算方法</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          「前々月」は発売月の2か月前、「前月」は発売月の1か月前を指します。各グループの締め切りは、
          その月の決まった日付（例：前々月28日、前月20日など）として計算しています。G-5「販売終了後」のみ、
          「販売終了月」の月末が締め切りになります。
        </p>
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-stone-500">
        ※本ツールは社内の準備業務を管理するための下書き・目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
