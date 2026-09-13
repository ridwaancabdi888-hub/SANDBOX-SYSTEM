"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/hooks/use-theme";
import { useIsClient } from "@/lib/hooks/use-is-client";

/**
 * Sonner paints its own surfaces, so it needs to be told the theme —
 * its own "system" setting would ignore an explicit Light/Dark choice.
 * Resolution waits for the client because the stored preference is
 * device-local.
 */
export function AppToaster() {
  const { theme } = useTheme();
  const isClient = useIsClient();

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={isClient ? theme : "system"}
    />
  );
}
