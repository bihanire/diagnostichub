import type { CSSProperties } from "react";

import { ProcedureSummary } from "@/lib/types";
import { uiCopy } from "@/lib/copy";

type SuggestionListProps = {
  title: string;
  items: ProcedureSummary[];
  emptyMessage: string;
  onSelect?: (procedure: ProcedureSummary) => void;
  embedded?: boolean;
};

export function SuggestionList({
  title,
  items,
  emptyMessage,
  onSelect,
  embedded = false
}: SuggestionListProps) {
  return (
    <section className={embedded ? "suggestion-list-embedded" : "panel"}>
      <div className="panel-header">
        <span className="eyebrow">{uiCopy.suggestions.eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? <p className="body-copy">{emptyMessage}</p> : null}
      <div className="link-grid motion-stage">
        {items.map((item, index) => (
          <button
            key={item.id}
            className="link-card stagger-item"
            onClick={() => onSelect?.(item)}
            style={
              {
                ["--stagger-index" as "--stagger-index"]: index
              } as CSSProperties
            }
            type="button"
          >
            <span className="eyebrow">{item.category}</span>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
