import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Age.3 商品データベース",
  description: "揚げサンドの商品情報・準備タスク・ビジュアルを、直営店で共有するための社内データベース",
};

/**
 * スマホ向けの表示設定。
 * - themeColor … iOS/Android でブラウザの上下の帯を、画面の地と同じ色にする
 * - viewportFit … ホーム画面から開いたとき、画面の端まで描画してよいことを伝える
 *                 （下端のホームバーとの間隔は .pb-safe で空けている）
 */
export const viewport: Viewport = {
  themeColor: "#fbfaf9",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
