import { ProcedureSummary } from "@/lib/types";

type ContextIntelligencePanelProps = {
  related: ProcedureSummary[];
  alternatives: ProcedureSummary[];
  riskFlags: string[];
  eligibilityChecks: string[];
  onSelectProcedure: (procedure: ProcedureSummary) => void;
};

function renderProcedureList(
  title: string,
  items: ProcedureSummary[],
  onSelectProcedure: (procedure: ProcedureSummary) => void
) {
  return (
    <section className="lm-context-card">
      <div className="panel-header">
        <span className="eyebrow">{title}</span>
      </div>
      {items.length > 0 ? (
        <div className="lm-context-list">
          {items.map((item) => (
            <button
              className="lm-context-link"
              key={`ctx-${title}-${item.id}`}
              onClick={() => onSelectProcedure(item)}
              type="button"
            >
              <strong>{item.title}</strong>
              <span>{item.category}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-copy">No recommendations yet. Run diagnosis first.</p>
      )}
    </section>
  );
}

export function ContextIntelligencePanel({
  related,
  alternatives,
  riskFlags,
  eligibilityChecks,
  onSelectProcedure,
}: ContextIntelligencePanelProps) {
  return (
    <div className="lm-context">
      {renderProcedureList("Related procedures", related, onSelectProcedure)}
      {renderProcedureList("Recommended next routes", alternatives, onSelectProcedure)}

      <section className="lm-context-card">
        <div className="panel-header">
          <span className="eyebrow">Risk flags</span>
        </div>
        <ul className="bullet-list">
          {riskFlags.length > 0 ? (
            riskFlags.slice(0, 4).map((flag) => <li key={`risk-${flag}`}>{flag}</li>)
          ) : (
            <li>No major risk flags surfaced yet.</li>
          )}
        </ul>
      </section>

      <section className="lm-context-card">
        <div className="panel-header">
          <span className="eyebrow">Eligibility checks</span>
        </div>
        <ul className="bullet-list">
          {eligibilityChecks.length > 0 ? (
            eligibilityChecks.slice(0, 4).map((item) => <li key={`elig-${item}`}>{item}</li>)
          ) : (
            <li>Eligibility checks appear after family or procedure selection.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
