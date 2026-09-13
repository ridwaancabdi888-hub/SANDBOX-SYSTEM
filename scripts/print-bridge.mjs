#!/usr/bin/env node
/**
 * SANDBOX print bridge — reference implementation.
 *
 * A tiny HTTP server that accepts ESC/POS jobs from the web app and forwards
 * the raw bytes to a printer the browser cannot reach directly. Use it when:
 *
 *   - you are on iOS (no browser there implements Web Bluetooth), or
 *   - the printer is a network/LAN printer (almost all speak raw TCP 9100), or
 *   - the printer is attached by USB/serial to a machine on the counter.
 *
 * It implements the contract the app's "bridge" backend expects:
 *
 *   GET  /status -> 200 { ok: true, printer: "<description>" }
 *   POST /print  -> 200 { ok: true }        body: { base64: "<ESC/POS>" }
 *
 * Usage:
 *   node scripts/print-bridge.mjs --target tcp://192.168.1.50:9100
 *   node scripts/print-bridge.mjs --target serial://COM3
 *   node scripts/print-bridge.mjs --target stdout        (dry run / debugging)
 *
 * Options:
 *   --port <n>     HTTP port to listen on (default 8080)
 *   --target <uri> where to send bytes (default stdout)
 *   --host <addr>  interface to bind (default 0.0.0.0 so tablets can reach it)
 *
 * Then set Printer settings -> Network / native bridge -> Bridge URL to
 * http://<this-machine-ip>:8080
 *
 * NOTE: serving the app over HTTPS while the bridge is plain HTTP will be
 * blocked by the browser as mixed content. Either run the app over HTTP on the
 * LAN, put the bridge behind HTTPS, or use localhost (treated as secure).
 */
import { createServer } from "node:http";
import { connect } from "node:net";
import { writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = { port: 8080, target: "stdout", host: "0.0.0.0" };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value) args[key] = key === "port" ? Number(value) : value;
  }
  return args;
}

const args = parseArgs(process.argv);

/** Sends raw bytes to a raw-TCP (JetDirect / port 9100) printer. */
function sendTcp(bytes, host, port) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port }, () => {
      socket.write(bytes, () => socket.end());
    });
    socket.setTimeout(10_000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Timed out talking to printer at ${host}:${port}`));
    });
    socket.on("error", reject);
    socket.on("close", resolve);
  });
}

/**
 * Serial/USB printers appear as a character device. Writing the raw bytes to
 * it is enough for ESC/POS — no driver negotiation involved.
 */
async function sendSerial(bytes, devicePath) {
  await writeFile(devicePath, bytes);
}

async function dispatch(bytes) {
  const target = args.target;

  if (target === "stdout") {
    process.stdout.write(`\n--- ESC/POS job (${bytes.length} bytes) ---\n`);
    process.stdout.write(bytes.toString("latin1").replace(/\x1b/g, "<ESC>").replace(/\x1d/g, "<GS>"));
    process.stdout.write("\n--- end of job ---\n");
    return;
  }

  if (target.startsWith("tcp://")) {
    const [host, port] = target.slice(6).split(":");
    await sendTcp(bytes, host, Number(port) || 9100);
    return;
  }

  if (target.startsWith("serial://")) {
    await sendSerial(bytes, target.slice(9));
    return;
  }

  throw new Error(`Unsupported target "${target}"`);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    // The app runs on a different origin to this bridge.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  if (req.method === "GET" && req.url === "/status") {
    return json(res, 200, { ok: true, printer: args.target });
  }

  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { base64 } = JSON.parse(body);
        if (typeof base64 !== "string") throw new Error("Missing 'base64' field");
        await dispatch(Buffer.from(base64, "base64"));
        json(res, 200, { ok: true });
      } catch (error) {
        console.error("[print-bridge] job failed:", error.message);
        json(res, 500, { ok: false, error: error.message });
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(args.port, args.host, () => {
  console.log(`[print-bridge] listening on http://${args.host}:${args.port}`);
  console.log(`[print-bridge] forwarding jobs to: ${args.target}`);
  console.log(`[print-bridge] set this as the Bridge URL in Printer settings`);
});
