"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer,
  Plug,
  PlugZap,
  FileText,
  Info,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createPrinterProfile,
  deletePrinterProfile,
  setDefaultPrinter,
  updatePrinterProfile,
} from "@/lib/services/printers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { PrinterStatusPill } from "./printer-status-pill";
import { PrintQueuePanel } from "./print-queue-panel";
import { usePrinter } from "@/lib/hooks/use-printer";
import {
  CONNECTION_TYPES,
  DEFAULT_CAPABILITIES,
  PrinterError,
  SUPPORTED_CODE_PAGES,
  buildSampleReceipt,
  connectionTypeInfo,
  type CodePage,
  type ConnectionType,
  type PrinterProfile,
  type PrinterRole,
  type ReceiptWidth,
} from "@/lib/printing";
import { cn, timeAgo } from "@/lib/utils";

const ROLES: { value: PrinterRole; label: string }[] = [
  { value: "RECEIPT", label: "Receipt (cashier)" },
  { value: "KITCHEN", label: "Kitchen tickets" },
  { value: "BAR", label: "Bar tickets" },
  { value: "BACKUP", label: "Backup" },
];

function describeError(error: unknown): { message: string; hint?: string } {
  if (error instanceof PrinterError) return { message: error.message, hint: error.hint };
  return { message: error instanceof Error ? error.message : "Printing failed." };
}

