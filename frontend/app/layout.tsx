import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import Link from "next/link";

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
        <AppStatusShell />
        <div className="site-chrome">
          <header className="site-header">
            <div className="site-header-inner">
              <Link className="site-wordmark" href="/">
                watu
              </Link>
              <nav aria-label="Reference tools" className="site-nav">
                <a
                  className="site-nav-link"
                  href="https://docs.google.com/spreadsheets/d/1jlpD74o0F88-wxq8p0x_nCptMLSjMuv6u2WuAcaa9Cs/edit?gid=655564610#gid=655564610"
                  rel="noreferrer"
                  target="_blank"
                >
                  Master Queries
                </a>
                <a
                  className="site-nav-link"
                  href="https://docs.google.com/document/d/13k8YVkqgaSG7Nck_0KTLh-emb9BhacJziuxxyxARXZ8/edit?tab=t.0"
                  rel="noreferrer"
                  target="_blank"
                >
                  SOP Guide
                </a>
                <Link className="site-nav-link" href="/ops/login">
                  Ops
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
