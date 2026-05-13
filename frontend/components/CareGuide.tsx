import { CustomerCare } from "@/lib/types";
import { uiCopy } from "@/lib/copy";
import { ControlledDisclosure } from "@/components/ControlledDisclosure";

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
      <ControlledDisclosure
        className={`panel ${compact ? "panel-compact" : ""} motion-surface`}
        defaultOpen={defaultOpen}
        eyebrow={uiCopy.careGuide.secondaryEyebrow}
        title={uiCopy.careGuide.title}
      >
        <CareGuideBody customerCare={customerCare} />
      </ControlledDisclosure>
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
