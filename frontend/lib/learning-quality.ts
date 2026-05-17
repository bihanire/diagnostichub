import type {
  ContentHealthSignal,
  DecisionTeachingNote,
  FamilyLessonCard,
  FeedbackSummaryResponse,
  OpsTelemetrySummaryResponse,
  ProcedureFeedbackBreakdownResponse,
  ProcedureSummary,
} from "@/lib/types";

export const FAMILY_LESSON_CARDS: FamilyLessonCard[] = [
  {
    id: "lesson-display-visible-before-software",
    familyId: "display",
    title: "Visible screen evidence comes before software guesses",
    teachingGoal:
      "Help the officer separate cracked glass, black display, colored lines, touch drift, and protector/case interference before moving to software language.",
    firstLook: [
      "Ask what the customer can still see, hear, or touch.",
      "Check visible damage and protector/case pressure before app or update assumptions.",
      "Record whether the device rings, vibrates, or shows partial image.",
    ],
    modelCaveats: [
      "Screen behavior, diagnostic availability, and update menus vary by Galaxy model and One UI version.",
      "A display that fails after an update can still need inspection when visible panel symptoms persist.",
    ],
    localPhrases: ["green line", "yellow screen", "half display", "touch pressing itself"],
    sourceIds: ["device-screen-flicker", "device-members-diagnostics", "watu-sop-pack"],
  },
  {
    id: "lesson-power-safety-first",
    familyId: "power",
    title: "Battery and charging teaching starts with safety",
    teachingGoal:
      "Train the officer to stop unsafe checks early, then separate charger, port, moisture, heat, swelling, and battery-drain patterns.",
    firstLook: [
      "Ask if heat, swelling, burnt smell, or liquid warning appeared.",
      "Use a known-good charger only when the device is safe to test.",
      "Capture whether the phone is dead, vibrating, percentage stuck, or draining quickly.",
    ],
    modelCaveats: [
      "Charging menus, battery-health signals, and Device Care wording vary by Android and One UI version.",
      "Moisture detection should be treated as a safety branch, not as a normal accessory complaint.",
    ],
    localPhrases: ["dead set", "not coming on", "charger bent", "battery finishes quickly"],
    sourceIds: [
      "device-battery-care",
      "device-device-care",
      "device-moisture-port",
      "device-members-diagnostics",
      "watu-sop-pack",
    ],
  },
  {
    id: "lesson-logic-repeatability",
    familyId: "logic",
    title: "Software symptoms need repeatability, not panic",
    teachingGoal:
      "Teach the officer to compare recent app changes, Safe Mode behavior, update state, storage pressure, restart loops, and freeze patterns before courier escalation.",
    firstLook: [
      "Ask what changed before the freeze, restart, or slow behavior started.",
      "Separate one-app failure from whole-device failure.",
      "Use Safe Mode or update context only when it fits the guided Watu path.",
    ],
    modelCaveats: [
      "Safe Mode entry, update availability, and reset wording vary by device generation and carrier build.",
      "Factory reset belongs behind ownership and data-loss checks.",
    ],
    localPhrases: ["hanging", "freezing", "safe mode keeps coming", "stuck on boot logo"],
    sourceIds: ["device-safe-mode", "device-software-update", "device-factory-reset", "watu-sop-pack"],
  },
  {
    id: "lesson-security-ownership-first",
    familyId: "security",
    title: "Security cases are ownership and policy cases first",
    teachingGoal:
      "Keep stolen, lost, forgotten password, FRP, and managed-device cases inside ownership and compliance language before any repair or replacement promise.",
    firstLook: [
      "Confirm whether the case is lost, stolen, locked, reset, or enterprise-managed.",
      "Use account-protection language before replacement eligibility language.",
      "Treat Knox or managed locks as policy/account states until proven otherwise.",
    ],
    modelCaveats: [
      "Lock, account recovery, and managed-device experiences can vary by region, account state, and enterprise policy.",
      "Branch officers must not imply bypasses for locks, FRP, or management controls.",
    ],
    localPhrases: ["phone was snatched", "forgot pattern", "Google lock", "shell managed"],
    sourceIds: [
      "device-smartthings-find",
      "device-factory-reset",
      "knox-android-enterprise",
      "knox-guard-lock-unlock",
      "watu-sop-pack",
    ],
  },
  {
    id: "lesson-connectivity-compare-paths",
    familyId: "connectivity",
    title: "Connectivity needs network-side and device-side comparison",
    teachingGoal:
      "Help the officer compare SIM, network registration, mobile data, Wi-Fi, speaker, microphone, and accessory path symptoms before deciding repair movement.",
    firstLook: [
      "Ask whether the issue follows the SIM, network area, app, accessory, or device.",
      "Separate speaker output from microphone input and earpiece behavior.",
      "Record diagnostic failures only for the function the customer reported.",
    ],
    modelCaveats: [
      "SIM settings, network menus, and diagnostic tests differ by model, carrier, and software version.",
      "A network outage should not be handled like a board-level repair symptom.",
    ],
    localPhrases: ["not reading SIM", "no service", "mouthpiece not working", "callers cannot hear me"],
    sourceIds: ["device-members-diagnostics", "watu-sop-pack"],
  },
  {
    id: "lesson-physical-evidence-decides-path",
    familyId: "physical",
    title: "Physical and liquid cases need evidence before reassurance",
    teachingGoal:
      "Teach the officer to capture visible impact, liquid entry, bent frame, broken tray, corrosion, burnt signs, and unsafe battery cues before giving warranty direction.",
    firstLook: [
      "Look for cracks, dents, bends, liquid signs, corrosion, and burnt smell.",
      "Stop power or charging checks when safety signs appear.",
      "Record evidence before dispatch, replacement, or return conversations.",
    ],
    modelCaveats: [
      "Water resistance and inspection outcomes vary by model, condition, and service evaluation.",
      "Visible damage can change warranty handling even when a software symptom is also present.",
    ],
    localPhrases: ["fell in water", "sim tray broken", "frame bent", "back cover lifting"],
    sourceIds: ["device-moisture-port", "device-battery-care", "watu-sop-pack"],
  },
];

