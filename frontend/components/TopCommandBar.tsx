import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { RepairFamilySummary } from "@/lib/types";

type TopCommandBarProps = {
  families: RepairFamilySummary[];
  selectedFamilyId: string | null;
  onFocusSearch: () => void;
  onOpenCommandPalette: () => void;
  onSelectFamily: (familyId: string, trigger: HTMLButtonElement) => void;
  onGoHome: () => void;
};

export function TopCommandBar({
  families,
  selectedFamilyId,
  onFocusSearch,
  onOpenCommandPalette,
  onSelectFamily,
  onGoHome,
}: TopCommandBarProps) {
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
      <span className="lm-topbar-status-dot" aria-hidden="true" />

      <button className="lm-brand" onClick={onGoHome} type="button">
        <span>watu</span>
      </button>

      <span className="lm-command-kbd lm-command-kbd-static" aria-hidden="true">
        /
      </span>

      <input
        aria-label="Global search"
        className="lm-topbar-search"
        onClick={onOpenCommandPalette}
        onFocus={onOpenCommandPalette}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onOpenCommandPalette();
          }
        }}
        placeholder="Ask anything — problem, procedure, or family"
        readOnly
        value=""
      />

      <nav className="lm-nav-tabs" aria-label="Primary navigation">
        <details className="lm-family-menu" ref={familyMenuRef}>
          <summary className={`lm-nav-tab ${selectedFamilyId ? "active" : ""}`}>Families</summary>
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
                <div className="lm-family-empty">No families match that filter yet.</div>
              )}
            </div>
          </div>
        </details>

        <button className="lm-nav-tab" onClick={onFocusSearch} type="button">
          System
        </button>

        <details className="lm-utility-menu">
          <summary className="lm-nav-tab">Utilities</summary>
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
              Open command palette
            </button>
          </div>
        </details>

        <Link className="lm-nav-tab lm-nav-tab-ops" href="/ops/login">
          Ops
        </Link>
      </nav>
    </div>
  );
}
