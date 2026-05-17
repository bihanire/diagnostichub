"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

import { TopCommandBar } from "@/components/TopCommandBar";
import { BUILT_IN_REPAIR_FAMILIES } from "@/lib/repair-families";
import { RepairFamilySummary } from "@/lib/types";

export type RouteShellStatus = {
  phase: string;
  family?: string;
  procedure?: string;
  confidence?: string;
  readiness?: string;
};

type ProductRouteShellProps = {
  children: ReactNode;
  className?: string;
  families?: RepairFamilySummary[];
  selectedFamilyId?: string | null;
  status: RouteShellStatus;
};

export function ProductRouteShell({
  children,
  className = "",
  families = BUILT_IN_REPAIR_FAMILIES,
  selectedFamilyId = null,
  status,
}: ProductRouteShellProps) {
  const router = useRouter();
  const [commandHintOpen, setCommandHintOpen] = useState(false);

  function goHome() {
    setCommandHintOpen(false);
    router.push("/");
  }

  function openFamily(familyId: string) {
    setCommandHintOpen(false);
    router.push(`/families/${familyId}`);
  }

  return (
    <main className={`route-shell app-shell ${className}`.trim()} id="main-content">
      <header className="lm-topbar-wrap route-shell-topbar">
        <TopCommandBar
          families={families}
          selectedFamilyId={selectedFamilyId}
          onFocusSearch={goHome}
          onGoHome={goHome}
          onOpenCommandPalette={() => setCommandHintOpen(true)}
          onSelectFamily={openFamily}
        />
      </header>

      {commandHintOpen ? (
        <section aria-modal="true" className="route-command-layer" role="dialog">
          <button
            aria-label="Close command helper"
            className="route-command-shroud"
            onClick={() => setCommandHintOpen(false)}
            type="button"
          />
          <div className="route-command-panel">
            <div className="panel-header">
              <span className="eyebrow">Learning assistant</span>
              <h3>Start from the hub</h3>
            </div>
            <div className="action-grid">
              <button className="primary-button" onClick={goHome} type="button">
                Open diagnostic search
              </button>
              <button
                className="secondary-button"
                onClick={() => setCommandHintOpen(false)}
                type="button"
              >
                Stay here
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="route-shell-page">{children}</div>

    </main>
  );
}
