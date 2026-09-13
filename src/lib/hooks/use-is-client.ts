"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False during SSR and the hydration pass, true afterwards.
 *
 * Needed wherever rendering depends on browser-only capability checks
 * (`navigator.bluetooth`, `window.print`, localStorage): those return
 * different answers on the server than in the browser, which would otherwise
 * produce a hydration mismatch.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
