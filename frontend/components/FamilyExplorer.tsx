import { ProcedureSummary, RepairFamilyDetail } from "@/lib/types";
import { getRepairFamilyShortcut } from "@/lib/issue-visuals";

type FamilyExplorerProps = {
  family: RepairFamilyDetail;
  onSelectProcedure: (procedure: ProcedureSummary) => void;
  onRunPrompt: (prompt: string) => void;
  openingProcedureId?: number | null;
};

export function FamilyExplorer({
  family,
  onSelectProcedure,
  onRunPrompt,
  openingProcedureId,
}: FamilyExplorerProps) {
  const familyVisual = getRepairFamilyShortcut(family.id);
  const focusCards = family.focus_cards || [];
  const commonCategories = family.common_categories || [];
  const procedureGroups = family.procedure_groups || [];
  const branchChecks = family.branch_checks || [];
  const escalationSignals = family.escalation_signals || [];

  return (
    <section className="panel family-explorer">
      <div className="panel-header family-explorer-header">
        <div>
          <span className="eyebrow">Diagnostic workspace</span>
          <h3>{family.title}</h3>
          <p className="body-copy">{family.diagnostic_goal}</p>
        </div>
        {familyVisual ? (
          <div className="family-explorer-art" aria-hidden="true">
            {familyVisual.art}
          </div>
        ) : null}
      </div>

      {focusCards.length ? (
        <div className="family-focus-grid">
          {focusCards.map((card) => (
            <div className="muted-card stack-block family-focus-card" key={card.title}>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="family-explorer-meta">
        <div className="muted-card stack-block">
          <strong>Officer focus</strong>
          <p>{family.hint}</p>
        </div>
        <div className="muted-card stack-block">
          <strong>Start from likely wording</strong>
          <div className="quick-pill-row">
            {family.symptom_prompts.map((prompt) => (
              <button
                key={prompt}
                className="quick-pill"
                onClick={() => onRunPrompt(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {commonCategories.length ? (
        <section className="family-workspace-section">
          <div className="panel-header">
            <span className="eyebrow">Common categories</span>
            <h3>Start from the closest category inside this family</h3>
          </div>
          <p className="body-copy panel-lead">
            These are the most common ways branch teams are likely to hear the issue described.
          </p>
          <div className="family-category-grid">
            {commonCategories.map((category) => (
              <article className="family-category-card" key={category.title}>
                <div className="stack-block">
                  <span className="eyebrow">{category.primary_procedure.category}</span>
                  <h4>{category.title}</h4>
                  <p className="body-copy">{category.description}</p>
                </div>

                <div className="stack-block">
                  <strong className="family-mini-heading">What officers may search for</strong>
                  <div className="quick-pill-row family-example-row">
                    {category.search_examples.map((example) => (
                      <button
                        key={example}
                        className="quick-pill"
                        onClick={() => onRunPrompt(example)}
                        type="button"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                {category.supporting_procedures.length ? (
                  <div className="stack-block">
                    <strong className="family-mini-heading">Cross-check if the symptom shifts</strong>
                    <div className="family-supporting-list">
                      {category.supporting_procedures.map((procedure) => (
                        <button
                          key={`${category.title}-${procedure.id}`}
                          className="family-support-chip"
                          onClick={() => onSelectProcedure(procedure)}
                          type="button"
                        >
                          {procedure.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  className="primary-button"
                  disabled={openingProcedureId === category.primary_procedure.id}
                  onClick={() => onSelectProcedure(category.primary_procedure)}
                  type="button"
                >
                  {openingProcedureId === category.primary_procedure.id
                    ? "Opening..."
                    : `Start with ${category.primary_procedure.title}`}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {procedureGroups.length ? (
        <details className="panel panel-compact detail-toggle family-routes-toggle">
          <summary className="detail-toggle-summary">
            <div className="panel-header">
              <span className="eyebrow">More guided routes</span>
              <h3>See the full family route list</h3>
            </div>
            <span className="detail-toggle-action">Open</span>
          </summary>
          <div className="family-workspace-sections">
          {procedureGroups.map((group) => (
            <section className="family-workspace-section" key={group.title}>
              <div className="panel-header">
                <span className="eyebrow">Guided route</span>
                <h3>{group.title}</h3>
              </div>
              <p className="body-copy panel-lead">{group.description}</p>
              <div className="family-procedure-grid">
                {group.procedures.map((procedure) => (
                  <section key={`${group.title}-${procedure.id}`} className="family-procedure-card">
                    <span className="eyebrow">{procedure.category}</span>
                    <h4>{procedure.title}</h4>
                    <p className="body-copy">{procedure.description}</p>
                    <button
                      className="primary-button"
                      disabled={openingProcedureId === procedure.id}
                      onClick={() => onSelectProcedure(procedure)}
                      type="button"
                    >
                      {openingProcedureId === procedure.id ? "Opening..." : "Start this guided flow"}
                    </button>
                  </section>
                ))}
              </div>
            </section>
          ))}
          </div>
        </details>
      ) : (
        <div className="family-procedure-grid">
          {family.procedures.map((procedure) => (
            <section key={procedure.id} className="family-procedure-card">
              <span className="eyebrow">{procedure.category}</span>
              <h4>{procedure.title}</h4>
              <p className="body-copy">{procedure.description}</p>
              <button
                className="primary-button"
                disabled={openingProcedureId === procedure.id}
                onClick={() => onSelectProcedure(procedure)}
                type="button"
              >
                {openingProcedureId === procedure.id ? "Opening..." : "Start this guided flow"}
              </button>
            </section>
          ))}
        </div>
      )}

      <div className="family-diagnostic-guides">
        <div className="muted-card stack-block family-guide-card">
          <strong>Keep these branch checks in play</strong>
          <ul className="bullet-list">
            {branchChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="muted-card stack-block family-guide-card family-guide-card-accent">
          <strong>Escalate faster when you see this</strong>
          <ul className="bullet-list">
            {escalationSignals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
