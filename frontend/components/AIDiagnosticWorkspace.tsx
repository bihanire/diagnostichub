import { FormEvent, KeyboardEvent } from "react";

import { SearchAssistDropdown } from "@/components/SearchAssistDropdown";
import { SearchAssistSuggestion } from "@/lib/search-assist";

type AIDiagnosticWorkspaceProps = {
  title: string;
  description: string;
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
  inputRef: React.RefObject<HTMLTextAreaElement>;
};

const modeMap: Record<string, string> = {
  diagnostic: "Convert issue into action plan",
  guided: "Guide me step-by-step",
  explain: "Explain this SOP clearly",
};

export function AIDiagnosticWorkspace({
  title,
  description,
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
  inputRef,
}: AIDiagnosticWorkspaceProps) {
  return (
    <section className="lm-workspace">
      <header className="lm-workspace-head">
        <span className="eyebrow">LLM learning module for aftersales operations</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <form className="lm-diagnosis-form" onSubmit={onSubmit}>
        <div className="lm-diagnosis-head">
          <strong>Intelligent diagnosis input</strong>
          <span>{modeMap[moduleMode] || modeMap.diagnostic}</span>
        </div>
        <div className="lm-diagnosis-input-wrap">
          <textarea
            ref={inputRef}
            aria-label="Describe the customer issue"
            className="lm-diagnosis-input"
            disabled={searching}
            onBlur={onBlur}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder="Example: phone is not turning on but it vibrates when I hold the power button"
            value={query}
          />
          {query.trim() ? (
            <button
              aria-label="Clear search"
              className="lm-clear-btn"
              onClick={onClear}
              type="button"
            >
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
          <button className="primary-button lm-run-btn" onClick={onRun} type="submit">
            {searching ? "Thinking..." : "Run diagnosis"}
          </button>
          <span>Enter to run, Esc to close overlays, Ctrl/Cmd+K for command palette</span>
        </div>
      </form>

      <section className="lm-prompt-chips">
        <span className="eyebrow">Ask the module</span>
        <div className="lm-chip-grid">
          {promptChips.map((chip) => (
            <button
              className="lm-chip"
              key={`chip-${chip}`}
              onClick={() => onPromptClick(chip)}
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
