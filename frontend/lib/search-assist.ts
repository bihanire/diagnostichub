import { quickQueries } from "@/lib/copy";
import { repairFamilyShortcuts } from "@/lib/issue-visuals";
import type { RepairFamilySummary } from "@/lib/types";

export type SearchAssistCategory =
  | "Hardware Errors"
  | "Documentation"
  | "Partners"
  | "Branch Locations";

type SearchAssistAction = "search" | "link" | "fill";

export type SearchAssistSuggestion = {
  id: string;
  category: SearchAssistCategory;
  label: string;
  subtitle: string;
  queryValue: string;
  action: SearchAssistAction;
  href?: string;
  score: number;
  matchedTerms: string[];
};

type SearchAssistEntrySeed = {
  id: string;
  category: SearchAssistCategory;
  label: string;
  subtitle: string;
  queryValue: string;
  action: SearchAssistAction;
  href?: string;
  keywords: string[];
};

type SearchAssistEntry = SearchAssistEntrySeed & {
  normalizedLabel: string;
  normalizedHaystack: string;
  haystackTokens: string[];
};

const CATEGORY_RANK: Record<SearchAssistCategory, number> = {
  "Hardware Errors": 0,
  Documentation: 1,
  Partners: 2,
  "Branch Locations": 3
};

const SYNONYM_GROUPS = [
  ["frp", "factory reset protection", "google lock", "device activation", "activation lock"],
  ["knox guard", "knox gaurd", "kg lock", "shell managed", "managed device"],
  ["stolen", "phone snatched", "phone stolen", "missing phone"],
  ["not charging", "charger not working", "no charge", "charging issue", "charge port"],
  ["not powering on", "dead phone", "no power", "does not turn on"],
  ["overheating", "too hot", "hot phone", "swollen battery", "battery lifting"],
  ["sim issue", "sim not detected", "no network", "network issue", "data issue"],
  ["speaker issue", "microphone issue", "mouthpiece issue", "audio issue"],
  ["screen issue", "display issue", "black screen", "lines on screen", "touch not working"],
  ["samsung", "smasung", "samusng", "galaxy"]
] as const;

const DOCUMENTATION_LINKS: SearchAssistEntrySeed[] = [
  {
    id: "doc-master-queries",
    category: "Documentation",
    label: "Master Queries Log",
    subtitle: "All logged repair, replacement, stolen, and transfer cases.",
    queryValue: "master queries log aftersales",
    action: "link",
    href: "https://docs.google.com/spreadsheets/d/1jlpD74o0F88-wxq8p0x_nCptMLSjMuv6u2WuAcaa9Cs/edit?gid=655564610#gid=655564610",
    keywords: ["master queries", "spreadsheet", "repair logs", "replacement logs", "stolen logs"]
  },
  {
    id: "doc-sop-guide",
    category: "Documentation",
    label: "SOP Guide",
    subtitle: "Operational policy reference for warranty, dispatch, and legal status handling.",
    queryValue: "sop guide warranty legal status dispatch",
    action: "link",
    href: "https://docs.google.com/document/d/13k8YVkqgaSG7Nck_0KTLh-emb9BhacJziuxxyxARXZ8/edit?tab=t.0",
    keywords: ["sop", "policy", "warranty", "dispatch", "legal status", "ls change"]
  }
];

