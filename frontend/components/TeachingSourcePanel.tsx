"use client";

import { ControlledDisclosure } from "@/components/ControlledDisclosure";
import {
  getKnowledgeSources,
  getTeachingGuidanceForFamily,
  getTeachingGuidanceForProcedure,
} from "@/lib/knowledge-sources";
import type { ProcedureSummary } from "@/lib/types";

type TeachingSourcePanelProps = {
  className?: string;
  compact?: boolean;
  defaultOpen?: boolean;
  familyId?: string | null;
  limit?: number;
  procedure?: ProcedureSummary | null;
  query?: string | null;
  title?: string;
};

export function TeachingSourcePanel({
  className = "",
  compact = false,
  defaultOpen = false,
  familyId = null,
  limit = 3,
  procedure = null,
  query = null,
  title = "Source-backed teaching plan",
}: TeachingSourcePanelProps) {
  const guidance = (
    procedure
      ? getTeachingGuidanceForProcedure(procedure, familyId, query)
      : getTeachingGuidanceForFamily(familyId)
  ).slice(0, limit);

  if (guidance.length === 0) {
    return null;
  }

  return (
    <ControlledDisclosure
      className={`panel teaching-source-panel ${compact ? "teaching-source-panel-compact" : ""} ${className}`.trim()}
      defaultOpen={defaultOpen}
      eyebrow="Teaching intelligence"
      title={title}
    >
      <div className="teaching-source-grid">
        {guidance.map((item) => {
          const sources = getKnowledgeSources(item.sourceIds);
          return (
            <article className="teaching-source-card" key={item.id}>
              <div className="teaching-source-card-head">
                <span className={`teaching-source-priority teaching-source-priority-${item.priority}`}>
                  {item.priority.replace("_", " ")}
                </span>
                <h4>{item.title}</h4>
              </div>
              <p className="body-copy">{item.teach}</p>
              <div className="teaching-source-section">
                <strong>Branch-safe checks</strong>
                <ul className="bullet-list">
                  {item.branchSafeChecks.slice(0, compact ? 2 : 3).map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
              <div className="teaching-source-section">
                <strong>Do not promise</strong>
                <ul className="bullet-list">
                  {item.doNotPromise.slice(0, 2).map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div className="teaching-source-links" aria-label={`Sources for ${item.title}`}>
                {sources.map((source) =>
                  source.url ? (
                    <a
                      className="source-chip"
                      href={source.url}
                      key={source.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.vendor}: {source.topic}
                    </a>
                  ) : (
                    <span className="source-chip source-chip-internal" key={source.id}>
                      {source.vendor}: {source.topic}
                    </span>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
    </ControlledDisclosure>
  );
}
