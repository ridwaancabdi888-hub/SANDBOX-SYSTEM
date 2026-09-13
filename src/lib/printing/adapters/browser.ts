import {
  PrinterError,
  PrinterStatusEmitter,
  type ConnectionType,
  type PrinterAdapter,
  type PrinterStatus,
} from "../types";

/**
 * Prints through the operating system's own print pipeline by rendering the
 * receipt into the DOM (see ReceiptPreview and the `.print-area` rules in
 * globals.css) and calling window.print().
 *
 * Covers three user-facing connection types:
 *   BROWSER         — the universal fallback
 *   WINDOWS_SYSTEM  — a thermal printer installed with a Windows driver
 *   (macOS uses BROWSER; CUPS exposes the printer the same way)
 *
 * These do NOT emit ESC/POS — the OS driver rasterises the page — so
 * capability flags like supportsCut are handled by the driver's own settings,
 * not by us. Paper size is chosen in the print dialog.
 */
export class BrowserAdapter implements PrinterAdapter {
  readonly requiresConnection = false;
  readonly acceptsEscPos = false;
  readonly label: string;

  readonly connectionType: ConnectionType;
  private emitter: PrinterStatusEmitter;

  constructor(connectionType: ConnectionType = "BROWSER") {
    this.connectionType = connectionType;
    this.label =
      connectionType === "WINDOWS_SYSTEM" ? "Windows/macOS system printer" : "Browser print dialog";
    this.emitter = new PrinterStatusEmitter(
      this.isSupported()
        ? { state: "connected", message: "Ready — uses the system print dialog" }
        : { state: "unsupported", message: this.supportDetail() }
    );
  }

  isSupported() {
    return typeof window !== "undefined" && typeof window.print === "function";
  }

  supportDetail() {
    if (!this.isSupported()) return "Printing is not available in this environment.";
    return this.connectionType === "WINDOWS_SYSTEM"
      ? "Install the printer's driver in Windows/macOS, then pick it in the print dialog. Set the paper size to your receipt roll."
      : "Available in every browser. Choose the printer and paper size in the print dialog.";
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
    // The OS owns the printer; nothing to open.
  }

  async disconnect(): Promise<void> {
    // Nothing to close.
  }

  /**
   * The receipt markup is rendered by the calling component before this runs,
   * so here we only open the dialog. Byte payloads are ignored by design.
   */
  async print(): Promise<void> {
    if (!this.isSupported()) {
      throw new PrinterError("unsupported", "Printing is not available here.", this.supportDetail());
    }
    window.print();
    this.emitter.markSuccess();
  }
}
