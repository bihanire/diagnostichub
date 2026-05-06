import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import { AppStatusShell } from "@/components/AppStatusShell";
import { uiCopy } from "@/lib/copy";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Space_Grotesk({
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
        <AppStatusShell />
        <div className="site-chrome">
          {children}
        </div>
      </body>
    </html>
  );
}
