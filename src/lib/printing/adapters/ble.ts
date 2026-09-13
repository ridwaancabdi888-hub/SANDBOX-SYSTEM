import {
  PrinterError,
  PrinterStatusEmitter,
  type PrintPayload,
  type PrinterAdapter,
  type PrinterProfile,
  type PrinterStatus,
} from "../types";

/**
 * Service UUIDs used by common generic ESC/POS BLE modules. Discovery also
 * falls back to scanning every service, so an unlisted module still works.
 */
export const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Zjiang / Goojprt / many clones
  "0000ff00-0000-1000-8000-00805f9b34fb", // assorted Chinese modules
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 style transparent UART
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip/ISSC transparent UART
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // some portable units
];

/**
 * Conservative default: the ATT MTU starts at 23 bytes (20 usable). Chrome
 * usually negotiates higher but never guarantees it, and oversized writes are
 * silently truncated by some firmware — which looks like "half a receipt".
 */
const CHUNK_SIZE = 20;
const CHUNK_DELAY_MS = 24;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bluetooth **Low Energy** ESC/POS printing via Web Bluetooth.
 *
 * HARD PLATFORM LIMITS (not implementation gaps):
 *  1. Web Bluetooth speaks BLE GATT only — it cannot reach Bluetooth
 *     Classic/SPP printers. Those need the RawBT or bridge adapter.
 *  2. No iOS browser implements Web Bluetooth.
 *  3. Requires a secure context (HTTPS/localhost) and a real user gesture.
 *  4. Android additionally needs Location enabled for BLE scanning.
 */
export class BleAdapter implements PrinterAdapter {
  readonly connectionType = "BLUETOOTH_BLE" as const;
  readonly label = "Bluetooth (BLE direct)";
  readonly requiresConnection = true;
  readonly acceptsEscPos = true;

  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private emitter: PrinterStatusEmitter;
  private profile: PrinterProfile | null = null;

  private onDisconnected = () => {
    this.characteristic = null;
    this.emitter.set({
      state: "error",
      deviceName: this.device?.name ?? null,
      message: "Printer disconnected. Power it on and press Connect.",
    });
    if (this.profile?.autoReconnect) void this.tryReconnect();
  };

  constructor() {
    this.emitter = new PrinterStatusEmitter(
      this.isSupported()
        ? { state: "idle", message: "Not connected" }
        : { state: "unsupported", message: this.supportDetail() }
    );
  }

  isSupported() {
    return (
      typeof navigator !== "undefined" &&
      "bluetooth" in navigator &&
      typeof window !== "undefined" &&
      window.isSecureContext
    );
  }

  supportDetail() {
    if (typeof navigator === "undefined") return "Not available during server rendering.";
    if (!("bluetooth" in navigator)) {
      return "This browser has no Web Bluetooth API. Use Chrome or Edge on Android/desktop — no iOS browser supports it.";
    }
    if (!window.isSecureContext) {
      return "Web Bluetooth requires HTTPS (or localhost). Serve the app over HTTPS to enable it.";
    }
    return "Available. Works only with BLE printers — Bluetooth Classic/SPP printers cannot be reached from any browser.";
  }

  isConnected() {
    return !!this.characteristic && !!this.device?.gatt?.connected;
  }

  getStatus(): PrinterStatus {
    return this.emitter.get();
  }

  subscribe(listener: (status: PrinterStatus) => void) {
    return this.emitter.subscribe(listener);
  }

  private async tryReconnect() {
    try {
      if (this.device && this.profile) {
        await sleep(1500);
        await this.connect(this.profile);
      }
    } catch {
      // Leave the error status in place; the cashier can retry manually.
    }
  }

  /**
   * Finds a writable characteristic: preferred UUIDs from the profile first,
   * then the well-known printer services, then any service at all — cheap
   * modules routinely expose non-standard UUIDs.
   */
  private async discoverCharacteristic(
    server: BluetoothRemoteGATTServer,
    profile: PrinterProfile
  ) {
    const preferred = profile.connection.bleServiceUuid?.toLowerCase();

    if (preferred && profile.connection.bleCharacteristicUuid) {
      try {
        const service = await server.getPrimaryService(preferred);
        return await service.getCharacteristic(
          profile.connection.bleCharacteristicUuid.toLowerCase()
        );
      } catch {
        // Fall through to discovery — a stale override shouldn't be fatal.
      }
    }

    const services = await server.getPrimaryServices().catch(() => []);
    if (!services.length) {
      throw new PrinterError(
        "characteristic_not_found",
        "No GATT services found on this device.",
        "It may be a Bluetooth Classic (SPP) printer, which browsers cannot reach. Use RawBT on Android."
      );
    }

    const ordered = [
      ...services.filter((s) => KNOWN_PRINTER_SERVICES.includes(s.uuid.toLowerCase())),
      ...services.filter((s) => !KNOWN_PRINTER_SERVICES.includes(s.uuid.toLowerCase())),
    ];

    for (const service of ordered) {
      const characteristics = await service.getCharacteristics().catch(() => []);
      for (const candidate of characteristics) {
        if (candidate.properties.write || candidate.properties.writeWithoutResponse) {
          return candidate;
        }
      }
    }

    throw new PrinterError(
      "characteristic_not_found",
      "This device exposes no writable characteristic.",
      "It is probably not a BLE ESC/POS printer. If it is Classic/SPP, use RawBT on Android."
    );
  }

