"use client";

import { useState } from "react";
import Header, { TabKey } from "@/components/Header";
import MenuView from "@/components/MenuView";
import ProductSheetView from "@/components/ProductSheetView";
import PrepTaskView from "@/components/PrepTaskView";
import VisualGalleryView from "@/components/VisualGalleryView";
import HelpView from "@/components/HelpView";
import { useAppData } from "@/hooks/useAppData";
import { useIsClient } from "@/hooks/useIsClient";

export default function Home() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4ede4] text-stone-400">
        読み込み中…
      </div>
    );
  }

  return <AppShell />;
}

// useAppData は localStorage を直接読む lazy initializer を使うため、
// クライアントであることが確定した後にのみマウントされる必要がある。
function AppShell() {
  const [tab, setTab] = useState<TabKey>("menu");
  const app = useAppData();

  return (
    <div className="min-h-screen bg-[#f4ede4]">
      <Header activeTab={tab} onChangeTab={setTab} productName={app.selectedProduct?.name} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "menu" && <MenuView app={app} onNavigate={setTab} />}
        {tab === "sheet" && <ProductSheetView app={app} />}
        {tab === "tasks" && <PrepTaskView app={app} />}
        {tab === "gallery" && <VisualGalleryView app={app} onNavigate={setTab} />}
        {tab === "help" && <HelpView />}
      </main>
    </div>
  );
}
