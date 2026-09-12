"use client";

import { card, h3, muted } from "@/lib/ui";

export default function HelpView() {
  return (
    <div className="space-y-4">
      <div className={`${card} p-5`}>
        <h2 className={`mb-3 ${h3}`}>使い方</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-600">
          <li>「🏠 メニュー」で商品を選ぶ（新商品は「＋ 商品を追加」）。スマホでは画面の下に並んだタブで切り替えます。</li>
          <li>「📝 商品情報シート」で品名・価格・材料・SNS文章などを入力する。</li>
          <li>「✅ 準備タスク」で発売月を設定すると、A-1〜G-5の締め切りが自動計算される。各タスクをチェックして進捗を管理する。</li>
          <li>「🖼 ビジュアル一覧」で全商品の発売時期・ジャンルを俯瞰できる。カードを押すと商品情報シートに飛ぶ。</li>
          <li>入力・チェックは共有データベースに自動保存されます。チーム全員が同じ内容を見るので、別の端末で開いても続きから作業できます。</li>
        </ol>
      </div>
      <div className={`${card} p-5`}>
        <h2 className={`mb-3 ${h3}`}>商品名の書き方（産地名）</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          産地をうたう商品は、<strong className="font-semibold text-stone-800">産地名を品名の前に置きます。</strong>
          「シナモンアップルパイ（青森県）」ではなく「青森県 シナモンアップルパイ」の形です。
          産地名と品名の間は全角スペースを1つ空けます。
        </p>
        <ul className="mt-2 space-y-1 pl-5 text-sm text-stone-600 list-disc">
          <li>青森県 シナモンアップルパイ</li>
          <li>石川県 旨だれ牛カルビ焼肉</li>
          <li>宮崎県 チキン南蛮</li>
          <li>北海道 炙りチーズサーモン（スモークサーモン）</li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          産地ではない補足（原料の種類・店舗限定など）は、これまでどおり品名のうしろに括弧で付けます。
          上の例の「（スモークサーモン）」や「（茅ヶ崎限定）」がこれにあたります。
        </p>
        <p className={`mt-2 ${muted}`}>
          この表記は「商品名マスタ（2026年10月1日適用・全店改変）」に合わせたものです。
          迷ったときはマスタの表記が正になります。
        </p>
      </div>
      <div className={`${card} p-5`}>
        <h2 className={`mb-3 ${h3}`}>作らないものがあるとき</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          ポスターやパネルは、商品によっては作らない店舗があります。準備タスクの
          「制作・入稿」が並ぶ項目には
          <strong className="font-semibold text-stone-800">「今回は作らない」</strong>
          が付いていて、押すとその項目は<strong className="font-semibold text-stone-800">進捗の分母から外れます。</strong>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          たとえば原宿ポスターを作らない回は、68件が66件になり、残りを全部チェックすれば100%になります。
          作らないものが未完了として残り続けないので、遅れの数字が実態と合います。「作る に戻す」でいつでも元に戻せます。
        </p>
        <p className={`mt-2 ${muted}`}>
          この設定は商品ごとです。別の商品の同じポスターには影響しません。
        </p>
      </div>
      <div className={`${card} p-5`}>
        <h2 className={`mb-3 ${h3}`}>ビジュアル一覧の見方</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          ますに出しているのは
          <strong className="font-semibold text-stone-800">Instagramフィード投稿画像</strong>
          です。無ければ商品画像（背景なし）、それも無ければ登録済みの他のビジュアルを出します。
          ますを押すと全画面で開き、
          <strong className="font-semibold text-stone-800">左右にスワイプ（PCは ← → キー）</strong>
          で次の商品に移れます。下にスワイプするか Esc で閉じます。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          いちばん下の細い線は、その商品のビジュアルがどこまで揃っているかです。全部そろうと緑になります。
          上の丸い列はこれから発売する商品で、
          <strong className="font-semibold text-stone-800">橙の輪が付いているものはビジュアルがまだ足りません。</strong>
        </p>
      </div>
      <div className={`${card} p-5`}>
        <h2 className={`mb-3 ${h3}`}>締め切りの計算方法</h2>
        <p className="text-sm leading-relaxed text-stone-600">
          「前々月」は発売月の2か月前、「前月」は発売月の1か月前を指します。各グループの締め切りは、
          その月の決まった日付（例：前々月28日、前月20日など）として計算しています。G-5「販売終了後」のみ、
          「販売終了月」の月末が締め切りになります。
        </p>
      </div>
      <p className={`rounded-lg bg-amber-50 p-3 ${muted}`}>
        ※本ツールは社内の準備業務を管理するための下書き・目安です。掲示・入稿・配信・展開の前に、必ずご自身と上長の目でご確認ください。
      </p>
    </div>
  );
}
