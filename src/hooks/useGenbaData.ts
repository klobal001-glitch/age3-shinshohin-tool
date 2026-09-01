"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  STORES,
  createEmptyVisit,
  makeVisitId,
  normalizeVisit,
  parseVisitId,
} from "@/lib/genba/checkItems";
import { normalizeAnswer } from "@/lib/genba/survey";
import { ItemRecord, SaveState, SurveyAnswer, SurveyResponse, Visit, VisitData } from "@/lib/genba/types";

type StoreRow = { store_id: string; data: unknown };
type SurveyRow = { id: string; store_id: string; answered_on: string | null; data: unknown };

/** 共有データベースが使えないときの、この端末だけの控え */
const LS_KEY = "age3_genba_v2";

type Cached = { visits: Record<string, VisitData>; surveys: SurveyResponse[] };

function lsLoad(): Cached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Cached>;
    const visits: Record<string, VisitData> = {};
    for (const [id, data] of Object.entries(v.visits ?? {})) {
      const parsed = parseVisitId(id);
      if (parsed) visits[id] = normalizeVisit(parsed.storeId, parsed.date, data);
    }
    return { visits, surveys: Array.isArray(v.surveys) ? v.surveys : [] };
  } catch {
    return null;
  }
}

function lsSave(visits: Record<string, VisitData>, surveys: SurveyResponse[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ visits, surveys }));
  } catch {
    // 端末の保存領域が使えないときは何もしない
  }
}

