import type { CSSProperties } from "react";

import { getIssueVisualGuide } from "@/lib/issue-visuals";

type IssueVisualGuideProps = {
  procedureTitle: string;
  procedureCategory: string;
  question?: string | null;
  variant?: "panel" | "embedded";
};

export function IssueVisualGuide({
  procedureTitle,
  procedureCategory,
  question,
  variant = "panel"
}: IssueVisualGuideProps) {
  const guide = getIssueVisualGuide(procedureTitle, procedureCategory, question);

  return (
    <section
      className={
        variant === "panel"
          ? "panel panel-compact visual-guide-panel motion-surface"
          : "visual-guide-panel visual-guide-embedded motion-surface"
      }
    >
      <div className="panel-header visual-guide-header">
        <div>
          <span className="eyebrow">Look for this</span>
          <h3>{guide.title}</h3>
        </div>
        <span className="visual-guide-badge">Reference set</span>
      </div>
      <div className="visual-guide-grid motion-stage" role="list">
        {guide.items.map((item, index) => (
          <article
            className="visual-card motion-card stagger-item"
            key={item.id}
            role="listitem"
            style={
              {
                ["--stagger-index" as "--stagger-index"]: index
              } as CSSProperties
            }
          >
            <div className="visual-art">
              <div className="visual-art-meta">
                <span className="visual-art-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="visual-art-tag">field cue</span>
              </div>
              {item.art}
            </div>
            <div className="visual-copy">
              <strong>{item.title}</strong>
              <p>{item.hint}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
