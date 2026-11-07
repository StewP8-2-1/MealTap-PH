import Link from "next/link";

import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mb-16 border-t md:mb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground">
        <p className="font-heading text-base font-bold text-foreground">
          {siteConfig.name}
        </p>
        <p className="max-w-prose">
          Nutrition and cost figures are estimates and are not medical or
          dietary advice. Every recipe is credited to its original creator, with
          a link back to their site.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/credits" className="underline-offset-4 hover:underline">
            Credits &amp; data sources
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
