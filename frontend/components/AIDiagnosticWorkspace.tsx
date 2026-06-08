import { AlertTriangle, CheckCircle2, X as XIcon } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";

import { SearchAssistDropdown } from "@/components/SearchAssistDropdown";
import { SearchAssistSuggestion } from "@/lib/search-assist";

type AIDiagnosticWorkspaceProps = {
  title: string;
  description: string;
  activeFamilyTitle: string | null;
  backendStatus: "ok" | "degraded" | "unreachable";
  hasRunError: boolean;
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
  onClearFamily: () => void;
  onOpenFamilyPicker: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  isGateway?: boolean;
};

function StethoscopeIcon() {
  return (
    <svg aria-hidden="true" className="run-btn-icon" viewBox="0 0 24 24">
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M8 3H4M16 3h4M10 12v2a5 5 0 0 0 10 0v-1" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function ReadyIllustration() {
  return (
    <div className="diag-idle-illustration" aria-hidden="true" />
  );
}

export function AIDiagnosticWorkspace({
  title,
  description,
  activeFamilyTitle,
  backendStatus,
  hasRunError,
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
  onClearFamily,
  onOpenFamilyPicker,
  inputRef,
  isGateway = false,
}: AIDiagnosticWorkspaceProps) {
  const [runVisualState, setRunVisualState] = useState<"idle" | "success" | "error">("idle");

  const backendIssue = backendStatus !== "ok";
  const focusDotState = backendIssue ? "danger" : activeFamilyTitle ? "success" : "warn";
  const focusLabel = backendIssue
    ? "Backend issue detected"
    : activeFamilyTitle
      ? "Family selected"
      : "No family selected";
  const activeRunState = searching ? "loading" : runVisualState;
  const runButtonText = activeRunState === "loading"
    ? "Analysing..."
    : activeRunState === "error"
      ? "Retry - something failed"
      : "Run Diagnosis";
  const characterCount = query.length;
  const hasInput = query.trim().length > 0;
  const showIdleZone = !hasInput && !searching && runSuccessKey <= 0;

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
            <button aria-label="Clear selected family" className="focus-family-chip" onClick={onClearFamily} type="button">
              <span>{activeFamilyTitle}</span>
              <span aria-hidden="true">x</span>
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
          <div className="backend-health-banner" role="alert">
            <AlertTriangle size={15} aria-hidden="true" strokeWidth={2} />
            <span>Backend issue detected — results may be unavailable.</span>
          </div>
        ) : null}
      </header>

      <form
        className={`lm-diagnosis-form diag-panel ${hasInput ? "has-input" : ""}`}
        onSubmit={onSubmit}
      >
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
              <XIcon size={13} aria-hidden="true" strokeWidth={2.5} />
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

        {showIdleZone ? (
          <div className="diag-idle-zone">
            <ReadyIllustration />
            <p>Ready to diagnose - describe the issue above</p>
          </div>
        ) : null}

        <div className="lm-action-bar">
          <button
            aria-label={searching ? "Running diagnosis" : hasRunError ? "Retry diagnosis" : "Run diagnosis"}
            className={`primary-button lm-run-btn run-btn run-btn-${activeRunState}`}
            disabled={searching}
            type="submit"
          >
            {activeRunState === "loading" ? (
              <span className="run-btn-dots" aria-hidden="true">
                <span /><span /><span />
              </span>
            ) : activeRunState === "error" ? (
              <AlertTriangle size={16} aria-hidden="true" strokeWidth={2} />
            ) : activeRunState === "success" ? (
              <CheckCircle2 size={16} aria-hidden="true" strokeWidth={2} />
            ) : (
              <StethoscopeIcon />
            )}
            <span>{runButtonText}</span>
          </button>
          <span className="sr-only" id="diagnosis-helper">
            Enter runs diagnosis. Escape clears the input.
          </span>
        </div>
      </form>
    </section>
  );
}
