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
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

// Printer roles are database values; only the label is translated.
const ROLES: { value: PrinterRole; labelKey: TranslationKey }[] = [
  { value: "RECEIPT", labelKey: "printer.roleReceipt" },
  { value: "KITCHEN", labelKey: "printer.roleKitchen" },
  { value: "BAR", labelKey: "printer.roleBar" },
  { value: "BACKUP", labelKey: "printer.roleBackup" },
];

const CAPABILITIES: { key: keyof PrinterProfile["capabilities"]; labelKey: TranslationKey }[] = [
  { key: "supportsCut", labelKey: "printer.capCut" },
  { key: "supportsQRCode", labelKey: "printer.capQr" },
  { key: "supportsBarcode", labelKey: "printer.capBarcode" },
  { key: "supportsBold", labelKey: "printer.capBold" },
  { key: "supportsDrawer", labelKey: "printer.capDrawer" },
  { key: "supportsImages", labelKey: "printer.capImages" },
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
  const t = useT();
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
      toast.success(t("printer.connected2"));
    } catch (error) {
      const described = describeError(error);
      setLastError(described);
      if (!(error instanceof PrinterError && error.code === "cancelled")) {
        toast.error(described.message, { description: described.hint });
      }
    } finally {
      setBusy(null);
    }
  }, [service, t]);

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
        service.usesSystemDialog ? t("printer.dialogOpened") : t("printer.testSent")
      );
    } catch (error) {
      const described = describeError(error);
      setLastError(described);
      toast.error(described.message, { description: described.hint });
    } finally {
      setBusy(null);
    }
  }, [service, sample, t]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setBusy("save");
    try {
      const supabase = createClient();
      await updatePrinterProfile(supabase, draft.id, draft);
      toast.success(t("printer.saved"));
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("printer.saveFailed"));
    } finally {
      setBusy(null);
    }
  }, [draft, router, t]);

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
      toast.success(t("printer.added"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("printer.addFailed"));
    }
  }, [profiles.length, router, selectPrinter, t]);

  const handleDelete = useCallback(async () => {
    const ok = await confirm({
      title: t("menu.confirmDeleteProduct", { name: profile.name }),
      description: t("printer.deleteBody"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await deletePrinterProfile(supabase, profile.id);
      setDraft(null);
      toast.success(t("printer.deleted"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("printer.deleteFailed"));
    }
  }, [confirm, profile, router, t]);

  const handleMakeDefault = useCallback(async () => {
    try {
      const supabase = createClient();
      await setDefaultPrinter(supabase, profile.id, profile.role);
      toast.success(t("printer.defaultSet", { role: profile.role.toLowerCase() }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("printer.defaultFailed"));
    }
  }, [profile, router, t]);

  if (!ready || !service) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("printer.loadingPrinter")}
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
              {profile.isDefault && <Badge variant="brand">{t("printer.default")}</Badge>}
            </CardTitle>
            <PrinterStatusPill status={status} />
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("printer.deviceScopeNote")}
            </div>

            {available.length > 1 && (
              <div>
                <Label htmlFor="active-printer">{t("printer.forThisDevice")}</Label>
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
                supported ? "bg-info-bg text-info" : "bg-warning-bg text-warning"
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
                  <div className="text-muted-foreground">{t("printer.lastSuccess")}</div>
                  <div className="font-medium">
                    {status.lastSuccessAt ? timeAgo(status.lastSuccessAt) : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground">{t("printer.lastError")}</div>
                  <div className="font-medium text-danger">{status.lastError ?? "—"}</div>
                </div>
              </div>
            )}

            {lastError && (
              <div className="space-y-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
                <p className="font-medium">🔴 {lastError.message}</p>
                {lastError.hint && <p className="text-xs">{lastError.hint}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleConnect}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t("printer.retryJob")}
                  </Button>
                  {available.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById("active-printer")?.focus()}
                    >
                      {t("printer.chooseAnother")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      patchDraft({ connectionType: "BROWSER" });
                      toast.message(t("printer.switchedToBrowser"));
                    }}
                  >
                    {t("printer.useBrowserPrint")}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {service.adapter.requiresConnection && (
                <>
                  <Button onClick={handleConnect} loading={busy === "connect"} disabled={!supported}>
                    <PlugZap className="h-4 w-4" />
                    {status.state === "connected" ? t("printer.reconnect") : t("printer.connect")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={status.state !== "connected"}
                  >
                    <Plug className="h-4 w-4" /> {t("printer.disconnect")}
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                onClick={handleTestPrint}
                loading={busy === "test"}
                disabled={!supported}
              >
                <FileText className="h-4 w-4" /> {t("printer.testReceipt")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {editable && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>{t("printer.configure")}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleAdd}>
                  <Plus className="h-4 w-4" /> {t("common.add")}
                </Button>
                {!profile.isDefault && (
                  <Button size="sm" variant="outline" onClick={handleMakeDefault}>
                    {t("printer.makeDefault")}
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
                  <Label htmlFor="p-name">{t("printer.printerName")}</Label>
                  <Input
                    id="p-name"
                    value={editing.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="p-role">{t("printer.usedFor")}</Label>
                  <Select
                    id="p-role"
                    value={editing.role}
                    onChange={(e) => patchDraft({ role: e.target.value as PrinterRole })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {t(r.labelKey)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="p-connection">{t("printer.howConnected")}</Label>
                <Select
                  id="p-connection"
                  value={editing.connectionType}
                  onChange={(e) =>
                    patchDraft({ connectionType: e.target.value as ConnectionType })
                  }
                >
                  {CONNECTION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {t(ct.labelKey as TranslationKey)}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t(info.blurbKey as TranslationKey)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong>{t("printer.worksOn")}</strong> {t(info.platformsKey as TranslationKey)}
                </p>
              </div>

              {needs("host") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-host">{t("printer.ipAddress")}</Label>
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
                    <Label htmlFor="p-port">{t("printer.port")}</Label>
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
                  <Label htmlFor="p-bridge">{t("printer.bridgeUrl")}</Label>
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
                    {t("printer.bridgeHint", { command: "node scripts/print-bridge.mjs" })}
                  </p>
                </div>
              )}

              {needs("bleUuids") && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="p-svc">{t("printer.bleServiceUuid")}</Label>
                    <Input
                      id="p-svc"
                      value={editing.connection.bleServiceUuid ?? ""}
                      onChange={(e) =>
                        patchDraft({
                          connection: { ...editing.connection, bleServiceUuid: e.target.value },
                        })
                      }
                      placeholder={t("printer.autoDetected")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="p-chr">{t("printer.bleCharUuid")}</Label>
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
                      placeholder={t("printer.autoDetected")}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="p-width">{t("printer.paperWidth")}</Label>
                  <Select
                    id="p-width"
                    value={String(editing.paperWidth)}
                    onChange={(e) =>
                      patchDraft({ paperWidth: Number(e.target.value) as ReceiptWidth })
                    }
                  >
                    <option value="58">{t("printer.width58")}</option>
                    <option value="80">{t("printer.width80")}</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="p-encoding">{t("printer.encoding")}</Label>
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
                  <Label htmlFor="p-copies">{t("printer.copies")}</Label>
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
                  <Label htmlFor="p-feed">{t("printer.feedLines")}</Label>
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
                  <Label htmlFor="p-density">{t("printer.density")}</Label>
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
                    <option value="">{t("printer.densityDefault")}</option>
                    <option value="0">{t("printer.densityLight")}</option>
                    <option value="1">{t("printer.densityNormal")}</option>
                    <option value="2">{t("printer.densityDark")}</option>
                  </Select>
                </div>
              </div>

              <fieldset className="rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">
                  {t("printer.capabilitiesLegend")}
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAPABILITIES.map(({ key, labelKey }) => (
                    <label key={key} className="flex items-center gap-2 text-sm touch:min-h-11">
                      <input
                        type="checkbox"
                        checked={editing.capabilities[key]}
                        onChange={(e) =>
                          patchDraft({
                            capabilities: { ...editing.capabilities, [key]: e.target.checked },
                          })
                        }
                        className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
                      />
                      {t(labelKey)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm touch:min-h-11">
                <input
                  type="checkbox"
                  checked={editing.autoReconnect}
                  onChange={(e) => patchDraft({ autoReconnect: e.target.checked })}
                  className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
                />
                {t("printer.autoReconnect")}
              </label>

              {draft && (
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button loading={busy === "save"} onClick={handleSave}>
                    <Save className="h-4 w-4" /> {t("printer.savePrinter")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <PrintQueuePanel jobs={jobs} onRetry={(id) => service.retry(id)} />

        <Card className="border-warning/30 bg-warning-bg/50">
          <CardContent className="pt-5 text-xs text-warning">
            <p className="font-semibold">{t("printer.verificationTitle")}</p>
            <p className="mt-1">{t("printer.verificationBody")}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("printer.previewTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border bg-paper p-2">
            <ReceiptDocument data={sample} profile={editing} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("printer.previewNote", { width: editing.paperWidth })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
