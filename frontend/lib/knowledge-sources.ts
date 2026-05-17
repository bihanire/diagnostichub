import { KnowledgeSource, ProcedureSummary, TeachingGuidance } from "@/lib/types";

const REVIEWED_AT = "2026-05-13";

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: "device-members-diagnostics",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "built-in support diagnostics",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Built-in support can strengthen branch learning by giving model-dependent diagnostic signals for battery, charging, touch, SIM, network, speaker, microphone, Wi-Fi, sensors, and related device checks.",
  },
  {
    id: "device-maintenance-mode",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Maintenance Mode and repair privacy",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Maintenance Mode is relevant before handover because it helps protect personal data while another person handles the Galaxy device for service.",
  },
  {
    id: "device-service-readiness",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Preparing a device for service",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Before service handover, the branch should think about privacy, backup readiness, device condition, and whether the case is actually ready to leave the branch.",
  },
  {
    id: "device-smartthings-find",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "SmartThings Find / lost device protection",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Lost or stolen device teaching should prioritize account and device protection before replacement, refund, or repair conversations.",
  },
  {
    id: "device-battery-care",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Galaxy battery care and safety",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Battery guidance should separate safe branch checks from heat, swelling, temperature, accessory, and battery-health signals that may need service review.",
  },
  {
    id: "device-device-care",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Device Care optimization",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Device Care context helps teach branch teams how to distinguish optimization, battery use, and app behavior from hardware failure.",
  },
  {
    id: "device-moisture-port",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Moisture detected in charging port",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Moisture warnings should trigger safety-first charging guidance; the branch should not force objects into the port or treat the first warning as ordinary charger failure.",
  },
  {
    id: "device-safe-mode",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Safe Mode for app-caused behavior",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Safe Mode is a teaching tool for app-related freezing, restart, slow, and misbehavior cases before courier escalation.",
  },
  {
    id: "device-software-update",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Galaxy software updates",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Software-update context helps officers explain update-related checks without promising that an update will repair every performance or display symptom.",
  },
  {
    id: "device-screen-flicker",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Screen flickering or glitching",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Display teaching should separate visible damage, protector/case interference, software checks, and persistent panel behavior.",
  },
  {
    id: "device-factory-reset",
    vendor: "Device support",
    sourceType: "official_documentation",
    topic: "Factory reset and data risk",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Reset guidance belongs behind ownership and data-loss checks; it should never be treated as a casual troubleshooting shortcut.",
  },
  {
    id: "knox-android-enterprise",
    vendor: "Enterprise device management",
    sourceType: "official_documentation",
    topic: "Android Enterprise modes in Knox Manage",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Managed-device cases require careful separation between personal-device repair symptoms and enterprise policy, profile, or enrollment states.",
  },
  {
    id: "knox-guard-lock-unlock",
    vendor: "Enterprise device management",
    sourceType: "official_documentation",
    topic: "Knox Guard lock and unlock concepts",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Knox Guard-style lock states are policy and account-state issues, not ordinary hardware repair failures.",
  },
  {
    id: "knox-configure-enrollment",
    vendor: "Enterprise device management",
    sourceType: "official_documentation",
    topic: "Knox Configure enrollment and profiles",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Enrollment and profile context helps the branch recognize when a device behavior may come from configuration management rather than physical fault.",
  },
  {
    id: "knox-asset-intelligence",
    vendor: "Enterprise device management",
    sourceType: "official_documentation",
    topic: "Knox Asset Intelligence device signals",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Fleet telemetry ideas can inform future case enrichment, but branch recommendations must remain based on the current case evidence available to the officer.",
  },
  {
    id: "power-automate-http-trigger",
    vendor: "Microsoft",
    sourceType: "integration_documentation",
    topic: "Power Automate HTTP trigger",
    url: "https://learn.microsoft.com/en-us/power-automate/oauth-authentication",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Power Automate can receive HTTP-triggered workflows, so DiagnosticHub case packets should be shaped as stable JSON with clear authentication expectations.",
  },
  {
    id: "zapier-webhooks",
    vendor: "Zapier",
    sourceType: "integration_documentation",
    topic: "Zapier webhook triggers",
    url: "https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zaps-from-webhooks",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Zapier-style webhook usage favors simple payloads, predictable event names, and clear troubleshooting metadata.",
  },
  {
    id: "zapier-rest-hooks",
    vendor: "Zapier",
    sourceType: "integration_documentation",
    topic: "Zapier REST Hook trigger design",
    url: "https://docs.zapier.com/platform/build/hook-trigger",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "REST-hook concepts support a future subscription model where external automations receive new or updated case events.",
  },
  {
    id: "make-webhooks",
    vendor: "Make",
    sourceType: "integration_documentation",
    topic: "Make webhooks",
    url: "https://help.make.com/webhooks",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Make-style webhooks support scenario automation, so case-packet fields should stay human-readable and automation-friendly.",
  },
  {
    id: "webhook-best-practices",
    vendor: "GitHub",
    sourceType: "integration_best_practice",
    topic: "Webhook delivery safety",
    url: "https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "paraphrase_and_link",
    copyrightStatus: "link_only_no_copying",
    teachingSummary:
      "Webhook integrations need signed delivery, idempotency, retry handling, response logging, and safe secret storage.",
  },
  {
    id: "watu-sop-pack",
    vendor: "Watu",
    sourceType: "internal_policy",
    topic: "Watu after-sales SOP pack",
    reviewedAt: REVIEWED_AT,
    allowedUsage: "internal_policy_only",
    copyrightStatus: "watu_owned",
    teachingSummary:
      "The canonical Watu SOP pack remains the decision source of truth for warranty direction, branch routing, and operational handover.",
  },
];

