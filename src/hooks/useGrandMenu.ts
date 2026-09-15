"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  GrandMenuIssue,
  GrandMenuRow,
  createEmptyIssue,
  normalizeIssue,
} from "@/lib/grandMenu";

/**
 * グランドメニューの号を Supabase（grand_menu テーブル）に読み書きする。
 *
 * 商品データ（useAppData）とは別のテーブルなので、ここだけで完結させている。
 * 入力は600ms止まったらまとめて保存する（1文字ごとに送らない）。
 */
export function useGrandMenu() {
  const [rows, setRows] = useState<GrandMenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, GrandMenuIssue>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("grand_menu").select("id,data");
      if (!alive) return;
      if (!error && data) {
        setRows(data.map((r) => ({ id: r.id as string, data: normalizeIssue(r.data as GrandMenuIssue) })));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const push = useCallback(async (id: string, data: GrandMenuIssue) => {
    setSaveState("saving");
    const { error } = await supabase
      .from("grand_menu")
      .upsert({ id, data, updated_at: new Date().toISOString() });
    setSaveState(error ? "error" : "saved");
  }, []);

  /** 1つの号の内容を変える。画面はすぐ変わり、保存は少し待ってからまとめて送る */
  const update = useCallback(
    (id: string, patch: Partial<GrandMenuIssue>) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...patch } } : r));
        const hit = next.find((r) => r.id === id);
        if (hit) latest.current[id] = hit.data;
        return next;
      });
      setSaveState("saving");
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        const data = latest.current[id];
        if (data) void push(id, data);
      }, 600);
    },
    [push]
  );

  /** 号を足す。新しい行は空のまま画面のいちばん上に出る */
  const add = useCallback(async () => {
    const id = `gm_${Date.now().toString(36)}`;
    const data = createEmptyIssue();
    setRows((prev) => [{ id, data }, ...prev]);
    latest.current[id] = data;
    await push(id, data);
    return id;
  }, [push]);

  /** 号を消す */
  const remove = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSaveState("saving");
    const { error } = await supabase.from("grand_menu").delete().eq("id", id);
    setSaveState(error ? "error" : "saved");
  }, []);

  return { rows, loading, saveState, update, add, remove };
}
