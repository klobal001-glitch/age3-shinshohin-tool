import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Age.3 新商品ツール",
  description: "商品情報シート・準備タスク・ビジュアル一覧をまとめて管理する社内ツール",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
