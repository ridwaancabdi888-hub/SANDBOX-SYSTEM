"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Upload, Trash2, ImageIcon, Loader2, Palette, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateSettings } from "@/lib/services/settings";
import {
  uploadBrandingLogo,
  deleteBrandingLogo,
  validateLogoFile,
  LOGO_ACCEPT_ATTR,
  LOGO_FORMATS_LABEL,
  LOGO_FORBIDDEN,
} from "@/lib/services/branding";
import { PrinterManager } from "@/components/printing/printer-manager";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { Settings } from "@/lib/types/domain";
import type { PrinterProfile } from "@/lib/printing";

export function SettingsManager({
  initialSettings,
  printers,
}: {
  initialSettings: Settings;
  printers: PrinterProfile[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const t = useT();

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const supabase = createClient();
      const saved = await updateSettings(supabase, {
        cafeteria_name: settings.cafeteria_name,
        address: settings.address,
        phone: settings.phone,
        currency: settings.currency,
        receipt_header: settings.receipt_header,
        receipt_footer: settings.receipt_footer,
        low_stock_threshold_default: settings.low_stock_threshold_default,
        allow_negative_stock: settings.allow_negative_stock,
      });
      setSettings(saved);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 lg:p-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" /> {t("settings.appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("settings.theme")}</Label>
            <div className="mt-2">
              <ThemeToggle />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.themeHint")}</p>
        </CardContent>
      </Card>

      {/* Language sits beside Appearance because it is the same kind of
          choice: a device preference, not cafeteria data. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4" /> {t("settings.language")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("settings.language")}</Label>
            <div className="mt-2">
              <LanguageToggle />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.languageHint")}</p>
        </CardContent>
      </Card>

      <BrandingCard
        settings={settings}
        onChange={(next) => setSettings(next)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.cafeteriaInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="s-name">{t("settings.cafeteriaName")}</Label>
            <Input
              id="s-name"
              value={settings.cafeteria_name}
              onChange={(e) => setSettings({ ...settings, cafeteria_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-currency">{t("settings.currency")}</Label>
            <Select
              id="s-currency"
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SOS">SOS (Sh)</option>
              <option value="KES">KES (KSh)</option>
              <option value="ETB">ETB (Br)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-address">{t("settings.address")}</Label>
            <Input
              id="s-address"
              value={settings.address ?? ""}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-phone">{t("settings.phone")}</Label>
            <Input
              id="s-phone"
              value={settings.phone ?? ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-header">{t("settings.receiptHeader")}</Label>
            <Input
              id="s-header"
              value={settings.receipt_header ?? ""}
              onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-footer">{t("settings.receiptFooter")}</Label>
            <Input
              id="s-footer"
              value={settings.receipt_footer ?? ""}
              onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="s-threshold">{t("settings.defaultLowStockThreshold")}</Label>
            <Input
              id="s-threshold"
              type="number"
              step="0.001"
              value={settings.low_stock_threshold_default}
              onChange={(e) =>
                setSettings({ ...settings, low_stock_threshold_default: Number(e.target.value) })
              }
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm touch:min-h-11">
            <input
              type="checkbox"
              checked={settings.allow_negative_stock}
              onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.checked })}
              className="h-4 w-4 shrink-0 rounded border-border touch:h-5 touch:w-5"
            />
            {t("settings.allowNegativeStock")}
          </label>
        </CardContent>
        <div className="flex justify-end px-4 pb-4 sm:px-5 sm:pb-5">
          <Button loading={savingSettings} onClick={saveSettings}>
            <Save className="h-4 w-4" /> {t("settings.saveSettings")}
          </Button>
        </div>
      </Card>

      <div id="printers">
        <h2 className="mb-1 text-lg font-semibold">{t("settings.printers")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("settings.printersHint")}</p>
        <PrinterManager profiles={printers} editable />
      </div>
    </div>
  );
}

/**
 * Settings → Branding.
 *
 * A picked logo is uploaded to Storage straight away (that is what makes the
 * preview real rather than a local blob that later fails to load), but the
 * settings row is only written on Save. Superseded pending uploads are cleaned
 * up as we go so an admin who changes their mind three times doesn't leave
 * three orphaned objects behind.
 */
function BrandingCard({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  const router = useRouter();
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  // undefined = untouched · null = remove on save · string = new logo
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = settings.logo_url;
  const shown = pending === undefined ? current : pending;
  const dirty = pending !== undefined && pending !== current;

  async function handleFile(file: File) {
    const rejection = validateLogoFile(file);
    if (rejection) {
      toast.error(
        rejection.reason === "type"
          ? t("settings.logoWrongType")
          : rejection.reason === "size"
            ? t("settings.logoTooLargeMb", { mb: rejection.mb })
            : t("settings.logoEmpty")
      );
      return;
    }

    setUploading(true);
    const superseded = typeof pending === "string" ? pending : null;
    try {
      const supabase = createClient();
      const url = await uploadBrandingLogo(supabase, file);
      setPending(url);
      if (superseded) await deleteBrandingLogo(supabase, superseded);
      toast.success(t("settings.logoPendingSave"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message === LOGO_FORBIDDEN
          ? t("settings.logoForbidden")
          : message || t("settings.logoUploadFailed")
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const saved = await updateSettings(supabase, { logo_url: pending ?? null });
      // Only reclaim the old object once the new path is safely persisted.
      if (current && current !== saved.logo_url) await deleteBrandingLogo(supabase, current);
      onChange(saved);
      setPending(undefined);
      // The sidebar and header are server-rendered from this row, so refresh
      // the route tree or the new logo wouldn't appear until a navigation.
      router.refresh();
      toast.success(saved.logo_url ? t("settings.logoUploaded") : t("settings.logoRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.logoUploadFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    const orphan = typeof pending === "string" ? pending : null;
    setPending(undefined);
    if (orphan) await deleteBrandingLogo(createClient(), orphan);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> {t("settings.branding")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{t("settings.cafeteriaLogo")}</Label>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-2">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <BrandLogo
                  logoUrl={shown}
                  name={settings.cafeteria_name}
                  size="lg"
                  rounded="rounded-xl"
                  className="h-full w-full"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || saving}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {shown ? t("settings.replaceLogo") : t("settings.uploadLogo")}
                </Button>
                {shown && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading || saving}
                    onClick={() => setPending(null)}
                  >
                    <Trash2 className="h-4 w-4" /> {t("settings.removeLogo")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.supportedFormats", { formats: LOGO_FORMATS_LABEL })}{" "}
                {t("settings.logoUsage")}
              </p>
              {!shown && (
                <p className="text-xs text-muted-foreground">{t("settings.noLogoHint")}</p>
              )}
            </div>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={LOGO_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so picking the same file twice still fires onChange.
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{t("settings.brandingFooterHint")}</p>
      </CardContent>
      <div className="flex items-center justify-end gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        {dirty && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void discard()}>
            {t("common.cancel")}
          </Button>
        )}
        <Button loading={saving} disabled={!dirty || uploading} onClick={save}>
          <Save className="h-4 w-4" /> {t("settings.saveChanges")}
        </Button>
      </div>
    </Card>
  );
}
