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
  return (
    <div className="lm-status-strip" role="status" aria-live="polite">
      <span>
        <strong>Phase</strong>
        {phase}
      </span>
      <span>
        <strong>Family</strong>
        {family}
      </span>
      <span>
        <strong>Procedure</strong>
        {procedure}
      </span>
      <span>
        <strong>Confidence</strong>
        {confidence}
      </span>
      <span>
        <strong>Readiness</strong>
        {readiness}
      </span>
    </div>
  );
}
