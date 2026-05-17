import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import { AppStatusShell } from "@/components/AppStatusShell";
import { StartupHandshakeGate } from "@/components/StartupHandshakeGate";
import { uiCopy } from "@/lib/copy";

import "./globals.css";
import "./startup-gate.css";

const bodyFont = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Syne({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: uiCopy.meta.title,
  description: uiCopy.meta.description,
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-env={process.env.NODE_ENV} lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
        <div className="app-atmosphere" aria-hidden="true" />
        <AppStatusShell />
        <div className="site-chrome">
          <StartupHandshakeGate>{children}</StartupHandshakeGate>
        </div>
      </body>
    </html>
  );
}
