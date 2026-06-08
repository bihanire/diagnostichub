import { useState } from "react";
import { ProcedureSummary, RepairFamilyDetail } from "@/lib/types";

const MAX_VISIBLE = 6;

type FamilyFlowSelectorProps = {
  family: RepairFamilyDetail | null;
  onSelectFlow: (procedure: ProcedureSummary, trackTitle: string | null) => void;
};

export function FamilyFlowSelector({ family, onSelectFlow }: FamilyFlowSelectorProps) {
  const [showAll, setShowAll] = useState(false);

  if (!family) {
    return (
      <section className="lm-flow-selector">
        <div className="lm-flow-selector-head">
          <span className="eyebrow">Family flows</span>
          <h3>Select a family to load guided routes</h3>
        </div>
        <p className="muted-copy">
          Open the <strong>Families</strong> menu above to reveal available operational flows.
        </p>
      </section>
    );
  }

  const allCategories = family.common_categories;
  const categories = showAll ? allCategories : allCategories.slice(0, MAX_VISIBLE);
  const hiddenCount = allCategories.length - MAX_VISIBLE;

  return (
    <section className="lm-flow-selector">
      <div className="lm-flow-selector-head">
        <span className="eyebrow">Family flows</span>
        <h3>{family.title} routes</h3>
        <p className="muted-copy">{family.hint}</p>
      </div>
      <div className="lm-flow-chip-grid">
        {categories.map((category) => (
          <button
            className="lm-flow-chip"
            key={`flow-chip-${family.id}-${category.title}`}
            onClick={() => onSelectFlow(category.primary_procedure, category.title)}
            type="button"
          >
            <strong>{category.primary_procedure.title}</strong>
            <span>{category.title}</span>
          </button>
        ))}
      </div>
      {!showAll && hiddenCount > 0 ? (
        <button
          className="lm-flow-show-more"
          onClick={() => setShowAll(true)}
          type="button"
        >
          Show all {allCategories.length} routes
        </button>
      ) : null}
    </section>
  );
}
