type LearningPathProps = {
  phase: "intake" | "interpretation" | "action" | "related";
};

const phaseSteps = [
  { id: "intake", label: "Customer issue" },
  { id: "interpretation", label: "AI interpretation" },
  { id: "action", label: "SOP action" },
  { id: "related", label: "Related flow" },
] as const;

export function LearningPath({ phase }: LearningPathProps) {
  const activeIndex = phaseSteps.findIndex((item) => item.id === phase);

  return (
    <section className="lm-learning-path" aria-label="Learning path">
      <span className="eyebrow">Learning path</span>
      <div className="lm-learning-path-steps">
        {phaseSteps.map((step, index) => (
          <span
            className={`lm-learning-path-step ${
              index <= activeIndex ? "is-complete" : ""
            } ${index === activeIndex ? "is-active" : ""}`}
            key={`learning-path-${step.id}`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </section>
  );
}
