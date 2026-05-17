import { FormEvent, KeyboardEvent, useEffect, useState } from "react";

import { AssistantActionGrid } from "@/components/AssistantActionGrid";
import { LearningPath } from "@/components/LearningPath";
import { SearchAssistDropdown } from "@/components/SearchAssistDropdown";
import { SearchOutputMode } from "@/lib/api";
import { SearchAssistSuggestion } from "@/lib/search-assist";

type AIDiagnosticWorkspaceProps = {
  title: string;
  description: string;
  activeFamilyTitle: string | null;
  backendStatus: "ok" | "degraded" | "unreachable";
  hasRunError: boolean;
  moduleMode: string;
  query: string;
  runSuccessKey: number;
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
  onClearFamily: () => void;
  onOpenFamilyPicker: () => void;
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

function StethoscopeIcon() {
  return (
    <svg aria-hidden="true" className="run-btn-icon" viewBox="0 0 24 24">
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M8 3H4M16 3h4M10 12v2a5 5 0 0 0 10 0v-1" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

export function AIDiagnosticWorkspace({
  title,
  description,
  activeFamilyTitle,
  backendStatus,
  hasRunError,
  moduleMode,
  query,
  runSuccessKey,
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
  onClearFamily,
  onOpenFamilyPicker,
  learningPhase,
  inputRef,
  isGateway = false,
  outputMode,
  onOutputModeChange,
}: AIDiagnosticWorkspaceProps) {
  const [diagnosisPulse, setDiagnosisPulse] = useState(false);
  const [runVisualState, setRunVisualState] = useState<"idle" | "success" | "error">("idle");

  const modeLabel =
    moduleMode === "diagnostic" ? "Diagnostic Learning" : moduleMode === "guided" ? "Guided Steps" : "SOP Explain";
  const backendIssue = backendStatus !== "ok";
  const focusDotState = backendIssue ? "danger" : activeFamilyTitle ? "success" : "warn";
  const focusLabel = backendIssue
    ? "Backend issue detected"
    : activeFamilyTitle
      ? "Family selected"
      : "No family selected";
  const activeRunState = searching ? "loading" : runVisualState;
  const runButtonText = activeRunState === "loading"
    ? "Analysing…"
    : activeRunState === "error"
      ? "Retry — something failed"
      : "Run Diagnosis";
  const characterCount = query.length;

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 120), 280);
    textarea.style.height = `${nextHeight}px`;
  }, [inputRef, query]);

  useEffect(() => {
    if (runSuccessKey <= 0 || searching || hasRunError) {
      return;
    }

    setRunVisualState("success");
    const timeout = window.setTimeout(() => setRunVisualState("idle"), 200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasRunError, runSuccessKey, searching]);

  useEffect(() => {
    if (!hasRunError) {
      return;
    }

    setRunVisualState("error");
    const timeout = window.setTimeout(() => setRunVisualState("idle"), 4000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasRunError]);

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
        {activeFamilyTitle ? (
          <div className={`lm-active-focus focus-bar focus-bar-${focusDotState}`}>
            <span className={`focus-dot focus-dot-${focusDotState}`} aria-hidden="true" />
            <span className="focus-eyebrow">Current focus</span>
            <span className="focus-text" aria-live="polite">{focusLabel}</span>
            <button className="focus-family-chip" onClick={onClearFamily} type="button">
              <span>{activeFamilyTitle}</span>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : (
          <button
            className={`lm-active-focus focus-bar focus-bar-clickable focus-bar-${focusDotState}`}
            onClick={onOpenFamilyPicker}
            type="button"
          >
            <span className={`focus-dot focus-dot-${focusDotState} focus-dot-pulse`} aria-hidden="true" />
            <span className="focus-eyebrow">Current focus</span>
            <span className="focus-text" aria-live="polite">{focusLabel}</span>
          </button>
        )}
        {backendIssue ? (
          <p className="backend-health-banner" role="status">
            Backend issue detected — results may be unavailable.
          </p>
        ) : null}
        {isGateway ? null : (
          <div className="lm-workspace-flow" aria-label="Learning flow">
            {workflowMilestones.map((milestone) => (
              <span key={`workflow-${milestone}`}>{milestone}</span>
            ))}
          </div>
        )}
      </header>

      <form className={`lm-diagnosis-form diag-panel ${diagnosisPulse ? "diag-panel-pulse" : ""}`} onSubmit={onSubmit}>
        {isGateway ? null : (
          <>
            <div className="lm-diagnosis-head diag-header">
              <strong>Intelligent diagnosis input</strong>
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
          </>
        )}
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
            placeholder="Describe the issue in the customer's own words..."
            value={query}
          />
          {query.trim() ? (
            <button aria-label="Clear input" className="lm-clear-btn" onClick={onClear} type="button">
              ×
            </button>
          ) : null}
          {characterCount > 20 ? (
            <span className="diag-character-count" aria-live="polite">
              {characterCount}
            </span>
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
          <button
            aria-label="Run diagnosis"
            className={`primary-button lm-run-btn run-btn run-btn-${activeRunState}`}
            disabled={searching}
            type="submit"
          >
            <StethoscopeIcon />
            <span>{runButtonText}</span>
            <span className="run-btn-tooltip" role="tooltip">
              Enter to run · Esc to clear
            </span>
          </button>
          <span className="sr-only" id="diagnosis-helper">
            Enter runs diagnosis. Escape clears the input.
          </span>
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
              {chip}
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