export const TEACHING_GUIDANCE: TeachingGuidance[] = [
  {
    id: "teach-diagnostics-before-dispatch",
    title: "Use device diagnostics as evidence, not as the final decision",
    families: ["display", "power", "logic", "connectivity"],
    procedureCategories: ["Display & Vision", "Power & Thermal", "Logic & Software", "Connectivity & I/O"],
    searchSignals: ["diagnostic", "members", "test", "touch", "speaker", "mic", "sim", "battery"],
    priority: "foundational",
    teach:
      "When the phone is usable, built-in support diagnostics can help the officer learn which function is failing. The final branch decision still comes from the guided Watu flow.",
    branchSafeChecks: [
      "Run only tests that match the visible complaint.",
      "Record failed diagnostic areas as evidence in the case notes.",
      "Continue through the guided flow even when a diagnostic test appears clear.",
    ],
    doNotPromise: [
      "Do not tell the customer a diagnostic pass proves there is no fault.",
      "Do not use diagnostics to override visible damage, warranty, or policy checks.",
    ],
    sourceIds: ["device-members-diagnostics", "watu-sop-pack"],
  },
  {
    id: "teach-maintenance-before-handover",
    title: "Protect customer data before repair handover",
    families: ["physical", "power", "operations"],
    procedureCategories: ["Operations & Compliance", "Physical & Liquid", "Power & Thermal"],
    searchSignals: ["dispatch", "repair", "service", "handover", "maintenance", "privacy"],
    priority: "case_specific",
    teach:
      "If a Galaxy device is leaving the branch and still turns on, the officer should think about privacy and handover readiness before dispatch.",
    branchSafeChecks: [
      "Confirm whether Maintenance Mode is available and appropriate.",
      "Confirm evidence, stickers, documents, and receiver path before dispatch.",
      "Use the Watu routing decision before advising service movement.",
    ],
    doNotPromise: [
      "Do not promise data safety if the device may need reset or storage replacement.",
      "Do not delay urgent safety cases just to complete optional phone-side steps.",
    ],
    sourceIds: ["device-maintenance-mode", "device-service-readiness", "watu-sop-pack"],
  },
  {
    id: "teach-battery-and-charging-safety",
    title: "Separate charger, moisture, heat, and battery-risk cases",
    families: ["power", "physical"],
    procedureCategories: ["Power & Thermal", "Physical & Liquid"],
    searchSignals: ["charge", "battery", "moisture", "hot", "swollen", "device care", "charger"],
    priority: "case_specific",
    teach:
      "Charging and battery complaints teach best when the officer separates accessory behavior, moisture warnings, temperature, swelling, and repeat drain.",
    branchSafeChecks: [
      "Use a safe known-good charger where available.",
      "Stop charging checks when heat, swelling, burnt smell, or moisture warning appears.",
      "Use Device Care or Members battery signals only when the device is safe to keep on.",
    ],
    doNotPromise: [
      "Do not force tools into a charging port.",
      "Do not call swelling, heat, or moisture a normal charger issue.",
    ],
    sourceIds: [
      "device-battery-care",
      "device-device-care",
      "device-moisture-port",
      "device-members-diagnostics",
      "watu-sop-pack",
    ],
  },
  {
    id: "teach-software-before-courier",
    title: "Use Safe Mode and update context to avoid premature courier escalation",
    families: ["logic"],
    procedureCategories: ["Logic & Software"],
    searchSignals: ["safe mode", "update", "freeze", "hang", "restart", "slow", "app"],
    priority: "case_specific",
    teach:
      "Software symptoms often need a learning path before repair intake: recent app changes, Safe Mode behavior, update state, and repeatability.",
    branchSafeChecks: [
      "Ask what changed before the behavior started.",
      "Use Safe Mode to separate third-party app behavior from deeper device behavior when appropriate.",
      "Keep software-update advice conservative and tied to the guided flow.",
    ],
    doNotPromise: [
      "Do not promise an update will fix a physical or recurring hardware-like symptom.",
      "Do not factory reset before ownership, data, and policy checks are clear.",
    ],
    sourceIds: ["device-safe-mode", "device-software-update", "device-factory-reset", "watu-sop-pack"],
  },
  {
    id: "teach-security-and-managed-state",
    title: "Separate theft, access recovery, FRP, and managed-device states",
    families: ["security"],
    procedureCategories: ["Security & Access", "Operations & Compliance"],
    searchSignals: ["stolen", "lost", "find", "frp", "password", "lock", "knox", "managed"],
    priority: "case_specific",
    teach:
      "Security cases are teaching-heavy because the wrong shortcut can create privacy, ownership, or compliance risk.",
    branchSafeChecks: [
      "Confirm ownership before account-recovery guidance.",
      "Use lost-device protection language before discussing replacement eligibility.",
      "Treat managed-device or Knox lock states as policy/account states until proven otherwise.",
    ],
    doNotPromise: [
      "Do not promise bypasses for locks, FRP, or managed restrictions.",
      "Do not treat a policy lock as a normal hardware repair symptom.",
    ],
    sourceIds: [
      "device-smartthings-find",
      "device-factory-reset",
      "knox-android-enterprise",
      "knox-guard-lock-unlock",
      "knox-configure-enrollment",
      "watu-sop-pack",
    ],
  },
  {
    id: "teach-case-automation-runway",
    title: "Shape every diagnosis so future automation can read it",
    families: [],
    procedureCategories: [],
    searchSignals: [
      "ipaas",
      "automation",
      "webhook",
      "case packet",
      "power automate",
      "zapier",
      "make webhook",
      "make scenario",
    ],
    priority: "integration",
    teach:
      "The app is not sending outbound cases yet, but completed diagnostic flows should stay structured enough for a reviewed iPaaS workflow later.",
    branchSafeChecks: [
      "Keep case fields stable and readable for humans and automation.",
      "Use signed webhooks, idempotency, retry logging, and dead-letter review only when outbound integration starts.",
      "Send source IDs and Watu decision outputs, not copied vendor documentation.",
    ],
    doNotPromise: [
      "Do not claim any external case was created until a real integration confirms delivery.",
      "Do not send customer-sensitive notes to automation targets without an approved privacy path.",
    ],
    sourceIds: [
      "power-automate-http-trigger",
      "zapier-webhooks",
      "zapier-rest-hooks",
      "make-webhooks",
      "webhook-best-practices",
      "watu-sop-pack",
    ],
  },
];

