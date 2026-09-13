import {
  PrinterError,
  PrinterStatusEmitter,
  type ConnectionType,
  type PrintPayload,
  type PrinterAdapter,
  type PrinterProfile,
  type PrinterStatus,
} from "../types";
import { toBase64 } from "../escpos-renderer";

const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends ESC/POS to a companion "print bridge" over HTTP — a small program
 * running on the machine that physically owns the printer.
 *
 * Serves two connection types:
 *   USB_BRIDGE — a USB/serial printer on a counter PC. Browsers cannot drive
 *                arbitrary USB printers (WebUSB can't claim an interface the
 *                OS driver already owns), so a bridge is the supported path.
 *   IOS_BRIDGE — iPads/iPhones, where no browser implements Web Bluetooth.
 *
 * Contract (see scripts/print-bridge.mjs for a working implementation):
 *   GET  <bridgeUrl>/status -> 200 { ok: true, printer?: string }
 *   POST <bridgeUrl>/print  -> 200, body { base64: "<ESC/POS>" }
 */
export class BridgeAdapter implements PrinterAdapter {
  readonly label: string;
  readonly requiresConnection = true;
  readonly acceptsEscPos = true;

  readonly connectionType: ConnectionType;
  private emitter: PrinterStatusEmitter;
  private connected = false;

  // Explicit field assignment rather than a TS parameter property: those are
  // an emit-time feature and don't run under type-stripping runtimes.
  constructor(connectionType: ConnectionType = "USB_BRIDGE") {
    this.connectionType = connectionType;
    this.label =
      connectionType === "IOS_BRIDGE" ? "iOS / network bridge" : "USB or native print bridge";
    this.emitter = new PrinterStatusEmitter({ state: "idle", message: "Not checked yet" });
  }

  isSupported() {
    return true;
  }

  supportDetail() {
    return this.connectionType === "IOS_BRIDGE"
      ? "For iPhone/iPad. No iOS browser supports Web Bluetooth, so jobs go to a bridge on your network which owns the printer."
      : "For USB/serial printers. Run the bridge on the machine the printer is plugged into — see docs/THERMAL-PRINTING.md.";
  }

  isConnected() {
    return this.connected;
  }

  getStatus(): PrinterStatus {
    return this.emitter.get();
  }

  subscribe(listener: (status: PrinterStatus) => void) {
    return this.emitter.subscribe(listener);
  }

  private base(profile: PrinterProfile): string {
    const url = profile.connection.bridgeUrl?.trim();
    if (!url) {
      throw new PrinterError(
        "not_configured",
        "No print bridge URL is configured.",
        "Set the bridge URL (e.g. http://192.168.1.20:8080) in Printer settings."
      );
    }
    return url.replace(/\/+$/, "");
  }

  private toPrinterError(error: unknown): PrinterError {
    if (error instanceof PrinterError) return error;
    if (error instanceof DOMException && error.name === "AbortError") {
      return new PrinterError(
        "bridge_unreachable",
        "The print bridge timed out.",
        "Confirm the bridge program is running and reachable from this device."
      );
    }
    return new PrinterError(
      "bridge_unreachable",
      "Could not reach the print bridge.",
      "Check the URL, that the bridge is running, and that an HTTPS page isn't blocking a plain-HTTP bridge (mixed content)."
    );
  }

  async connect(profile: PrinterProfile): Promise<void> {
    this.emitter.set({ state: "connecting", message: "Contacting bridge…" });
    try {
      const response = await fetchWithTimeout(
        `${this.base(profile)}/status`,
        { method: "GET" },
        REQUEST_TIMEOUT_MS
      );
      if (!response.ok) {
        throw new PrinterError(
          "bridge_unreachable",
          `Bridge responded with HTTP ${response.status}.`,
          "Check the bridge program is running and the URL is correct."
        );
      }
      const body = (await response.json().catch(() => ({}))) as { printer?: string };
      this.connected = true;
      this.emitter.set({
        state: "connected",
        deviceName: body.printer ?? null,
        message: "Bridge online",
      });
    } catch (error) {
      this.connected = false;
      const printerError = this.toPrinterError(error);
      this.emitter.markError(printerError);
      throw printerError;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emitter.set({ state: "idle", message: "Not checked yet" });
  }

  async print(payload: PrintPayload, profile: PrinterProfile): Promise<void> {
    try {
      const response = await fetchWithTimeout(
        `${this.base(profile)}/print`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: toBase64(payload.bytes) }),
        },
        REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new PrinterError(
          "printer_offline",
          `Bridge rejected the job (HTTP ${response.status}).`,
          "Check the bridge log — the printer may be offline or out of paper."
        );
      }

      this.connected = true;
      this.emitter.markSuccess();
    } catch (error) {
      const printerError = this.toPrinterError(error);
      this.emitter.markError(printerError);
      throw printerError;
    }
  }
}
