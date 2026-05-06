import { useEffect, useState } from "react";

import { RepairFamilyDetail, RepairFamilySummary } from "@/lib/types";

type LearningRailProps = {
  families: RepairFamilySummary[];
  activeFamilyId: string | null;
  activeFamily: RepairFamilyDetail | null;
  loadError: string | null;
  onSelectFamily: (family: RepairFamilySummary, trigger: HTMLButtonElement) => void;
  onOpenProcedure: (procedureId: number) => void;
  onRetryFamilies: () => void;
};

function familyGlyph(title: string): string {
  return title
    .split("&")[0]
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function LearningRail({
  families,
  activeFamilyId,
  activeFamily,
  loadError,
  onSelectFamily,
  onOpenProcedure,
  onRetryFamilies,
}: LearningRailProps) {
  const [showProcedureTree, setShowProcedureTree] = useState(true);

  useEffect(() => {
    setShowProcedureTree(true);
  }, [activeFamily?.id]);

  return (
    <div className="lm-rail">
      <div className="lm-rail-head">
        <span className="eyebrow">Learning rail</span>
        <h2>SOP families</h2>
        {loadError ? (
          <div className="lm-rail-alert" role="status">
            <p>Showing backup family guide while live family data refreshes.</p>
            <button onClick={onRetryFamilies} type="button">
              Retry
            </button>
          </div>
        ) : null}
      </div>
      <div className="lm-rail-list">
        {families.map((family) => (
          <button
            aria-label={`Open ${family.title} diagnosis family`}
            className={`lm-rail-family ${activeFamilyId === family.id ? "is-active" : ""}`}
            key={`rail-${family.id}`}
            onClick={(event) => onSelectFamily(family, event.currentTarget)}
            type="button"
          >
            <span className="lm-rail-glyph" aria-hidden="true">
              {familyGlyph(family.title)}
            </span>
            <span className="lm-rail-copy">
              <strong>{family.title}</strong>
              <small>{family.procedure_count} flows</small>
            </span>
          </button>
        ))}
      </div>

      {activeFamily ? (
        <div className="lm-rail-children">
          <div className="lm-rail-children-head">
            <span className="eyebrow">Procedure tree</span>
            <button
              className="lm-rail-toggle"
              onClick={() => setShowProcedureTree((value) => !value)}
              type="button"
            >
              {showProcedureTree ? "Hide" : "Show"}
            </button>
          </div>
          {showProcedureTree ? (
            activeFamily.common_categories.slice(0, 5).map((category) => (
              <button
                className="lm-rail-child"
                key={`child-${activeFamily.id}-${category.title}`}
                onClick={() => onOpenProcedure(category.primary_procedure.id)}
                type="button"
              >
                <strong>{category.primary_procedure.title}</strong>
                <span>Track: {category.title}</span>
              </button>
            ))
          ) : (
            <p className="lm-rail-collapsed-copy">Procedure list collapsed. Expand to continue guided learning.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
