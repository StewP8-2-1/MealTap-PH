import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

import { DesktopNavLinks } from "./desktop-nav-links";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="font-heading text-xl font-extrabold tracking-tight text-primary"
        >
          {siteConfig.name}
        </Link>

        <DesktopNavLinks />

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link href="/sign-in" className={buttonVariants({ size: "sm" })}>
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
