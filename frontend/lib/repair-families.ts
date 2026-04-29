import { repairFamilyShortcuts } from "@/lib/issue-visuals";
import { recordClientDiagnostic } from "@/lib/client-diagnostics";
import { RepairFamilySummary } from "@/lib/types";

type RepairFamilyResolution = {
  invalidCount: number;
  items: RepairFamilySummary[];
  normalizedCount: number;
  partial: boolean;
  usedFallback: boolean;
};

const MIN_EXPECTED_FAMILY_COUNT = repairFamilyShortcuts.length;

export const BUILT_IN_REPAIR_FAMILIES: RepairFamilySummary[] = repairFamilyShortcuts.map((item) => ({
  id: item.id,
  title: item.label,
  hint: item.hint,
  symptom_prompts: [item.query],
  procedure_count: 0
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeProcedureCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function normalizePromptList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (prompt): prompt is string => typeof prompt === "string" && prompt.trim().length > 0
  );
}

export function normalizeRepairFamilies(value: unknown): {
  invalidCount: number;
  items: RepairFamilySummary[];
} {
  if (!Array.isArray(value)) {
    return {
      invalidCount: value == null ? 0 : 1,
      items: []
    };
  }

  let invalidCount = 0;
  const items = value.flatMap((item): RepairFamilySummary[] => {
    if (!isRecord(item)) {
      invalidCount += 1;
      return [];
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const fallback = repairFamilyShortcuts.find((shortcut) => shortcut.id === id);
    const title =
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : fallback?.label || "";

    if (!id || !title) {
      invalidCount += 1;
      return [];
    }

    const hint =
      typeof item.hint === "string" && item.hint.trim()
        ? item.hint.trim()
        : fallback?.hint || "Open this family to narrow the visible issue.";
    const symptomPrompts = normalizePromptList(item.symptom_prompts);

    return [
      {
        id,
        title,
        hint,
        symptom_prompts: symptomPrompts.length > 0 ? symptomPrompts : fallback ? [fallback.query] : [],
        procedure_count: normalizeProcedureCount(item.procedure_count)
      }
    ];
  });

  return { invalidCount, items };
}

function mergeWithBuiltIns(items: RepairFamilySummary[]): RepairFamilySummary[] {
  const byId = new Map(BUILT_IN_REPAIR_FAMILIES.map((item) => [item.id, item]));
  for (const item of items) {
    byId.set(item.id, {
      ...byId.get(item.id),
      ...item,
      symptom_prompts: item.symptom_prompts.length > 0
        ? item.symptom_prompts
        : byId.get(item.id)?.symptom_prompts || []
    });
  }

  const canonical = BUILT_IN_REPAIR_FAMILIES.map((item) => byId.get(item.id)).filter(
    (item): item is RepairFamilySummary => Boolean(item)
  );
  const extras = items.filter((item) => !BUILT_IN_REPAIR_FAMILIES.some((known) => known.id === item.id));
  return [...canonical, ...extras];
}

export function resolveRepairFamilies(
  value: unknown,
  source: string,
  options: { log?: boolean } = {}
): RepairFamilyResolution {
  const normalized = normalizeRepairFamilies(value);
  const usedFallback = normalized.items.length === 0;
  const partial = normalized.items.length > 0 && normalized.items.length < MIN_EXPECTED_FAMILY_COUNT;
  const items = usedFallback ? BUILT_IN_REPAIR_FAMILIES : mergeWithBuiltIns(normalized.items);

  if (options.log && (usedFallback || partial || normalized.invalidCount > 0)) {
    recordClientDiagnostic("visual_families_resolution", {
      severity: usedFallback ? "warn" : "info",
      message: usedFallback
        ? "Visual families fell back to the built-in asset set."
        : "Visual families loaded with partial or corrected data.",
      details: {
        invalid_count: normalized.invalidCount,
        normalized_count: normalized.items.length,
        rendered_count: items.length,
        source
      }
    });
  }

  return {
    invalidCount: normalized.invalidCount,
    items,
    normalizedCount: normalized.items.length,
    partial,
    usedFallback
  };
}

export function getRenderableRepairFamilies(value: unknown): RepairFamilySummary[] {
  return resolveRepairFamilies(value, "render").items;
}
