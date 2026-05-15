"use client";

import { ControlledDisclosure } from "@/components/ControlledDisclosure";
import {
  CASE_PACKET_SCHEMA_VERSION,
  CASE_PACKET_WEBHOOK_REQUIREMENTS,
  getCasePacketExportPreview,
  getCasePacketSchemaPreview,
  IPAAS_CANDIDATE_PROFILES,
} from "@/lib/case-packet-schema";
import { getKnowledgeSources } from "@/lib/knowledge-sources";
import type { CasePacket } from "@/lib/types";

type CasePacketReadinessPanelProps = {
  casePacket?: CasePacket | null;
  className?: string;
  defaultOpen?: boolean;
  title?: string;
};

export function CasePacketReadinessPanel({
  casePacket = null,
  className = "",
  defaultOpen = false,
  title = "Long-term case automation readiness",
}: CasePacketReadinessPanelProps) {
  const preview = casePacket ? getCasePacketExportPreview(casePacket) : getCasePacketSchemaPreview();
  const readiness = casePacket?.deliveryReadiness || "preview_only_not_sent";

  return (
    <ControlledDisclosure
      className={`panel case-packet-readiness-panel ${className}`.trim()}
      defaultOpen={defaultOpen}
      eyebrow="Long-term automation"
      title={title}
    >
      <div className="case-readiness-summary">
        <span>
          <strong>Schema</strong>
          {CASE_PACKET_SCHEMA_VERSION}
        </span>
        <span>
          <strong>Readiness</strong>
          {readiness}
        </span>
        <span>
          <strong>Event</strong>
          {casePacket?.eventName || "diagnostic.case.completed"}
        </span>
        <span>
          <strong>Privacy</strong>
          {casePacket?.privacyClassification || "contains_customer_free_text"}
        </span>
      </div>

      <div className="case-readiness-grid">
        <section className="case-readiness-block">
          <div className="panel-header">
            <span className="eyebrow">Webhook requirements</span>
            <h4>Required before any outbound automation</h4>
          </div>
          <div className="case-requirement-list">
            {CASE_PACKET_WEBHOOK_REQUIREMENTS.map((requirement) => (
              <article className="case-requirement-card" key={requirement.id}>
                <strong>{requirement.label}</strong>
                <p className="muted-copy">{requirement.reason}</p>
                <SourceChips sourceIds={requirement.sourceIds} />
              </article>
            ))}
          </div>
        </section>

        <section className="case-readiness-block">
          <div className="panel-header">
            <span className="eyebrow">Long-term iPaaS options</span>
            <h4>Compare without sending data</h4>
          </div>
          <div className="ipaas-profile-list">
            {IPAAS_CANDIDATE_PROFILES.map((profile) => (
              <article className="ipaas-profile-card" key={profile.id}>
                <strong>{profile.label}</strong>
                <p className="body-copy">{profile.bestFor}</p>
                <ul className="bullet-list">
                  {profile.cautions.map((caution) => (
                    <li key={caution}>{caution}</li>
                  ))}
                </ul>
                <SourceChips sourceIds={profile.sourceIds} />
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="case-json-preview" aria-label="Case packet JSON preview">
        <div className="panel-header">
          <span className="eyebrow">JSON preview</span>
          <h4>{casePacket ? "Current case packet preview" : "Ops schema preview"}</h4>
        </div>
        <pre>{JSON.stringify(preview, null, 2)}</pre>
      </section>
    </ControlledDisclosure>
  );
}

function SourceChips({ sourceIds }: { sourceIds: string[] }) {
  const sources = getKnowledgeSources(sourceIds);
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="teaching-source-links" aria-label="Readiness sources">
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
