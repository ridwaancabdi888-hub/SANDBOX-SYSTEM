import { BleAdapter } from "./adapters/ble";
import { BridgeAdapter } from "./adapters/bridge";
import { BrowserAdapter } from "./adapters/browser";
import { LanAdapter } from "./adapters/lan";
import { RawBtAdapter } from "./adapters/rawbt";
import { renderEscPos } from "./escpos-renderer";
import { rasterizeLogo } from "./raster";
import { buildReceiptDoc } from "./receipt-model";
import { printQueue, type PrintQueue } from "./queue";
import {
  PrinterError,
  type ConnectionType,
  type PrintJob,
  type PrinterAdapter,
  type PrinterProfile,
  type PrinterStatus,
  type ReceiptData,
} from "./types";

/** Adapters are cached per connection type so a BLE pairing survives navigation. */
const adapterCache = new Map<ConnectionType, PrinterAdapter>();

export function getAdapter(connectionType: ConnectionType): PrinterAdapter {
  const cached = adapterCache.get(connectionType);
  if (cached) return cached;

  let adapter: PrinterAdapter;
  switch (connectionType) {
    case "BLUETOOTH_BLE":
      adapter = new BleAdapter();
      break;
    // On Android, Classic/SPP is reachable only through RawBT — Web Bluetooth
    // cannot speak RFCOMM, so both types share that adapter.
    case "BLUETOOTH_CLASSIC":
    case "RAWBT":
      adapter = new RawBtAdapter(connectionType);
      break;
    case "LAN":
      adapter = new LanAdapter();
      break;
    case "USB_BRIDGE":
    case "IOS_BRIDGE":
      adapter = new BridgeAdapter(connectionType);
      break;
    case "WINDOWS_SYSTEM":
      adapter = new BrowserAdapter("WINDOWS_SYSTEM");
      break;
    case "BROWSER":
    default:
      adapter = new BrowserAdapter("BROWSER");
      break;
  }

  adapterCache.set(connectionType, adapter);
  return adapter;
}

export interface PrintRequest {
  receipt: ReceiptData;
  /** Dedupe key — same key twice in quick succession prints once. */
  idempotencyKey?: string;
  orderId?: string;
  label?: string;
}

/**
 * The single entry point the POS talks to.
 *
 *   Cashier -> PrinterService -> PrinterAdapter -> printer
 *
 * Cashier components never import an adapter, never build ESC/POS and never
 * branch on connection type. Swapping transports is a settings change.
 */
export class PrinterService {
  private profile: PrinterProfile;
  private queue: PrintQueue;

  constructor(profile: PrinterProfile, queue: PrintQueue = printQueue) {
    this.profile = profile;
    this.queue = queue;
  }

  getProfile(): PrinterProfile {
    return this.profile;
  }

  setProfile(profile: PrinterProfile) {
    this.profile = profile;
  }

  get adapter(): PrinterAdapter {
    return getAdapter(this.profile.connectionType);
  }

  /** True when this transport renders via the OS rather than ESC/POS bytes. */
  get usesSystemDialog(): boolean {
    return !this.adapter.acceptsEscPos;
  }

  isSupported(): boolean {
    return this.adapter.isSupported();
  }

  supportDetail(): string {
    return this.adapter.supportDetail();
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  getStatus(): PrinterStatus {
    return this.adapter.getStatus();
  }

  subscribe(listener: (status: PrinterStatus) => void) {
    return this.adapter.subscribe(listener);
  }

  subscribeToQueue(listener: (jobs: PrintJob[]) => void) {
    return this.queue.subscribe(listener);
  }

  async connect(): Promise<void> {
    await this.adapter.connect(this.profile);
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }

  /** Renders a receipt to this profile's bytes without sending anything. */
  render(receipt: ReceiptData): Uint8Array {
    const doc = buildReceiptDoc({ ...receipt, widthMm: this.profile.paperWidth }, this.profile);
    return renderEscPos(doc, this.profile);
  }

  /**
   * `render`, plus the logo converted to a bitmap for this printer head.
   *
   * Separate from `render` because rasterising needs a canvas and a network
   * fetch. A printer that doesn't claim `supportsImages` never pays that cost,
   * and a logo that fails to load is dropped rather than failing the receipt.
   */
  private async renderForPrint(receipt: ReceiptData): Promise<Uint8Array> {
    const profile = this.profile;
    if (!profile.capabilities.supportsImages || !receipt.logoUrl || !this.adapter.acceptsEscPos) {
      return this.render(receipt);
    }
    const logo = await rasterizeLogo(receipt.logoUrl, profile.paperWidth);
    return this.render({ ...receipt, logo });
  }

  /**
   * Queues a receipt. Resolves when it has printed, rejects with a
   * PrinterError the UI can act on. Honours `copies`.
   */
  print(request: PrintRequest): Promise<PrintJob> {
    const label = request.label ?? `Receipt #${request.receipt.orderNumber}`;
    const profile = this.profile;
    const adapter = this.adapter;

    return new Promise((resolve, reject) => {
      const job = this.queue.enqueue({
        label,
        printerId: profile.id,
        orderId: request.orderId,
        idempotencyKey: request.idempotencyKey,
        run: async () => {
          if (!adapter.isSupported()) {
            throw new PrinterError("unsupported", `${adapter.label} is unavailable on this device.`, adapter.supportDetail());
          }
          // Rendered inside the job so a retry re-renders — and so the logo is
          // fetched once the job actually reaches the head of the queue.
          const bytes = await this.renderForPrint(request.receipt);
          for (let copy = 0; copy < Math.max(1, profile.copies); copy++) {
            await adapter.print({ bytes, label }, profile);
          }
        },
      });

      // Resolve/reject once this specific job settles.
      const unsubscribe = this.queue.subscribe((jobs) => {
        const current = jobs.find((j) => j.id === job.id);
        if (!current) return;
        if (current.status === "PRINTED") {
          unsubscribe();
          resolve(current);
        } else if (current.status === "FAILED" || current.status === "CANCELLED") {
          unsubscribe();
          reject(
            new PrinterError(
              "printer_offline",
              current.error ?? "Printing failed.",
              "Retry, pick another printer, or use Browser print as a fallback."
            )
          );
        }
      });
    });
  }

  /** Prints the built-in alignment/capability sample. */
  testPrint(sample: ReceiptData): Promise<PrintJob> {
    return this.print({
      receipt: sample,
      label: "Test receipt",
      idempotencyKey: `test-${Date.now()}`,
    });
  }

  retry(jobId: string) {
    this.queue.retry(jobId);
  }

  cancel(jobId: string) {
    this.queue.cancel(jobId);
  }
}

export function createPrinterService(profile: PrinterProfile): PrinterService {
  return new PrinterService(profile);
}
