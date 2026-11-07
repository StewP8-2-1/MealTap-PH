import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">
        Naligaw ka yata!
      </h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find that page. It may not be built yet, or it has
        moved.
      </p>
      <Link href="/" className={buttonVariants()}>
        Back to home
      </Link>
    </section>
  );
}
