import { NextResponse } from "next/server";
import { Socket } from "node:net";
import { requireRole } from "@/lib/auth/require-role";

export const runtime = "nodejs";

const CONNECT_TIMEOUT_MS = 6000;
const MAX_PAYLOAD_BYTES = 512 * 1024;

/**
 * Ports that raw ESC/POS network printers actually listen on. An allowlist
 * keeps this endpoint from being used as a general-purpose port scanner.
 */
const ALLOWED_PORTS = new Set([9100, 9101, 9102, 515, 631]);

/**
 * Only private/loopback addresses are reachable. A receipt printer is always
 * on the local network, so refusing public addresses removes this route as an
 * SSRF pivot toward the internet without limiting legitimate use.
 */
function isPrivateAddress(host: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) {
    // Allow bare hostnames/.local for mDNS printers, but never a public FQDN.
    return /^[a-z0-9-]+(\.local)?$/i.test(host);
  }

  const [a, b, c, d] = ipv4.slice(1).map(Number);
  if ([a, b, c, d].some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

function sendToPrinter(host: string, port: number, data: Buffer, write: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(message));
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("timeout", () => fail(`Timed out connecting to ${host}:${port}`));
    socket.once("error", (error: NodeJS.ErrnoException) => {
      const reason =
        error.code === "ECONNREFUSED"
          ? "Connection refused — is the printer switched on and on this network?"
          : error.code === "EHOSTUNREACH" || error.code === "ENETUNREACH"
            ? "Host unreachable — check the IP address and that the server shares the printer's network."
            : error.message;
      fail(reason);
    });

    socket.connect(port, host, () => {
      if (!write) {
        settled = true;
        socket.end();
        resolve();
        return;
      }
      socket.write(data, () => {
        settled = true;
        socket.end();
        resolve();
      });
    });

    socket.once("close", () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });
  });
}

/**
 * Sends ESC/POS bytes to a LAN/Wi-Fi/Ethernet printer over raw TCP.
 *
 * This must run server-side: browsers cannot open TCP sockets. The trade-off
 * is that the *server* has to share a network with the printer — fine for a
 * self-hosted/on-premise deployment, impossible on a cloud host like Vercel,
 * where the print bridge running on the counter machine is the answer instead.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["admin", "cashier", "kitchen", "waiter"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const host = String(body?.host ?? "").trim();
  const port = Number(body?.port ?? 9100);
  const probeOnly = body?.probeOnly === true;
  const base64 = typeof body?.base64 === "string" ? body.base64 : "";

  if (!host) {
    return NextResponse.json({ error: "Printer IP address is required" }, { status: 400 });
  }
  if (!isPrivateAddress(host)) {
    return NextResponse.json(
      {
        error:
          "Only local network addresses are allowed (10.x, 172.16–31.x, 192.168.x, 127.x or a .local hostname).",
      },
      { status: 400 }
    );
  }
  if (!Number.isInteger(port) || !ALLOWED_PORTS.has(port)) {
    return NextResponse.json(
      { error: `Port ${port} is not an allowed printer port (9100, 9101, 9102, 515, 631).` },
      { status: 400 }
    );
  }

  let data = Buffer.alloc(0);
  if (!probeOnly) {
    if (!base64) {
      return NextResponse.json({ error: "Nothing to print" }, { status: 400 });
    }
    data = Buffer.from(base64, "base64");
    if (data.byteLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Print job too large" }, { status: 413 });
    }
  }

  try {
    await sendToPrinter(host, port, data, !probeOnly);
    return NextResponse.json({ ok: true, bytes: data.byteLength });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reach the printer" },
      { status: 502 }
    );
  }
}
