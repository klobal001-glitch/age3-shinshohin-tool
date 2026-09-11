import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Age.3 新商品シート",
  description: "商品情報シート・準備タスク・ビジュアル一覧をまとめて管理する社内ツール",
};

/**
 * スマホ向けの表示設定。
 * - themeColor … iOS/Android でブラウザの上下の帯をヘッダーと同じ茶色にする
 * - viewportFit … ホーム画面から開いたとき、画面の端まで描画してよいことを伝える
 *                 （下端のホームバーとの間隔は .pb-safe で空けている）
 */
export const viewport: Viewport = {
  themeColor: "#4a2f1f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
