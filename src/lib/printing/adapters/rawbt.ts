import {
  PrinterError,
  PrinterStatusEmitter,
  type ConnectionType,
  type PrintPayload,
  type PrinterAdapter,
  type PrinterStatus,
} from "../types";
import { toBase64 } from "../escpos-renderer";

const RAWBT_PACKAGE = "ru.a402d.rawbtprinter";

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Hands raw ESC/POS to the **RawBT** Android app, which owns the printer
 * connection.
 *
 * This is the answer for **Bluetooth Classic/SPP** printers: Web Bluetooth
 * cannot speak RFCOMM, and most cheap portable receipt printers are Classic.
 * RawBT is a free Play Store app supporting Classic SPP, BLE, USB and network
 * printers, and accepts jobs from a web page via a URL scheme — so Android can
 * drive a Classic printer with no custom native app to build or distribute.
 *
 * Serves both the RAWBT and BLUETOOTH_CLASSIC connection types, since on
 * Android the latter is implemented through the former.
 *
 * KNOWN CONSTRAINT: the handoff is fire-and-forget. The browser receives no
 * completion callback, so this adapter cannot detect paper-out or an offline
 * printer — those surface in RawBT's own UI.
 */
export class RawBtAdapter implements PrinterAdapter {
  readonly label = "RawBT (Android app)";
  readonly requiresConnection = false;
  readonly acceptsEscPos = true;

  readonly connectionType: ConnectionType;
  private emitter: PrinterStatusEmitter;

  constructor(connectionType: ConnectionType = "RAWBT") {
    this.connectionType = connectionType;
    this.emitter = new PrinterStatusEmitter(
      this.isSupported()
        ? { state: "connected", message: "Ready — jobs are handed to the RawBT app" }
        : { state: "unsupported", message: this.supportDetail() }
    );
  }

  isSupported() {
    return isAndroid();
  }

  supportDetail() {
    if (typeof navigator === "undefined") return "Not available during server rendering.";
    if (!isAndroid()) {
      return "RawBT is an Android app — this option only works on Android devices. On desktop use LAN, BLE or a bridge; on iOS use LAN or a bridge.";
    }
    return "Available. Requires the free RawBT app installed, with your printer paired and selected inside it.";
  }

  isConnected() {
    return this.isSupported();
  }

  getStatus(): PrinterStatus {
    return this.emitter.get();
  }

  subscribe(listener: (status: PrinterStatus) => void) {
    return this.emitter.subscribe(listener);
  }

  async connect(): Promise<void> {
    // RawBT owns the connection; nothing to open from the web side.
  }

  async disconnect(): Promise<void> {
    // Nothing to close.
  }

  async print(payload: PrintPayload): Promise<void> {
    if (!this.isSupported()) {
      const error = new PrinterError("unsupported", "RawBT requires Android.", this.supportDetail());
      this.emitter.markError(error);
      throw error;
    }

    const data = toBase64(payload.bytes);

    // Android intent URL. If RawBT is missing, browser_fallback_url sends the
    // user to the Play Store listing rather than dead-ending on an error.
    const fallback = encodeURIComponent(
      `https://play.google.com/store/apps/details?id=${RAWBT_PACKAGE}`
    );
    const intentUrl =
      `intent://base64,${data}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE};` +
      `S.browser_fallback_url=${fallback};end;`;

    try {
      window.location.href = intentUrl;
      this.emitter.markSuccess();
    } catch {
      const error = new PrinterError(
        "write_failed",
        "Could not hand the job to RawBT.",
        "Make sure the RawBT app is installed and set as the print service."
      );
      this.emitter.markError(error);
      throw error;
    }
  }
}
