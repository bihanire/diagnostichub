const APP_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE || "en-UG";

function clampRatio(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function clampWholePercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function getAppLocale(): string {
  return APP_LOCALE;
}

export function formatRatioPercent(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: "percent",
    maximumFractionDigits
  }).format(clampRatio(value));
}

export function formatWholePercent(value: number, maximumFractionDigits = 0): string {
  return `${new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits
  }).format(clampWholePercent(value))}%`;
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
