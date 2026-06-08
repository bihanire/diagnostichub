"use client";

import Link from "next/link";
import {
  ChevronRight,
  Cpu,
  Droplets,
  LayoutGrid,
  Monitor,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Smartphone,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import {
  CSSProperties,
  ElementType,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type FamilyMenuPosition = { top: number; right: number };

/* ── Per-family icon + color config ───────────────────────── */
type FamilyIconConfig = {
  Icon: ElementType;
  bg: string;
  stroke: string;
};

const FAMILY_ICON_MAP: Record<string, FamilyIconConfig> = {
  display:      { Icon: Monitor,     bg: "rgba(56,189,248,0.14)",   stroke: "#38bdf8" },
  power:        { Icon: Zap,         bg: "rgba(251,191,36,0.14)",   stroke: "#fbbf24" },
  logic:        { Icon: Cpu,         bg: "rgba(167,139,250,0.14)",  stroke: "#a78bfa" },
  security:     { Icon: ShieldCheck, bg: "rgba(52,211,153,0.14)",   stroke: "#34d399" },
  connectivity: { Icon: Wifi,        bg: "rgba(96,165,250,0.14)",   stroke: "#60a5fa" },
  physical:     { Icon: Droplets,    bg: "rgba(34,211,238,0.14)",   stroke: "#22d3ee" },
};

function FamilyIconChip({ familyId }: { familyId: string }) {
  const cfg = FAMILY_ICON_MAP[familyId];
  const IconComp = cfg?.Icon ?? Wrench;
  const bg     = cfg?.bg     ?? "rgba(0,200,150,0.1)";
  const stroke = cfg?.stroke ?? "#00c896";
  return (
    <span
      className="lm-family-icon-chip"
      aria-hidden="true"
      style={{ background: bg, color: stroke } as CSSProperties}
    >
      <IconComp size={15} strokeWidth={1.75} />
    </span>
  );
}

/* ── Nav bar inline icons ─────────────────────────────────── */
function NavIcon({ name }: { name: string }) {
  const props = { size: 13, strokeWidth: 1.8, "aria-hidden": true, className: "lm-nav-icon-lc" };
  if (name === "families")    return <LayoutGrid    {...props} />;
  if (name === "system")      return <Settings2     {...props} />;
  if (name === "utilities")   return <Wrench        {...props} />;
  if (name === "ops")         return <ShieldCheck   {...props} />;
  if (name === "smartphone")  return <Smartphone    {...props} />;
  return <ChevronRight {...props} />;
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
  const familyMenuRef    = useRef<HTMLDivElement | null>(null);
  const familyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const familyPanelRef   = useRef<HTMLDivElement | null>(null);
  const familyFilterRef  = useRef<HTMLInputElement | null>(null);
  const familyItemRefs   = useRef<Array<HTMLButtonElement | null>>([]);
  const utilityMenuRef   = useRef<HTMLDivElement | null>(null);
  const utilityTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [familyFilter, setFamilyFilter]         = useState("");
  const [activeFamilyIndex, setActiveFamilyIndex] = useState(0);
  const [familyMenuOpen, setFamilyMenuOpen]     = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen]   = useState(false);
  const [familyMenuPosition, setFamilyMenuPosition] =
    useState<FamilyMenuPosition>({ top: 64, right: 16 });

  const activeFamily = families.find((f) => f.id === selectedFamilyId) ?? null;

  const filteredFamilies = useMemo(() => {
    const q = familyFilter.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) => {
      const prompts = Array.isArray(f.symptom_prompts) ? f.symptom_prompts : [];
      return `${f.title} ${f.hint} ${prompts.join(" ")}`.toLowerCase().includes(q);
    });
  }, [families, familyFilter]);

  useEffect(() => { setActiveFamilyIndex(0); }, [familyFilter]);

  /* close on outside click / focus */
  useEffect(() => {
    if (!familyMenuOpen && !utilityMenuOpen) return;
    function closeIfOutside(e: PointerEvent | FocusEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (
        familyMenuRef.current?.contains(t) ||
        familyPanelRef.current?.contains(t) ||
        utilityMenuRef.current?.contains(t)
      ) return;
      closeMenus();
    }
    function onEsc(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      const focusFamily  = familyMenuOpen;
      const focusUtility = !familyMenuOpen && utilityMenuOpen;
      closeMenus();
      if (focusFamily)  familyTriggerRef.current?.focus();
      if (focusUtility) utilityTriggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("focusin",     closeIfOutside);
    document.addEventListener("keydown",     onEsc);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("focusin",     closeIfOutside);
      document.removeEventListener("keydown",     onEsc);
    };
  }, [familyMenuOpen, utilityMenuOpen]);

  /* sync panel position + body scroll lock */
  useEffect(() => {
    if (!familyMenuOpen) return;

    /* body scroll lock */
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";

    function syncPos() {
      const trigger = familyTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw   = window.innerWidth;
      const pw   = Math.min(470, vw - 24);
      const maxR = Math.max(12, vw - pw - 12);
      const right = Math.min(Math.max(12, vw - rect.right), maxR);
      setFamilyMenuPosition({ top: Math.round(rect.bottom + 8), right: Math.round(right) });
    }

    syncPos();
    setTimeout(() => familyFilterRef.current?.focus(), 0);
    window.addEventListener("resize", syncPos);
    window.addEventListener("scroll", syncPos, true);
    return () => {
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
      window.removeEventListener("resize", syncPos);
      window.removeEventListener("scroll", syncPos, true);
    };
  }, [familyMenuOpen]);

  /* external signal to open */
  useEffect(() => {
    if (openFamilyMenuSignal > 0) openFamilyMenuFromTrigger();
  }, [openFamilyMenuSignal]);

  /* scroll active item into view */
  useEffect(() => {
    if (familyMenuOpen && activeFamilyIndex >= 0) {
      familyItemRefs.current[activeFamilyIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeFamilyIndex, familyMenuOpen]);

  function closeMenus() {
    setFamilyMenuOpen(false);
    setUtilityMenuOpen(false);
    setFamilyFilter("");
    setActiveFamilyIndex(0);
  }

  function openFamilyMenuFromTrigger() {
    const trigger = familyTriggerRef.current;
    const vw  = window.innerWidth;
    const pw  = Math.min(470, vw - 24);
    const maxR = Math.max(12, vw - pw - 12);
    let top  = 64;
    let right = 16;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      top   = Math.round(rect.bottom + 8);
      right = Math.round(Math.min(Math.max(12, vw - rect.right), maxR));
    }
    setFamilyMenuPosition({ top, right });
    setUtilityMenuOpen(false);
    setFamilyMenuOpen(true);
  }

  function handleSelect(id: string) {
    closeMenus();
    onSelectFamily(id);
  }

  function toggleFamilyMenu() {
    if (!familyMenuOpen) { openFamilyMenuFromTrigger(); return; }
    setFamilyMenuOpen(false);
    setUtilityMenuOpen(false);
  }

  function toggleUtilityMenu() {
    setFamilyMenuOpen(false);
    setUtilityMenuOpen((c) => !c);
  }

  function handleOpenCommandPalette() { closeMenus(); onOpenCommandPalette(); }
  function handleFocusSearch()        { closeMenus(); onFocusSearch(); }
  function handleGoHome()             { closeMenus(); onGoHome(); }

  function handleFilterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!filteredFamilies.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveFamilyIndex((c) => (c + 1) % filteredFamilies.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveFamilyIndex((c) => (c <= 0 ? filteredFamilies.length - 1 : c - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const sel = filteredFamilies[activeFamilyIndex] ?? filteredFamilies[0];
      if (sel) handleSelect(sel.id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenus();
      familyTriggerRef.current?.focus();
    }
  }

  const panelStyle: CSSProperties = {
    top:   familyMenuPosition.top,
    right: familyMenuPosition.right,
  };

  return (
    <>
      {/* Scrim backdrop when router is open */}
      {familyMenuOpen && (
        <div
          className="lm-family-backdrop"
          aria-hidden="true"
          onClick={closeMenus}
        />
      )}

      <div className="lm-topbar">
        <button className="lm-brand" onClick={handleGoHome} type="button">
          <span>watu</span>
        </button>

        <span className="lm-command-kbd lm-command-kbd-static" aria-hidden="true">/</span>

        <input
          aria-label="Global search"
          className="lm-topbar-search"
          onClick={handleOpenCommandPalette}
          onFocus={handleOpenCommandPalette}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleOpenCommandPalette(); } }}
          placeholder="Ask anything — problem, procedure, or family"
          readOnly
          value=""
        />

        <nav className="lm-nav-tabs" aria-label="Primary navigation">
          {/* Families */}
          <div className="lm-family-menu" ref={familyMenuRef}>
            <button
              aria-expanded={familyMenuOpen}
              aria-haspopup="listbox"
              className={`lm-nav-tab${selectedFamilyId || familyMenuOpen ? " active" : ""}`}
              onClick={toggleFamilyMenu}
              ref={familyTriggerRef}
              type="button"
            >
              <NavIcon name="families" />
              Families
            </button>

            {familyMenuOpen && (
              <div
                aria-label="Family operational router"
                className="lm-family-menu-panel"
                ref={familyPanelRef}
                style={panelStyle}
              >
                {/* Header */}
                <div className="lm-family-router-head">
                  <span className="eyebrow">Operational router</span>
                  <strong>Choose family, then flow</strong>
                  <p>Open the right workspace first, then select the exact guided route.</p>
                </div>

                {/* Step indicator */}
                <div className="lm-family-router-steps" aria-label="Router steps" role="list">
                  <span className="lm-step is-current" aria-current="step" role="listitem">
                    <span className="lm-step-num" aria-hidden="true">1</span>
                    <span className="lm-step-label">Family</span>
                  </span>
                  <span className="lm-step-sep" aria-hidden="true">›</span>
                  <span className="lm-step" role="listitem" title="Select a family first">
                    <span className="lm-step-num" aria-hidden="true">2</span>
                    <span className="lm-step-label">Flow</span>
                  </span>
                  <span className="lm-step-sep" aria-hidden="true">›</span>
                  <span className="lm-step" role="listitem" title="Select a flow to open workspace">
                    <span className="lm-step-num" aria-hidden="true">3</span>
                    <span className="lm-step-label">Workspace</span>
                  </span>
                </div>

                {/* Filter */}
                <label className="lm-family-filter-label" htmlFor="family-filter">
                  Find family
                </label>
                <div className="lm-family-filter-wrap">
                  <Search size={14} aria-hidden="true" className="lm-family-filter-icon" />
                  <input
                    aria-activedescendant={
                      activeFamilyIndex >= 0 && filteredFamilies[activeFamilyIndex]
                        ? `fmo-${filteredFamilies[activeFamilyIndex].id}`
                        : undefined
                    }
                    aria-controls="family-menu-list"
                    aria-expanded={familyMenuOpen}
                    className="lm-family-filter-input"
                    id="family-filter"
                    onChange={(e) => setFamilyFilter(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    placeholder="Display, power, security, SIM…"
                    ref={familyFilterRef}
                    role="combobox"
                    value={familyFilter}
                  />
                </div>

                {activeFamily && (
                  <p className="lm-family-active-note">
                    Current: <strong>{activeFamily.title}</strong>
                  </p>
                )}

                {/* List */}
                <div className="lm-family-menu-list" id="family-menu-list" role="listbox">
                  {filteredFamilies.length ? (
                    filteredFamilies.map((family, index) => {

                      const isActive      = selectedFamilyId === family.id;
                      const isHighlighted = activeFamilyIndex === index;
                      return (
                        <button
                          aria-current={isActive ? "true" : undefined}
                          aria-label={`Open ${family.title} diagnosis family`}
                          className={`lm-family-menu-item${isActive ? " is-active" : ""}${isHighlighted ? " is-highlighted" : ""}`}
                          id={`fmo-${family.id}`}
                          key={`fmo-${family.id}`}
                          onClick={() => handleSelect(family.id)}
                          onMouseEnter={() => setActiveFamilyIndex(index)}
                          ref={(n) => { familyItemRefs.current[index] = n; }}
                          style={{ "--item-index": index, "--fam-accent": FAMILY_ICON_MAP[family.id]?.stroke ?? "#00c896" } as CSSProperties}
                          type="button"
                        >
                          <FamilyIconChip familyId={family.id} />
                          <span className="lm-family-menu-copy">
                            <strong>{family.title}</strong>
                            <span title={family.hint}>{family.hint}</span>
                          </span>
                          <span className="lm-family-menu-badge-slot">
                            {isActive ? (
                              <span className="lm-family-check-badge" aria-label="selected">
                                ✓
                              </span>
                            ) : (
                              <span className="lm-family-menu-count">
                                {family.procedure_count} flows
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="lm-family-empty" role="status">
                      No family matches. Try power, display, security, SIM, or liquid.
                    </div>
                  )}
                </div>

                {/* Keyboard hint */}
                <div className="lm-family-keyboard-hint" aria-hidden="true">
                  <kbd>↑↓</kbd>
                  <span>navigate</span>
                  <span className="lm-hint-sep">·</span>
                  <kbd>Enter</kbd>
                  <span>select</span>
                  <span className="lm-hint-sep">·</span>
                  <kbd>Esc</kbd>
                  <span>close</span>
                </div>
              </div>
            )}
          </div>

          {/* System */}
          <button className="lm-nav-tab" onClick={handleFocusSearch} type="button">
            <NavIcon name="system" />
            System
          </button>

          {/* Utilities */}
          <div className="lm-utility-menu" ref={utilityMenuRef}>
            <button
              aria-expanded={utilityMenuOpen}
              aria-haspopup="menu"
              className={`lm-nav-tab${utilityMenuOpen ? " active" : ""}`}
              onClick={toggleUtilityMenu}
              ref={utilityTriggerRef}
              type="button"
            >
              <NavIcon name="utilities" />
              Utilities
            </button>
            {utilityMenuOpen && (
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
            )}
          </div>

          {/* Ops */}
          <Link
            className={`lm-nav-tab lm-nav-tab-ops${opsAuthenticated ? " lm-nav-tab-ops-authenticated" : ""}`}
            href="/ops/login"
            onClick={closeMenus}
          >
            <NavIcon name="ops" />
            Ops
          </Link>
        </nav>
      </div>
    </>
  );
}
