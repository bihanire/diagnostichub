import { FormEvent, KeyboardEvent, useState } from "react";

import { AssistantActionGrid } from "@/components/AssistantActionGrid";
import { LearningPath } from "@/components/LearningPath";
import { SearchAssistDropdown } from "@/components/SearchAssistDropdown";
import { SearchOutputMode } from "@/lib/api";
import { SearchAssistSuggestion } from "@/lib/search-assist";

type AIDiagnosticWorkspaceProps = {
  title: string;
  description: string;
  activeFamilyTitle: string | null;
  moduleMode: string;
  query: string;
  searching: boolean;
  searchAssistOpen: boolean;
  searchAssistLoading: boolean;
  activeSuggestionIndex: number;
  suggestions: SearchAssistSuggestion[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelectSuggestion: (suggestion: SearchAssistSuggestion) => void;
  onHoverSuggestion: (index: number) => void;
  onClear: () => void;
  promptChips: string[];
  onPromptClick: (value: string) => void;
  onRun: () => void;
  learningPhase: "intake" | "interpretation" | "action" | "related";
  inputRef: React.RefObject<HTMLTextAreaElement>;
  isGateway?: boolean;
  outputMode: SearchOutputMode;
  onOutputModeChange: (mode: SearchOutputMode) => void;
};

const modeMap: Record<string, string> = {
  diagnostic: "Convert issue into action plan",
  guided: "Guide me step-by-step",
  explain: "Explain this SOP clearly",
};

const workflowMilestones = ["Families", "Procedures", "Guided steps", "Related suggestions"];

function promptIcon(prompt: string): string {
  const clean = prompt.toLowerCase();
  if (clean.includes("overheat")) {
    return "!";
  }
  if (clean.includes("step-by-step")) {
    return ">";
  }
  if (clean.includes("eligibility")) {
    return "#";
  }
  if (clean.includes("procedure")) {
    return "=";
  }
  if (clean.includes("branch")) {
    return "@";
  }
  return "*";
}

const outputModeLabels: Record<SearchOutputMode, string> = {
  issue_interpretation: "Issue interpretation",
  diagnostic_path: "Diagnostic path",
  sop_action: "SOP action",
};

const outputModeOptions: Array<{ label: string; value: SearchOutputMode }> = [
  { label: outputModeLabels.issue_interpretation, value: "issue_interpretation" },
  { label: outputModeLabels.diagnostic_path, value: "diagnostic_path" },
  { label: outputModeLabels.sop_action, value: "sop_action" },
];

export function AIDiagnosticWorkspace({
  title,
  description,
  activeFamilyTitle,
  moduleMode,
  query,
  searching,
  searchAssistOpen,
  searchAssistLoading,
  activeSuggestionIndex,
  suggestions,
  onSubmit,
  onQueryChange,
  onFocus,
  onBlur,
  onKeyDown,
  onSelectSuggestion,
  onHoverSuggestion,
  onClear,
  promptChips,
  onPromptClick,
  onRun,
  learningPhase,
  inputRef,
  isGateway = false,
  outputMode,
  onOutputModeChange,
}: AIDiagnosticWorkspaceProps) {
  const [diagnosisPulse, setDiagnosisPulse] = useState(false);

  const modeLabel =
    moduleMode === "diagnostic" ? "Diagnostic Learning" : moduleMode === "guided" ? "Guided Steps" : "SOP Explain";

  function handlePromptPick(value: string) {
    onPromptClick(value);
    setDiagnosisPulse(true);
    window.setTimeout(() => setDiagnosisPulse(false), 520);
  }

  return (
    <section className={`lm-workspace ${isGateway ? "lm-workspace-gateway" : "lm-workspace-deep"}`}>
      <header className="lm-workspace-head hero">
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="lm-active-focus focus-bar">
          <span className="focus-dot" aria-hidden="true" />
          <span className="focus-eyebrow">Current focus</span>
          <span className="focus-text">
            {activeFamilyTitle ? `${activeFamilyTitle} · ${modeLabel}` : "No family selected · Diagnostic Learning"}
          </span>
        </div>
        {isGateway ? null : (
          <div className="lm-workspace-flow" aria-label="Learning flow">
            {workflowMilestones.map((milestone) => (
              <span key={`workflow-${milestone}`}>{milestone}</span>
            ))}
          </div>
        )}
      </header>

      <form className={`lm-diagnosis-form diag-panel ${diagnosisPulse ? "diag-panel-pulse" : ""}`} onSubmit={onSubmit}>
        <span className="scan-line" aria-hidden="true" />
        <div className="lm-diagnosis-head diag-header">
          <strong>
            <span className="diag-head-icon" aria-hidden="true">
              *
            </span>
            Intelligent diagnosis input
          </strong>
          <span className="diag-convert-link">{modeMap[moduleMode] || modeMap.diagnostic}</span>
        </div>
        <div className="lm-ai-cues lm-mini-chip-row" role="group" aria-label="Output selectors">
          {outputModeOptions.map((item) => (
            <button
              className={`output-chip ${outputMode === item.value ? "selected" : ""}`}
              key={`output-${item.value}`}
              onClick={() => onOutputModeChange(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="lm-diagnosis-input-wrap">
          <textarea
            ref={inputRef}
            aria-label="Describe the customer issue"
            aria-describedby="diagnosis-helper"
            className="lm-diagnosis-input diag-textarea"
            disabled={searching}
            onBlur={onBlur}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder="e.g. phone won't turn on but vibrates when I hold power"
            value={query}
          />
          {query.trim() ? (
            <button aria-label="Clear search" className="lm-clear-btn" onClick={onClear} type="button">
              x
            </button>
          ) : null}
          {searchAssistOpen ? (
            <div className="lm-assist-popover">
              <SearchAssistDropdown
                activeIndex={activeSuggestionIndex}
                loading={searchAssistLoading}
                onHover={onHoverSuggestion}
                onSelect={onSelectSuggestion}
                query={query}
                suggestions={suggestions}
              />
            </div>
          ) : null}
        </div>
        <div className="lm-action-bar">
          <button className="primary-button lm-run-btn run-btn" onClick={onRun} type="submit">
            {searching ? "Analyzing issue..." : "Run diagnosis"}
          </button>
          <div className="lm-kbd-hints" id="diagnosis-helper">
            <span>
              <kbd>Enter</kbd> run
            </span>
            <span>
              <kbd>Esc</kbd> close overlays
            </span>
            <span>
              <kbd>Ctrl/Cmd + K</kbd> command palette
            </span>
          </div>
        </div>
      </form>

      {isGateway ? null : <LearningPath phase={learningPhase} />}

      {isGateway ? null : (
        <AssistantActionGrid
          items={[
            "Ask the Module",
            "Explain SOP",
            "Guide Step-by-Step",
            "Convert Issue to Action Plan",
            "Show Related Procedures",
            "Check Eligibility",
            "Surface Risk Flags",
          ]}
          onSelect={onPromptClick}
        />
      )}

      <section className="lm-prompt-chips">
        <span className="eyebrow">Suggested prompts</span>
        <div className="lm-chip-grid lm-chip-grid-primary">
          {promptChips.slice(0, 2).map((chip, index) => (
            <button
              className="lm-chip lm-chip-primary"
              key={`chip-${chip}`}
              onClick={() => handlePromptPick(chip)}
              style={{ animationDelay: `${220 + index * 40}ms` }}
              type="button"
            >
              <span className="lm-chip-icon" aria-hidden="true">
                {promptIcon(chip)}
              </span>
              <span>{chip}</span>
            </button>
          ))}
        </div>
        <div className="lm-chip-grid lm-chip-grid-secondary">
          {promptChips.slice(2).map((chip, index) => (
            <button
              className="lm-chip lm-chip-secondary"
              key={`chip-secondary-${chip}`}
              onClick={() => handlePromptPick(chip)}
              style={{ animationDelay: `${340 + index * 40}ms` }}
              type="button"
            >
              <span className="lm-chip-icon" aria-hidden="true">
                {promptIcon(chip)}
              </span>
              {chip}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
