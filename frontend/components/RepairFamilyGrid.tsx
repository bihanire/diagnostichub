import type { CSSProperties } from "react";

import { getRepairFamilyShortcut } from "@/lib/issue-visuals";
import { getRenderableRepairFamilies } from "@/lib/repair-families";
import { RepairFamilySummary } from "@/lib/types";

type RepairFamilyGridProps = {
  families?: RepairFamilySummary[] | null;
  activeFamilyId?: string | null;
  onSelect: (familyId: string) => void;
  onRetry?: () => void;
  loadError?: string | null;
};

export function RepairFamilyGrid({
  families,
  activeFamilyId,
  onSelect,
  onRetry,
  loadError = null,
}: RepairFamilyGridProps) {
  const incomingFamilies = Array.isArray(families)
    ? families.filter((item): item is RepairFamilySummary => Boolean(item?.id))
    : [];
  const safeFamilies = getRenderableRepairFamilies(incomingFamilies);
  const usingBuiltInFallback = incomingFamilies.length === 0;
  const showEmptyState = safeFamilies.length === 0;

  return (
    <section className="panel panel-compact">
      <div className="panel-header family-grid-header">
        <div>
          <span className="eyebrow">Common visual families</span>
          <h3>Start from what the officer can see, then narrow the fault family.</h3>
        </div>
        <span className="visual-guide-badge">Watu Simu library</span>
      </div>
      <div className="family-grid-shelf">
        {showEmptyState ? (
          <div className="family-grid-empty" role="status">
            <strong>{loadError ? "Family library could not load." : "Family library is empty."}</strong>
            <p>
              {loadError
                ? "Search still works, but the visual family workspace is not available until the family data endpoint responds."
                : "The visual family workspace will appear here once the family knowledge is available."}
            </p>
            {onRetry ? (
              <button className="secondary-button" onClick={onRetry} type="button">
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {loadError ? (
              <div className="family-grid-notice" role="status">
                Showing backup family guide. Live refresh can be retried if needed.
                {onRetry ? (
                  <button className="inline-action" onClick={onRetry} type="button">
                    Retry
                  </button>
                ) : null}
              </div>
            ) : usingBuiltInFallback ? (
              <div className="family-grid-notice" role="status">
                Showing built-in family guide while live data refreshes.
              </div>
            ) : null}
            <div className="family-grid motion-stage">
              {safeFamilies.map((item, index) => {
                const familyVisual = getRepairFamilyShortcut(item.id);
                const title = item.title?.trim() || familyVisual?.label || "Repair family";
                const hint =
                  item.hint?.trim() ||
                  familyVisual?.hint ||
                  "Open this family to narrow the visible issue.";
                const procedureCount = Number.isFinite(item.procedure_count)
                  ? Math.max(0, item.procedure_count)
                  : 0;
                const flowLabel =
                  procedureCount > 0
                    ? `${procedureCount} ${procedureCount === 1 ? "flow" : "flows"}`
                    : "starter guide";
                const promptPreview = Array.isArray(item.symptom_prompts)
                  ? item.symptom_prompts
                      .filter((prompt) => typeof prompt === "string" && prompt.trim().length > 0)
                      .slice(0, 2)
                  : [];
                const isActive = activeFamilyId === item.id;
                const cardStyle = {
                  ["--stagger-index" as "--stagger-index"]: index
                } as CSSProperties;
                if (isActive) {
                  cardStyle.viewTransitionName = `family-card-${item.id}`;
                }

                return (
                  <button
                    key={item.id}
                    aria-label={`Open ${title} diagnosis family`}
                    aria-pressed={isActive}
                    className={`family-card motion-card stagger-item ${isActive ? "family-card-active" : ""}`}
                    onClick={() => onSelect(item.id)}
                    style={cardStyle}
                    type="button"
                  >
                    <div className="family-card-art">
                      <div className="family-card-art-meta">
                        <span className="family-card-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="family-card-tag">{flowLabel}</span>
                      </div>
                      {familyVisual?.art ?? (
                        <span className="family-card-art-fallback" aria-hidden="true">
                          {title.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="family-card-copy">
                      <strong>{title}</strong>
                      <span>{hint}</span>
                      {promptPreview.length > 0 ? (
                        <span className="family-card-prompts" aria-label="Common wording">
                          {promptPreview.map((prompt) => (
                            <span className="family-card-prompt" key={`${item.id}-${prompt}`}>
                              {prompt}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className="family-card-cta">{isActive ? "Opening workspace" : "Open family"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
