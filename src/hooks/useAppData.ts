"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorageState } from "@/lib/storage";
import { INITIAL_PRODUCTS, INITIAL_RELEASE_DATES } from "@/lib/products";
import { createDefaultProductInfo, normalizeProductInfo } from "@/lib/productInfo";
import { supabase } from "@/lib/supabaseClient";
import { Genre, Product, ProductInfo } from "@/lib/types";

export type TaskStateMap = Record<string, boolean>; // key: "groupId|milestoneId|taskId(|childId)" -> checked

function buildInitialInfoMap(): Record<string, ProductInfo> {
  const map: Record<string, ProductInfo> = {};
  for (const p of INITIAL_PRODUCTS) {
    const info = createDefaultProductInfo();
    info.nameJa = p.name;
    if (INITIAL_RELEASE_DATES[p.id]) info.releaseDate = INITIAL_RELEASE_DATES[p.id];
    map[p.id] = info;
  }
  return map;
}

type ProductRow = { id: string; name: string; genre: Genre; custom: boolean; sort_order: number | null };
type InfoRow = { product_id: string; data: ProductInfo };
type TaskRow = { product_id: string; data: TaskStateMap };

/**
 * 商品リスト・商品情報シート・準備タスクのチェック状態を Supabase の共有データベースに
 * 保存する。チームの誰が開いても同じデータが見える／編集できる。
 *
 * 画面がすぐ表示できるよう、読み込み中はこの端末のデフォルト値（あるいは前回の表示内容）
 * を出しておき、Supabase から取得できたら差し替える（読み込み中の白画面を避けるため）。
 * 「選択中の商品」だけは端末ごとのUI状態なので localStorage のまま。
 */
