"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { GENRE_LABELS, Genre } from "@/lib/types";
import { infoFillRate } from "@/lib/stats";
import { TabKey } from "./Header";
import Age3Logo from "@/components/Age3Logo";

const NAV: { key: TabKey; icon: string; label: string }[] = [
  { key: "menu", icon: "🏠", label: "メニュー" },
  { key: "sheet", icon: "📝", label: "情報シート" },
  { key: "tasks", icon: "✅", label: "準備タスク" },
  { key: "gallery", icon: "🖼", label: "ビジュアル" },
];

const GENRE_ORDER: Genre[] = [
  "regular_sweet",
  "regular_savory",
  "sweets_sand",
  "fruit_sand",
  "single",
  "shop_limited",
  "season",
  null,
];

function genreLabel(g: Genre) {
  return g ? GENRE_LABELS[g] : "未分類";
}

function fillDotColor(pct: number) {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-stone-300";
}

export default function Sidebar({
  app,
  activeTab,
  onChangeTab,
}: {
  app: ReturnType<typeof useAppData>;
  activeTab: TabKey;
  onChangeTab: (t: TabKey) => void;
}) {
  const { products, selectedId, setSelectedId, getInfo, addProduct } = app;
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  /** 廃盤は普段は隠す。現行の商品だけに集中できるようにするため */
  const [showDiscontinued, setShowDiscontinued] = useState(false);

  /** 現行の商品（ジャンル別）と、廃盤の商品を分けて持つ */
  const { grouped, retired } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

    const live = filtered.filter((p) => !getInfo(p.id).discontinued);
    const gone = filtered.filter((p) => getInfo(p.id).discontinued);

    const map = new Map<Genre, typeof products>();
    for (const g of GENRE_ORDER) map.set(g, []);
    for (const p of live) {
      const key = GENRE_ORDER.includes(p.genre) ? p.genre : null;
      map.get(key)!.push(p);
    }
    return {
      grouped: GENRE_ORDER.map((g) => ({ genre: g, items: map.get(g) ?? [] })).filter(
        (section) => section.items.length > 0
      ),
      retired: gone,
    };
  }, [products, query, getInfo]);

  const submitAdd = () => {
    if (!newName.trim()) return;
    const id = addProduct(newName.trim(), null);
    setSelectedId(id);
    setNewName("");
    setAdding(false);
  };

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-amber-900/10 bg-[#f4ede4] md:flex">
      <div className="bg-[#4a2f1f] px-4 py-4 text-amber-50">
        <Age3Logo className="h-7 w-auto" />
        <h1 className="mt-2.5 text-base font-bold leading-tight">新商品ツール</h1>
        <p className="truncate text-[11px] text-amber-200/80">揚サンド直営共有</p>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            🔍
          </span>
          <input
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-amber-500 focus:outline-none"
            placeholder="商品を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <nav className="grid grid-cols-4 gap-1 px-3 pb-3 pt-3">
        {NAV.map((t) => (
          <button
            key={t.key}
            onClick={() => onChangeTab(t.key)}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition ${
              activeTab === t.key
                ? "bg-white text-amber-900 shadow-sm"
                : "text-stone-500 hover:bg-white/60"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-[10px] font-medium leading-none">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {grouped.length === 0 && retired.length === 0 && (
          <p className="px-1 py-4 text-xs text-stone-400">該当する商品がありません。</p>
        )}
        {grouped.map(({ genre, items }) => (
          <div key={genre ?? "none"} className="mb-3">
            <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              {genreLabel(genre)}
            </div>
            <ul>
              {items.map((p) => {
                const pct = infoFillRate(getInfo(p.id), p.genre);
                const active = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        active ? "bg-amber-700 text-white" : "text-stone-700 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          active ? "bg-white" : fillDotColor(pct)
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className={`shrink-0 text-[11px] ${active ? "text-amber-100" : "text-stone-400"}`}>
                        {pct}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {retired.length > 0 && (
          <div className="mb-3">
            <button
              className="mb-1 flex w-full items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-600"
              onClick={() => setShowDiscontinued((v) => !v)}
            >
              <span aria-hidden>{showDiscontinued ? "▾" : "▸"}</span>
              廃盤 {retired.length}
            </button>
            {showDiscontinued && (
              <ul>
                {retired.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                          active ? "bg-stone-600 text-white" : "text-stone-400 hover:bg-white"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            active ? "bg-white" : "bg-stone-300"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate line-through">{p.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-amber-900/10 p-3">
        <button
          onClick={() => onChangeTab("help")}
          className={`mb-2 w-full rounded-lg px-2 py-1 text-left text-xs font-medium transition ${
            activeTab === "help" ? "text-amber-800" : "text-stone-500 hover:text-amber-800"
          }`}
        >
          ❓ 使い方
        </button>
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
              placeholder="新しい商品名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button
              className="rounded-lg bg-amber-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
              onClick={submitAdd}
            >
              追加
            </button>
          </div>
        ) : (
          <button
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            onClick={() => setAdding(true)}
          >
            ＋ 商品を追加
          </button>
        )}
      </div>
    </aside>
  );
}