/** 日付が早い順、同じ日なら店舗の並び順 */
function sortVisits(map: Record<string, VisitData>): Visit[] {
  const order = new Map(STORES.map((s, i) => [s.id, i]));
  return Object.entries(map)
    .map(([id, data]) => ({ id, ...data }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (order.get(a.storeId) ?? 9) - (order.get(b.storeId) ?? 9)
    );
}

/**
 * 訪問（店舗＋日付）ごとの記録と、アンケート回答を Supabase の共有データベースに
 * 保存する。同じ店に期間中2回行っても、別の記録として残る。
 *
 * 共有データベースが使えない・電波が届かないときは、この端末だけに保存して
 * 先に進めるようにする（視察中に入力が止まらないことを優先する）。
 * その場合は shared が false になり、画面にその旨を出す。
 */
export function useGenbaData() {
  /** この端末に残っている前回の内容。最初の描画に間に合うよう一度だけ読む */
  const [cached] = useState<Cached | null>(lsLoad);

  const [visitMap, setVisitMap] = useState<Record<string, VisitData>>(() => cached?.visits ?? {});
  const [responses, setResponses] = useState<SurveyResponse[]>(() => cached?.surveys ?? []);
  const [loading, setLoading] = useState(true);
  /** true = チーム全員と共有できている、false = この端末だけ */
  const [shared, setShared] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const visitMapRef = useRef(visitMap);
  const responsesRef = useRef(responses);
  useEffect(() => {
    visitMapRef.current = visitMap;
  }, [visitMap]);
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  const persistLocal = useCallback(() => {
    lsSave(visitMapRef.current, responsesRef.current);
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
        const map: Record<string, VisitData> = {};
        for (const row of storeRes.data as StoreRow[]) {
          // 訪問として読めない行（店舗ごとに1件だった頃の記録）は引き継がない
          const parsed = parseVisitId(row.store_id);
          if (!parsed) continue;
          map[row.store_id] = normalizeVisit(parsed.storeId, parsed.date, row.data);
        }
        setVisitMap(map);
        visitMapRef.current = map;
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
      if (ok) lsSave(visitMapRef.current, responsesRef.current);
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
   * 訪問の記録の保存（訪問ごとにまとめ保存）
   * ------------------------------------------------------------------ */
  const pendingRef = useRef<Record<string, VisitData>>({});
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
    (visitId?: string) => {
      const ids = visitId ? [visitId] : Object.keys(pendingRef.current);
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
              console.error("訪問の記録の保存に失敗しました", error);
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

  const applyVisit = useCallback(
    (visitId: string, next: VisitData, immediate: boolean) => {
      pendingRef.current[visitId] = next;
      visitMapRef.current = { ...visitMapRef.current, [visitId]: next };
      setVisitMap((prev) => ({ ...prev, [visitId]: next }));
      persistLocal();

      hadErrorRef.current = false;
      setSaveState("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (timersRef.current[visitId]) clearTimeout(timersRef.current[visitId]);
      if (immediate) {
        flush(visitId);
        return;
      }
      timersRef.current[visitId] = setTimeout(() => flush(visitId), 600);
    },
    [flush, persistLocal]
  );

  const currentVisit = useCallback((visitId: string): VisitData | null => {
    const pending = pendingRef.current[visitId];
    if (pending) return pending;
    return visitMapRef.current[visitId] ?? null;
  }, []);

  const visits = useMemo(() => sortVisits(visitMap), [visitMap]);

  const getVisit = useCallback(
    (visitId: string): VisitData | null => visitMap[visitId] ?? null,
    [visitMap]
  );

  /** 訪問を1件足す。同じ店・同じ日がすでにあれば、その id をそのまま返す */
  const addVisit = useCallback(
    (storeId: string, date: string): string => {
      const id = makeVisitId(storeId, date);
      if (visitMapRef.current[id]) return id;
      applyVisit(id, createEmptyVisit(storeId, date), true);
      return id;
    },
    [applyVisit]
  );

  const removeVisit = useCallback(
    (visitId: string) => {
      delete pendingRef.current[visitId];
      if (timersRef.current[visitId]) {
        clearTimeout(timersRef.current[visitId]);
        delete timersRef.current[visitId];
      }
      const next = { ...visitMapRef.current };
      delete next[visitId];
      visitMapRef.current = next;
      setVisitMap(next);
      lsSave(next, responsesRef.current);
      supabase
        .from("genba_store")
        .delete()
        .eq("store_id", visitId)
        .then(({ error }) => {
          if (error) console.error("訪問の削除に失敗しました", error);
        });
    },
    []
  );

  /** 時間帯などの補足メモ */
  const updateMemo = useCallback(
    (visitId: string, memo: string) => {
      const base = currentVisit(visitId);
      if (!base) return;
      applyVisit(visitId, { ...base, memo }, false);
    },
    [applyVisit, currentVisit]
  );

  const updateItem = useCallback(
    (visitId: string, index: number, patch: Partial<ItemRecord>, immediate = false) => {
      const base = currentVisit(visitId);
      if (!base) return;
      const items = base.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      applyVisit(visitId, { ...base, items }, immediate);
    },
    [applyVisit, currentVisit]
  );

  /**
   * 同じ店の、この訪問より前で最も新しい記録。
   * 再訪したときに「前回の指摘」を出すために使う。
   */
  const previousVisit = useCallback(
    (visitId: string): Visit | null => {
      const here = visitMap[visitId];
      if (!here) return null;
      const earlier = visits.filter((v) => v.storeId === here.storeId && v.date < here.date);
      return earlier.length ? earlier[earlier.length - 1] : null;
    },
    [visitMap, visits]
  );

  /* ------------------------------------------------------------------ *
   * アンケート回答（1枚ずつ追加・削除）
   * ------------------------------------------------------------------ */
  const addLocalResponse = useCallback((row: SurveyResponse) => {
    const next = [...responsesRef.current, row];
    responsesRef.current = next;
    setResponses(next);
    lsSave(visitMapRef.current, next);
  }, []);

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

  const deleteResponse = useCallback(async (id: string): Promise<boolean> => {
    const next = responsesRef.current.filter((r) => r.id !== id);
    responsesRef.current = next;
    setResponses(next);
    lsSave(visitMapRef.current, next);
    if (id.startsWith("local-")) return true;

    const { error } = await supabase.from("genba_survey").delete().eq("id", id);
    if (error) {
      console.error("アンケート回答の削除に失敗しました", error);
      setShared(false);
      return false;
    }
    return true;
  }, []);

  return {
    loading,
    shared,
    saveState,
    retrySave,
    visits,
    getVisit,
    previousVisit,
    addVisit,
    removeVisit,
    updateMemo,
    updateItem,
    responses,
    addResponse,
    deleteResponse,
  };
}