export function useAppData() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedId, setSelectedId] = useLocalStorageState<string>(
    "selected_product",
    INITIAL_PRODUCTS[0]?.id ?? ""
  );
  const [infoMap, setInfoMap] = useState<Record<string, ProductInfo>>(buildInitialInfoMap());
  const [taskStateAll, setTaskStateAll] = useState<Record<string, TaskStateMap>>({});
  const [loading, setLoading] = useState(true);
  /** 画面右上の保存表示。"saving" = 保存待ち／保存中、"saved" = 直前の保存が完了 */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [productsRes, infoRes, taskRes] = await Promise.all([
        supabase.from("products").select("id,name,genre,custom,sort_order").order("sort_order", { ascending: true }),
        supabase.from("product_info").select("product_id,data"),
        supabase.from("task_state").select("product_id,data"),
      ]);

      if (cancelled) return;

      if (!productsRes.error && productsRes.data) {
        const rows = productsRes.data as ProductRow[];
        if (rows.length > 0) {
          setProducts(rows.map((r) => ({ id: r.id, name: r.name, genre: r.genre, custom: r.custom })));
        }
      } else if (productsRes.error) {
        console.error("products の読み込みに失敗しました", productsRes.error);
      }

      if (!infoRes.error && infoRes.data) {
        const rows = infoRes.data as InfoRow[];
        if (rows.length > 0) {
          const map: Record<string, ProductInfo> = {};
          for (const r of rows) map[r.product_id] = normalizeProductInfo(r.data);
          setInfoMap(map);
        }
      } else if (infoRes.error) {
        console.error("product_info の読み込みに失敗しました", infoRes.error);
      }

      if (!taskRes.error && taskRes.data) {
        const rows = taskRes.data as TaskRow[];
        const map: Record<string, TaskStateMap> = {};
        for (const r of rows) map[r.product_id] = r.data;
        setTaskStateAll(map);
      } else if (taskRes.error) {
        console.error("task_state の読み込みに失敗しました", taskRes.error);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0],
    [products, selectedId]
  );

  const getInfo = useCallback(
    (productId: string): ProductInfo => infoMap[productId] ?? createDefaultProductInfo(),
    [infoMap]
  );

  /* ------------------------------------------------------------------ *
   * 商品情報シートの保存
   *
   * 以前は1文字入力するたびに upsert していたため、続けて入力すると
   * 前の保存が後の保存を上書きして入力が消えることがあった。
   * ここでは商品ごとに最新の内容だけを保持し、入力が止まってから
   * まとめて保存する（離脱時・タブを隠したときは即時保存）。
   * ------------------------------------------------------------------ */
  const infoMapRef = useRef(infoMap);
  useEffect(() => {
    infoMapRef.current = infoMap;
  }, [infoMap]);

  const pendingInfoRef = useRef<Record<string, ProductInfo>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** 送信中の upsert 数。0 になった時点で「保存しました」に切り替える */
  const inflightRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushInfo = useCallback((productId?: string) => {
    const ids = productId ? [productId] : Object.keys(pendingInfoRef.current);
    for (const id of ids) {
      const data = pendingInfoRef.current[id];
      if (!data) continue;
      delete pendingInfoRef.current[id];
      if (saveTimersRef.current[id]) {
        clearTimeout(saveTimersRef.current[id]);
        delete saveTimersRef.current[id];
      }
      inflightRef.current += 1;
      setSaveState("saving");
      supabase
        .from("product_info")
        .upsert({ product_id: id, data, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          inflightRef.current = Math.max(0, inflightRef.current - 1);
          if (error) {
            console.error("product_info の保存に失敗しました", error);
            setSaveState("idle");
            return;
          }
          if (inflightRef.current === 0) {
            setSaveState("saved");
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
            savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500);
          }
        });
    }
  }, []);

  useEffect(() => {
    const flushAll = () => flushInfo();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("beforeunload", flushAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flushAll);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAll();
    };
  }, [flushInfo]);

  const updateInfo = useCallback(
    (productId: string, patch: Partial<ProductInfo>) => {
      const base =
        pendingInfoRef.current[productId] ??
        infoMapRef.current[productId] ??
        createDefaultProductInfo();
      const next = { ...base, ...patch };
      pendingInfoRef.current[productId] = next;
      infoMapRef.current = { ...infoMapRef.current, [productId]: next };
      setInfoMap((prev) => ({ ...prev, [productId]: next }));

      setSaveState("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (saveTimersRef.current[productId]) clearTimeout(saveTimersRef.current[productId]);
      saveTimersRef.current[productId] = setTimeout(() => flushInfo(productId), 600);
    },
    [flushInfo]
  );

  const getTaskState = useCallback(
    (productId: string): TaskStateMap => taskStateAll[productId] ?? {},
    [taskStateAll]
  );

  const toggleTask = useCallback((productId: string, key: string) => {
    setTaskStateAll((prev) => {
      const productState = { ...(prev[productId] ?? {}) };
      productState[key] = !productState[key];
      supabase
        .from("task_state")
        .upsert({ product_id: productId, data: productState, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("task_state の保存に失敗しました", error);
        });
      return { ...prev, [productId]: productState };
    });
  }, []);

  const resetProductTasks = useCallback((productId: string) => {
    setTaskStateAll((prev) => {
      supabase
        .from("task_state")
        .upsert({ product_id: productId, data: {}, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("task_state のリセットに失敗しました", error);
        });
      return { ...prev, [productId]: {} };
    });
  }, []);

  const resetProductInfo = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      const fresh = createDefaultProductInfo();
      if (product) fresh.nameJa = product.name;
      delete pendingInfoRef.current[productId];
      if (saveTimersRef.current[productId]) {
        clearTimeout(saveTimersRef.current[productId]);
        delete saveTimersRef.current[productId];
      }
      supabase
        .from("product_info")
        .upsert({ product_id: productId, data: fresh, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("product_info のリセットに失敗しました", error);
        });
      setInfoMap((prev) => ({ ...prev, [productId]: fresh }));
    },
    [products]
  );

  const addProduct = useCallback(
    (name: string, genre: Genre) => {
      const id = `custom_${Date.now().toString(36)}`;
      const product: Product = { id, name, genre, custom: true };
      const info = createDefaultProductInfo();
      info.nameJa = name;

      setProducts((prev) => [...prev, product]);
      setInfoMap((prev) => ({ ...prev, [id]: info }));
      setSelectedId(id);

      const sortOrder = products.length;
      supabase
        .from("products")
        .insert({ id, name, genre, custom: true, sort_order: sortOrder })
        .then(({ error }) => {
          if (error) console.error("products への追加に失敗しました", error);
        });
      supabase
        .from("product_info")
        .upsert({ product_id: id, data: info, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("product_info への追加に失敗しました", error);
        });

      return id;
    },
    [products, setSelectedId]
  );

  const renameProduct = useCallback((productId: string, name: string) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, name } : p)));
    // 入力中の内容を取りこぼさないよう、保存待ちの内容を土台にする
    const base =
      pendingInfoRef.current[productId] ??
      infoMapRef.current[productId] ??
      createDefaultProductInfo();
    const next = { ...base, nameJa: name };
    pendingInfoRef.current[productId] = next;
    infoMapRef.current = { ...infoMapRef.current, [productId]: next };
    setInfoMap((prev) => ({ ...prev, [productId]: next }));
    flushInfo(productId);
    supabase
      .from("products")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .then(({ error }) => {
        if (error) console.error("products の更新に失敗しました", error);
      });
  }, [flushInfo]);

  const changeGenre = useCallback((productId: string, genre: Genre) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, genre } : p)));
    supabase
      .from("products")
      .update({ genre, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .then(({ error }) => {
        if (error) console.error("products の更新に失敗しました", error);
      });
  }, []);

  const deleteProduct = useCallback(
    (productId: string) => {
      setProducts((prev) => {
        const next = prev.filter((p) => p.id !== productId);
        if (selectedId === productId && next.length > 0) {
          setSelectedId(next[0].id);
        }
        return next;
      });
      setInfoMap((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setTaskStateAll((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      // product_info / task_state は products の on delete cascade で自動削除される
      supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .then(({ error }) => {
          if (error) console.error("products の削除に失敗しました", error);
        });
    },
    [selectedId, setSelectedId]
  );

  return {
    products,
    selectedProduct,
    selectedId,
    setSelectedId,
    loading,
    saveState,
    getInfo,
    updateInfo,
    getTaskState,
    toggleTask,
    resetProductTasks,
    resetProductInfo,
    addProduct,
    renameProduct,
    changeGenre,
    deleteProduct,
  };
}
