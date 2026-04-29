import { uiCopy } from "@/lib/copy";
import { formatWholePercent } from "@/lib/format";

type ProgressBarProps = {
  step: number;
  total: number;
};

export function ProgressBar({ step, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min((step / total) * 100, 100) : 0;

  return (
    <div className="progress-panel motion-surface" aria-label={`Step ${step} of ${total}`}>
      <div className="progress-copy">
        <div className="progress-copy-main">
          <span className="eyebrow">{uiCopy.progress.eyebrow}</span>
          <strong>
            Step {step} of {total}
          </strong>
        </div>
        <span className="progress-percent">{formatWholePercent(percentage)}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
      <p className="muted-copy progress-note">{uiCopy.progress.note}</p>
    </div>
  );
}
