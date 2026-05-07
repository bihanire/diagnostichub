import Link from "next/link";

type TopCommandBarProps = {
  moduleMode: string;
  onModuleModeChange: (value: string) => void;
  onFocusSearch: () => void;
  onOpenCommandPalette: () => void;
};

export function TopCommandBar({
  moduleMode,
  onModuleModeChange,
  onFocusSearch,
  onOpenCommandPalette,
}: TopCommandBarProps) {
  const modeLabel =
    moduleMode === "diagnostic"
      ? "Diagnostic learning"
      : moduleMode === "guided"
        ? "Guide step-by-step"
        : "Explain SOP";

  return (
    <div className="lm-topbar">
      <button className="lm-brand" onClick={onFocusSearch} type="button">
        <span className="lm-brand-dot" aria-hidden="true" />
        <span>watu</span>
        <small>Simu triage module</small>
      </button>

      <button
        className="lm-global-search-trigger"
        onClick={onFocusSearch}
        type="button"
      >
        <span>/</span>
        <span>Ask the Module, search procedures, or run a command...</span>
      </button>

      <div className="lm-module-control">
        <label className="lm-module-control-label" htmlFor="learning-mode">
          Active learning mode
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
  );
}
