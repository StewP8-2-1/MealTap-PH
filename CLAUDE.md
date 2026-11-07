@AGENTS.md

# MealTap

A Philippine-focused healthy recipe app: Filipino recipes with macros from food-composition data and live ₱ meal costs from local market prices. It also has accounts, favorites, a meal planner and grocery list, an admin console, and AI search and chat.

- **Plan:** [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) has 15 stages, each with a verification gate.
- **Progress:** [docs/PROGRESS.md](docs/PROGRESS.md). Tick a stage only after its gate passes.
- **Repo:** https://github.com/StewP8-2-1/MealTap-PH. Vercel project `mealtap-ph`, Hobby plan.

## Commands

| Command          | What it does                               |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Dev server at http://localhost:3000        |
| `pnpm lint`      | ESLint (Next core-web-vitals + TypeScript) |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit`         |
| `pnpm test`      | Vitest unit tests (`src/**/*.test.ts`)     |
| `pnpm build`     | Production build                           |
| `pnpm format`    | Prettier, with the Tailwind class sorter   |

Every stage gate requires `pnpm lint && pnpm typecheck && pnpm test` to pass.

## Stack notes (Next.js 16.4)

- **Read the bundled docs first:** `node_modules/next/dist/docs/` matches the installed version, and several APIs differ from older Next.js:
  - `middleware.ts` is now **`proxy.ts`**.
  - Error boundaries receive **`retry()`** (`reset()` is the rare case).
  - `LayoutProps<"/">` / `PageProps<"/x">` are global generated types.
- **`cacheComponents: true`:** request-time data (cookies, headers, searchParams, uncached DB reads) must sit inside `<Suspense>`, or be cached with `'use cache'` + `cacheLife()`. Don't call `new Date()` or `Math.random()` during prerender outside those boundaries.
- **shadcn/ui** uses the `base-nova` style on **Base UI**, not Radix. There's no `asChild`: style a `<Link>` as a button with `buttonVariants()`, or use the `render` prop. `cn` comes from the `cn` package.
- **Theme:** there is no `next-themes`. `components/theme/theme-script.tsx` sets the `dark` class before first paint, and `useTheme()` reads and changes it.
- **Env:** import `env` from `@/env` (validated with zod). Keep `.env.example` in sync.
- **pnpm 12** blocks dependency build scripts by default. Allow them in `pnpm-workspace.yaml` under `allowBuilds`.

## Conventions

- Pure, tested logic lives in `src/lib/**`, with tests next to it (`*.test.ts`). Route handlers and server actions stay thin.
- Never invent nutrition values, prices or recipe content. Use real sources or clearly marked fixtures.
- Credit every recipe to its original author and site.
- AI model IDs live only in `src/lib/ai/models.ts` (Stage 4).
- Schema changes go through `drizzle-kit generate` plus a committed migration (Stage 2+).
- Commit per stage as `feat(stage-N): …`.

## Folder map (current)

```
src/app/              routes (App Router); layout.tsx holds the shell
src/components/ui/    shadcn-generated (don't hand-edit unless needed)
src/components/layout header, footer, mobile bottom nav, theme toggle
src/components/theme  no-flash theme script + useTheme hook
src/lib/              format.ts (₱, minutes, grams), nav.ts, site.ts, utils.ts
src/env.ts            validated environment variables
data/                 ingredient-map.csv (curated) → ingredients.csv + ingredient-portions.csv (generated from USDA); recipe-sources.json
scripts/              data build/seed scripts (pure logic in scripts/lib, tested)
docs/                 plan, progress, data sources
```