  async connect(profile: PrinterProfile): Promise<void> {
    this.profile = profile;
    if (!this.isSupported()) {
      throw new PrinterError("unsupported", "Web Bluetooth is not available here.", this.supportDetail());
    }

    this.emitter.set({ state: "connecting", message: "Select your printer…" });

    try {
      if (!this.device) {
        // acceptAllDevices, not a service filter: most printers omit their
        // service UUID from the advertisement, so filtering by service shows
        // an empty chooser and the printer can never be selected.
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            ...KNOWN_PRINTER_SERVICES,
            ...(profile.connection.bleServiceUuid ? [profile.connection.bleServiceUuid] : []),
          ],
        });
        this.device.addEventListener("gattserverdisconnected", this.onDisconnected);
      }

      this.emitter.set({
        state: "connecting",
        deviceName: this.device.name ?? null,
        message: "Connecting…",
      });

      const server = await this.device.gatt!.connect();
      this.characteristic = await this.discoverCharacteristic(server, profile);

      this.emitter.set({
        state: "connected",
        deviceName: this.device.name ?? null,
        message: "Ready to print",
      });
    } catch (error) {
      this.characteristic = null;
      const printerError = this.toPrinterError(error);
      if (printerError.code === "cancelled") {
        this.emitter.set({ state: "idle", message: "Not connected" });
      } else {
        this.emitter.markError(printerError);
      }
      throw printerError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.device?.removeEventListener("gattserverdisconnected", this.onDisconnected);
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } finally {
      this.characteristic = null;
      this.device = null;
      this.emitter.set({ state: "idle", message: "Not connected" });
    }
  }

  private toPrinterError(error: unknown): PrinterError {
    if (error instanceof PrinterError) return error;
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof DOMException) {
      if (error.name === "NotFoundError") {
        return new PrinterError(
          "cancelled",
          "No printer was selected.",
          "Press Connect again and pick your printer from the list."
        );
      }
      if (error.name === "SecurityError") {
        return new PrinterError("unsupported", "Blocked by the browser.", this.supportDetail());
      }
      if (error.name === "NetworkError") {
        return new PrinterError(
          "connect_failed",
          "Could not connect to the printer.",
          "Check it is powered on, in range, has paper, and is not already connected to another device."
        );
      }
    }
    return new PrinterError("write_failed", message, "Reconnect the printer and try again.");
  }

  private async writeChunk(chunk: Uint8Array) {
    const characteristic = this.characteristic!;
    // Copy into a standalone ArrayBuffer: a subarray view of a larger buffer
    // is not a valid BufferSource for the Web Bluetooth typings.
    const buffer = new ArrayBuffer(chunk.length);
    new Uint8Array(buffer).set(chunk);

    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(buffer);
    } else {
      await characteristic.writeValueWithResponse(buffer);
    }
  }

  async print(payload: PrintPayload, profile: PrinterProfile): Promise<void> {
    this.profile = profile;
    if (!this.isConnected()) await this.connect(profile);

    if (!this.characteristic) {
      throw new PrinterError(
        "not_connected",
        "Printer is not connected.",
        "Open Printer settings and press Connect."
      );
    }

    const { bytes } = payload;
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
      try {
        await this.writeChunk(chunk);
      } catch (error) {
        if (!this.device?.gatt?.connected) {
          const disconnected = new PrinterError(
            "disconnected",
            "Printer disconnected while printing.",
            "The receipt may be partially printed. Reconnect and reprint it."
          );
          this.emitter.markError(disconnected);
          throw disconnected;
        }
        const printerError = this.toPrinterError(error);
        this.emitter.markError(printerError);
        throw printerError;
      }
      await sleep(CHUNK_DELAY_MS);
    }

    this.emitter.markSuccess();
  }
}