const SOURCES_BY_ID = new Map(KNOWLEDGE_SOURCES.map((source) => [source.id, source]));

export function getKnowledgeSource(sourceId: string): KnowledgeSource | null {
  return SOURCES_BY_ID.get(sourceId) || null;
}

export function getKnowledgeSources(sourceIds: string[]): KnowledgeSource[] {
  return sourceIds
    .map((sourceId) => SOURCES_BY_ID.get(sourceId))
    .filter((source): source is KnowledgeSource => Boolean(source));
}

export function getTeachingGuidanceForFamily(familyId: string | null | undefined): TeachingGuidance[] {
  if (!familyId) {
    return TEACHING_GUIDANCE.filter((item) => item.priority === "foundational").slice(0, 2);
  }
  return TEACHING_GUIDANCE.filter((item) => item.families.includes(familyId)).slice(0, 4);
}

export function getTeachingGuidanceForProcedure(
  procedure: ProcedureSummary | null | undefined,
  familyId?: string | null,
  query?: string | null
): TeachingGuidance[] {
  const category = procedure?.category || "";
  const text = `${query || ""} ${procedure?.title || ""} ${procedure?.description || ""}`.toLowerCase();
  const matches = TEACHING_GUIDANCE.filter((item) => {
    const familyMatch = familyId ? item.families.includes(familyId) : false;
    const categoryMatch = item.procedureCategories.includes(category);
    const signalMatch = item.searchSignals.some((signal) => text.includes(signal));
    return familyMatch || categoryMatch || signalMatch;
  });

  const ranked = [...matches].sort((left, right) => {
    const leftScore = guidanceScore(left, category, familyId, text);
    const rightScore = guidanceScore(right, category, familyId, text);
    return rightScore - leftScore;
  });

  const selected = ranked.slice(0, 3);
  if (selected.some((item) => item.id === "teach-case-automation-runway")) {
    return selected;
  }

  const wantsIntegrationContext = [
    "ipaas",
    "automation",
    "webhook",
    "case packet",
    "power automate",
    "zapier",
    "make webhook",
    "make scenario",
  ].some((signal) => text.includes(signal));
  const integration = TEACHING_GUIDANCE.find((item) => item.id === "teach-case-automation-runway");

  return wantsIntegrationContext && integration ? [...selected.slice(0, 2), integration] : selected;
}

export function getKnowledgeSourceIdsForCase(
  procedure: ProcedureSummary,
  familyId?: string | null,
  query?: string | null
): string[] {
  const ids = getTeachingGuidanceForProcedure(procedure, familyId, query).flatMap((item) => item.sourceIds);
  return Array.from(new Set(ids));
}

function guidanceScore(
  item: TeachingGuidance,
  category: string,
  familyId: string | null | undefined,
  text: string
): number {
  let score = 0;
  if (familyId && item.families.includes(familyId)) {
    score += 4;
  }
  if (item.procedureCategories.includes(category)) {
    score += 3;
  }
  score += item.searchSignals.filter((signal) => text.includes(signal)).length;
  if (item.priority === "foundational") {
    score += 0.5;
  }
  if (item.priority === "integration") {
    score += 0.25;
  }
  return score;
}
