"use client";

import { ControlledDisclosure } from "@/components/ControlledDisclosure";
import { getKnowledgeSources } from "@/lib/knowledge-sources";
import {
  getContentHealthSignals,
  getDecisionTeachingNotesForProcedure,
  getFamilyLessonCards,
} from "@/lib/learning-quality";
import type {
  FeedbackSummaryResponse,
  OpsTelemetrySummaryResponse,
  ProcedureFeedbackBreakdownResponse,
  ProcedureSummary,
} from "@/lib/types";

type LearningQualityPanelProps = {
  className?: string;
  compact?: boolean;
  defaultOpen?: boolean;
  familyId?: string | null;
  healthContext?: {
    procedureBreakdown?: ProcedureFeedbackBreakdownResponse | null;
    summary?: FeedbackSummaryResponse | null;
    telemetrySummary?: OpsTelemetrySummaryResponse | null;
  };
  procedure?: ProcedureSummary | null;
  query?: string | null;
  title?: string;
};

export function LearningQualityPanel({
  className = "",
  compact = false,
  defaultOpen = false,
  familyId = null,
  healthContext,
  procedure = null,
  query = null,
  title = "Learning quality",
}: LearningQualityPanelProps) {
  const lessons = getFamilyLessonCards(familyId).slice(0, compact ? 1 : 3);
  const notes = getDecisionTeachingNotesForProcedure(procedure, query, compact ? 2 : 3);
  const healthSignals = healthContext ? getContentHealthSignals(healthContext) : [];

  if (lessons.length === 0 && notes.length === 0 && healthSignals.length === 0) {
    return null;
  }

  return (
    <ControlledDisclosure
      className={`panel learning-quality-panel ${compact ? "learning-quality-panel-compact" : ""} ${className}`.trim()}
      defaultOpen={defaultOpen}
      eyebrow="Learning quality"
      title={title}
    >
      {lessons.length ? (
        <div className="learning-quality-section">
          <div className="learning-quality-section-head">
            <span className="eyebrow">Family lesson cards</span>
          </div>
          <div className="learning-card-grid">
            {lessons.map((lesson) => (
              <article className="learning-card" key={lesson.id}>
                <h4>{lesson.title}</h4>
                <p className="body-copy">{lesson.teachingGoal}</p>
                <div className="learning-card-block">
                  <strong>First look</strong>
                  <ul className="bullet-list">
                    {lesson.firstLook.slice(0, compact ? 2 : 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="learning-card-block">
                  <strong>Model caveats</strong>
                  <ul className="bullet-list">
                    {lesson.modelCaveats.slice(0, compact ? 1 : 2).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="local-phrase-row">
                  {lesson.localPhrases.map((phrase) => (
                    <span className="local-phrase-chip" key={phrase}>
                      {phrase}
                    </span>
                  ))}
                </div>
                <SourceChips sourceIds={lesson.sourceIds} />
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {notes.length ? (
        <div className="learning-quality-section">
          <div className="learning-quality-section-head">
            <span className="eyebrow">Decision teaching notes</span>
          </div>
          <div className="decision-note-grid">
            {notes.map((note) => (
              <article className="decision-note-card" key={note.id}>
                <h4>{note.title}</h4>
                <p className="body-copy">{note.whyItMatters}</p>
                <div className="decision-note-prompt">
                  <strong>Officer prompt</strong>
                  <span>{note.officerPrompt}</span>
                </div>
                <p className="muted-copy">{note.escalationRisk}</p>
                <SourceChips sourceIds={note.sourceIds} />
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {healthSignals.length ? (
        <div className="learning-quality-section">
          <div className="learning-quality-section-head">
            <span className="eyebrow">Ops content health</span>
          </div>
          <div className="content-health-grid">
            {healthSignals.map((signal) => (
              <article className={`content-health-card content-health-${signal.level}`} key={signal.id}>
                <span className="content-health-label">{signal.label}</span>
                <strong>{signal.value}</strong>
                <p className="body-copy">{signal.teachingImpact}</p>
                <p className="muted-copy">{signal.recommendedAction}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </ControlledDisclosure>
  );
}

function SourceChips({ sourceIds }: { sourceIds: string[] }) {
  const sources = getKnowledgeSources(sourceIds);
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="teaching-source-links" aria-label="Learning sources">
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
  );
}
