import { CustomerCare } from "@/lib/types";
import { uiCopy } from "@/lib/copy";

type CareGuideProps = {
  customerCare: CustomerCare;
  compact?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

function CareGuideBody({ customerCare }: { customerCare: CustomerCare }) {
  return (
    <div className="guidance-grid motion-stage">
      <div className="guidance-item motion-card stagger-item" style={{ animationDelay: "0ms" }}>
        <span className="field-label">{uiCopy.careGuide.greetingLabel}</span>
        <p>{customerCare.greeting}</p>
      </div>
      <div className="guidance-item motion-card stagger-item" style={{ animationDelay: "56ms" }}>
        <span className="field-label">{uiCopy.careGuide.listeningLabel}</span>
        <p>{customerCare.listening}</p>
      </div>
      <div className="guidance-item motion-card stagger-item" style={{ animationDelay: "112ms" }}>
        <span className="field-label">{uiCopy.careGuide.expectationLabel}</span>
        <p>{customerCare.expectation}</p>
      </div>
    </div>
  );
}

export function CareGuide({
  customerCare,
  compact = false,
  collapsible = false,
  defaultOpen = false
}: CareGuideProps) {
  if (collapsible) {
    return (
      <details className={`panel ${compact ? "panel-compact" : ""} detail-toggle motion-surface`} open={defaultOpen}>
        <summary className="detail-toggle-summary">
          <div className="panel-header">
            <span className="eyebrow">{uiCopy.careGuide.secondaryEyebrow}</span>
            <h3>{uiCopy.careGuide.title}</h3>
          </div>
          <span className="detail-toggle-action">Open</span>
        </summary>
        <CareGuideBody customerCare={customerCare} />
      </details>
    );
  }

  return (
    <section className={`panel ${compact ? "panel-compact" : ""} motion-surface`}>
      <div className="panel-header">
        <span className="eyebrow">{uiCopy.careGuide.secondaryEyebrow}</span>
        <h3>{uiCopy.careGuide.title}</h3>
      </div>
      <CareGuideBody customerCare={customerCare} />
    </section>
  );
}
