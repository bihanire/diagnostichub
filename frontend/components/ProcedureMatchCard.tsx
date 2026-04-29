import { CustomerCare, ProcedureSummary } from "@/lib/types";
import { uiCopy } from "@/lib/copy";
import { formatRatioPercent } from "@/lib/format";
import { IssueVisualGuide } from "@/components/IssueVisualGuide";

type ProcedureMatchCardProps = {
  procedure: ProcedureSummary;
  confidence: number;
  confidenceState?: string;
  confidenceMargin?: number;
  reviewMessage?: string | null;
  nextStep: string;
  customerCare?: CustomerCare | null;
  onStart: () => void;
  busy?: boolean;
};

export function ProcedureMatchCard({
  procedure,
  confidence,
  confidenceState,
  confidenceMargin,
  reviewMessage,
  nextStep,
  customerCare,
  onStart,
  busy
}: ProcedureMatchCardProps) {
  return (
    <section className="panel match-card motion-surface">
      <div className="match-heading">
        <div>
          <span className="eyebrow">{uiCopy.matchCard.eyebrow}</span>
          <h2>{procedure.title}</h2>
        </div>
        <div className="confidence-pill">
          {formatRatioPercent(confidence)} {uiCopy.matchCard.matchSuffix}
        </div>
      </div>

      <div className="chip-row">
        <span className="chip">
          {uiCopy.matchCard.categoryLabel}: {procedure.category}
        </span>
        {procedure.warranty_status ? (
          <span className="chip chip-muted">{uiCopy.matchCard.warrantyReviewed}</span>
        ) : null}
      </div>

      <p className="body-copy">{procedure.description}</p>
      <IssueVisualGuide
        procedureTitle={procedure.title}
        procedureCategory={procedure.category}
        variant="embedded"
      />
      <div
        className={`muted-card stack-block motion-card ${confidenceState === "caution" ? "match-review-card" : ""}`}
      >
        <strong>
          {confidenceState === "caution"
            ? uiCopy.matchCard.cautionTitle
            : uiCopy.matchCard.cautionStrongTitle}
        </strong>
        <p>{reviewMessage || nextStep}</p>
        {typeof confidenceMargin === "number" ? (
          <p className="muted-copy">
            {uiCopy.matchCard.cautionMarginLabel}: {formatRatioPercent(confidenceMargin)}
          </p>
        ) : null}
      </div>
      <p className="callout">{nextStep}</p>

      {customerCare ? (
        <details className="detail-toggle detail-toggle-inline">
          <summary className="detail-toggle-summary">
            <strong>{uiCopy.matchCard.secondaryGuideTitle}</strong>
            <span className="detail-toggle-action">Show</span>
          </summary>
          <div className="detail-grid">
            <div className="stack-block muted-card">
              <strong>{uiCopy.matchCard.firstLineLabel}</strong>
              <p>{customerCare.greeting}</p>
            </div>
            <div className="stack-block muted-card">
              <strong>{uiCopy.matchCard.listeningLabel}</strong>
              <p>{customerCare.listening}</p>
            </div>
          </div>
        </details>
      ) : null}

      <button className="primary-button" onClick={onStart} disabled={busy}>
        {busy ? uiCopy.matchCard.busyLabel : uiCopy.matchCard.startLabel}
      </button>
    </section>
  );
}
