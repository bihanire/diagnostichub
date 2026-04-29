import type { ReactNode } from "react";

import { SearchAssistSuggestion } from "@/lib/search-assist";

type SearchAssistDropdownProps = {
  query: string;
  loading: boolean;
  suggestions: SearchAssistSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: SearchAssistSuggestion) => void;
  onHover: (index: number) => void;
};

function renderHighlighted(text: string, terms: string[]): ReactNode {
  if (!terms.length) {
    return text;
  }

  const lower = text.toLowerCase();
  const hitTerm = terms.find((term) => term.length > 1 && lower.includes(term.toLowerCase()));
  if (!hitTerm) {
    return text;
  }

  const lowerTerm = hitTerm.toLowerCase();
  const start = lower.indexOf(lowerTerm);
  if (start < 0) {
    return text;
  }
  const end = start + lowerTerm.length;

  return (
    <>
      {text.slice(0, start)}
      <strong>{text.slice(start, end)}</strong>
      {text.slice(end)}
    </>
  );
}

function groupedSuggestions(suggestions: SearchAssistSuggestion[]) {
  const grouped = new Map<string, Array<SearchAssistSuggestion & { index: number }>>();
  suggestions.forEach((item, index) => {
    const bucket = grouped.get(item.category) || [];
    bucket.push({ ...item, index });
    grouped.set(item.category, bucket);
  });
  return [...grouped.entries()];
}

export function SearchAssistDropdown({
  query,
  loading,
  suggestions,
  activeIndex,
  onSelect,
  onHover
}: SearchAssistDropdownProps) {
  if (!query.trim()) {
    return null;
  }

  if (!loading && suggestions.length === 0) {
    return (
      <div className="search-assist-panel" role="status">
        <p className="search-assist-empty">No quick matches yet. Press Enter to run full diagnosis search.</p>
      </div>
    );
  }

  return (
    <div className="search-assist-panel" role="listbox" aria-label="Search suggestions">
      {loading ? (
        <div className="search-assist-loading" role="status">
          <span className="skeleton-line search-skeleton-line-lg" />
          <span className="skeleton-line search-skeleton-line-md" />
        </div>
      ) : (
        groupedSuggestions(suggestions).map(([category, items]) => (
          <section className="search-assist-group" key={category}>
            <header className="search-assist-group-title">{category}</header>
            <div className="search-assist-group-items">
              {items.map((item) => {
                const selected = item.index === activeIndex;
                return (
                  <button
                    aria-selected={selected}
                    className={`search-assist-item ${selected ? "search-assist-item-active" : ""}`}
                    id={`search-assist-option-${item.index}`}
                    key={item.id}
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => onHover(item.index)}
                    role="option"
                    type="button"
                  >
                    <span className="search-assist-item-label">
                      {renderHighlighted(item.label, item.matchedTerms)}
                    </span>
                    <span className="search-assist-item-subtitle">
                      {renderHighlighted(item.subtitle, item.matchedTerms)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
