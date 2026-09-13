import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { BridgeAdapter } from "../adapters/bridge";
import { LanAdapter } from "../adapters/lan";
import { RawBtAdapter } from "../adapters/rawbt";
import { BrowserAdapter } from "../adapters/browser";
import { PrinterError } from "../types";
import { makeProfile } from "./helpers";

const PAYLOAD = { bytes: new Uint8Array([0x1b, 0x40, 0x41, 0x0a]), label: "Test" };

/** Minimal stand-in for a print bridge, so adapters are tested for real. */
function startMockBridge(options: { failPrint?: boolean; statusCode?: number } = {}) {
  const received: string[] = [];
  const server = createServer((req, res) => {
    if (req.url === "/status") {
      res.writeHead(options.statusCode ?? 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, printer: "Mock Thermal" }));
      return;
    }
    if (req.url === "/print") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        if (options.failPrint) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "out of paper" }));
          return;
        }
        received.push(JSON.parse(body).base64);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise<{ server: Server; url: string; received: string[] }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, url: `http://127.0.0.1:${port}`, received });
    });
  });
}

const servers: Server[] = [];
afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

describe("bridge adapter", () => {
  test("reports connected when the bridge responds and names the printer", async () => {
    const mock = await startMockBridge();
    servers.push(mock.server);

    const adapter = new BridgeAdapter("USB_BRIDGE");
    await adapter.connect(makeProfile({ connection: { bridgeUrl: mock.url } }));

    assert.equal(adapter.isConnected(), true);
    assert.equal(adapter.getStatus().state, "connected");
    assert.equal(adapter.getStatus().deviceName, "Mock Thermal");
  });

  test("delivers the exact ESC/POS bytes", async () => {
    const mock = await startMockBridge();
    servers.push(mock.server);

    const adapter = new BridgeAdapter("USB_BRIDGE");
    const profile = makeProfile({ connection: { bridgeUrl: mock.url } });
    await adapter.print(PAYLOAD, profile);

    assert.equal(mock.received.length, 1);
    assert.deepEqual(
      Array.from(Buffer.from(mock.received[0], "base64")),
      Array.from(PAYLOAD.bytes)
    );
  });

  test("surfaces a printer-side failure as an actionable error", async () => {
    const mock = await startMockBridge({ failPrint: true });
    servers.push(mock.server);

    const adapter = new BridgeAdapter("USB_BRIDGE");
    const profile = makeProfile({ connection: { bridgeUrl: mock.url } });

    await assert.rejects(
      () => adapter.print(PAYLOAD, profile),
      (error: unknown) => {
        assert.ok(error instanceof PrinterError);
        assert.equal(error.code, "printer_offline");
        assert.ok(error.hint);
        return true;
      }
    );
    assert.equal(adapter.getStatus().state, "error");
  });

  test("reports an offline bridge rather than hanging", async () => {
    const adapter = new BridgeAdapter("USB_BRIDGE");
    // Nothing is listening on this port.
    const profile = makeProfile({ connection: { bridgeUrl: "http://127.0.0.1:1" } });

    await assert.rejects(
      () => adapter.connect(profile),
      (error: unknown) => {
        assert.ok(error instanceof PrinterError);
        assert.equal(error.code, "bridge_unreachable");
        return true;
      }
    );
  });

  test("refuses to print with no bridge configured", async () => {
    const adapter = new BridgeAdapter("IOS_BRIDGE");
    await assert.rejects(
      () => adapter.print(PAYLOAD, makeProfile()),
      (error: unknown) => {
        assert.ok(error instanceof PrinterError);
        assert.equal(error.code, "not_configured");
        return true;
      }
    );
  });
});

describe("LAN adapter", () => {
  test("requires an IP address before printing", async () => {
    const adapter = new LanAdapter();
    await assert.rejects(
      () => adapter.connect(makeProfile({ connectionType: "LAN" })),
      (error: unknown) => {
        assert.ok(error instanceof PrinterError);
        assert.equal(error.code, "not_configured");
        assert.match(error.message, /IP address/i);
        return true;
      }
    );
  });

  test("posts host, port and payload to the server relay", async () => {
    const calls: Record<string, unknown>[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }) as typeof fetch;

    try {
      const adapter = new LanAdapter();
      const profile = makeProfile({
        connectionType: "LAN",
        connection: { host: "192.168.1.100", port: 9100 },
      });
      await adapter.print(PAYLOAD, profile);

      assert.equal(calls.length, 1);
      assert.equal(calls[0].host, "192.168.1.100");
      assert.equal(calls[0].port, 9100);
      assert.deepEqual(
        Array.from(Buffer.from(String(calls[0].base64), "base64")),
        Array.from(PAYLOAD.bytes)
      );
      assert.equal(adapter.isConnected(), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("turns a relay error into an offline-printer error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 502,
        json: async () => ({ error: "Connection refused — is the printer switched on?" }),
      }) as Response) as typeof fetch;

    try {
      const adapter = new LanAdapter();
      const profile = makeProfile({
        connectionType: "LAN",
        connection: { host: "192.168.1.100", port: 9100 },
      });

      await assert.rejects(
        () => adapter.print(PAYLOAD, profile),
        (error: unknown) => {
          assert.ok(error instanceof PrinterError);
          assert.equal(error.code, "printer_offline");
          assert.match(error.message, /Connection refused/);
          return true;
        }
      );
      assert.equal(adapter.isConnected(), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("RawBT adapter", () => {
  test("is unsupported off Android and says why", () => {
    const adapter = new RawBtAdapter("BLUETOOTH_CLASSIC");
    // No navigator in the test runtime => not Android.
    assert.equal(adapter.isSupported(), false);
    assert.match(adapter.supportDetail(), /Android/);
    assert.equal(adapter.getStatus().state, "unsupported");
  });

  test("refuses to print off Android rather than failing silently", async () => {
    const adapter = new RawBtAdapter("RAWBT");
    await assert.rejects(
      () => adapter.print(PAYLOAD),
      (error: unknown) => {
        assert.ok(error instanceof PrinterError);
        assert.equal(error.code, "unsupported");
        return true;
      }
    );
  });

  test("needs no explicit connection step", () => {
    assert.equal(new RawBtAdapter().requiresConnection, false);
  });
});

describe("browser adapter", () => {
  test("reports unsupported without a window and refuses to print", async () => {
    const adapter = new BrowserAdapter("BROWSER");
    assert.equal(adapter.isSupported(), false);
    await assert.rejects(() => adapter.print(), (error: unknown) => {
      assert.ok(error instanceof PrinterError);
      assert.equal(error.code, "unsupported");
      return true;
    });
  });

  test("does not accept raw ESC/POS — the OS driver renders instead", () => {
    assert.equal(new BrowserAdapter("BROWSER").acceptsEscPos, false);
    assert.equal(new BrowserAdapter("WINDOWS_SYSTEM").acceptsEscPos, false);
  });
});