const PARTNER_ENTRIES: SearchAssistEntrySeed[] = [
  {
    id: "partner-scorpio",
    category: "Partners",
    label: "Scorpio",
    subtitle: "Merchant/partner reference.",
    queryValue: "scorpio merchant partner",
    action: "fill",
    keywords: ["scorpio", "merchant", "partner", "code"]
  },
  {
    id: "partner-banana-world",
    category: "Partners",
    label: "Banana World",
    subtitle: "Merchant/partner reference.",
    queryValue: "banana world merchant partner",
    action: "fill",
    keywords: ["banana world", "merchant", "partner", "code"]
  },
  {
    id: "partner-transtel",
    category: "Partners",
    label: "Transtel",
    subtitle: "Service center routing reference.",
    queryValue: "transtel service center routing",
    action: "search",
    keywords: ["transtel", "service center", "routing", "out warranty"]
  },
  {
    id: "partner-watu-simu-hq",
    category: "Partners",
    label: "Watu SIMU HQ",
    subtitle: "Out-warranty intake routing reference.",
    queryValue: "watu simu hq out warranty routing",
    action: "search",
    keywords: ["watu simu hq", "out warranty", "routing", "assessment"]
  }
];

const BRANCH_ENTRIES: SearchAssistEntrySeed[] = [
  "Kampala Central",
  "Jinja",
  "Mbarara",
  "Gulu",
  "Mukono",
  "Entebbe",
  "Masaka"
].map((label) => ({
  id: `branch-${label.toLowerCase().replace(/\s+/g, "-")}`,
  category: "Branch Locations" as const,
  label,
  subtitle: "Branch location reference.",
  queryValue: `${label} branch`,
  action: "fill" as const,
  keywords: [label.toLowerCase(), "branch", "location", "after sales"]
}));

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokens(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

function toCatalogEntry(seed: SearchAssistEntrySeed): SearchAssistEntry {
  const normalizedLabel = normalizeText(seed.label);
  const normalizedHaystack = normalizeText(
    `${seed.label} ${seed.subtitle} ${seed.keywords.join(" ")}`
  );
  return {
    ...seed,
    normalizedLabel,
    normalizedHaystack,
    haystackTokens: toTokens(normalizedHaystack)
  };
}

function levenshteinDistance(a: string, b: string): number {
  if (!a) {
    return b.length;
  }
  if (!b) {
    return a.length;
  }
  if (a === b) {
    return 0;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function expandTerms(rawQuery: string): string[] {
  const normalized = normalizeText(rawQuery);
  if (!normalized) {
    return [];
  }

  const terms = new Set<string>(toTokens(normalized));
  terms.add(normalized);

  for (const group of SYNONYM_GROUPS) {
    const groupHit = group.some((phrase) => normalized.includes(normalizeText(phrase)));
    if (!groupHit) {
      continue;
    }
    for (const phrase of group) {
      terms.add(normalizeText(phrase));
      for (const token of toTokens(phrase)) {
        terms.add(token);
      }
    }
  }

  return [...terms].filter(Boolean);
}

function buildHardwareEntries(families: RepairFamilySummary[]): SearchAssistEntry[] {
  const fromFamilies: SearchAssistEntrySeed[] = families.map((family) => ({
    id: `hardware-family-${family.id}`,
    category: "Hardware Errors" as const,
    label: family.title,
    subtitle: family.hint,
    queryValue: family.symptom_prompts[0] || family.title,
    action: "search" as const,
    keywords: [
      family.title,
      family.hint,
      ...family.symptom_prompts,
      "samsung",
      "galaxy",
      "diagnosis",
      "triage"
    ]
  }));

  const fromShortcuts: SearchAssistEntrySeed[] = repairFamilyShortcuts.map((shortcut) => ({
    id: `hardware-shortcut-${shortcut.id}`,
    category: "Hardware Errors" as const,
    label: shortcut.label,
    subtitle: shortcut.hint,
    queryValue: shortcut.query,
    action: "search" as const,
    keywords: [shortcut.label, shortcut.hint, shortcut.query, "samsung", "galaxy"]
  }));

  const fromQuickQueries: SearchAssistEntrySeed[] = quickQueries.map((item) => ({
    id: `hardware-quick-${item.label.toLowerCase().replace(/\s+/g, "-")}`,
    category: "Hardware Errors" as const,
    label: item.label,
    subtitle: item.hint,
    queryValue: item.query,
    action: "search" as const,
    keywords: [item.label, item.query, item.hint, "samsung", "galaxy"]
  }));

  const securityAnchors: SearchAssistEntrySeed[] = [
    {
      id: "hardware-security-frp",
      category: "Hardware Errors",
      label: "FRP / Google Lock",
      subtitle: "Security and access flow for locked devices.",
      queryValue: "frp google lock locked device",
      action: "search",
      keywords: ["frp", "google lock", "locked device", "activation", "samsung"]
    },
    {
      id: "hardware-security-knox-guard",
      category: "Hardware Errors",
      label: "Knox Guard / Managed Device",
      subtitle: "Managed or shell-restricted device handling.",
      queryValue: "knox guard shell managed device",
      action: "search",
      keywords: ["knox guard", "knox gaurd", "shell managed", "managed device", "samsung"]
    }
  ];

  const unique = new Map<string, SearchAssistEntry>();
  for (const entry of [...fromFamilies, ...fromShortcuts, ...fromQuickQueries, ...securityAnchors]) {
    unique.set(entry.id, toCatalogEntry(entry));
  }
  return [...unique.values()];
}

function scoreEntry(
  normalizedQuery: string,
  expandedTerms: string[],
  queryTokens: string[],
  entry: SearchAssistEntry
): SearchAssistSuggestion | null {
  if (!normalizedQuery) {
    return null;
  }

  const matchedTerms = new Set<string>();
  let score = 0;

  if (entry.normalizedHaystack.includes(normalizedQuery)) {
    score += 70;
    matchedTerms.add(normalizedQuery);
  }

  for (const term of expandedTerms) {
    if (!term) {
      continue;
    }
    if (entry.normalizedHaystack.includes(term)) {
      score += term.length > 4 ? 18 : 12;
      matchedTerms.add(term);
      continue;
    }

    const nearToken = entry.haystackTokens.some((token) => {
      if (!token || Math.abs(token.length - term.length) > 2) {
        return false;
      }
      return levenshteinDistance(token, term) <= 2;
    });

    if (nearToken) {
      score += 8;
      matchedTerms.add(term);
    }
  }

  const overlapCount = queryTokens.filter((token) => entry.haystackTokens.includes(token)).length;
  score += overlapCount * 6;

  const labelDistance = levenshteinDistance(normalizedQuery, entry.normalizedLabel);
  if (labelDistance <= 2) {
    score += 28;
  } else if (labelDistance <= 4) {
    score += 18;
  } else if (labelDistance <= 6) {
    score += 10;
  } else if (labelDistance <= 8) {
    score += 4;
  }

  if (score < 14) {
    return null;
  }

  return {
    id: entry.id,
    category: entry.category,
    label: entry.label,
    subtitle: entry.subtitle,
    queryValue: entry.queryValue,
    action: entry.action,
    href: entry.href,
    score,
    matchedTerms: [...matchedTerms]
      .map((term) => normalizeText(term))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
  };
}

export function getSearchAssistSuggestions(
  query: string,
  families: RepairFamilySummary[],
  limit = 5
): SearchAssistSuggestion[] {
  const normalized = normalizeText(query);
  if (!normalized) {
    return [];
  }

  const expandedTerms = expandTerms(normalized);
  const queryTokens = toTokens(normalized);
  const catalog: SearchAssistEntry[] = [
    ...buildHardwareEntries(families),
    ...DOCUMENTATION_LINKS.map(toCatalogEntry),
    ...PARTNER_ENTRIES.map(toCatalogEntry),
    ...BRANCH_ENTRIES.map(toCatalogEntry)
  ];

  const scored = catalog
    .map((entry) => scoreEntry(normalized, expandedTerms, queryTokens, entry))
    .filter((item): item is SearchAssistSuggestion => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const categoryDelta = CATEGORY_RANK[left.category] - CATEGORY_RANK[right.category];
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      return left.label.localeCompare(right.label);
    });

  return scored.slice(0, limit);
}
