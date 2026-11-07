import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

// Placeholder home page. The designed landing page arrives in Stage 7.
export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-6 px-4 py-20">
      <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
        Coming soon
      </p>
      <h1 className="max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        {siteConfig.tagline}
      </h1>
      <p className="max-w-prose text-lg text-muted-foreground">
        {siteConfig.description}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/recipes" className={buttonVariants({ size: "lg" })}>
          Browse recipes
        </Link>
        <Link
          href="/planner"
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          Plan my week
        </Link>
      </div>
    </section>
  );
}
