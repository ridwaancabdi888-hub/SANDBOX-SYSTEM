const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type KeyboardEventLike = Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">;

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hidden &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true"
  );
}

/** Move focus into a newly opened dialog, preferring an explicit autofocus target or form field. */
export function focusModal(panel: HTMLElement): HTMLElement {
  const preferred =
    panel.querySelector<HTMLElement>("[autofocus]") ??
    panel.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
    ) ??
    focusableElements(panel)[0] ??
    panel;

  preferred.focus();
  return preferred;
}

/** Keep Tab and Shift+Tab navigation inside an open dialog. */
export function containModalFocus(
  event: KeyboardEventLike,
  panel: HTMLElement,
  activeElement: Element | null
): boolean {
  if (event.key !== "Tab") return false;

  const focusable = focusableElements(panel);
  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusIsOutside = !panel.contains(activeElement);

  if (event.shiftKey && (activeElement === first || focusIsOutside)) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}

/** Restore focus only while the original trigger still belongs to the page. */
export function restoreModalFocus(element: HTMLElement | null): boolean {
  if (!element?.isConnected || typeof element.focus !== "function") return false;
  element.focus();
  return true;
}
