// ---------------------------------------------------------------------------
// Canonical receipt input
// ---------------------------------------------------------------------------

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  note?: string | null;
}

export type ReceiptWidth = 58 | 80;

/**
 * A 1-bit bitmap ready for ESC/POS `GS v 0`: one bit per pixel, packed eight
 * pixels to a byte left-to-right, rows padded to a byte boundary. A set bit
 * burns a dot.
 */
export interface RasterImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface ReceiptData {
  cafeteriaName: string;
  /** Cafeteria logo. Shown on the HTML/browser receipt whenever present. */
  logoUrl?: string | null;
  /**
   * The same logo rasterised for this printer. Only ESC/POS transports need
   * it, it is resolved at print time, and a printer without `supportsImages`
   * simply never receives it.
   */
  logo?: RasterImage | null;
  header?: string | null;
  footer?: string | null;
  address?: string | null;
  phone?: string | null;
  orderNumber: number;
  date: string;
  cashierName: string;
  locationName?: string | null;
  source: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  currency: string;
  widthMm: ReceiptWidth;
  /** Stamped when re-issuing an already-printed receipt. */
  reprint?: boolean;
  /** Kitchen/bar tickets omit money and show prep detail instead. */
  variant?: "RECEIPT" | "TICKET";
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

/**
 * User-facing connection types. Several map onto the same wire protocol but
 * are kept distinct because setup instructions, capability defaults and
 * platform support differ — a cafeteria owner picks "USB printer", not
 * "HTTP bridge with a serial target".
 */
export type ConnectionType =
  | "BROWSER"
  | "BLUETOOTH_BLE"
  | "BLUETOOTH_CLASSIC"
  | "RAWBT"
  | "LAN"
  | "USB_BRIDGE"
  | "WINDOWS_SYSTEM"
  | "IOS_BRIDGE";

export type PrinterRole = "RECEIPT" | "KITCHEN" | "BAR" | "BACKUP";

export type CodePage = "CP437" | "CP850" | "CP858" | "CP1252";

export interface PrinterCapabilities {
  supportsCut: boolean;
  supportsDrawer: boolean;
  supportsQRCode: boolean;
  supportsBarcode: boolean;
  supportsBold: boolean;
  supportsImages: boolean;
}

export const DEFAULT_CAPABILITIES: PrinterCapabilities = {
  supportsCut: false,
  supportsDrawer: false,
  supportsQRCode: true,
  supportsBarcode: true,
  supportsBold: true,
  supportsImages: false,
};

/** Transport parameters. Which fields matter depends on connectionType. */
export interface PrinterConnectionParams {
  /** LAN/Ethernet/Wi-Fi printer address. */
  host?: string;
  port?: number;
  /** HTTP print bridge base URL (USB_BRIDGE / IOS_BRIDGE). */
  bridgeUrl?: string;
  /** Optional BLE overrides when auto-discovery picks the wrong characteristic. */
  bleServiceUuid?: string;
  bleCharacteristicUuid?: string;
  /** Remembered BLE device name, for display only. */
  deviceName?: string;
  /** ESC/POS print density, when the printer supports GS ( K. */
  density?: number;
}

export interface PrinterProfile {
  id: string;
  name: string;
  role: PrinterRole;
  connectionType: ConnectionType;
  paperWidth: ReceiptWidth;
  encoding: CodePage;
  capabilities: PrinterCapabilities;
  connection: PrinterConnectionParams;
  feedLines: number;
  copies: number;
  autoReconnect: boolean;
  isDefault: boolean;
  active: boolean;
}

export const DEFAULT_PROFILE: PrinterProfile = {
  id: "local-default",
  name: "Receipt Printer",
  role: "RECEIPT",
  connectionType: "BROWSER",
  paperWidth: 80,
  encoding: "CP437",
  capabilities: DEFAULT_CAPABILITIES,
  connection: {},
  feedLines: 4,
  copies: 1,
  autoReconnect: true,
  isDefault: true,
  active: true,
};

// ---------------------------------------------------------------------------
// Status + errors
// ---------------------------------------------------------------------------

export type PrinterConnectionState =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export interface PrinterStatus {
  state: PrinterConnectionState;
  deviceName?: string | null;
  message?: string;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
}

export type PrinterErrorCode =
  | "unsupported"
  | "not_configured"
  | "not_connected"
  | "cancelled"
  | "no_device"
  | "connect_failed"
  | "characteristic_not_found"
  | "disconnected"
  | "write_failed"
  | "bridge_unreachable"
  | "printer_offline";

/**
 * Machine-readable code plus an actionable hint, so the UI can tell a cashier
 * what to do instead of surfacing a raw DOMException.
 */
export class PrinterError extends Error {
  readonly code: PrinterErrorCode;
  readonly hint?: string;

  constructor(code: PrinterErrorCode, message: string, hint?: string) {
    super(message);
    this.name = "PrinterError";
    this.code = code;
    this.hint = hint;
  }
}

// ---------------------------------------------------------------------------
// Print queue
// ---------------------------------------------------------------------------

export type PrintJobStatus = "QUEUED" | "PRINTING" | "PRINTED" | "FAILED" | "CANCELLED";

export interface PrintJob {
  id: string;
  label: string;
  printerId: string;
  orderId?: string;
  status: PrintJobStatus;
  attempts: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  /** Repeat submissions with the same key are ignored — duplicate guard. */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

export interface PrinterAdapter {
  readonly connectionType: ConnectionType;
  readonly label: string;
  /** True when the user explicitly opens/closes a connection (BLE, LAN, bridge). */
  readonly requiresConnection: boolean;
  /** Can this transport emit raw ESC/POS, or does it render via the OS? */
  readonly acceptsEscPos: boolean;

  isSupported(): boolean;
  supportDetail(): string;
  isConnected(): boolean;
  getStatus(): PrinterStatus;
  subscribe(listener: (status: PrinterStatus) => void): () => void;

  connect(profile: PrinterProfile): Promise<void>;
  disconnect(): Promise<void>;
  /** Sends an already-rendered payload for this profile. */
  print(payload: PrintPayload, profile: PrinterProfile): Promise<void>;
}

/**
 * A receipt rendered for a specific transport. ESC/POS adapters read `bytes`;
 * the browser/OS adapters render the DOM instead and only need to know that a
 * job happened.
 */
export interface PrintPayload {
  bytes: Uint8Array;
  /** Human label used in queue entries and logs. */
  label: string;
}

/** Shared status broadcasting for stateful adapters. */
export class PrinterStatusEmitter {
  private listeners = new Set<(status: PrinterStatus) => void>();
  private status: PrinterStatus;

  constructor(initial: PrinterStatus) {
    this.status = initial;
  }

  get(): PrinterStatus {
    return this.status;
  }

  set(patch: Partial<PrinterStatus> & Pick<PrinterStatus, "state">) {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener(this.status);
  }

  markSuccess() {
    this.set({
      state: "connected",
      message: "Last print succeeded",
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    });
  }

  markError(error: PrinterError) {
    this.set({
      state: "error",
      message: error.message,
      lastError: error.message,
      lastErrorAt: new Date().toISOString(),
    });
  }

  subscribe(listener: (status: PrinterStatus) => void) {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
