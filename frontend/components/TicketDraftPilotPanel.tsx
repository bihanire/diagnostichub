"use client";

import { useState } from "react";

import { ControlledDisclosure } from "@/components/ControlledDisclosure";
import { previewOpsTicketDraft } from "@/lib/api";
import { getSampleCasePacketForDraft } from "@/lib/case-packet-schema";
import type { TicketDraftPreviewResponse } from "@/lib/types";

export function TicketDraftPilotPanel() {
  const [preview, setPreview] = useState<TicketDraftPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDryRunPreview() {
    setLoading(true);
    setError(null);
    try {
      const response = await previewOpsTicketDraft(getSampleCasePacketForDraft());
      setPreview(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ticket draft dry run could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ControlledDisclosure
      className="panel ticket-draft-pilot-panel"
      eyebrow="Ticket pilot"
      title="Dry-run ticket draft endpoint"
    >
      <div className="ticket-draft-pilot-copy">
        <p className="body-copy">
          Run a protected ops-only preview against a sample case packet. This does not create,
          store, or send a ticket.
        </p>
        <button
          className="primary-button inline-action"
          disabled={loading}
          onClick={() => void runDryRunPreview()}
          type="button"
        >
          {loading ? "Running preview..." : "Run dry-run preview"}
        </button>
      </div>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      {preview ? (
        <div className="ticket-draft-preview-result" role="status">
          <div className="case-readiness-summary">
            <span>
              <strong>Draft status</strong>
              {preview.draft_status}
            </span>
            <span>
              <strong>Dry run</strong>
              {preview.dry_run ? "true" : "false"}
            </span>
            <span>
              <strong>Delivery</strong>
              {preview.delivery_enabled ? "enabled" : "disabled"}
            </span>
            <span>
              <strong>External ticket</strong>
              {preview.external_ticket_id || "none"}
            </span>
          </div>
          {preview.blockers.length ? (
            <ul className="bullet-list">
              {preview.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : (
            <p className="success-banner">{preview.message}</p>
          )}
          <div className="ticket-draft-requirements">
            {preview.webhook_requirements.map((requirement) => (
              <article className="case-requirement-card" key={requirement.id}>
                <strong>{requirement.label}</strong>
                <span className={`status-badge ${requirement.ready ? "status-positive" : "status-negative"}`}>
                  {requirement.ready ? "ready" : "not ready"}
                </span>
                <p className="muted-copy">{requirement.note}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </ControlledDisclosure>
  );
}
