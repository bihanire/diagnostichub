"use client";

import Link from "next/link";
import { CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { RepairFamilySummary } from "@/lib/types";

type TopCommandBarProps = {
  families: RepairFamilySummary[];
  openFamilyMenuSignal?: number;
  opsAuthenticated?: boolean;
  selectedFamilyId: string | null;
  onFocusSearch: () => void;
  onOpenCommandPalette: () => void;
  onSelectFamily: (familyId: string) => void;
  onGoHome: () => void;
};

type FamilyIconConfig = { d: string; bg: string; stroke: string };

const FAMILY_ICON_MAP: Record<string, FamilyIconConfig> = {
  display: {
    d: "M2 3.5h14v9H2z M6 12.5v2 M12 12.5v2 M4 14.5h10",
    bg: "rgba(14, 165, 233, 0.12)",
    stroke: "#0284c7",
  },
  power: {
    d: "M10.5 2.5l-5 7h4.5l-2 6 6-8.5h-5z",
    bg: "rgba(245, 158, 11, 0.12)",
    stroke: "#b45309",
  },
  logic: {
    d: "M5.5 5.5h7v7h-7z M3 7.5h2.5 M3 10.5h2.5 M12.5 7.5H15 M12.5 10.5H15 M7.5 3v2.5 M10.5 3v2.5 M7.5 12.5V15 M10.5 12.5V15",
    bg: "rgba(139, 92, 246, 0.12)",
    stroke: "#7c3aed",
  },
  security: {
    d: "M9 2l5.5 2.5v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7V4.5z M6.5 9l2 2 3-3.5",
    bg: "rgba(15, 118, 110, 0.12)",
    stroke: "#0f766e",
  },
  connectivity: {
    d: "M1.5 9a10.5 10.5 0 0 1 15 0 M4.5 12a6 6 0 0 1 9 0 M7.5 15a2.5 2.5 0 0 1 3 0 M9 17.5h.01",
    bg: "rgba(59, 130, 246, 0.12)",
    stroke: "#1d4ed8",
  },
  physical: {
    d: "M9 2.5c-3 4.5-4.5 7-4.5 9.5a4.5 4.5 0 0 0 9 0c0-2.5-1.5-5-4.5-9.5z",
    bg: "rgba(6, 182, 212, 0.12)",
    stroke: "#0891b2",
  },
};

function FamilyIconChip({ familyId }: { familyId: string }) {
  const config = FAMILY_ICON_MAP[familyId];
  if (!config) {
    return <span className="lm-family-icon-chip lm-family-icon-chip-generic" aria-hidden="true" />;
  }
  return (
    <span className="lm-family-icon-chip" aria-hidden="true" style={{ background: config.bg } as CSSProperties}>
      <svg viewBox="0 0 18 18" fill="none" stroke={config.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={config.d} />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="lm-family-check-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9l3.5 3.5 6.5-7" />
    </svg>
  );
}

type FamilyMenuPosition = {
  top: number;
  right: number;
};

type NavIconName = "families" | "system" | "utilities" | "ops";

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "families") {
    return (
      <svg aria-hidden="true" className="lm-nav-icon" viewBox="0 0 18 18">
        <path d="M3 5.5h12M3 9h12M3 12.5h12" />
      </svg>
    );
  }
  if (name === "system") {
    return (
      <svg aria-hidden="true" className="lm-nav-icon" viewBox="0 0 18 18">
        <path d="M9 3.25v11.5M3.25 9h11.5M5 5l8 8M13 5l-8 8" />
      </svg>
    );
  }
  if (name === "utilities") {
    return (
      <svg aria-hidden="true" className="lm-nav-icon" viewBox="0 0 18 18">
        <path d="M5.25 3.5h7.5v3h-7.5zM5.25 11.5h7.5v3h-7.5zM3.5 8.25h11" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="lm-nav-icon" viewBox="0 0 18 18">
      <path d="M9 2.75 14 5v4.25c0 3-2 5.25-5 6-3-.75-5-3-5-6V5z" />
      <path d="M6.75 9.2 8.25 10.7 11.4 7.5" />
    </svg>
  );
}

export function TopCommandBar({
  families,
  openFamilyMenuSignal = 0,
  opsAuthenticated = false,
  selectedFamilyId,
  onFocusSearch,
  onOpenCommandPalette,
  onSelectFamily,
  onGoHome,
}: TopCommandBarProps) {
  const familyMenuRef = useRef<HTMLDivElement | null>(null);
  const familyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const familyPanelRef = useRef<HTMLDivElement | null>(null);
  const familyFilterRef = useRef<HTMLInputElement | null>(null);
  const familyItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [familyFilter, setFamilyFilter] = useState("");
  const [activeFamilyIndex, setActiveFamilyIndex] = useState(0);
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [familyMenuPosition, setFamilyMenuPosition] = useState<FamilyMenuPosition>({ top: 64, right: 16 });
  const activeFamily = families.find((family) => family.id === selectedFamilyId) || null;

  const filteredFamilies = useMemo(() => {
    const clean = familyFilter.trim().toLowerCase();
    if (!clean) {
      return families;
    }
    return families.filter((family) => {
      const prompts = Array.isArray(family.symptom_prompts) ? family.symptom_prompts : [];
      const searchable = `${family.title} ${family.hint} ${prompts.join(" ")}`.toLowerCase();
      return searchable.includes(clean);
    });
  }, [families, familyFilter]);

  useEffect(() => {
    setActiveFamilyIndex(0);
  }, [familyFilter]);

  useEffect(() => {
    if (!familyMenuOpen && !utilityMenuOpen) {
      return;
    }

    function closeIfOutside(event: PointerEvent | FocusEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        familyMenuRef.current?.contains(target) ||
        familyPanelRef.current?.contains(target) ||
        utilityMenuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenus();
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      const shouldFocusFamily = familyMenuOpen;
      const shouldFocusUtility = !familyMenuOpen && utilityMenuOpen;
      closeMenus();
      if (shouldFocusFamily) {
        familyTriggerRef.current?.focus();
      } else if (shouldFocusUtility) {
        utilityTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("focusin", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("focusin", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [familyMenuOpen, utilityMenuOpen]);

  useEffect(() => {
    if (!familyMenuOpen) {
      return;
    }

    function syncPosition() {
      const trigger = familyTriggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = Math.min(470, viewportWidth - 24);
      const maxRight = Math.max(12, viewportWidth - panelWidth - 12);
      const right = Math.min(Math.max(12, viewportWidth - rect.right), maxRight);
      setFamilyMenuPosition({
        top: Math.round(rect.bottom + 8),
        right: Math.round(right)
      });
    }

    syncPosition();
    window.setTimeout(() => familyFilterRef.current?.focus(), 0);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [familyMenuOpen]);

  useEffect(() => {
    if (openFamilyMenuSignal <= 0) {
      return;
    }
    openFamilyMenuFromTrigger();
  }, [openFamilyMenuSignal]);

  useEffect(() => {
    if (!familyMenuOpen || activeFamilyIndex < 0) {
      return;
    }
    familyItemRefs.current[activeFamilyIndex]?.scrollIntoView?.({
      block: "nearest",
    });
  }, [activeFamilyIndex, familyMenuOpen]);

  function closeMenus() {
    setFamilyMenuOpen(false);
    setUtilityMenuOpen(false);
    setFamilyFilter("");
    setActiveFamilyIndex(0);
  }

  function openFamilyMenuFromTrigger() {
    const trigger = familyTriggerRef.current;
    if (!trigger) {
      setUtilityMenuOpen(false);
      setFamilyMenuOpen(true);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const panelWidth = Math.min(470, viewportWidth - 24);
    const maxRight = Math.max(12, viewportWidth - panelWidth - 12);
    setFamilyMenuPosition({
      top: Math.round(rect.bottom + 8),
      right: Math.round(Math.min(Math.max(12, viewportWidth - rect.right), maxRight))
    });
    setUtilityMenuOpen(false);
    setFamilyMenuOpen(true);
  }

  function handleSelect(familyId: string) {
    closeMenus();
    onSelectFamily(familyId);
  }

  function toggleFamilyMenu() {
    if (!familyMenuOpen) {
      openFamilyMenuFromTrigger();
      return;
    }
    setUtilityMenuOpen(false);
    setFamilyMenuOpen(false);
  }

  function toggleUtilityMenu() {
    setFamilyMenuOpen(false);
    setUtilityMenuOpen((current) => !current);
  }

  function handleOpenCommandPalette() {
    closeMenus();
    onOpenCommandPalette();
  }

  function handleFocusSearch() {
    closeMenus();
    onFocusSearch();
  }

  function handleGoHome() {
    closeMenus();
    onGoHome();
  }

  function handleFamilyFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!filteredFamilies.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveFamilyIndex((current) => (current + 1) % filteredFamilies.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveFamilyIndex((current) => (current <= 0 ? filteredFamilies.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredFamilies[activeFamilyIndex] || filteredFamilies[0];
      if (selected) {
        handleSelect(selected.id);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenus();
      familyTriggerRef.current?.focus();
    }
  }

  const familyMenuStyle: CSSProperties = {
    top: familyMenuPosition.top,
    right: familyMenuPosition.right
  };

  return (
    <div className="lm-topbar">
      <button className="lm-brand" onClick={handleGoHome} type="button">
        <span>watu</span>
      </button>

      <span className="lm-command-kbd lm-command-kbd-static" aria-hidden="true">
        /
      </span>

      <input
        aria-label="Global search"
        className="lm-topbar-search"
        onClick={handleOpenCommandPalette}
        onFocus={handleOpenCommandPalette}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleOpenCommandPalette();
          }
        }}
        placeholder="Ask anything - problem, procedure, or family"
        readOnly
        value=""
      />

      <nav className="lm-nav-tabs" aria-label="Primary navigation">
        <div className="lm-family-menu" ref={familyMenuRef}>
          <button
            aria-expanded={familyMenuOpen}
            aria-haspopup="listbox"
            className={`lm-nav-tab ${selectedFamilyId || familyMenuOpen ? "active" : ""}`}
            onClick={toggleFamilyMenu}
            ref={familyTriggerRef}
            type="button"
          >
            <NavIcon name="families" />
            Families
          </button>
          {familyMenuOpen ? (
            <div
              aria-label="Family operational router"
              className="lm-family-menu-panel"
              ref={familyPanelRef}
              style={familyMenuStyle}
            >
              <div className="lm-family-router-head">
                <span className="eyebrow">Operational router</span>
                <strong>Choose family, then flow</strong>
                <p>Open the right workspace first, then select the exact guided route.</p>
              </div>
              <div className="lm-family-router-steps" aria-label="Router steps">
                <span className="is-current">1 Family</span>
                <span>2 Flow</span>
                <span>3 Guided workspace</span>
              </div>
              <label className="lm-family-filter-label" htmlFor="family-filter">
                Find family
              </label>
              <input
                aria-activedescendant={
                  activeFamilyIndex >= 0 && filteredFamilies[activeFamilyIndex]
                    ? `family-menu-option-${filteredFamilies[activeFamilyIndex].id}`
                    : undefined
                }
                className="lm-family-filter-input"
                id="family-filter"
                onChange={(event) => setFamilyFilter(event.target.value)}
                onKeyDown={handleFamilyFilterKeyDown}
                placeholder="Display, power, security, SIM..."
                ref={familyFilterRef}
                role="combobox"
                aria-controls="family-menu-list"
                aria-expanded={familyMenuOpen}
                value={familyFilter}
              />
              {activeFamily ? (
                <p className="lm-family-active-note">
                  Current family: <strong>{activeFamily.title}</strong>
                </p>
              ) : null}
              <div className="lm-family-menu-list" id="family-menu-list" role="listbox">
                {filteredFamilies.length ? (
                  filteredFamilies.map((family, index) => (
                    <button
                      aria-label={`Open ${family.title} diagnosis family`}
                      aria-current={selectedFamilyId === family.id ? "true" : undefined}
                      className={`lm-family-menu-item ${selectedFamilyId === family.id ? "is-active" : ""} ${
                        activeFamilyIndex === index ? "is-highlighted" : ""
                      }`}
                      id={`family-menu-option-${family.id}`}
                      key={`family-menu-${family.id}`}
                      onMouseEnter={() => setActiveFamilyIndex(index)}
                      onClick={() => handleSelect(family.id)}
                      ref={(node) => {
                        familyItemRefs.current[index] = node;
                      }}
                      style={{ "--item-index": index } as CSSProperties}
                      type="button"
                    >
                      <FamilyIconChip familyId={family.id} />
                      <span className="lm-family-menu-copy">
                        <strong>{family.title}</strong>
                        <span title={family.hint}>{family.hint}</span>
                      </span>
                      <span className="lm-family-menu-badge-slot">
                        {selectedFamilyId === family.id ? (
                          <CheckIcon />
                        ) : (
                          <span className="lm-family-menu-count">{family.procedure_count} flows</span>
                        )}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="lm-family-empty">No family matches that wording. Try power, display, security, SIM, or liquid.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <button className="lm-nav-tab" onClick={handleFocusSearch} type="button">
          <NavIcon name="system" />
          System
        </button>

        <div className="lm-utility-menu" ref={utilityMenuRef}>
          <button
            aria-expanded={utilityMenuOpen}
            aria-haspopup="menu"
            className={`lm-nav-tab ${utilityMenuOpen ? "active" : ""}`}
            onClick={toggleUtilityMenu}
            ref={utilityTriggerRef}
            type="button"
          >
            <NavIcon name="utilities" />
            Utilities
          </button>
          {utilityMenuOpen ? (
          <div className="lm-utility-panel" role="menu">
            <a
              href="https://docs.google.com/spreadsheets/d/1jlpD74o0F88-wxq8p0x_nCptMLSjMuv6u2WuAcaa9Cs/edit?gid=655564610#gid=655564610"
              onClick={closeMenus}
              rel="noreferrer"
              role="menuitem"
              target="_blank"
            >
              Master queries
            </a>
            <a
              href="https://docs.google.com/document/d/13k8YVkqgaSG7Nck_0KTLh-emb9BhacJziuxxyxARXZ8/edit?tab=t.0"
              onClick={closeMenus}
              rel="noreferrer"
              role="menuitem"
              target="_blank"
            >
              SOP guide
            </a>
            <button onClick={handleOpenCommandPalette} role="menuitem" type="button">
              Open command palette
            </button>
            <Link href="/ops/diagnostics" onClick={closeMenus} role="menuitem">
              Deployment diagnostics
            </Link>
          </div>
          ) : null}
        </div>

        <Link
          className={`lm-nav-tab lm-nav-tab-ops ${opsAuthenticated ? "lm-nav-tab-ops-authenticated" : ""}`}
          href="/ops/login"
          onClick={closeMenus}
        >
          <NavIcon name="ops" />
          Ops
        </Link>
      </nav>
    </div>
  );
}
