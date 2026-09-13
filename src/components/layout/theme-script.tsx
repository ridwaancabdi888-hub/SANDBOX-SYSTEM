/**
 * Resolves the theme *before first paint*.
 *
 * The server cannot know a device-local preference, so without this the page
 * would paint light and then snap to dark on hydration — a white flash on
 * every navigation. This runs synchronously in <head>, so the first frame is
 * already correct.
 *
 * <html> carries `suppressHydrationWarning` because this script deliberately
 * changes the class and style React rendered.
 */
const BOOT = `(function(){try{var t=localStorage.getItem("sandbox_theme");if(t!=="light"&&t!=="dark"&&t!=="system"){t="system"}var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
