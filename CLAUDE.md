@AGENTS.md

# Age.3 新商品ツール — 引き継ぎメモ

新しいセッションで作業を頼まれたら、まずここを読むこと。
毎回ゼロから聞き直さないための共有メモ。

## これは何か

揚げサンドの新商品1つ分の「商品情報シート」と「準備タスク（A-1／G-1〜G-5）」を
チームで共有するための社内ツール。作ったのは Claude（松尾さんとの作業）。

- 公開URL: https://age3-shinshohin-tool-theta.vercel.app/
- リポジトリ: https://github.com/klobal001-glitch/age3-shinshohin-tool
- 公開の流れ: main にコミット → Vercel が自動デプロイ（手動の作業は不要）
- データ: Supabase の共有DB（products / product_info / task_state）。
  端末ごとの保存ではなく、チーム全員が同じデータを見る。
  環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY。
- Next.js 16 + React 19 + Tailwind v4。ローカル確認は `npm run dev`。

## 画面の構成

| ファイル | 役割 |
| --- | --- |
| `src/components/Sidebar.tsx` | 左の商品リスト（検索・ジャンル別・入力率） |
| `src/components/ProductSheetView.tsx` | 商品情報シート（入力の本体） |
| `src/components/PrepTaskView.tsx` | 準備タスク（締め切りは発売月から自動計算） |
| `src/components/VisualGalleryView.tsx` | ビジュアル一覧 |
| `src/hooks/useAppData.ts` | Supabase の読み書き。入力は600ms止まったらまとめて保存 |
| `src/lib/productInfo.ts` | 入力率の数え方・価格の自動計算（Uber = 元価格 ×1.4） |
| `src/lib/prepTasks.ts` `src/lib/deadline.ts` | タスク定義と締め切りルール |

## 見た目の約束（勝手に変えないこと）

2026年8月に「メルカリ風のすっきりした案」を出したが、**現行の見た目のままがよい**
という結論になった。配色・フォント・カードの形・絵文字の見出しは維持する。
変えていいのは「入力の手数を減らすところ」だけ。

- 背景 `#f4ede4` ／ ヘッダー `#4a2f1f` ／ アクセント amber ／ 文字 stone
- フォントは指定なし（Arial, Helvetica, sans-serif）
- セクション見出しは番号＋絵文字（1 🧾 / 2 🥘 / 3 👩‍🍳 / 4 🖼️ / 5 📣）

## 入力まわりの決めごと

- 材料は表。`Tab` で右のセル、最後の行で `Enter` を押すと行が増える
- ビジュアルのリンクは、枠にURLを貼って `Enter` で登録
- 必須項目の左の点は 未入力＝赤／入力済み＝緑
- 「次の未入力へ」で空いている必須項目にジャンプ、「未入力だけ表示」で絞り込み
- 右上に「保存中…→ 保存しました」を出す（`useAppData` の `saveState`）

## 作業のしかた

- 松尾さんは iMac と MacBook を使い分ける。作業はクラウド側で完結するので、
  どちらのMacかは気にしなくてよい。ローカルのファイルを触りに行く必要はない。
- 変更は必ず `npm run build` と `npx eslint` を通してからコミットする。
- 締め切りの計算ルール・項目の増減は業務に直結する。勝手に変えず、必ず確認する。
