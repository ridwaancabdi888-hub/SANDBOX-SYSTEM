"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Pencil, Trash2, QrCode, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteLocation, updateLocation } from "@/lib/services/locations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LocationModal } from "./location-modal";
import { QrViewModal } from "./qr-view-modal";
import type { Location } from "@/lib/types/domain";

export function LocationsManager({
  initialLocations,
  appUrl,
}: {
  initialLocations: Location[];
  appUrl: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [formModal, setFormModal] = useState<{ open: boolean; location: Location | null }>({
    open: false,
    location: null,
  });
  const [qrModal, setQrModal] = useState<{ open: boolean; location: Location | null }>({
    open: false,
    location: null,
  });

  function refresh() {
    router.refresh();
  }

  async function toggleActive(location: Location) {
    try {
      const supabase = createClient();
      await updateLocation(supabase, location.id, { active: !location.active });
      toast.success(location.active ? "Location deactivated" : "Location activated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update location");
    }
  }

  async function handleDelete(location: Location) {
    const ok = await confirm({
      title: `Delete "${location.name}"?`,
      description: "This cannot be undone. Existing orders keep their history.",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await deleteLocation(supabase, location.id);
      toast.success("Location deleted");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete location");
    }
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">QR Locations</h1>
        <Button onClick={() => setFormModal({ open: true, location: null })}>
          <Plus className="h-4 w-4" /> New Location
        </Button>
      </div>

      {initialLocations.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-6 w-6" />}
          title="No QR locations yet"
          description="Create seating locations so customers can scan a QR code and order from their seat."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {initialLocations.map((loc) => (
            <Card key={loc.id} className="flex flex-col items-center gap-3 p-4">
              <button onClick={() => setQrModal({ open: true, location: loc })}>
                <QRCodeSVG value={`${appUrl}/menu/${loc.code}`} size={100} level="M" />
              </button>
              <div className="text-center">
                <p className="font-semibold">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.code}</p>
              </div>
              <Badge variant={loc.active ? "success" : "default"}>
                {loc.active ? "Active" : "Inactive"}
              </Badge>
              <div className="flex w-full gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => toggleActive(loc)}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setFormModal({ open: true, location: loc })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(loc)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formModal.open && (
        <LocationModal
          key={formModal.location?.id ?? "new"}
          open
          location={formModal.location}
          onClose={() => setFormModal({ open: false, location: null })}
          onSaved={refresh}
        />
      )}
      <QrViewModal
        open={qrModal.open}
        location={qrModal.location}
        appUrl={appUrl}
        onClose={() => setQrModal({ open: false, location: null })}
      />
    </div>
  );
}