export function PrinterManager({
  profiles,
  editable,
}: {
  profiles: PrinterProfile[];
  /** Admins can add/edit/delete printers; cashiers only select and test. */
  editable?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { service, profile, profiles: available, status, jobs, selectPrinter, ready } =
    usePrinter(profiles);

  const [busy, setBusy] = useState<"connect" | "test" | "save" | null>(null);
  const [lastError, setLastError] = useState<{ message: string; hint?: string } | null>(null);
  const [draft, setDraft] = useState<PrinterProfile | null>(null);

  const editing = draft ?? profile;
  const info = connectionTypeInfo(editing.connectionType);
  const sample = useMemo(
    () => buildSampleReceipt(editing.paperWidth, info.label),
    [editing.paperWidth, info.label]
  );

  const patchDraft = useCallback(
    (patch: Partial<PrinterProfile>) => setDraft((prev) => ({ ...(prev ?? profile), ...patch })),
    [profile]
  );

  const handleConnect = useCallback(async () => {
    if (!service) return;
    setBusy("connect");
    setLastError(null);
    try {
      await service.connect();
      toast.success("Printer connected");
    } catch (error) {
      const described = describeError(error);
      setLastError(described);
      if (!(error instanceof PrinterError && error.code === "cancelled")) {
        toast.error(described.message, { description: described.hint });
      }
    } finally {
      setBusy(null);
    }
  }, [service]);

  const handleDisconnect = useCallback(async () => {
    if (!service) return;
    await service.disconnect();
    setLastError(null);
  }, [service]);

  const handleTestPrint = useCallback(async () => {
    if (!service) return;
    setBusy("test");
    setLastError(null);
    try {
      await service.testPrint(sample);
      toast.success(
        service.usesSystemDialog ? "Print dialog opened" : "Test receipt sent to the printer"
      );
    } catch (error) {
      const described = describeError(error);
      setLastError(described);
      toast.error(described.message, { description: described.hint });
    } finally {
      setBusy(null);
    }
  }, [service, sample]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setBusy("save");
    try {
      const supabase = createClient();
      await updatePrinterProfile(supabase, draft.id, draft);
      toast.success("Printer saved");
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save printer");
    } finally {
      setBusy(null);
    }
  }, [draft, router]);

  const handleAdd = useCallback(async () => {
    try {
      const supabase = createClient();
      const created = await createPrinterProfile(supabase, {
        name: `Printer ${profiles.length + 1}`,
        role: "RECEIPT",
        connectionType: "BROWSER",
        paperWidth: 80,
        encoding: "CP437",
        capabilities: DEFAULT_CAPABILITIES,
        connection: {},
        feedLines: 4,
        copies: 1,
        autoReconnect: true,
        isDefault: profiles.length === 0,
        active: true,
      });
      selectPrinter(created.id);
      toast.success("Printer added");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add printer");
    }
  }, [profiles.length, router, selectPrinter]);

  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      title: `Delete "${profile.name}"?`,
      description: "Devices using this printer will fall back to the default.",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await deletePrinterProfile(supabase, profile.id);
      setDraft(null);
      toast.success("Printer deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete printer");
    }
  }, [confirm, profile, router]);

  const handleMakeDefault = useCallback(async () => {
    try {
      const supabase = createClient();
      await setDefaultPrinter(supabase, profile.id, profile.role);
      toast.success(`Default ${profile.role.toLowerCase()} printer set`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set default");
    }
  }, [profile, router]);

  if (!ready || !service) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading printer…
        </CardContent>
      </Card>
    );
  }

  const supported = service.isSupported();
  const needs = (field: (typeof info.fields)[number]) => info.fields.includes(field);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4" /> {profile.name}
              {profile.isDefault && <Badge variant="brand">Default</Badge>}
            </CardTitle>
            <PrinterStatusPill status={status} />
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              The printer selected here applies to <strong>this device only</strong>, so each till,
              tablet or phone can use different hardware. Printer definitions themselves are shared.
            </div>

            {available.length > 1 && (
              <div>
                <Label htmlFor="active-printer">Printer for this device</Label>
                <Select
                  id="active-printer"
                  value={profile.id}
                  onChange={(e) => {
                    selectPrinter(e.target.value);
                    setDraft(null);
                    setLastError(null);
                  }}
                >
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {connectionTypeInfo(p.connectionType).label}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                supported ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"
              )}
            >
              {supported ? (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>{service.supportDetail()}</span>
            </div>

            {(status.lastSuccessAt || status.lastError) && (
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground">Last successful print</div>
                  <div className="font-medium">
                    {status.lastSuccessAt ? timeAgo(status.lastSuccessAt) : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground">Last error</div>
                  <div className="font-medium text-red-700">{status.lastError ?? "—"}</div>
                </div>
              </div>
            )}

            {lastError && (
              <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                <p className="font-medium">🔴 {lastError.message}</p>
                {lastError.hint && <p className="text-xs">{lastError.hint}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleConnect}>
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                  {available.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById("active-printer")?.focus()}
                    >
                      Choose another printer
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      patchDraft({ connectionType: "BROWSER" });
                      toast.message("Switched to browser print — save to keep this.");
                    }}
                  >
                    Use browser print
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {service.adapter.requiresConnection && (
                <>
                  <Button onClick={handleConnect} loading={busy === "connect"} disabled={!supported}>
                    <PlugZap className="h-4 w-4" />
                    {status.state === "connected" ? "Reconnect" : "Connect"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={status.state !== "connected"}
                  >
                    <Plug className="h-4 w-4" /> Disconnect
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                onClick={handleTestPrint}
                loading={busy === "test"}
                disabled={!supported}
              >
                <FileText className="h-4 w-4" /> Print Test Receipt
              </Button>
            </div>
          </CardContent>
        </Card>

        {editable && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Configure printer</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleAdd}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
                {!profile.isDefault && (
                  <Button size="sm" variant="outline" onClick={handleMakeDefault}>
                    Make default
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-name">Printer name</Label>
                  <Input
                    id="p-name"
                    value={editing.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="p-role">Used for</Label>
                  <Select
                    id="p-role"
                    value={editing.role}
                    onChange={(e) => patchDraft({ role: e.target.value as PrinterRole })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="p-connection">How is it connected?</Label>
                <Select
                  id="p-connection"
                  value={editing.connectionType}
                  onChange={(e) =>
                    patchDraft({ connectionType: e.target.value as ConnectionType })
                  }
                >
                  {CONNECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">{info.blurb}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong>Works on:</strong> {info.platforms}
                </p>
              </div>

              {needs("host") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-host">Printer IP address</Label>
                    <Input
                      id="p-host"
                      value={editing.connection.host ?? ""}
                      onChange={(e) =>
                        patchDraft({ connection: { ...editing.connection, host: e.target.value } })
                      }
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-port">Port</Label>
                    <Input
                      id="p-port"
                      type="number"
                      value={editing.connection.port ?? 9100}
                      onChange={(e) =>
                        patchDraft({
                          connection: { ...editing.connection, port: Number(e.target.value) },
                        })
                      }
                      placeholder="9100"
                    />
                  </div>
                </div>
              )}

              {needs("bridgeUrl") && (
                <div>
                  <Label htmlFor="p-bridge">Bridge URL</Label>
                  <Input
                    id="p-bridge"
                    value={editing.connection.bridgeUrl ?? ""}
                    onChange={(e) =>
                      patchDraft({
                        connection: { ...editing.connection, bridgeUrl: e.target.value },
                      })
                    }
                    placeholder="http://192.168.1.20:8080"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run <code>node scripts/print-bridge.mjs</code> on the machine with the printer.
                  </p>
                </div>
              )}

              {needs("bleUuids") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-svc">BLE service UUID (optional)</Label>
                    <Input
                      id="p-svc"
                      value={editing.connection.bleServiceUuid ?? ""}
                      onChange={(e) =>
                        patchDraft({
                          connection: { ...editing.connection, bleServiceUuid: e.target.value },
                        })
                      }
                      placeholder="auto-detected"
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-chr">BLE characteristic UUID (optional)</Label>
                    <Input
                      id="p-chr"
                      value={editing.connection.bleCharacteristicUuid ?? ""}
                      onChange={(e) =>
                        patchDraft({
                          connection: {
                            ...editing.connection,
                            bleCharacteristicUuid: e.target.value,
                          },
                        })
                      }
                      placeholder="auto-detected"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="p-width">Paper width</Label>
                  <Select
                    id="p-width"
                    value={String(editing.paperWidth)}
                    onChange={(e) =>
                      patchDraft({ paperWidth: Number(e.target.value) as ReceiptWidth })
                    }
                  >
                    <option value="58">58 mm (32 characters)</option>
                    <option value="80">80 mm (48 characters)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="p-encoding">Character encoding</Label>
                  <Select
                    id="p-encoding"
                    value={editing.encoding}
                    onChange={(e) => patchDraft({ encoding: e.target.value as CodePage })}
                  >
                    {SUPPORTED_CODE_PAGES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="p-copies">Copies</Label>
                  <Input
                    id="p-copies"
                    type="number"
                    min={1}
                    max={5}
                    value={editing.copies}
                    onChange={(e) => patchDraft({ copies: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-feed">Feed lines after receipt</Label>
                  <Input
                    id="p-feed"
                    type="number"
                    min={0}
                    max={20}
                    value={editing.feedLines}
                    onChange={(e) => patchDraft({ feedLines: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="p-density">Print density (optional)</Label>
                  <Select
                    id="p-density"
                    value={String(editing.connection.density ?? "")}
                    onChange={(e) =>
                      patchDraft({
                        connection: {
                          ...editing.connection,
                          density: e.target.value === "" ? undefined : Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value="">Printer default</option>
                    <option value="0">Light</option>
                    <option value="1">Normal</option>
                    <option value="2">Dark</option>
                  </Select>
                </div>
              </div>

              <fieldset className="rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">
                  Printer capabilities — commands are only sent when enabled
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["supportsCut", "Has an auto-cutter"],
                      ["supportsQRCode", "Can print QR codes"],
                      ["supportsBarcode", "Can print barcodes"],
                      ["supportsBold", "Supports bold text"],
                      ["supportsDrawer", "Has a cash drawer port"],
                      ["supportsImages", "Supports images/logos"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.capabilities[key]}
                        onChange={(e) =>
                          patchDraft({
                            capabilities: { ...editing.capabilities, [key]: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.autoReconnect}
                  onChange={(e) => patchDraft({ autoReconnect: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Reconnect automatically if the printer drops
              </label>

              {draft && (
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button loading={busy === "save"} onClick={handleSave}>
                    <Save className="h-4 w-4" /> Save printer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <PrintQueuePanel jobs={jobs} onRetry={(id) => service.retry(id)} />

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5 text-xs text-amber-900">
            <p className="font-semibold">Hardware verification status</p>
            <p className="mt-1">
              Only <strong>browser/system print</strong> has been verified end to end here, plus
              the LAN and bridge transports against mock printers. Bluetooth BLE, RawBT and real
              hardware have not been tested — treat a successful test print on your own printer as
              the real confirmation.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Test receipt preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border bg-white p-2">
            <ReceiptDocument data={sample} profile={editing} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rendered with the same layout engine as the printed output at {editing.paperWidth}mm,
            so wrapping and column alignment match the paper exactly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
