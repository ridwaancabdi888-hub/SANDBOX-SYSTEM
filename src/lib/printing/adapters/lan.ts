import {
  PrinterError,
  PrinterStatusEmitter,
  type PrintPayload,
  type PrinterAdapter,
  type PrinterProfile,
  type PrinterStatus,
} from "../types";
import { toBase64 } from "../escpos-renderer";

/**
 * LAN / Wi-Fi / Ethernet ESC/POS printers (raw TCP, usually port 9100).
 *
 * Browsers cannot open TCP sockets, so jobs are relayed through this app's
 * own server route (`/api/print/lan`), which holds the socket. That means the
 * **server** must share a network with the printer:
 *
 *   - Self-hosted / on-premise  -> works
 *   - Cloud host (e.g. Vercel)  -> cannot reach a private LAN address; use the
 *                                  bridge adapter on a counter machine instead
 *
 * The printer's address never reaches any third party, and the route refuses
 * non-private addresses so it can't be used to probe the public internet.
 */
export class LanAdapter implements PrinterAdapter {
  readonly connectionType = "LAN" as const;
  readonly label = "Network printer (LAN / Wi-Fi)";
  readonly requiresConnection = true;
  readonly acceptsEscPos = true;

  private emitter: PrinterStatusEmitter;
  private connected = false;

  constructor() {
    this.emitter = new PrinterStatusEmitter({ state: "idle", message: "Not checked yet" });
  }

  isSupported() {
    return true;
  }

  supportDetail() {
    return "Works from any device. The SANDBOX server relays the job, so the server must be on the same network as the printer — on a cloud host, use a print bridge instead.";
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

  private endpoint(profile: PrinterProfile) {
    const host = profile.connection.host?.trim();
    const port = profile.connection.port ?? 9100;
    if (!host) {
      throw new PrinterError(
        "not_configured",
        "No printer IP address configured.",
        "Enter the printer's IP address (e.g. 192.168.1.100) in Printer settings."
      );
    }
    return { host, port };
  }

  private async call(
    profile: PrinterProfile,
    payload: { base64?: string; probeOnly?: boolean }
  ): Promise<void> {
    const { host, port } = this.endpoint(profile);

    const response = await fetch("/api/print/lan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port, ...payload }),
    }).catch(() => null);

    if (!response) {
      throw new PrinterError(
        "bridge_unreachable",
        "Could not reach the SANDBOX server.",
        "Check your internet/network connection and try again."
      );
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new PrinterError(
        "printer_offline",
        body.error ?? `Printer error (HTTP ${response.status}).`,
        "Check the printer is powered on, has paper, and that its IP address is correct."
      );
    }
  }

  /** Opens and immediately closes a socket so status reflects reality. */
  async connect(profile: PrinterProfile): Promise<void> {
    this.emitter.set({ state: "connecting", message: "Testing connection…" });
    try {
      await this.call(profile, { probeOnly: true });
      this.connected = true;
      const { host, port } = this.endpoint(profile);
      this.emitter.set({
        state: "connected",
        deviceName: `${host}:${port}`,
        message: "Printer reachable",
      });
    } catch (error) {
      this.connected = false;
      const printerError =
        error instanceof PrinterError
          ? error
          : new PrinterError("printer_offline", "Could not reach the printer.");
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
      await this.call(profile, { base64: toBase64(payload.bytes) });
      this.connected = true;
      this.emitter.markSuccess();
    } catch (error) {
      this.connected = false;
      const printerError =
        error instanceof PrinterError
          ? error
          : new PrinterError("printer_offline", "Could not reach the printer.");
      this.emitter.markError(printerError);
      throw printerError;
    }
  }
}
