"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { STORES, createEmptyStoreData, normalizeStoreData } from "@/lib/genba/checkItems";
import { normalizeAnswer } from "@/lib/genba/survey";
import { ItemRecord, SaveState, StoreData, SurveyAnswer, SurveyResponse } from "@/lib/genba/types";

type StoreRow = { store_id: string; data: unknown };
type SurveyRow = { id: string; store_id: string; answered_on: string | null; data: unknown };

/** 共有データベースが使えないときの、この端末だけの控え */
const LS_KEY = "age3_genba_v1";

function buildInitialStoreMap(): Record<string, StoreData> {
  const map: Record<string, StoreData> = {};
  for (const s of STORES) map[s.id] = createEmptyStoreData();
  return map;
}

type Cached = { stores: Record<string, StoreData>; surveys: SurveyResponse[] };

function lsLoad(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Cached>;
    const stores = buildInitialStoreMap();
    if (v.stores) {
      for (const s of STORES) if (v.stores[s.id]) stores[s.id] = normalizeStoreData(v.stores[s.id]);
    }
    return { stores, surveys: Array.isArray(v.surveys) ? v.surveys : [] };
  } catch {
    return null;
  }
}

function lsSave(stores: Record<string, StoreData>, surveys: SurveyResponse[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ stores, surveys }));
  } catch {
    // 端末の保存領域が使えないときは何もしない
  }
}

/**
 * 現場チェックの記録とアンケート回答を Supabase の共有データベースに保存する。
 * チームの誰が開いても、どの端末で開いても同じデータが見える／編集できる。
 *
 * 共有データベースの用意ができていない・電波が届かないときは、この端末だけに
 * 保存して先に進めるようにする（視察中に入力が止まらないことを優先する）。
 * その場合は shared が false になり、画面にその旨を出す。
 *
 * 入力は1文字ごとには送らず、600ms 止まってからまとめて送る。
 */
