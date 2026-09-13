import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-2xl",
} as const;

/**
 * The cafeteria mark, used everywhere the brand appears.
 *
 * Falls back to the built-in "S" tile whenever no logo has been uploaded, so
 * every surface keeps a mark and none of them need their own null handling.
 * `object-contain` is deliberate — a logo is never cropped or stretched to fit
 * the square, it is letterboxed inside it.
 */
export function BrandLogo({
  logoUrl,
  name = "SANDBOX",
  size = "sm",
  className,
  rounded = "rounded-lg",
}: {
  logoUrl?: string | null;
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
  rounded?: string;
}) {
  if (logoUrl) {
    return (
      // A logo lives on a user-configurable Supabase Storage host, which
      // next/image would need allow-listed in next.config at build time.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn(
          "shrink-0 bg-white object-contain",
          SIZES[size],
          rounded,
          className
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand-600 font-bold text-white",
        SIZES[size],
        rounded,
        className
      )}
    >
      S
    </div>
  );
}
