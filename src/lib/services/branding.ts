import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "branding";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const LOGO_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export const LOGO_ACCEPT_ATTR = LOGO_ACCEPTED_TYPES.join(",");
export const LOGO_FORMATS_LABEL = "PNG, JPG, JPEG, WEBP or SVG";

/** Sentinel thrown when Storage RLS rejects the write. It is the one upload
 *  failure a user can act on, so the UI translates it rather than surfacing
 *  the raw Postgres message. */
export const LOGO_FORBIDDEN = "LOGO_FORBIDDEN";

/**
 * Why a file was rejected, as data rather than prose.
 *
 * This module cannot see the locale (it is a plain service, not a component),
 * so it reports *what* was wrong and lets the caller phrase it.
 */
export type LogoRejection =
  | { reason: "type" }
  | { reason: "size"; mb: string }
  | { reason: "empty" };

/**
 * Validates a candidate logo before it costs the user an upload round-trip.
 * Returns null when the file is acceptable.
 */
export function validateLogoFile(file: File): LogoRejection | null {
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return { reason: "type" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { reason: "size", mb: (file.size / (1024 * 1024)).toFixed(1) };
  }
  if (file.size === 0) return { reason: "empty" };
  return null;
}

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return file.type === "image/png"
    ? "png"
    : file.type === "image/webp"
      ? "webp"
      : file.type === "image/svg+xml"
        ? "svg"
        : "jpg";
}

/**
 * Uploads a logo to the public `branding` bucket and returns its public URL.
 *
 * This runs with the admin's own session — the bucket's RLS policies
 * (`branding_admin_write`) are what enforce admin-only writes, so no
 * service-role key is involved and none reaches the browser.
 *
 * Each upload gets a fresh path rather than overwriting, which sidesteps CDN
 * caching serving the previous logo after a replace.
 */
export async function uploadBrandingLogo(supabase: Client, file: File): Promise<string> {
  const rejection = validateLogoFile(file);
  if (rejection) throw new Error(rejection.reason);

  const path = `logo/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    throw new Error(
      /row-level security|not authorized|Unauthorized/i.test(error.message)
        ? LOGO_FORBIDDEN
        : `Upload failed: ${error.message}`
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Best-effort removal of a previously uploaded logo's object.
 *
 * Deliberately non-throwing: the settings row is the source of truth, and a
 * failure to reclaim an orphaned object must never block the admin from
 * removing or replacing the logo.
 */
export async function deleteBrandingLogo(supabase: Client, publicUrl: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  const path = publicUrl.slice(index + marker.length).split("?")[0];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
