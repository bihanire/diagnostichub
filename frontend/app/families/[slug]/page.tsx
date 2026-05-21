"use client";

import Link from "next/link";
import { CSSProperties, startTransition, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ProductRouteShell } from "@/components/ProductRouteShell";
import {
  ApiError,
  getRepairFamilyDetail,
  getRepairFamilyLearningModule,
  startTriage
} from "@/lib/api";
import { getIssueVisualGuide, getRepairFamilyShortcut } from "@/lib/issue-visuals";
import { BUILT_IN_REPAIR_FAMILIES } from "@/lib/repair-families";
import {
  buildTriageSessionFromStart,
  getTriageRoute,
  persistTriageSessionWithRelatedHydration,
} from "@/lib/triage-session";
import {
  ProcedureSummary,
  RepairFamilyDetail,
  RepairFamilyLearningModule,
} from "@/lib/types";

type FlowEntry = {
  key: string;
  title: string;
  description: string;
  keywords: string[];
  procedure: ProcedureSummary;
};

const familyNarratives: Record<string, string> = {
  display:
    "Display and vision routes group the faults a technician can usually see first: cracked glass, dark picture, lines, tint, ghost touch, and backlight symptoms. Work here starts with what is visible, then separates cosmetic damage from image, touch, and panel behaviour before a repair path is opened.",
  power:
    "Power and thermal routes cover no-power states, charging behaviour, battery drain, overheating, swelling, and unsafe battery signs. The goal is to separate accessory or branch-recoverable causes from internal power faults before a device is sent away.",
  logic:
    "Logic and software routes cover freezing, hanging, slow apps, restart loops, safe mode, and firmware-like behaviour. This family helps the technician decide whether the device needs a branch software check, customer education, or deeper repair handling.",
  security:
    "Security and access routes cover forgotten passwords, account locks, reset protection, managed-device states, and lock-screen blockers. Work here is about identifying the exact access state before making a warranty, payment, or escalation decision.",
  connectivity:
    "Connectivity and I/O routes cover SIM detection, network registration, mobile data, speaker, microphone, earpiece, and external path symptoms. The technician should expect to compare network-side, settings-side, and component-side causes before escalation.",
  physical:
    "Physical and liquid routes cover visible impact, liquid entry, bent frames, broken trays, burnt signs, and deformation. This family prioritizes evidence capture and warranty direction because visible condition often changes the service path immediately."
};

function uniqueFlows(flows: FlowEntry[]): FlowEntry[] {
  const seen = new Set<number>();
  const ordered: FlowEntry[] = [];
  for (const flow of flows) {
    const key = flow.procedure.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(flow);
  }
  return ordered;
}

function buildFlowCatalogue(
  family: RepairFamilyDetail,
  module: RepairFamilyLearningModule | null
): FlowEntry[] {
  const categoryFlows = family.common_categories.map((category) => ({
    key: `category-${category.primary_procedure.id}-${category.title}`,
    title: category.title,
    description: category.description,
    keywords: [
      category.title,
      category.description,
      category.primary_procedure.title,
      category.primary_procedure.description,
      ...category.search_examples
    ],
    procedure: category.primary_procedure
  }));

  const trackFlows =
    module?.tracks.map((track) => ({
      key: `track-${track.procedure.id}-${track.track_title}`,
      title: track.track_title,
      description: track.track_summary || track.procedure.description,
      keywords: [
        track.track_title,
        track.track_summary,
        track.first_question || "",
        track.procedure.title,
        track.procedure.description
      ],
      procedure: track.procedure
    })) || [];

  const procedureFlows = family.procedures.map((procedure) => ({
    key: `procedure-${procedure.id}`,
    title: procedure.title,
    description: procedure.description,
    keywords: [procedure.title, procedure.description, procedure.category],
    procedure
  }));

  return uniqueFlows([...categoryFlows, ...trackFlows, ...procedureFlows]);
}

