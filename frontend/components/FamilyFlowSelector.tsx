import { ProcedureSummary, RepairFamilyDetail } from "@/lib/types";

type FamilyFlowSelectorProps = {
  family: RepairFamilyDetail | null;
  onSelectFlow: (procedure: ProcedureSummary, trackTitle: string | null) => void;
};

export function FamilyFlowSelector({ family, onSelectFlow }: FamilyFlowSelectorProps) {
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

  const categories = family.common_categories.slice(0, 6);

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
            <span>Route: {category.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
