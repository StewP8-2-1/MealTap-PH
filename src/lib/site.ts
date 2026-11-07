import { env } from "@/env";

export const siteConfig = {
  name: "MealTap",
  tagline: "Masustansyang ulam, sakto sa budget.",
  description:
    "Healthy Filipino recipes with macros from Philippine food data and real-time meal cost estimates from local market prices.",
  locale: "en_PH",
  timeZone: "Asia/Manila",
} as const;

/** Absolute base URL for metadata, sitemaps and OG images. */
export function getSiteUrl(): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  // Vercel exposes this automatically for the Next.js framework preset.
  const vercelProd = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  return "http://localhost:3000";
}
