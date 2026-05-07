type StatusStripProps = {
  phase: string;
  family: string;
  procedure: string;
  confidence: string;
  readiness: string;
};

export function StatusStrip({
  phase,
  family,
  procedure,
  confidence,
  readiness,
}: StatusStripProps) {
  const healthy = readiness.toLowerCase().includes("operational");

  return (
    <div
      className={`lm-status-strip ${healthy ? "is-healthy" : "is-warning"}`}
      role="status"
      aria-live="polite"
    >
      <span className="lm-status-pill">
        <strong>Phase</strong>
        {phase}
      </span>
      <span className="lm-status-pill">
        <strong>Family</strong>
        {family}
      </span>
      <span className="lm-status-pill">
        <strong>Procedure</strong>
        {procedure}
      </span>
      <span className="lm-status-pill">
        <strong>Confidence</strong>
        {confidence}
      </span>
      <span className="lm-status-pill">
        <strong>Readiness</strong>
        {readiness}
      </span>
    </div>
  );
}
