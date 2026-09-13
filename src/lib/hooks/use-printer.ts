"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_PROFILE,
  PrinterService,
  createPrinterService,
  type PrintJob,
  type PrinterProfile,
  type PrinterStatus,
} from "@/lib/printing";
import { useIsClient } from "./use-is-client";

const STORAGE_KEY = "sandbox_active_printer_v2";
const CHANGE_EVENT = "sandbox:printer-selection";

/**
 * Which printer *this device* uses. Printer profiles are shared (the admin
 * defines them once), but the selection is per device: the counter tablet has
 * the Bluetooth printer paired, the kitchen screen drives the kitchen printer,
 * and the manager's laptop has neither.
 */
function subscribeSelection(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSelectionSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const getServerSelection = () => null;

export function setActivePrinterId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode) — selection lasts for this session
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface UsePrinterResult {
  service: PrinterService | null;
  profile: PrinterProfile;
  profiles: PrinterProfile[];
  status: PrinterStatus;
  jobs: PrintJob[];
  selectPrinter: (id: string) => void;
  ready: boolean;
}

/**
 * Binds the available printer profiles to a live PrinterService for this
 * device, and keeps status + queue subscriptions wired up.
 */
export function usePrinter(
  profiles: PrinterProfile[],
  options: { role?: PrinterProfile["role"] } = {}
): UsePrinterResult {
  const isClient = useIsClient();
  const selectedId = useSyncExternalStore(
    subscribeSelection,
    getSelectionSnapshot,
    getServerSelection
  );

  const candidates = useMemo(
    () => profiles.filter((p) => p.active && (!options.role || p.role === options.role)),
    [profiles, options.role]
  );

  const profile = useMemo(() => {
    return (
      candidates.find((p) => p.id === selectedId) ??
      candidates.find((p) => p.isDefault) ??
      candidates[0] ??
      DEFAULT_PROFILE
    );
  }, [candidates, selectedId]);

  // One service instance per profile; adapters themselves are cached globally
  // so an open BLE connection survives re-renders and navigation.
  const service = useMemo(
    () => (isClient ? createPrinterService(profile) : null),
    [isClient, profile]
  );

  const [status, setStatus] = useState<PrinterStatus>({ state: "idle" });
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  useEffect(() => {
    if (!service) return;
    return service.subscribe(setStatus);
  }, [service]);

  useEffect(() => {
    if (!service) return;
    return service.subscribeToQueue(setJobs);
  }, [service]);

  const selectPrinter = useCallback((id: string) => setActivePrinterId(id), []);

  return {
    service,
    profile,
    profiles: candidates,
    status,
    jobs,
    selectPrinter,
    ready: isClient && !!service,
  };
}
