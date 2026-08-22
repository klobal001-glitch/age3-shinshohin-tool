"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorageState } from "@/lib/storage";
import { INITIAL_PRODUCTS, INITIAL_RELEASE_DATES } from "@/lib/products";
import { createDefaultProductInfo } from "@/lib/productInfo";
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

export function useAppData() {
  const [products, setProducts] = useLocalStorageState<Product[]>("products", INITIAL_PRODUCTS);
  const [selectedId, setSelectedId] = useLocalStorageState<string>(
    "selected_product",
    INITIAL_PRODUCTS[0]?.id ?? ""
  );
  const [infoMap, setInfoMap] = useLocalStorageState<Record<string, ProductInfo>>(
    "product_info",
    buildInitialInfoMap()
  );
  const [taskStateAll, setTaskStateAll] = useLocalStorageState<Record<string, TaskStateMap>>(
    "task_state",
    {}
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0],
    [products, selectedId]
  );

  const getInfo = useCallback(
    (productId: string): ProductInfo => infoMap[productId] ?? createDefaultProductInfo(),
    [infoMap]
  );

  const updateInfo = useCallback(
    (productId: string, patch: Partial<ProductInfo>) => {
      setInfoMap((prev) => ({
        ...prev,
        [productId]: { ...(prev[productId] ?? createDefaultProductInfo()), ...patch },
      }));
    },
    [setInfoMap]
  );

  const getTaskState = useCallback(
    (productId: string): TaskStateMap => taskStateAll[productId] ?? {},
    [taskStateAll]
  );

  const toggleTask = useCallback(
    (productId: string, key: string) => {
      setTaskStateAll((prev) => {
        const productState = { ...(prev[productId] ?? {}) };
        productState[key] = !productState[key];
        return { ...prev, [productId]: productState };
      });
    },
    [setTaskStateAll]
  );

  const resetProductTasks = useCallback(
    (productId: string) => {
      setTaskStateAll((prev) => ({ ...prev, [productId]: {} }));
    },
    [setTaskStateAll]
  );

  const resetProductInfo = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      const fresh = createDefaultProductInfo();
      if (product) fresh.nameJa = product.name;
      setInfoMap((prev) => ({ ...prev, [productId]: fresh }));
    },
    [products, setInfoMap]
  );

  const addProduct = useCallback(
    (name: string, genre: Genre) => {
      const id = `custom_${Date.now().toString(36)}`;
      const product: Product = { id, name, genre, custom: true };
      setProducts((prev) => [...prev, product]);
      const info = createDefaultProductInfo();
      info.nameJa = name;
      setInfoMap((prev) => ({ ...prev, [id]: info }));
      setSelectedId(id);
      return id;
    },
    [setProducts, setInfoMap, setSelectedId]
  );

  const renameProduct = useCallback(
    (productId: string, name: string) => {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, name } : p)));
      setInfoMap((prev) => ({
        ...prev,
        [productId]: { ...(prev[productId] ?? createDefaultProductInfo()), nameJa: name },
      }));
    },
    [setProducts, setInfoMap]
  );

  const changeGenre = useCallback(
    (productId: string, genre: Genre) => {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, genre } : p)));
    },
    [setProducts]
  );

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
    },
    [selectedId, setProducts, setInfoMap, setTaskStateAll, setSelectedId]
  );

  return {
    products,
    selectedProduct,
    selectedId,
    setSelectedId,
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
