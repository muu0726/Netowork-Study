"use client";

import { useSyncExternalStore } from "react";
import { useLearningStore } from "@/store/useLearningStore";

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const hasStoreHydrated = useLearningStore((state) => state._hasHydrated);

  return isClient && hasStoreHydrated;
}