export const DECISION_TEACHING_NOTES: DecisionTeachingNote[] = [
  {
    id: "decision-visible-damage",
    title: "Visible damage changes the conversation",
    procedureCategories: ["Display & Vision", "Physical & Liquid"],
    searchSignals: ["crack", "line", "yellow", "fell", "bent", "water", "corrosion"],
    whyItMatters:
      "Visible condition often decides whether the branch can continue a simple check or must capture evidence for inspection and warranty direction.",
    officerPrompt: "What can you see on the device before you touch the software path?",
    escalationRisk: "Skipping evidence can lead to a weak repair handover or wrong warranty expectation.",
    sourceIds: ["device-screen-flicker", "device-moisture-port", "watu-sop-pack"],
  },
  {
    id: "decision-battery-risk",
    title: "Battery risk stops ordinary troubleshooting",
    procedureCategories: ["Power & Thermal", "Physical & Liquid"],
    searchSignals: ["hot", "swollen", "burnt", "moisture", "charging", "battery"],
    whyItMatters:
      "Heat, swelling, burnt smell, and moisture warnings are safety signals. They should narrow the path before repeated charger or reboot checks.",
    officerPrompt: "Is there any sign that continuing to charge or power the device could be unsafe?",
    escalationRisk: "Unsafe checks can damage the device further and put the customer or officer at risk.",
    sourceIds: ["device-battery-care", "device-moisture-port", "watu-sop-pack"],
  },
  {
    id: "decision-reset-risk",
    title: "Reset advice belongs behind data and ownership checks",
    procedureCategories: ["Logic & Software", "Security & Access"],
    searchSignals: ["reset", "factory", "frp", "google", "password", "pattern", "locked"],
    whyItMatters:
      "Reset language can create data-loss and account-lock risk. It must stay behind ownership, backup, and guided decision checks.",
    officerPrompt: "Have ownership, backup risk, and account-lock implications been made clear?",
    escalationRisk: "Premature reset advice can lock the customer out or erase important data.",
    sourceIds: ["device-factory-reset", "knox-android-enterprise", "watu-sop-pack"],
  },
  {
    id: "decision-managed-device",
    title: "Managed device behavior may be policy, not fault",
    procedureCategories: ["Security & Access", "Operations & Compliance"],
    searchSignals: ["knox", "managed", "policy", "lock", "enrolled", "configure", "guard"],
    whyItMatters:
      "Enterprise or Knox-managed states may come from policy, enrollment, or account controls rather than repairable hardware failure.",
    officerPrompt: "Is this a personal device problem or a managed-device policy state?",
    escalationRisk: "Treating policy control as repair failure can create privacy and compliance risk.",
    sourceIds: ["knox-android-enterprise", "knox-guard-lock-unlock", "knox-configure-enrollment", "watu-sop-pack"],
  },
  {
    id: "decision-handover-readiness",
    title: "A strong diagnosis should stand on its evidence",
    procedureCategories: [
      "Display & Vision",
      "Power & Thermal",
      "Logic & Software",
      "Security & Access",
      "Connectivity & I/O",
      "Physical & Liquid",
      "Operations & Compliance",
      "Replacements & Transfers",
      "Returns & Recovery",
    ],
    searchSignals: ["dispatch", "case", "handover", "feedback", "repair", "evidence"],
    whyItMatters:
      "The finished diagnosis should preserve enough structured evidence for another officer, reviewer, or future automation path to understand the case without replaying the whole conversation.",
    officerPrompt: "Would another team understand the case from the query, answer trail, decision, evidence, and source IDs?",
    escalationRisk: "Weak case structure creates rework when another team reviews or receives the case.",
    sourceIds: ["device-service-readiness", "watu-sop-pack"],
  },
];

