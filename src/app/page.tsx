"use client";

import { useEffect, useState } from "react";
import Header, { TabKey } from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MenuView from "@/components/MenuView";
import ProductSheetView from "@/components/ProductSheetView";
import PrepTaskView from "@/components/PrepTaskView";
import VisualGalleryView from "@/components/VisualGalleryView";
import HelpView from "@/components/HelpView";
import ProductSwitcher, { useRecentProducts } from "@/components/ProductSwitcher";
import { useAppData } from "@/hooks/useAppData";
import { useIsClient } from "@/hooks/useIsClient";

export default function Home() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-stone-400">
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
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const app = useAppData();
  const { push } = useRecentProducts();

  /* どこから選ばれても「最近開いた商品」に残す */
  const selectedId = app.selectedId;
  useEffect(() => {
    if (selectedId) push(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const openSwitcher = () => setSwitcherOpen(true);

  return (
    <div className="flex min-h-screen bg-canvas md:h-screen md:overflow-hidden">
      <Sidebar app={app} activeTab={tab} onChangeTab={setTab} />
      <div className="flex min-w-0 flex-1 flex-col md:overflow-y-auto">
        <div className="md:hidden">
          <Header
            activeTab={tab}
            onChangeTab={setTab}
            productName={app.selectedProduct?.name}
            onOpenSwitcher={openSwitcher}
          />
        </div>
        {/* スマホは下端のタブに隠れないよう、本文の下に余白を足す */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:pb-6">
          {tab === "menu" && <MenuView app={app} onNavigate={setTab} />}
          {tab === "sheet" && <ProductSheetView app={app} onOpenSwitcher={openSwitcher} />}
          {tab === "tasks" && <PrepTaskView app={app} onOpenSwitcher={openSwitcher} />}
          {tab === "gallery" && <VisualGalleryView app={app} onNavigate={setTab} />}
          {tab === "help" && <HelpView />}
        </main>
      </div>

      {switcherOpen && <ProductSwitcher app={app} onClose={() => setSwitcherOpen(false)} />}
    </div>
  );
}
