import type { CSSProperties } from "react";

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
  const inFamilyStream = family.in_family_stream;

  function createFallbackEntry(
    summary: string,
    source: string,
    priority: "critical" | "primary" | "secondary",
    index: number
  ) {
    return {
      key: `fallback-${source}-${index}`,
      summary,
      priority,
      source,
      signature: family.id,
      signature_label: family.title,
      occurrence_count: 1,
      first_seen_order: index + 1,
      related_procedures: [],
      technical_notes: []
    };
  }

  const criticalEntries =
    inFamilyStream?.critical_entries?.length
      ? inFamilyStream.critical_entries
      : escalationSignals.map((summary, index) =>
          createFallbackEntry(summary, "escalation_signal", "critical", index)
        );
  const needToKnowEntries =
    inFamilyStream?.need_to_know_entries?.length
      ? inFamilyStream.need_to_know_entries
      : branchChecks.map((summary, index) =>
          createFallbackEntry(summary, "branch_check", "primary", index)
        );
  const niceToKnowEntries = inFamilyStream?.nice_to_know_entries || [];
  const signatureClusters = inFamilyStream?.clusters || [];
  const originalEventCount = inFamilyStream?.original_event_count || 0;
  const deduplicatedEventCount = inFamilyStream?.deduplicated_event_count || 0;
  const explorerStyle = {
    viewTransitionName: `family-card-${family.id}`
  } as CSSProperties;

  return (
    <section className="panel family-explorer motion-surface" style={explorerStyle}>
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
        <div className="family-focus-grid motion-stage">
          {focusCards.map((card, index) => (
            <div
              className="muted-card stack-block family-focus-card motion-card stagger-item"
              key={card.title}
              style={
                {
                  ["--stagger-index" as "--stagger-index"]: index
                } as CSSProperties
              }
            >
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

      <section className="family-workspace-section">
        <div className="panel-header">
          <span className="eyebrow">In-family stream</span>
          <h3>Need-to-know first</h3>
        </div>
        <p className="body-copy panel-lead">
          Distilled view: show critical route signals first, then open deeper technical logs only if needed.
        </p>
        <div className="family-stream-meta">
          <span className="chip chip-muted">{deduplicatedEventCount || needToKnowEntries.length} key signals</span>
          {originalEventCount > deduplicatedEventCount && deduplicatedEventCount > 0 ? (
            <span className="chip chip-muted">
              deduplicated from {originalEventCount} events
            </span>
          ) : null}
        </div>

        <div className="family-stream-grid motion-stage">
          {criticalEntries.length ? (
            <article className="family-stream-card family-stream-card-critical motion-card stagger-item">
              <span className="eyebrow">Critical now</span>
              <ul className="bullet-list">
                {criticalEntries.map((entry) => (
                  <li key={entry.key}>
                    <strong>{entry.summary}</strong>
                    {entry.occurrence_count > 1 ? (
                      <span className="family-stream-count">Seen {entry.occurrence_count} times</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}

          <article
            className="family-stream-card motion-card stagger-item"
            style={
              {
                ["--stagger-index" as "--stagger-index"]: criticalEntries.length ? 1 : 0
              } as CSSProperties
            }
          >
            <span className="eyebrow">Need to know</span>
            <ul className="bullet-list">
              {needToKnowEntries.map((entry) => (
                <li key={entry.key}>
                  <strong>{entry.summary}</strong>
                  {entry.related_procedures.length ? (
                    <div className="family-supporting-list">
                      {entry.related_procedures.map((procedure) => (
                        <button
                          key={`${entry.key}-${procedure.id}`}
                          className="family-support-chip"
                          onClick={() => onSelectProcedure(procedure)}
                          type="button"
                        >
                          {procedure.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        </div>

        {niceToKnowEntries.length ? (
          <details className="panel panel-compact detail-toggle detail-toggle-inline family-stream-toggle">
            <summary className="detail-toggle-summary">
              <div className="panel-header">
                <span className="eyebrow">Expanded logs</span>
                <h3>Nice-to-know technical context</h3>
              </div>
              <span className="detail-toggle-action">Open</span>
            </summary>
            <div className="family-stream-list motion-stage">
              {niceToKnowEntries.map((entry, index) => (
                <article
                  className="family-stream-entry stagger-item"
                  key={entry.key}
                  style={
                    {
                      ["--stagger-index" as "--stagger-index"]: index
                    } as CSSProperties
                  }
                >
                  <strong>{entry.summary}</strong>
                  {entry.technical_notes.length ? (
                    <p className="body-copy">{entry.technical_notes[0]}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </details>
        ) : null}

        {signatureClusters.length ? (
          <details className="panel panel-compact detail-toggle detail-toggle-inline family-stream-toggle">
            <summary className="detail-toggle-summary">
              <div className="panel-header">
                <span className="eyebrow">In-family groups</span>
                <h3>Related signatures</h3>
              </div>
              <span className="detail-toggle-action">Open</span>
            </summary>
            <div className="family-signature-grid motion-stage">
              {signatureClusters.map((cluster, index) => (
                <section
                  className="family-signature-card motion-card stagger-item"
                  key={cluster.signature}
                  style={
                    {
                      ["--stagger-index" as "--stagger-index"]: index
                    } as CSSProperties
                  }
                >
                  <div className="family-signature-header">
                    <strong>{cluster.signature_label}</strong>
                    <span className="chip chip-muted">{cluster.total_occurrences}</span>
                  </div>
                  <ul className="bullet-list">
                    {cluster.entries.map((entry) => (
                      <li key={entry.key}>{entry.summary}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      {commonCategories.length ? (
        <section className="family-workspace-section">
          <div className="panel-header">
            <span className="eyebrow">Common categories</span>
            <h3>Start from the closest category inside this family</h3>
          </div>
          <p className="body-copy panel-lead">
            These are the most common ways branch teams are likely to hear the issue described.
          </p>
          <div className="family-category-grid motion-stage">
            {commonCategories.map((category, index) => (
              <article
                className="family-category-card motion-card stagger-item"
                key={category.title}
                style={
                  {
                    ["--stagger-index" as "--stagger-index"]: index
                  } as CSSProperties
                }
              >
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
              <div className="family-procedure-grid motion-stage">
                {group.procedures.map((procedure, index) => (
                  <section
                    key={`${group.title}-${procedure.id}`}
                    className="family-procedure-card motion-card stagger-item"
                    style={
                      {
                        ["--stagger-index" as "--stagger-index"]: index
                      } as CSSProperties
                    }
                  >
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
        <div className="family-procedure-grid motion-stage">
          {family.procedures.map((procedure, index) => (
            <section
              key={procedure.id}
              className="family-procedure-card motion-card stagger-item"
              style={
                {
                  ["--stagger-index" as "--stagger-index"]: index
                } as CSSProperties
              }
            >
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
