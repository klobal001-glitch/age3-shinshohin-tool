"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/hooks/useAppData";
import { Genre } from "@/lib/types";
import { infoFillRate } from "@/lib/stats";
import { SALE_STATUS_LABEL, SaleStatus, isInactive, saleStatus, todayKey } from "@/lib/saleStatus";
import { TabKey } from "./Header";
import Age3Logo from "@/components/Age3Logo";
import Icon, { IconName } from "@/components/Icon";
import { GENRE_ORDER, genreLabel } from "./ProductSwitcher";
import { btn, eyebrow, field, focusRing, rowSelect } from "@/lib/ui";

/* ラベルはスマホ下端のタブと同じ言葉にして、どちらで使っても迷わないようにする */
const NAV: { key: TabKey; icon: IconName; label: string }[] = [
  { key: "menu", icon: "home", label: "ホーム" },
  { key: "sheet", icon: "sheet", label: "シート" },
  { key: "tasks", icon: "task", label: "タスク" },
  { key: "gallery", icon: "gallery", label: "ビジュアル" },
];

/** シーズン以外の並び順の第一キー。販売中 → 販売終了 → 廃盤 の順に上から並べる
    （シーズンは発売日だけで並べる。下の sort を参照） */
const SALE_RANK: Record<SaleStatus, number> = { active: 0, ended: 1, retired: 2 };

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
  /* 廃盤も一覧には残す。ジャンルの中に「廃盤」の印を付けて、いちばん下に回す */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    const day = todayKey();

    const map = new Map<Genre, typeof products>();
    for (const g of GENRE_ORDER) map.set(g, []);
    for (const p of filtered) {
      const key = GENRE_ORDER.includes(p.genre) ? p.genre : null;
      map.get(key)!.push(p);
    }

    const rank = (p: (typeof products)[number]) => SALE_RANK[saleStatus(getInfo(p.id), day)];

    for (const g of GENRE_ORDER) {
      const items = map.get(g);
      if (!items) continue;
      items.sort((a, b) => {
        if (g === "season") {
          /* シーズンは「発売日が新しいものが上」。これから発売するものも含めて
             日付だけで並べ、古いものが下に沈むようにする（2026年9月・松尾さんの指示）。
             販売終了かどうかでは分けない。終わった商品でも、最近のものほど上にある方が探しやすい。
             廃盤だけは作らない商品なので、いちばん下に回す */
          const da = getInfo(a.id).discontinued ? 1 : 0;
          const db = getInfo(b.id).discontinued ? 1 : 0;
          if (da !== db) return da - db;
          const ra = getInfo(a.id).releaseDate;
          const rb = getInfo(b.id).releaseDate;
          if (!ra && !rb) return 0;
          if (!ra) return 1; // 発売日未設定は下に回す
          if (!rb) return -1;
          return rb.localeCompare(ra);
        }
        /* 他のジャンルは、販売していない商品をジャンルの下に落とすだけ。
           sort は安定なので、それ以外は元の並びが残る */
        return rank(a) - rank(b);
      });
    }

    return GENRE_ORDER.map((g) => ({ genre: g, items: map.get(g) ?? [] })).filter(
      (section) => section.items.length > 0
    );
  }, [products, query, getInfo]);

  const today = todayKey();

  const submitAdd = () => {
    if (!newName.trim()) return;
    const id = addProduct(newName.trim(), null);
    setSelectedId(id);
    setNewName("");
    setAdding(false);
  };

  return (
    <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-stone-200 bg-rail md:flex">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Age3Logo className="h-5 w-auto shrink-0 text-stone-900" />
        <span aria-hidden className="h-3.5 w-px bg-stone-300" />
        <h1 className="truncate text-sm font-semibold text-stone-700">商品データベース</h1>
      </div>

      <nav className="space-y-0.5 px-2.5 pb-3">
        {NAV.map((t) => {
          const on = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChangeTab(t.key)}
              aria-current={on ? "page" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${focusRing} ${
                on
                  ? "bg-white font-semibold text-stone-900 shadow-xs"
                  : "font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              }`}
            >
              <Icon
                name={t.icon}
                className={`h-4 w-4 ${on ? "text-amber-600" : "text-stone-400"}`}
                strokeWidth={on ? 1.9 : 1.7}
              />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-stone-200 px-2.5 pb-2 pt-3">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          />
          <input
            className={`${field} pl-9`}
            placeholder="商品を検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {grouped.length === 0 && (
          <p className="px-1 py-4 text-xs text-stone-400">該当する商品がありません。</p>
        )}
        {grouped.map(({ genre, items }) => (
          <div key={genre ?? "none"} className="mb-3">
            <div className={`mb-1 px-2.5 pt-1 ${eyebrow}`}>{genreLabel(genre)}</div>
            <ul className="space-y-px">
              {items.map((p) => {
                const info = getInfo(p.id);
                const pct = infoFillRate(info, p.genre);
                const active = p.id === selectedId;
                /* 廃盤・販売終了は薄くして、入力率の代わりに印を出す */
                const status = saleStatus(info, today);
                const off = isInactive(status);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className={rowSelect(active, off && !active ? "text-stone-400" : "")}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          off ? "bg-stone-300" : fillDotColor(pct)
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {off ? (
                        <span className="shrink-0 rounded-full bg-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-500">
                          {SALE_STATUS_LABEL[status]}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-stone-400 tabular-nums">{pct}%</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200 p-2.5">
        <button
          onClick={() => onChangeTab("help")}
          className={`mb-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${focusRing} ${
            activeTab === "help"
              ? "bg-white text-stone-900 shadow-xs"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          }`}
        >
          <Icon
            name="help"
            className={`h-4 w-4 ${activeTab === "help" ? "text-amber-600" : "text-stone-400"}`}
          />
          使い方
        </button>
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className={`${field} flex-1`}
              placeholder="新しい商品名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button className={btn("primary")} onClick={submitAdd}>
              追加
            </button>
          </div>
        ) : (
          <button className={`${btn("secondary")} w-full`} onClick={() => setAdding(true)}>
            <Icon name="plus" className="h-4 w-4" />
            商品を追加
          </button>
        )}
      </div>
    </aside>
  );
}
