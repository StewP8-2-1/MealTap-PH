# MealTap

**Masustansyang ulam, sakto sa budget.** MealTap is a Philippine-focused healthy recipe web app. Each recipe shows its nutrition (from food-composition data) and an estimated meal cost (from local market prices). You can also plan your week and get a grocery list.

> Status: early development. See [docs/PROGRESS.md](docs/PROGRESS.md).

## Tech stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- Tailwind CSS v4, shadcn/ui (Base UI), Lucide icons
- Neon Postgres + Drizzle ORM + pgvector
- Vercel AI Gateway, Vercel Blob, Vercel Cron
- Better Auth (Sign in with Vercel, plus email and password)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in values as later stages need them
pnpm dev                     # http://localhost:3000
```

Checks:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Docs

- [Development plan](docs/DEVELOPMENT_PLAN.md)
- [Progress](docs/PROGRESS.md)
- [Data sources](docs/DATA_SOURCES.md)

## Credits

Every recipe on MealTap credits its original creator and links back to their site. Nutrition and price data sources are listed in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) and on the site's Credits page.
