import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { RepairFamilySummary } from "@/lib/types";

type TopCommandBarProps = {
  families: RepairFamilySummary[];
  selectedFamilyId: string | null;
  moduleMode: string;
  onModuleModeChange: (value: string) => void;
  onFocusSearch: () => void;
  onOpenCommandPalette: () => void;
  onSelectFamily: (familyId: string, trigger: HTMLButtonElement) => void;
  onGoHome: () => void;
};

export function TopCommandBar({
  families,
  selectedFamilyId,
  moduleMode,
  onModuleModeChange,
  onFocusSearch,
  onOpenCommandPalette,
  onSelectFamily,
  onGoHome,
}: TopCommandBarProps) {
  const modeLabel = moduleMode === "diagnostic" ? "Diagnostic learning" : moduleMode === "guided" ? "Guide step-by-step" : "Explain SOP";
  const familyMenuRef = useRef<HTMLDetailsElement | null>(null);
  const familyItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [familyFilter, setFamilyFilter] = useState("");
  const [activeFamilyIndex, setActiveFamilyIndex] = useState(0);

  const filteredFamilies = useMemo(() => {
    const clean = familyFilter.trim().toLowerCase();
    if (!clean) {
      return families;
    }
    return families.filter((family) => {
      const searchable = `${family.title} ${family.hint} ${family.symptom_prompts.join(" ")}`.toLowerCase();
      return searchable.includes(clean);
    });
  }, [families, familyFilter]);

  useEffect(() => {
    setActiveFamilyIndex(0);
  }, [familyFilter]);

  function handleSelect(familyId: string, trigger: HTMLButtonElement) {
    onSelectFamily(familyId, trigger);
    familyMenuRef.current?.removeAttribute("open");
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
      const selectedIndex = filteredFamilies.findIndex((family) => family.id === selected.id);
      const trigger = familyItemRefs.current[selectedIndex];
      if (selected && trigger) {
        handleSelect(selected.id, trigger);
      }
    }
  }

  return (
    <div className="lm-topbar">
      <button aria-label="Open global search" className="lm-nav-search" onClick={onFocusSearch} type="button">
        <span aria-hidden="true">⌕</span>
      </button>

      <button
        className="lm-command-trigger"
        onClick={onOpenCommandPalette}
        type="button"
      >
        <span className="lm-command-kbd">/</span>
        <span>Ask the Module, search procedures, or route a family flow</span>
      </button>

      <div className="lm-topbar-controls">
        <div className="lm-module-control">
          <label className="lm-module-control-label" htmlFor="learning-mode">
            Mode
          </label>
          <div className="lm-module-control-row">
            <select
              aria-label="Learning module mode"
              className="lm-module-selector"
              id="learning-mode"
              onChange={(event) => onModuleModeChange(event.target.value)}
              value={moduleMode}
            >
              <option value="diagnostic">Diagnostic learning</option>
              <option value="guided">Guide me step-by-step</option>
              <option value="explain">Explain this SOP</option>
            </select>
            <span className={`lm-mode-badge lm-mode-badge-${moduleMode}`}>{modeLabel}</span>
          </div>
        </div>

        <details className="lm-family-menu" ref={familyMenuRef}>
          <summary>Families</summary>
          <div className="lm-family-menu-panel">
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
                    onClick={(event) => handleSelect(family.id, event.currentTarget)}
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
                <div className="lm-family-empty">
                  No families match that filter yet.
                </div>
              )}
            </div>
          </div>
        </details>

        <details className="lm-utility-menu">
          <summary>System utilities</summary>
          <div className="lm-utility-panel">
            <a
              href="https://docs.google.com/spreadsheets/d/1jlpD74o0F88-wxq8p0x_nCptMLSjMuv6u2WuAcaa9Cs/edit?gid=655564610#gid=655564610"
              rel="noreferrer"
              target="_blank"
            >
              Master queries
            </a>
            <a
              href="https://docs.google.com/document/d/13k8YVkqgaSG7Nck_0KTLh-emb9BhacJziuxxyxARXZ8/edit?tab=t.0"
              rel="noreferrer"
              target="_blank"
            >
              SOP guide
            </a>
            <button onClick={onOpenCommandPalette} type="button">
              Command palette
            </button>
          </div>
        </details>

        <Link className="lm-ops-link" href="/ops/login">
          Ops
        </Link>
      </div>

      <button aria-label="Return home" className="lm-home-logo" onClick={onGoHome} type="button">
        watu
      </button>
    </div>
  );
}
