import Link from "next/link";
import { CSSProperties, KeyboardEvent, MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";

import { RepairFamilySummary } from "@/lib/types";

type TopCommandBarProps = {
  families: RepairFamilySummary[];
  selectedFamilyId: string | null;
  onFocusSearch: () => void;
  onOpenCommandPalette: () => void;
  onSelectFamily: (familyId: string) => void;
  onGoHome: () => void;
};

type FamilyMenuPosition = {
  top: number;
  right: number;
};

export function TopCommandBar({
  families,
  selectedFamilyId,
  onFocusSearch,
  onOpenCommandPalette,
  onSelectFamily,
  onGoHome,
}: TopCommandBarProps) {
  const familyMenuRef = useRef<HTMLDivElement | null>(null);
  const familyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const familyPanelRef = useRef<HTMLDivElement | null>(null);
  const familyItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [familyFilter, setFamilyFilter] = useState("");
  const [activeFamilyIndex, setActiveFamilyIndex] = useState(0);
  const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [familyMenuPosition, setFamilyMenuPosition] = useState<FamilyMenuPosition>({ top: 64, right: 16 });

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

    function closeIfOutside(event: globalThis.MouseEvent | globalThis.TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (familyMenuRef.current?.contains(target) || utilityMenuRef.current?.contains(target)) {
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

    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside, { passive: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
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
      setFamilyMenuPosition({
        top: Math.round(rect.bottom + 8),
        right: Math.max(12, Math.round(viewportWidth - rect.right))
      });
    }

    syncPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [familyMenuOpen]);

  function closeMenus() {
    setFamilyMenuOpen(false);
    setUtilityMenuOpen(false);
  }

  function handleSelect(familyId: string) {
    closeMenus();
    onSelectFamily(familyId);
  }

  function toggleFamilyMenu(event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setFamilyMenuPosition({
      top: Math.round(rect.bottom + 8),
      right: Math.max(12, Math.round(window.innerWidth - rect.right))
    });
    setUtilityMenuOpen(false);
    setFamilyMenuOpen((current) => !current);
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
      setFamilyMenuOpen(false);
      familyTriggerRef.current?.focus();
    }
  }

  const familyMenuStyle: CSSProperties = {
    top: familyMenuPosition.top,
    right: familyMenuPosition.right
  };

  return (
    <div className="lm-topbar">
      <span className="lm-topbar-status-dot" aria-hidden="true" />

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
        placeholder="Ask anything — problem, procedure, or family"
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
            Families
          </button>
          {familyMenuOpen ? (
          <div className="lm-family-menu-panel" ref={familyPanelRef} style={familyMenuStyle}>
            <label className="lm-family-filter-label" htmlFor="family-filter">
              Find family
            </label>
            <input
              className="lm-family-filter-input"
              id="family-filter"
              onChange={(event) => setFamilyFilter(event.target.value)}
              onKeyDown={handleFamilyFilterKeyDown}
              placeholder="Type display, power, frp, sim..."
              value={familyFilter}
            />
            <div className="lm-family-menu-list" role="listbox">
              {filteredFamilies.length ? (
                filteredFamilies.map((family, index) => (
                  <button
                    aria-label={`Open ${family.title} diagnosis family`}
                    className={`lm-family-menu-item ${selectedFamilyId === family.id ? "is-active" : ""} ${
                      activeFamilyIndex === index ? "is-highlighted" : ""
                    }`}
                    key={`family-menu-${family.id}`}
                    onClick={() => handleSelect(family.id)}
                    ref={(node) => {
                      familyItemRefs.current[index] = node;
                    }}
                    type="button"
                  >
                    <span className="lm-family-menu-glyph" aria-hidden="true">
                      {family.title.charAt(0)}
                    </span>
                    <span className="lm-family-menu-copy">
                      <strong>{family.title}</strong>
                      <small>{family.procedure_count} flows</small>
                      <span>{family.hint}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="lm-family-empty">No families match that filter yet.</div>
              )}
            </div>
          </div>
          ) : null}
        </div>

        <button className="lm-nav-tab" onClick={handleFocusSearch} type="button">
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
          </div>
          ) : null}
        </div>

        <Link className="lm-nav-tab lm-nav-tab-ops" href="/ops/login" onClick={closeMenus}>
          Ops
        </Link>
      </nav>
    </div>
  );
}
