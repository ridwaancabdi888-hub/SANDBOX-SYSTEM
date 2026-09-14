import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/layout/app-toaster";
import { ThemeScript } from "@/components/layout/theme-script";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { PWA_THEME_COLOR } from "@/lib/pwa/config";
import { LocaleProvider, LOCALE_DIR } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SANDBOX Cafeteria",
  description: "SANDBOX Cafeteria Management System",
  applicationName: "SANDBOX",
  // iOS ignores the manifest for home-screen apps; these are what it reads.
  appleWebApp: { capable: true, title: "SANDBOX", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here and hand it down. The server renders the text, so the
  // client provider must start from the same value or hydration would differ.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={LOCALE_DIR}
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>
          {children}
          <AppToaster />
          <ServiceWorkerRegister />
        </LocaleProvider>
      </body>
    </html>
  );
}
