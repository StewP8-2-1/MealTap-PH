"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : null;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center gap-4 px-4 py-20">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground">
        Please try again. If it keeps happening, let us know.
        {digest ? ` (Reference: ${digest})` : null}
      </p>
      {/* retry() re-fetches and re-renders the segment (Next 16.2+). */}
      <Button onClick={() => retry()}>Try again</Button>
    </section>
  );
}