export function useGenbaData() {
  /** この端末に残っている前回の内容。最初の描画に間に合うよう一度だけ読む */
  const [cached] = useState<Cached | null>(lsLoad);

  const [storeMap, setStoreMap] = useState<Record<string, StoreData>>(
    () => cached?.stores ?? buildInitialStoreMap()
  );
  const [responses, setResponses] = useState<SurveyResponse[]>(() => cached?.surveys ?? []);
  const [loading, setLoading] = useState(true);
  /** true = チーム全員と共有できている、false = この端末だけ */
  const [shared, setShared] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const storeMapRef = useRef(storeMap);
  const responsesRef = useRef(responses);
  useEffect(() => {
    storeMapRef.current = storeMap;
  }, [storeMap]);
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  const persistLocal = useCallback(() => {
    lsSave(storeMapRef.current, responsesRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    /** 応答が返ってこないとき、いつまでも「読み込み中」にしない */
    const giveUp = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setShared(false);
      }
    }, 8000);

    async function load() {
      const [storeRes, surveyRes] = await Promise.all([
        supabase.from("genba_store").select("store_id,data"),
        supabase.from("genba_survey").select("id,store_id,answered_on,data").order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;

      let ok = true;

      if (!storeRes.error && storeRes.data) {
        const map = buildInitialStoreMap();
        for (const row of storeRes.data as StoreRow[]) {
          if (map[row.store_id]) map[row.store_id] = normalizeStoreData(row.data);
        }
        setStoreMap(map);
        storeMapRef.current = map;
      } else {
        ok = false;
        console.error("genba_store の読み込みに失敗しました", storeRes.error);
      }

      if (!surveyRes.error && surveyRes.data) {
        const list = (surveyRes.data as SurveyRow[]).map((row) => ({
          id: row.id,
          storeId: row.store_id,
          answeredOn: row.answered_on ?? "",
          data: normalizeAnswer(row.data),
        }));
        setResponses(list);
        responsesRef.current = list;
      } else {
        ok = false;
        console.error("genba_survey の読み込みに失敗しました", surveyRes.error);
      }

      setShared(ok);
      if (ok) lsSave(storeMapRef.current, responsesRef.current);
      clearTimeout(giveUp);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * 現場チェックの保存（店舗ごとにまとめ保存）
   * ------------------------------------------------------------------ */
  const pendingRef = useRef<Record<string, StoreData>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflightRef = useRef(0);
  const hadErrorRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = useCallback(() => {
    if (inflightRef.current !== 0 || hadErrorRef.current) return;
    setSaveState("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500);
  }, []);

  const flush = useCallback(
    (storeId?: string) => {
      const ids = storeId ? [storeId] : Object.keys(pendingRef.current);
      for (const id of ids) {
        const data = pendingRef.current[id];
        if (!data) continue;
        delete pendingRef.current[id];
        if (timersRef.current[id]) {
          clearTimeout(timersRef.current[id]);
          delete timersRef.current[id];
        }
        inflightRef.current += 1;
        setSaveState("saving");
        supabase
          .from("genba_store")
          .upsert({ store_id: id, data, updated_at: new Date().toISOString() })
          .then(({ error }) => {
            inflightRef.current = Math.max(0, inflightRef.current - 1);
            if (error) {
              console.error("genba_store の保存に失敗しました", error);
              // 送れなかった内容は捨てずに保存待ちへ戻す。
              // （この間に新しい入力があれば、そちらが最新なので上書きしない）
              pendingRef.current[id] = pendingRef.current[id] ?? data;
              hadErrorRef.current = true;
              setShared(false);
              setSaveState("error");
              return;
            }
            setShared(true);
            markSaved();
          });
      }
    },
    [markSaved]
  );

  /** 保存待ち・保存し損ねた内容をもう一度送る（右上の「再試行」から呼ぶ） */
  const retrySave = useCallback(() => {
    hadErrorRef.current = false;
    if (Object.keys(pendingRef.current).length === 0) {
      setSaveState("idle");
      return;
    }
    flush();
  }, [flush]);

  useEffect(() => {
    const flushAll = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    const onBeforeUnload = () => {
      persistLocal();
      flushAll();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushAll();
      }
    };
    const onOnline = () => flushAll();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAll();
    };
  }, [flush, persistLocal]);

  /** 送れなかった内容を、電波が戻るまで自動で送り直す */
  useEffect(() => {
    const t = setInterval(() => {
      if (Object.keys(pendingRef.current).length > 0) {
        hadErrorRef.current = false;
        flush();
      }
    }, 15000);
    return () => clearInterval(t);
  }, [flush]);

  const applyStore = useCallback(
    (storeId: string, next: StoreData, immediate: boolean) => {
      pendingRef.current[storeId] = next;
      storeMapRef.current = { ...storeMapRef.current, [storeId]: next };
      setStoreMap((prev) => ({ ...prev, [storeId]: next }));
      persistLocal();

      hadErrorRef.current = false;
      setSaveState("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (timersRef.current[storeId]) clearTimeout(timersRef.current[storeId]);
      if (immediate) {
        flush(storeId);
        return;
      }
      timersRef.current[storeId] = setTimeout(() => flush(storeId), 600);
    },
    [flush, persistLocal]
  );

  const currentStore = useCallback(
    (storeId: string): StoreData =>
      pendingRef.current[storeId] ?? storeMapRef.current[storeId] ?? createEmptyStoreData(),
    []
  );

  const updateStore = useCallback(
    (storeId: string, patch: Partial<Pick<StoreData, "visitDate" | "visitMemo">>) => {
      applyStore(storeId, { ...currentStore(storeId), ...patch }, false);
    },
    [applyStore, currentStore]
  );

  const updateItem = useCallback(
    (storeId: string, index: number, patch: Partial<ItemRecord>, immediate = false) => {
      const base = currentStore(storeId);
      const items = base.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      applyStore(storeId, { ...base, items }, immediate);
    },
    [applyStore, currentStore]
  );

  const getStore = useCallback(
    (storeId: string): StoreData => storeMap[storeId] ?? createEmptyStoreData(),
    [storeMap]
  );

  /* ------------------------------------------------------------------ *
   * アンケート回答（1枚ずつ追加・削除）
   * ------------------------------------------------------------------ */
  const addLocalResponse = useCallback(
    (row: SurveyResponse) => {
      const next = [...responsesRef.current, row];
      responsesRef.current = next;
      setResponses(next);
      lsSave(storeMapRef.current, next);
    },
    []
  );

  const addResponse = useCallback(
    async (storeId: string, answeredOn: string, data: SurveyAnswer): Promise<boolean> => {
      setSaveState("saving");
      const { data: rows, error } = await supabase
        .from("genba_survey")
        .insert({ store_id: storeId, answered_on: answeredOn || null, data })
        .select("id,store_id,answered_on,data");

      if (error || !rows || rows.length === 0) {
        // 共有できなくても、この端末には残して入力を止めない
        console.error("アンケート回答の保存に失敗しました", error);
        addLocalResponse({ id: "local-" + Date.now().toString(36), storeId, answeredOn, data });
        setShared(false);
        setSaveState("idle");
        return true;
      }

      const row = rows[0] as SurveyRow;
      addLocalResponse({
        id: row.id,
        storeId: row.store_id,
        answeredOn: row.answered_on ?? "",
        data: normalizeAnswer(row.data),
      });
      setShared(true);
      hadErrorRef.current = false;
      markSaved();
      return true;
    },
    [addLocalResponse, markSaved]
  );

  const deleteResponse = useCallback(
    async (id: string): Promise<boolean> => {
      const next = responsesRef.current.filter((r) => r.id !== id);
      responsesRef.current = next;
      setResponses(next);
      lsSave(storeMapRef.current, next);
      if (id.startsWith("local-")) return true;

      const { error } = await supabase.from("genba_survey").delete().eq("id", id);
      if (error) {
        console.error("アンケート回答の削除に失敗しました", error);
        setShared(false);
        return false;
      }
      return true;
    },
    []
  );

  return {
    loading,
    shared,
    saveState,
    retrySave,
    storeMap,
    getStore,
    updateStore,
    updateItem,
    responses,
    addResponse,
    deleteResponse,
  };
}
