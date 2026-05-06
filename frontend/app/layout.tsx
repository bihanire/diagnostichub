import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import { AppStatusShell } from "@/components/AppStatusShell";
import { uiCopy } from "@/lib/copy";
import { repairFamilyShortcuts } from "@/lib/issue-visuals";

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
          <header className="site-header">
            <div className="site-header-inner">
              <div className="site-header-left">
                <Link className="site-nav-link site-nav-link-search" data-magnetic href="/#case-intake">
                  Search case
                </Link>
              </div>
              <nav aria-label="Primary tools" className="site-nav site-nav-right">
                <details className="site-utility-menu site-family-menu">
                  <summary className="site-nav-link site-utility-trigger" data-magnetic>
                    Flow Library
                    <span className="site-utility-caret" aria-hidden="true">
                      v
                    </span>
                  </summary>
                  <div className="site-utility-panel site-family-panel">
                    {repairFamilyShortcuts.map((family) => (
                      <Link
                        className="site-utility-link"
                        data-magnetic
                        href={`/?family=${family.id}`}
                        key={family.id}
                      >
                        <span>{family.label}</span>
                        <span className="site-utility-link-subtle">{family.hint}</span>
                      </Link>
                    ))}
                  </div>
                </details>
                <details className="site-utility-menu">
                  <summary className="site-nav-link site-utility-trigger" data-magnetic>
                    System Utilities
                    <span className="site-utility-caret" aria-hidden="true">
                      v
                    </span>
                  </summary>
                  <div className="site-utility-panel">
                    <a
                      className="site-utility-link"
                      data-magnetic
                      href="https://docs.google.com/spreadsheets/d/1jlpD74o0F88-wxq8p0x_nCptMLSjMuv6u2WuAcaa9Cs/edit?gid=655564610#gid=655564610"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Master Queries
                    </a>
                    <a
                      className="site-utility-link"
                      data-magnetic
                      href="https://docs.google.com/document/d/13k8YVkqgaSG7Nck_0KTLh-emb9BhacJziuxxyxARXZ8/edit?tab=t.0"
                      rel="noreferrer"
                      target="_blank"
                    >
                      SOP Guide
                    </a>
                  </div>
                </details>
                <Link className="site-nav-link site-nav-link-ops" data-magnetic href="/ops/login">
                  Ops
                </Link>
                <Link className="site-wordmark site-wordmark-right" href="/">
                  <span className="site-wordmark-mark" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                  <span className="site-wordmark-text">watu</span>
                </Link>
              </nav>
            </div>
            <div className="site-header-hairline" />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
