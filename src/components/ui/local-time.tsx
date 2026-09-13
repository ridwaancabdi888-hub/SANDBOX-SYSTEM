import { formatDateTime, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Timestamps rendered in the **viewer's** timezone.
 *
 * The server has no way to know that timezone — on Vercel it is UTC, while the
 * browser is wherever the user is — so the two renders legitimately disagree
 * and React reports a hydration mismatch (minified error #418). `timeAgo` has
 * the same problem for a different reason: it reads `Date.now()`, which has
 * moved on by the time the client hydrates.
 *
 * `suppressHydrationWarning` is the intended escape hatch for exactly this: it
 * tells React this element's text is expected to differ, and to keep the
 * client's value. It only covers this element's own text, so the timestamp must
 * stay a direct child.
 *
 * Pinning a fixed `timeZone` instead would remove the mismatch, but staff would
 * then read shift times in the wrong zone — worse than the warning it fixes.
 */
export function LocalDateTime({
  value,
  className,
  relative = false,
}: {
  value: string | Date;
  className?: string;
  /** Render "5m ago" instead of an absolute date. */
  relative?: boolean;
}) {
  const iso = typeof value === "string" ? value : value.toISOString();
  return (
    <time dateTime={iso} className={cn(className)} suppressHydrationWarning>
      {relative ? timeAgo(value) : formatDateTime(value)}
    </time>
  );
}
