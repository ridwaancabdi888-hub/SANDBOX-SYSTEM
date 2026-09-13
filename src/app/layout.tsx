import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/layout/app-toaster";
import { ThemeScript } from "@/components/layout/theme-script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SANDBOX Cafeteria",
  description: "SANDBOX Cafeteria Management System",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