export default function FamilyLandingPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = String(params?.slug || "").toLowerCase();
  const [family, setFamily] = useState<RepairFamilyDetail | null>(null);
  const [module, setModule] = useState<RepairFamilyLearningModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getRepairFamilyDetail(slug),
      getRepairFamilyLearningModule(slug).catch(() => null)
    ])
      .then(([detail, learningModule]) => {
        if (cancelled) {
          return;
        }
        setFamily(detail);
        setModule(learningModule);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }
        setError(
          requestError instanceof ApiError || requestError instanceof Error
            ? requestError.message
            : "This family could not be loaded."
        );
        setFamily(null);
        setModule(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const fallbackFamily = BUILT_IN_REPAIR_FAMILIES.find((item) => item.id === slug) || null;
  const flowCatalogue = useMemo(() => (family ? buildFlowCatalogue(family, module) : []), [family, module]);
  const featuredFlows = flowCatalogue.slice(0, 5);
  const filteredFlows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      return flowCatalogue;
    }
    return flowCatalogue.filter((flow) =>
      flow.keywords.some((keyword) => keyword.toLowerCase().includes(clean))
    );
  }, [flowCatalogue, query]);
  const familyArt = getRepairFamilyShortcut(family?.id || slug)?.art || getIssueVisualGuide(slug, slug).items[0]?.art;
  const routeCountLabel = `${flowCatalogue.length} guided ${flowCatalogue.length === 1 ? "route" : "routes"}`;

  async function openFlow(flow: FlowEntry) {
    setStartingId(flow.procedure.id);
    setError(null);

    try {
      const response = await startTriage(flow.procedure.id);
      const session = buildTriageSessionFromStart(response, {
        query: flow.title,
        learningContext: {
          familyId: family?.id || slug,
          familyTitle: family?.title || fallbackFamily?.title || null,
          trackTitle: flow.title,
        },
      });

      persistTriageSessionWithRelatedHydration(session);
      startTransition(() => {
        router.push(getTriageRoute(response));
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not start this triage flow."
      );
    } finally {
      setStartingId(null);
    }
  }

  if (loading) {
    return (
      <ProductRouteShell
        className="family-landing-page family-route"
        selectedFamilyId={slug}
        status={{
          phase: "Family workspace",
          family: fallbackFamily?.title || slug,
          procedure: "Loading routes",
          confidence: "Loading",
        }}
      >
        <section className="family-landing-loading" aria-live="polite">
          <span className="family-landing-loader" />
          Loading family workspace
        </section>
      </ProductRouteShell>
    );
  }

  if (!family) {
    return (
      <ProductRouteShell
        className="family-landing-page family-route"
        selectedFamilyId={slug}
        status={{
          phase: "Family workspace",
          family: fallbackFamily?.title || slug,
          procedure: "Unavailable",
          confidence: "Not ready",
          readiness: "Attention needed",
        }}
      >
        <section className="family-landing-empty">
          <Link className="family-landing-back" href="/">
            Back to hub
          </Link>
          <h1>{fallbackFamily?.title || "Family not found"}</h1>
          <p>{error || "This family route is not available yet."}</p>
        </section>
      </ProductRouteShell>
    );
  }

  return (
    <ProductRouteShell
      className="family-landing-page family-route"
      selectedFamilyId={family.id}
      status={{
        phase: "Family learning",
        family: family.title,
        procedure: routeCountLabel,
        confidence: "Device guide",
        readiness: error ? "Attention needed" : "Operational",
      }}
    >
      <section className="family-landing-hero">
        <div className="family-landing-copy">
          <Link className="family-landing-back" href="/">
            Back to hub
          </Link>
          <span className="family-landing-eyebrow">Family workspace</span>
          <h1>{family.title}</h1>
          <p>{familyNarratives[family.id] || family.diagnostic_goal || family.hint}</p>
        </div>

        <section className="family-flow-router-panel" aria-labelledby="family-flow-router-title">
          <div className="family-router-topline">
            <span className="eyebrow">Step 2</span>
            <span>{routeCountLabel}</span>
          </div>
          <div className="family-router-title-row">
            <div>
              <h2 id="family-flow-router-title">Choose the flow</h2>
              <p>Select the closest route. The next screen opens the guided workspace.</p>
            </div>
            <span className="family-router-visual" aria-hidden="true">
              {familyArt}
            </span>
          </div>

          <label className="field-label" htmlFor="family-flow-filter">
            Filter flows
          </label>
          <input
            id="family-flow-filter"
            aria-label={`Search flows in ${family.title}`}
            className="family-flow-router-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Type symptom or route in ${family.title}`}
            type="search"
            value={query}
          />

          <div className="family-flow-router-list" aria-live="polite">
            {(query.trim() ? filteredFlows : featuredFlows).length ? (
              (query.trim() ? filteredFlows : featuredFlows).map((flow, index) => (
                <button
                  aria-label={`Start ${flow.title} guided workspace`}
                  aria-busy={startingId === flow.procedure.id}
                  className="family-flow-router-item"
                  disabled={startingId !== null}
                  key={flow.key}
                  onClick={() => void openFlow(flow)}
                  style={{ "--stagger": `${index * 40}ms` } as CSSProperties}
                  type="button"
                >
                  <span className="family-flow-router-number">{index + 1}</span>
                  <span className="family-flow-router-copy">
                    <strong>{flow.title}</strong>
                    <small>{flow.description}</small>
                  </span>
                  <span className="family-flow-router-action">
                    {startingId === flow.procedure.id ? "Opening..." : "Start"}
                  </span>
                </button>
              ))
            ) : (
              <div className="family-flow-empty" role="status">
                No guided flow matches that wording yet. Clear the filter or try another symptom.
              </div>
            )}
          </div>
        </section>
      </section>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}

      <section className="family-landing-flows" aria-labelledby="family-flows-title">
        <div className="family-landing-section-head">
          <span>All family routes</span>
          <h2 id="family-flows-title">Review the available guided flows</h2>
        </div>
        {flowCatalogue.length ? (
          <div className="family-flow-card-grid">
            {flowCatalogue.slice(0, 6).map((flow, index) => (
              <button
                aria-label={`Open ${flow.title} guided workspace from all routes`}
                aria-busy={startingId === flow.procedure.id}
                className="family-flow-card"
                disabled={startingId !== null}
                key={flow.key}
                onClick={() => void openFlow(flow)}
                style={{ "--stagger": `${index * 60}ms` } as CSSProperties}
                type="button"
              >
                <span className="family-flow-art" aria-hidden="true">
                  {getIssueVisualGuide(flow.procedure.title, flow.procedure.category).items[0]?.art}
                </span>
                <strong>{flow.title}</strong>
                <span>{flow.description}</span>
                <em>{startingId === flow.procedure.id ? "Opening..." : "Open guided workspace"}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="family-landing-empty family-landing-empty-inline" role="status">
            <h3>No guided flows are available for this family yet.</h3>
            <p>Return to the hub and search by symptom while this family is reviewed.</p>
          </div>
        )}
      </section>
    </ProductRouteShell>
  );
}
