/**
 * Display formatters for prices, durations and weights.
 * Missing or invalid values render as an em dash so the UI never shows "NaN".
 */

const PLACEHOLDER = "—";

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const phpWholeFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function isUsable(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** ₱1,234.50, or ₱1,235 with `{ whole: true }`. */
export function formatPHP(
  amount: number | null | undefined,
  options: { whole?: boolean } = {},
): string {
  if (!isUsable(amount)) return PLACEHOLDER;
  return (options.whole ? phpWholeFormatter : phpFormatter).format(amount);
}

/** 45 → "45 min", 75 → "1 hr 15 min", 120 → "2 hr". */
export function formatMinutes(totalMinutes: number | null | undefined): string {
  if (!isUsable(totalMinutes) || totalMinutes < 0) return PLACEHOLDER;
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/** 2.5 → "2.5 g", 250 → "250 g", 1250 → "1.25 kg", 2000 → "2 kg". */
export function formatGrams(grams: number | null | undefined): string {
  if (!isUsable(grams) || grams < 0) return PLACEHOLDER;
  if (grams >= 1000) return `${trimNumber(grams / 1000, 2)} kg`;
  if (grams < 10) return `${trimNumber(grams, 1)} g`;
  return `${Math.round(grams)} g`;
}

function trimNumber(value: number, maxDecimals: number): string {
  return String(Number(value.toFixed(maxDecimals)));
}
