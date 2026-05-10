"use client";

import Image from "next/image";
import Link from "next/link";
import { CSSProperties, startTransition, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ApiError,
  getRelated,
  getRepairFamilyDetail,
  getRepairFamilyLearningModule,
  startTriage
} from "@/lib/api";
import { getIssueVisualGuide, getRepairFamilyShortcut } from "@/lib/issue-visuals";
import { BUILT_IN_REPAIR_FAMILIES } from "@/lib/repair-families";
import { saveSession } from "@/lib/session";
import {
  ProcedureSummary,
  RepairFamilyDetail,
  RepairFamilyLearningModule,
  TriageSession
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
  const seen = new Set<string>();
  const ordered: FlowEntry[] = [];
  for (const flow of flows) {
    const key = `${flow.procedure.id}-${flow.title.toLowerCase()}`;
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

function getFamilyImageAlt(family: RepairFamilyDetail): string {
  return `${family.title} device fault reference image`;
}

function FamilyImageFallback({ familyId }: { familyId: string }) {
  const shortcut = getRepairFamilyShortcut(familyId);

  return (
    <div className="family-landing-image-fallback" aria-hidden="true">
      <div className="family-landing-fallback-art">
        {shortcut?.art || getIssueVisualGuide(familyId, familyId).items[0]?.art}
      </div>
    </div>
  );
}

export default function FamilyLandingPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = String(params?.slug || "").toLowerCase();
  const [family, setFamily] = useState<RepairFamilyDetail | null>(null);
  const [module, setModule] = useState<RepairFamilyLearningModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImageFailed(false);

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
  const featuredFlows = flowCatalogue.slice(0, 6);
  const filteredFlows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      return flowCatalogue;
    }
    return flowCatalogue.filter((flow) =>
      flow.keywords.some((keyword) => keyword.toLowerCase().includes(clean))
    );
  }, [flowCatalogue, query]);

  async function openFlow(flow: FlowEntry) {
    setStartingId(flow.procedure.id);
    setError(null);

    try {
      const response = await startTriage(flow.procedure.id);
      const session: TriageSession = {
        query: flow.title,
        learningFamilyId: family?.id || slug,
        learningFamilyTitle: family?.title || fallbackFamily?.title || null,
        learningTrackTitle: flow.title,
        searchConfidence: null,
        searchConfidenceState: null,
        searchConfidenceMargin: null,
        searchNeedsReview: false,
        procedure: response.procedure,
        currentNode: response.current_node || null,
        progress: response.progress,
        customerCare: response.customer_care,
        sop: response.sop,
        outcome: response.outcome || null,
        related: [],
        history: [],
        dispatchGateConfirmed: [],
        updatedAt: new Date().toISOString()
      };

      saveSession(session);
      void getRelated(response.procedure.id)
        .then((relatedResponse) => {
          saveSession({
            ...session,
            related: relatedResponse.items,
            updatedAt: new Date().toISOString()
          });
        })
        .catch(() => {
          // Related suggestions should never block triage entry.
        });

      startTransition(() => {
        router.push(response.status === "complete" ? "/result" : "/triage");
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
      <main className="family-landing-page">
        <section className="family-landing-loading" aria-live="polite">
          <span className="family-landing-loader" />
          Loading family workspace
        </section>
      </main>
    );
  }

  if (!family) {
    return (
      <main className="family-landing-page">
        <section className="family-landing-empty">
          <Link className="family-landing-back" href="/">
            Back to hub
          </Link>
          <h1>{fallbackFamily?.title || "Family not found"}</h1>
          <p>{error || "This family route is not available yet."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="family-landing-page">
      <section className="family-landing-hero">
        <div className="family-landing-copy">
          <Link className="family-landing-back" href="/">
            Back to hub
          </Link>
          <span className="family-landing-eyebrow">Device family</span>
          <h1>{family.title}</h1>
          <p>{familyNarratives[family.id] || family.diagnostic_goal || family.hint}</p>
        </div>
        <div className="family-landing-image-shell">
          {imageFailed ? (
            <FamilyImageFallback familyId={family.id} />
          ) : (
            <Image
              alt={getFamilyImageAlt(family)}
              className="family-landing-image"
              fill
              onError={() => setImageFailed(true)}
              priority
              sizes="(max-width: 900px) 100vw, 42vw"
              src={`/families/${family.id}.webp`}
            />
          )}
        </div>
      </section>

      <section className="family-landing-flows" aria-labelledby="family-flows-title">
        <div className="family-landing-section-head">
          <span>Repair categories</span>
          <h2 id="family-flows-title">Start with the closest flow</h2>
        </div>
        <div className="family-flow-card-grid">
          {featuredFlows.map((flow, index) => (
            <button
              className="family-flow-card"
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
              <em>{startingId === flow.procedure.id ? "Starting..." : "Start triage"}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="family-flow-search" aria-labelledby="family-search-title">
        <div className="family-landing-section-head">
          <span>Family search</span>
          <h2 id="family-search-title">Find any route in this family</h2>
        </div>
        <input
          aria-label={`Search flows in ${family.title}`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search flows in ${family.title}...`}
          type="search"
          value={query}
        />
        <div className="family-flow-results" aria-live="polite">
          {filteredFlows.length ? (
            filteredFlows.map((flow) => (
              <button
                className="family-flow-result"
                key={`result-${flow.key}`}
                onClick={() => void openFlow(flow)}
                type="button"
              >
                <strong>{flow.title}</strong>
                <span>{flow.description}</span>
              </button>
            ))
          ) : (
            <p>No family routes match that wording yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