type ContentHealthInput = {
  procedureBreakdown?: ProcedureFeedbackBreakdownResponse | null;
  summary?: FeedbackSummaryResponse | null;
  telemetrySummary?: OpsTelemetrySummaryResponse | null;
};

export function getFamilyLessonCards(familyId: string | null | undefined): FamilyLessonCard[] {
  if (!familyId) {
    return FAMILY_LESSON_CARDS.slice(0, 3);
  }
  return FAMILY_LESSON_CARDS.filter((card) => card.familyId === familyId);
}

export function getDecisionTeachingNotesForProcedure(
  procedure: ProcedureSummary | null | undefined,
  query?: string | null,
  limit = 2
): DecisionTeachingNote[] {
  const category = procedure?.category || "";
  const text = `${query || ""} ${procedure?.title || ""} ${procedure?.description || ""}`.toLowerCase();

  const ranked = DECISION_TEACHING_NOTES.map((note) => ({
    note,
    score: decisionNoteScore(note, category, text),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.note);

  const handoverReadiness = DECISION_TEACHING_NOTES.find((note) => note.id === "decision-handover-readiness");
  const selected = ranked.slice(0, limit);

  if (handoverReadiness && !selected.some((note) => note.id === handoverReadiness.id)) {
    return [...selected.slice(0, Math.max(limit - 1, 0)), handoverReadiness];
  }
  return selected;
}

export function getContentHealthSignals({
  procedureBreakdown,
  summary,
  telemetrySummary,
}: ContentHealthInput): ContentHealthSignal[] {
  const signals: ContentHealthSignal[] = [];
  const totalSubmissions = summary?.total_submissions || 0;
  const helpfulRate = totalSubmissions > 0 ? (summary?.helpful_count || 0) / totalSubmissions : 1;

  signals.push({
    id: "helpful-rate",
    label: "Helpful rate",
    value: totalSubmissions > 0 ? formatPercent(helpfulRate) : "No feedback yet",
    level: helpfulRate < 0.6 ? "risk" : helpfulRate < 0.75 ? "watch" : "healthy",
    teachingImpact:
      totalSubmissions > 0
        ? "Shows whether branch officers trust the teaching and decision language."
        : "Needs more branch feedback before the wording can be judged.",
    recommendedAction:
      helpfulRate < 0.75
        ? "Review low-scoring procedures and compare the result wording with branch comments."
        : "Keep collecting feedback and protect the current wording discipline.",
  });

  const topNeedsWork = procedureBreakdown?.items
    .filter((item) => item.total_submissions > 0)
    .map((item) => ({
      ...item,
      needsWorkRate: item.not_helpful_count / item.total_submissions,
    }))
    .sort((left, right) => {
      if (right.not_helpful_count !== left.not_helpful_count) {
        return right.not_helpful_count - left.not_helpful_count;
      }
      return right.needsWorkRate - left.needsWorkRate;
    })[0];

  signals.push({
    id: "top-needs-work",
    label: "Top wording watch",
    value: topNeedsWork
      ? `${topNeedsWork.procedure_title}: ${topNeedsWork.not_helpful_count}`
      : "No procedure feedback yet",
    level:
      topNeedsWork && (topNeedsWork.not_helpful_count >= 3 || topNeedsWork.needsWorkRate >= 0.4)
        ? "risk"
        : topNeedsWork && topNeedsWork.not_helpful_count > 0
          ? "watch"
          : "healthy",
    teachingImpact: "Identifies the flow most likely to need clearer teaching language.",
    recommendedAction: topNeedsWork
      ? "Audit the first question, branch-safe checks, and final explanation for this flow."
      : "Wait for more procedure-level feedback before changing content.",
  });

  const eventCounts = telemetrySummary?.interaction.event_counts || {};
  const totalSearches = telemetrySummary?.search.total_searches || 0;
  const noMatchRecoveries =
    (eventCounts.no_match_recovery_family_opened || 0) +
    (eventCounts.no_match_recovery_prompt_used || 0);
  const recoveryRate = totalSearches > 0 ? noMatchRecoveries / totalSearches : 0;

  signals.push({
    id: "no-match-recovery-rate",
    label: "No-match recovery",
    value: totalSearches > 0 ? `${noMatchRecoveries} (${formatPercent(recoveryRate)})` : "No searches yet",
    level: recoveryRate > 0.2 ? "risk" : recoveryRate > 0.1 ? "watch" : "healthy",
    teachingImpact: "Shows whether officers are using words the search layer does not understand yet.",
    recommendedAction:
      recoveryRate > 0.1
        ? "Mine recovery prompts and branch comments for local phrases to add to benchmarks."
        : "Keep monitoring local wording drift as branches use the assistant.",
  });

  const confidencePrompts = eventCounts.confidence_gate_shown || 0;
  const confidenceConfirmations = eventCounts.confidence_gate_confirmed || 0;
  const confirmationRate = confidencePrompts > 0 ? confidenceConfirmations / confidencePrompts : 1;

  signals.push({
    id: "confidence-confirm-rate",
    label: "Confidence gate confirm",
    value: confidencePrompts > 0 ? formatPercent(confirmationRate) : "No gates shown",
    level: confirmationRate < 0.45 ? "risk" : confirmationRate < 0.65 ? "watch" : "healthy",
    teachingImpact: "Shows whether ambiguity gates are helping officers choose the right flow.",
    recommendedAction:
      confidencePrompts > 0 && confirmationRate < 0.65
        ? "Review alternatives shown for ambiguous searches and improve family phrasing."
        : "Current ambiguity handling is not showing a strong warning signal.",
  });

  return signals;
}

function decisionNoteScore(note: DecisionTeachingNote, category: string, text: string): number {
  let score = 0;
  if (note.procedureCategories.includes(category)) {
    score += 3;
  }
  score += note.searchSignals.filter((signal) => text.includes(signal)).length;
  if (note.id === "decision-handover-readiness") {
    score += 0.2;
  }
  return score;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
