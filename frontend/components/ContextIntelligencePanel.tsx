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
        <span className="eyebrow">
          {title} <em className="lm-context-count">{items.length}</em>
        </span>
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
  const hasSignals = related.length > 0 || alternatives.length > 0 || riskFlags.length > 0 || eligibilityChecks.length > 0;

  return (
    <div className="lm-context" aria-live="polite">
      <section className="lm-context-card lm-context-summary">
        <div className="panel-header">
          <span className="eyebrow">Context intelligence</span>
        </div>
        <div className="lm-context-summary-grid">
          <span>
            <strong>{related.length}</strong>
            Related
          </span>
          <span>
            <strong>{alternatives.length}</strong>
            Next routes
          </span>
          <span>
            <strong>{riskFlags.length}</strong>
            Risks
          </span>
          <span>
            <strong>{eligibilityChecks.length}</strong>
            Checks
          </span>
        </div>
        {!hasSignals ? <p className="muted-copy">Run diagnosis or open a family to populate intelligence.</p> : null}
      </section>

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
