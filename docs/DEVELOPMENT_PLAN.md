# MealTap: Staged Development Plan

> A Philippine-focused healthy recipe web app. Users can discover local healthy recipes, see macros based on Philippine (FNRI) food composition data, and see an estimated meal cost in real time from local grocery prices. It also covers accounts, favorites, a meal planner with a grocery list, an admin console, and AI-powered recipe search and chat.

---

## 0. Context

`initial_plan.md` sets out the tech stack, the ETL idea, a four-table schema, and a "first task" (folder structure, `schema.ts`, one sample ETL route). It does not give an order of work, it does not cover users, admin, search, testing or deployment, and its schema is too thin to work in production. For example, it has no unit conversions, no review status, no ETL provenance and no embeddings.

This document expands it into a **stage-by-stage workflow for an agentic AI coder**. Each stage has a goal, ordered tasks, the files it creates, and a **verification gate**. The next stage starts only after the gate passes. The original "first task" is spread across Stages 1–4.

The owner chose these points:

- **Brand:** "MealTap". The repo and package slug is `mealtap`. The project folder is still named "Moki's Kitchen" on disk. Branding, metadata and the package name all use "MealTap".
- **In scope:** user accounts and favorites, meal planner and grocery list, admin dashboard, AI chat and semantic search.

When this plan is approved, its first action is to save this document into the repo as `docs/DEVELOPMENT_PLAN.md`. The agent also creates `docs/PROGRESS.md`, a checklist it ticks off stage by stage.

---

## 1. Rules for the Agentic Coder (apply to every stage)

1. **One stage at a time.** Finish its tasks, run its verification gate, update `docs/PROGRESS.md`, and commit (`feat(stage-N): …`). Do not start the next stage while a gate is failing.
2. **The gate commands must always pass:** `pnpm lint && pnpm typecheck && pnpm test`. From Stage 14 on, `pnpm test:e2e` must pass too.
3. **Never invent data.** This covers FNRI nutrient values, prices and recipe content. Use real sources or clearly marked dev fixtures (`/fixtures`, `isFixture: true`).
4. **Never hard-code secrets.** Every env var goes in `.env.example` and is validated in `src/env.ts`.
5. **Keep heavy logic in pure functions** (units, cost, macros, matching) under `src/lib/**`, with unit tests beside the code. Route handlers and server actions should only glue those functions together.
6. **Keep the DB code in one place.** Schema changes go through `drizzle-kit generate` and a committed migration. Do not use `push` against shared branches.
7. **Put AI model IDs in one config file** (`src/lib/ai/models.ts`). Never scatter model strings through the code.
8. **Check versions at install time** with `pnpm view <pkg> version`, and use the current stable major of Next.js, AI SDK, Drizzle, Tailwind and Better Auth. If an API differs from this plan (for example AI SDK `generateObject` versus `generateText({ output: Output.object() })`), follow the installed version's docs.
9. **Keep `CLAUDE.md` current** with commands, conventions and the folder map.

---

## 2. Target Architecture (summary)

```
            ┌────────────── Vercel ──────────────────────────────────────────┐
 Browser ──►│ Next.js App Router (RSC + Server Actions + Route Handlers)      │
            │   ├─ Public pages (ISR, tag-revalidated)                       │
            │   ├─ App pages (auth: favorites, planner, grocery list)        │
            │   ├─ Admin console (role=admin)                                │
            │   ├─ /api/chat  (AI SDK streamText + tools → DB search)        │
            │   └─ /api/cron/* ◄── Vercel Cron (CRON_SECRET)                 │
            │          └─ ETL workers: fetch → raw store → AI normalize →    │
            │             match ingredients → Blob images → DB → revalidate  │
            └──────┬───────────────────┬───────────────────┬─────────────────┘
                   ▼                   ▼                   ▼
          NeonDB Postgres        Vercel Blob        Vercel AI Gateway
          (+pgvector, pg_trgm)   (images)           → Anthropic / Groq / embeddings
```

**Key design decisions**

- **Cost is computed at read time.** Prices change and recipes don't. Macros per serving are computed when a recipe is published and stored on the recipe. Cost is computed by SQL from `ingredient_latest_prices`, which is refreshed after each pricing ETL run. Pages are cached with `revalidateTag('prices')`.
- **All recipe amounts are converted to grams on ingest** (`recipe_ingredients.grams`). Macros and cost then only need grams × per-100g values.
- **ETL runs in two phases:** (1) _collect_ raw documents into `etl_raw_documents`, keyed by content hash so it is idempotent; (2) _process_ them in small batches. This keeps each cron call inside the serverless function time limit and makes reprocessing cheap.
- **Human-in-the-loop.** AI-parsed recipes land as `pending_review`. Only `published` recipes are public. Ingredient names that can't be matched go to an admin mapping queue.
- **Hybrid search:** Postgres full-text (`tsvector`) plus pgvector cosine similarity, merged with Reciprocal Rank Fusion, then structured filters (cost, macros, time, meal type).

---

## 3. Final Folder Structure

```
mealtap/
├─ .github/workflows/ci.yml
├─ docs/  DEVELOPMENT_PLAN.md  PROGRESS.md  ARCHITECTURE.md  DESIGN.md  RUNBOOK.md
├─ drizzle/                         # generated SQL migrations (committed)
├─ fixtures/                        # saved HTML/PDF/JSON for scraper + AI tests
├─ data/                            # source CSVs (FNRI PhilFCT export, unit conversions)
├─ scripts/
│  ├─ seed-ingredients.ts           # PhilFCT CSV → ingredients
│  ├─ seed-unit-conversions.ts
│  ├─ seed-dev-recipes.ts           # fixture recipes for local dev
│  ├─ backfill-embeddings.ts
│  └─ refresh-latest-prices.ts
├─ public/                          # og fallback, illustrations/ (palayok, bilao…), patterns/ (banig, capiz)
├─ src/
│  ├─ env.ts                        # zod-validated env (@t3-oss/env-nextjs)
│  ├─ proxy.ts                      # Next 16 name for middleware: auth gate for /app/*, /admin/*
│  ├─ app/
│  │  ├─ layout.tsx  globals.css  not-found.tsx  error.tsx
│  │  ├─ sitemap.ts  robots.ts  opengraph-image.tsx
│  │  ├─ (marketing)/page.tsx                        # landing
│  │  ├─ (dev)/styleguide/page.tsx                   # living design system (404 in production)
│  │  ├─ (public)/recipes/page.tsx                   # browse + filters
│  │  ├─ (public)/recipes/[slug]/page.tsx            # detail: macros + cost
│  │  ├─ (public)/ingredients/[slug]/page.tsx        # nutrients + price history
│  │  ├─ (public)/search/page.tsx                    # hybrid search results
│  │  ├─ (public)/chat/page.tsx                      # AI assistant
│  │  ├─ (public)/credits/page.tsx                   # every recipe source + data source, takedown contact
│  │  ├─ (auth)/sign-in/page.tsx
│  │  ├─ (app)/favorites/page.tsx
│  │  ├─ (app)/planner/page.tsx                      # weekly planner
│  │  ├─ (app)/planner/[planId]/grocery/page.tsx     # grocery list
│  │  ├─ (app)/profile/page.tsx                      # goals, budget, allergies
│  │  ├─ admin/layout.tsx  admin/page.tsx            # dashboard
│  │  ├─ admin/recipes/  admin/recipes/[id]/         # review queue + editor
│  │  ├─ admin/ingredients/  admin/mappings/         # catalog + unmatched queue
│  │  ├─ admin/prices/                               # anomalies, manual entry
│  │  ├─ admin/etl/                                  # runs, raw docs, triggers
│  │  └─ api/
│  │     ├─ auth/[...all]/route.ts                   # Better Auth handler
│  │     ├─ chat/route.ts
│  │     ├─ cron/recipes/route.ts                       # daily (Hobby): collect → process within time budget
│  │     ├─ cron/prices/route.ts                        # daily (Hobby): collect → process → refresh view
│  │     └─ etl/recipes/route.ts                     # admin-triggered single-URL ingest (original "first task")
│  ├─ components/
│  │  ├─ ui/                        # shadcn generated
│  │  ├─ recipe/  RecipeCard, MacroBadge, CostBadge, NutritionPanel, IngredientList, StepList
│  │  ├─ search/  FilterSidebar, SearchBar
│  │  ├─ planner/ WeekGrid, MealSlot, PlanSummary
│  │  ├─ chat/    ChatWindow, RecipeToolCard
│  │  ├─ admin/   DataTable, DiffView, EtlRunTable
│  │  ├─ layout/  SiteHeader, SiteFooter, MobileNav (bottom tab bar), ThemeToggle
│  │  ├─ brand/   BanigPattern, CapizDivider, BilaoFrame, PresyoTag, JeepneyStripe, Banderitas, PhRegionMap, illustrations
│  │  └─ motion/  Reveal, NumberTicker, MacroRing, SteamLoader, FiestaConfetti, PageTransition
│  ├─ db/
│  │  ├─ index.ts                   # neon-http client + drizzle; pooled client for txns
│  │  ├─ schema/ enums.ts auth.ts ingredients.ts prices.ts recipes.ts users.ts planner.ts etl.ts relations.ts index.ts
│  │  └─ sql/ latest-prices-view.sql  extensions.sql
│  ├─ lib/
│  │  ├─ ai/      gateway.ts models.ts prompts/ schemas/ embed.ts
│  │  ├─ etl/     runner.ts  rate-limit.ts  robots.ts  hash.ts
│  │  │  ├─ recipes/  sources/<blog>.ts  parse.ts  pipeline.ts
│  │  │  └─ prices/   sources/da-pricewatch.ts  sources/<grocer>.ts  normalize.ts  pipeline.ts
│  │  ├─ units/   units.ts  convert.ts  (+ .test.ts)
│  │  ├─ nutrition/ macros.ts (+ .test.ts)
│  │  ├─ pricing/ cost.ts  anomalies.ts (+ .test.ts)
│  │  ├─ matching/ ingredient-matcher.ts (+ .test.ts)
│  │  ├─ search/  hybrid.ts  filters.ts
│  │  ├─ planner/ aggregate.ts  grocery.ts (+ .test.ts)
│  │  ├─ auth/    auth.ts  auth-client.ts  guards.ts
│  │  ├─ blob.ts  format.ts (PHP currency, durations)  slug.ts  rate-limit.ts
│  │  ├─ motion.ts (durations, easings, springs)  copy.ts (Taglish microcopy)
│  └─ server/
│     ├─ queries/  recipes.ts ingredients.ts prices.ts planner.ts admin.ts
│     └─ actions/  favorites.ts planner.ts profile.ts admin-recipes.ts admin-mappings.ts
├─ tests/e2e/                       # Playwright specs
├─ drizzle.config.ts  next.config.ts  vercel.json  components.json
├─ vitest.config.ts  playwright.config.ts  eslint.config.mjs  .prettierrc
├─ .env.example  CLAUDE.md  README.md  package.json
```

---

## STAGE 1: Project Bootstrap and Tooling

**Goal:** an empty app that runs, with strict TypeScript, linting, tests, UI kit and validated env.

1. `pnpm create next-app@latest mealtap --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`. Move the result into the repo root, or scaffold in place.
2. Set TS strict extras: `noUncheckedIndexedAccess`, `noImplicitOverride`.
3. Install the base dependencies:
   - Runtime: `drizzle-orm @neondatabase/serverless ai @ai-sdk/react zod @vercel/blob better-auth cheerio lucide-react @t3-oss/env-nextjs date-fns nanoid`
   - Dev: `drizzle-kit vitest @vitejs/plugin-react @testing-library/react jsdom @playwright/test tsx prettier prettier-plugin-tailwindcss dotenv`
4. `pnpm dlx shadcn@latest init`. Add `button card badge input select slider tabs dialog sheet dropdown-menu table form toast/sonner skeleton separator avatar checkbox command tooltip progress`.
5. Add the scripts `dev build start lint typecheck test test:e2e db:generate db:migrate db:studio seed:*` to `package.json`.
6. `src/env.ts` validates `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AI_GATEWAY_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VERCEL_APP_CLIENT_ID` / `VERCEL_APP_CLIENT_SECRET` (Sign in with Vercel), `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL`. Every key comes from Neon or Vercel, so no other vendors are needed. List them all in `.env.example`.
7. Theme placeholder: use the neutral shadcn tokens in `globals.css` (Tailwind v4 `@theme`), with light/dark switching through `next-themes`. The full MealTap visual identity, fonts and motion come in **Stage 7**, so don't polish visuals here.
8. Build the layout shell: `SiteHeader` (logo, nav, search, sign-in), `SiteFooter` (data source attributions: FNRI, DA), `MobileNav`.
9. `src/lib/format.ts`: `formatPHP()` via `Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'})`, plus `formatMinutes()` and `formatGrams()`, with tests.
10. Write `CLAUDE.md`, `README.md` and the `docs/` skeleton. Run `git init` and make the first commit.
11. GitHub Actions `ci.yml`: install → lint → typecheck → test (unit).

**Gate:** `pnpm dev` renders the shell at `/`. The lint, typecheck and test commands all pass, and the `format.ts` tests are green.

---

## STAGE 2: Database Architecture (NeonDB + Drizzle + pgvector)

**Goal:** a production-grade schema with migrations, extensions, indexes and relations.

### 2.1 Connection

- `src/db/index.ts`: export `db` built from `drizzle-orm/neon-http` (fast, single-statement) and `dbTx` built from `drizzle-orm/neon-serverless` Pool (needed for interactive transactions in the ETL and the planner).
- `drizzle.config.ts`: `schema: ./src/db/schema`, `out: ./drizzle`, `dialect: postgresql`, using `DATABASE_URL_UNPOOLED`.

### 2.2 Extensions migration (custom, first)

Create it with `drizzle-kit generate --custom --name=extensions`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 2.3 Enums (`enums.ts`)

- `ingredient_category`: vegetable, fruit, meat, poultry, seafood, egg_dairy, grain_starch, legume, condiment_sauce, oil_fat, spice_herb, other
- `price_source`: da_pricewatch, metromart, sm_markets, manual
- `recipe_status`: draft, pending_review, published, rejected
- `meal_type`: breakfast, lunch, dinner, merienda, dessert, drink
- `meal_slot`: breakfast, lunch, dinner, snack
- `etl_pipeline`: recipes, prices · `etl_status`: queued, running, succeeded, partial, failed
- `raw_doc_status`: pending, processed, failed, skipped
- `user_role`: user, admin

### 2.4 Tables (expanded from the initial plan)

| Table                                           | Key columns (beyond the initial spec)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Notes                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingredients`                                   | `id uuid pk`, `slug unique`, `name_en`, `name_local`, `aliases text[]`, `category`, `nutrient_source` (usda_sr_legacy / philfct / pending_philfct), `source_ref` (FDC ID or FNRI code), `fnri_code`, `calories_per_100g`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sodium_mg`, `edible_portion_pct` (default 100), `density_g_per_ml`, `embedding vector(1536)`, `created_at`, `updated_at`                                                                                                                                                                                                                          | Nutrient columns use `numeric(8,2)`. Indexes: GIN trigram on `name_en` and `name_local`, GIN on `aliases`, HNSW on `embedding` (`vector_cosine_ops`). |
| `ingredient_unit_conversions`                   | `ingredient_id` (nullable = generic), `unit` (e.g. `piece`, `clove`, `tali`, `cup`), `grams`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Unique `(ingredient_id, unit)`. Handles "1 tali kangkong" and "2 butil bawang".                                                                       |
| `ingredient_prices`                             | `id`, `ingredient_id fk`, `price numeric(10,2)`, `currency` (default `PHP`), `quantity numeric`, `unit`, `price_per_100g numeric(10,4)` (normalized), `source price_source`, `source_url`, `store`, `region` (default `NCR`), `raw_label`, `etl_run_id`, `recorded_at timestamptz`                                                                                                                                                                                                                                                                                                                                       | Time-series. Index `(ingredient_id, recorded_at desc)`. Unique `(ingredient_id, source, store, recorded_at::date)` so prices are deduped per day.     |
| `ingredient_latest_prices`                      | **Materialized view.** Per ingredient: median `price_per_100g` over the last 14 days (falling back to the latest price), `observed_at`, `sample_count`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Refreshed (`CONCURRENTLY`) at the end of the price ETL. Unique index on `ingredient_id`.                                                              |
| `recipes`                                       | `id uuid`, `slug unique`, `title`, `description`, `instructions jsonb` (`{order,text}[]`), `image_url`, `image_blob_path`, `prep_time_min`, `cook_time_min`, `servings`, `meal_type`, `tags text[]`, `region_origin`, `difficulty`, `source_id fk → recipe_sources`, `source_url unique`, `source_author`, `source_published_at`, `image_credit`, `status`, `calories_per_serving`, `protein_g_per_serving`, `carbs_g_per_serving`, `fat_g_per_serving`, `macros_complete bool`, `embedding vector(1536)`, `search_tsv tsvector` (generated from title + description + tags), `published_at`, `created_at`, `updated_at` | Indexes: GIN on `search_tsv`, HNSW on `embedding`, btree `(status, published_at desc)`.                                                               |
| `recipe_sources`                                | `id`, `name` (site/blog name), `base_url unique`, `default_author`, `permission_status` (not_requested / requested / granted / denied), `contact`, `notes`, `enabled bool`, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                 | This table is the scraping allowlist. Disabling a source stops ingestion. A takedown unpublishes all of that source's recipes.                        |
| `recipe_ingredients`                            | `id`, `recipe_id fk cascade`, `ingredient_id fk nullable`, `raw_text`, `amount numeric`, `unit`, `grams numeric` (normalized), `preparation` ("minced"), `is_optional`, `group_label` ("For the sauce"), `sort_order`, `match_confidence real`                                                                                                                                                                                                                                                                                                                                                                           | Uses a surrogate pk, because the same ingredient can appear twice. A null `ingredient_id` means unmatched, which feeds the mapping queue.             |
| `user` / `session` / `account` / `verification` | Generated by the Better Auth CLI. Adds a `role user_role` column to `user`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `auth.ts`                                                                                                                                             |
| `user_profiles`                                 | `user_id pk/fk`, `daily_calorie_target`, `protein_target_g`, `weekly_budget_php`, `household_size`, `allergies text[]`, `dislikes text[]`, `diet_tags text[]`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                                                       |
| `favorites`                                     | `user_id`, `recipe_id`, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Composite pk.                                                                                                                                         |
| `meal_plans`                                    | `id`, `user_id`, `name`, `week_start date`, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Unique `(user_id, week_start, name)`.                                                                                                                 |
| `meal_plan_entries`                             | `id`, `meal_plan_id fk cascade`, `date`, `slot meal_slot`, `recipe_id fk`, `servings numeric`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                                                       |
| `grocery_list_checks`                           | `meal_plan_id`, `ingredient_id`, `checked_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The list itself is derived. Only the checked state is stored.                                                                                         |
| `etl_runs`                                      | `id`, `pipeline`, `phase` (collect/process), `status`, `trigger` (cron/manual), `started_at`, `finished_at`, `stats jsonb`, `error text`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                                                       |
| `etl_raw_documents`                             | `id`, `pipeline`, `source`, `url`, `content_hash unique`, `content text` (or a `blob_path` for large items/PDFs), `status raw_doc_status`, `attempts`, `last_error`, `fetched_at`, `processed_at`                                                                                                                                                                                                                                                                                                                                                                                                                        | This is the idempotency backbone.                                                                                                                     |
| `ai_usage_log`                                  | `id`, `feature` (etl_recipe/etl_price/chat/embed), `model`, `input_tokens`, `output_tokens`, `cost_usd`, `created_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | For cost monitoring.                                                                                                                                  |

### 2.5 Relations

`relations.ts` defines these with `relations()`:

- ingredients ↔ prices, recipe_ingredients, conversions
- recipes ↔ recipe_ingredients
- user ↔ profile, favorites, meal_plans
- meal_plans ↔ entries ↔ recipes

### 2.6 Tasks

1. Write the schema files and the barrel `schema/index.ts`.
2. Run `pnpm db:generate`, then hand-append the materialized view SQL and HNSW/GIN index SQL where Drizzle can't express them. Keep this in a separate custom migration.
3. Create a Neon project with branches `main` (prod) and `dev`, then run `pnpm db:migrate` against `dev`.
4. Add `src/server/queries/_helpers.ts` with the shared `publishedRecipe` filter and pagination helpers.

**Gate:** migrations apply cleanly to a fresh Neon branch, and `db:studio` shows every table. A Vitest integration test (behind the `TEST_DATABASE_URL` env) inserts an ingredient, a price, a recipe and a recipe_ingredient, refreshes the view, and reads back the joined cost.

---

## STAGE 3: Reference Data and Core Domain Libraries

**Goal:** trustworthy nutrient and unit data, plus pure, tested calculation logic.

1. **Ingredient seed (already built, see [DATA_SOURCES.md](DATA_SOURCES.md)).** `data/ingredients.csv` has 142 Filipino staples: 135 with nutrients copied exactly from USDA FoodData Central SR Legacy (public domain), and 7 marked `pending_philfct`.
   - It's generated from the hand-curated `data/ingredient-map.csv` by `scripts/build-ingredients-from-usda.ts`.
   - `scripts/seed-ingredients.ts` upserts it into `ingredients` on `slug`.
   - **PhilFCT** replaces USDA values once FNRI grants data access (the owner is requesting it). Rows switch to `nutrient_source='philfct'` with the FNRI code in `source_ref`.
   - The agent must **not** fabricate values. Items with no source stay blank, and recipes using them show `macros_complete=false`.
2. **Unit conversions.**
   - `data/ingredient-portions.csv` already holds 399 real USDA household weights (e.g. 1 clove garlic = 3 g, 1 large egg = 50 g). Use these first.
   - `data/unit-conversions.csv` adds the generic units (tsp=5 ml, tbsp=15 ml, cup=240 ml, kg, lb, oz) and Filipino market units that USDA lacks (tali of kangkong, piraso of calamansi, bugkos). Every value that is an estimate is flagged `is_estimate=true` so admins can refine it.
3. **`lib/units`.** Write `parseQuantity("1 1/2")`, `normalizeUnit("tbsp."|"kutsara"|"T")`, and `toGrams({amount, unit, ingredient, conversions})`. For volume units the conversion goes volume → ml → density → grams. It returns `{grams, method, confidence}`. Taglish unit synonyms (kutsara, kutsarita, tasa, piraso, butil, tali, buo) are part of this.
4. **`lib/nutrition/macros.ts`.** `computeRecipeMacros(items, servings)` uses grams × edible% × per-100g values. It returns per-serving totals plus a `complete` flag (false if any non-optional item is unmatched or has no grams).
5. **`lib/pricing/cost.ts`.** `computeRecipeCost(items, latestPrices, servings)` returns `{total, perServing, missing: ingredientId[], oldestObservedAt}`. Items like salt or water that have no price can be excluded through a `PANTRY_STAPLES` list.
6. **`lib/matching/ingredient-matcher.ts`.** It tries four steps in order: exact slug/alias → `pg_trgm` similarity ≥ 0.45 → embedding cosine ≥ 0.82 → otherwise unmatched. It returns `{ingredientId|null, confidence, method}`. The thresholds live in config.
7. `scripts/seed-dev-recipes.ts` loads about 10 fixture recipes (marked as fixtures) so the UI can be built before the ETL exists.

**Gate:** units, macros, cost and matcher each have at least 90% line coverage, including Taglish edge cases ("2 kutsarang toyo", "1/2 kilo manok", "asin to taste"). The seed scripts run twice without creating duplicates.

---

## STAGE 4: AI Layer (Vercel AI Gateway)

**Goal:** one typed, reliable gateway into the LLMs and embedding models.

1. **`lib/ai/models.ts`:** the central model IDs, all called through the gateway with string model IDs:
   - `RECIPE_PARSER = 'anthropic/claude-sonnet-5-5'`: high-quality Taglish parsing
   - `PRICE_NORMALIZER = 'anthropic/claude-haiku-5-5'`, with a Groq model as a cheap fallback
   - `CHAT = 'anthropic/claude-sonnet-5-5'`
   - `EMBEDDING = 'openai/text-embedding-3-small'` (1536 dimensions, which must match `vector(1536)`)
   - Fallback order goes through the gateway `providerOptions` (`order` / `models`).
2. **`lib/ai/schemas/`:** Zod schemas that act as the contract.
   - `ParsedRecipeSchema` holds `title`, `description` (in your own words), `servings`, `prepTimeMin`, `cookTimeMin`, `mealType`, and `tags`. Each item in `ingredients[]` has `{rawText, nameEn, nameLocal?, amount|null, unit|null, preparation?, isOptional, groupLabel?}`. It also holds `steps[]` (rewritten concisely, not copied verbatim) and `language` (`en`/`tl`/`taglish`).
   - `NormalizedPriceSchema` holds `{ingredientGuess, quantity, unit, price, isPerPiece, confidence}`.
3. **`lib/ai/prompts/`:** versioned system prompts (`RECIPE_PARSER_V1`). They contain Filipino culinary context, a unit synonym table, and rules: never invent quantities (use null), translate to English but keep the local name, and convert "to taste" to `amount:null`.
4. **`lib/ai/gateway.ts`:**
   - `parseRecipe(rawText)` and `normalizePriceLabel(label)` wrap the AI SDK structured output (`generateObject` or `Output.object`, whichever the installed version uses) with Zod validation, one retry on schema failure, a timeout, and token usage written to `ai_usage_log`.
5. **`lib/ai/embed.ts`:**
   - `embedText` and `embedMany` call the AI SDK `embed`/`embedMany`.
   - The recipe embedding input is title + description + tags + ingredient names.
6. **`api/etl/recipes/route.ts`** (the original first task): an admin-only POST `{ url | rawText }` that runs the full single-recipe pipeline from Stage 5 synchronously and returns the parsed preview. It is useful for testing and for one-off manual imports.
7. Record about 5 real fixture Taglish recipe texts in `fixtures/recipes/`. Add tests that mock the model (AI SDK `MockLanguageModel`) to check the schema handling, plus an opt-in `pnpm test:ai-live` that hits the real gateway.

**Gate:** the mocked tests pass, and `test:ai-live` correctly parses all 5 fixtures into a valid schema. A manual review confirms the quantities aren't hallucinated.

---

## STAGE 5: Recipe ETL Pipeline

**Goal:** scheduled, idempotent, reviewable recipe ingestion.

1. **Source adapters** live in `lib/etl/recipes/sources/<site>.ts` and implement:
   ```ts
   interface RecipeSource {
     id: string;
     listUrls(since?: Date): Promise<string[]>;
     extract(
       html: string,
       url: string,
     ): {
       rawText: string;
       imageUrl?: string;
       title?: string;
       author?: string;
       publishedAt?: string;
       imageCredit?: string;
     };
   }
   ```
   - They should prefer JSON-LD `Recipe` blocks when a page has them, and fall back to Cheerio selectors.
   - Playwright is used only when a site truly needs JavaScript. Use `playwright-core` + `@sparticuz/chromium` on Vercel, or run that source from a GitHub Action instead.
2. **Compliance (`lib/etl/robots.ts`, `rate-limit.ts`):**
   - Honor robots.txt.
   - Limit to 1 request every 2–3 seconds per host, with an identifying User-Agent (generic app name plus site URL).
   - **Credit every recipe to its owner.** Each adapter extracts the attribution: the author from JSON-LD `author` or the byline/meta tags (falling back to `recipe_sources.default_author`), the site name, the original publish date, the canonical source URL, and the image credit. A recipe with no author or site cannot be published.
   - Rewrite instructions in our own words rather than republishing them verbatim. Ingredient lists and facts are kept, and the full original is always one click away.
   - The allowlist is the `recipe_sources` table, and only `enabled` sources are crawled. Ask blog owners for permission and track the answer in `permission_status`. A source owner who opts out has the source disabled and its recipes unpublished.
3. **One daily cron route, `/api/cron/recipes`** (Vercel Hobby allows one run per day per cron). It checks `CRON_SECRET`, runs collect, then spends the remaining time budget on process.
   - **Collect** (`collectRecipes()` in `lib/etl/recipes/pipeline.ts`) creates an `etl_runs` row, and lists new URLs per source. It fetches each page and upserts it into `etl_raw_documents`; the `content_hash` dedupe makes this idempotent. One run handles at most N pages.
4. **Process** (`processRecipes()`) claims up to N `pending` raw docs (`FOR UPDATE SKIP LOCKED` through `dbTx`) and runs them through `pipeline.ts`:
   1. `parseRecipe(rawText)`, using the Stage 4 gateway
   2. normalize each ingredient with `toGrams`
   3. match ingredients with the matcher, leaving unmatched ones as null `ingredient_id`
   4. images follow the source's `image_policy`: `link_only` (the default) stores only the original image URL and credit, and the page shows our own illustration with a "See photo on {site}" link. `rehost` (only once permission is granted) `put()`s it to Vercel Blob at `recipes/<slug>.webp`, resized to 1200w with `sharp`
   5. compute macros
   6. embed
   7. insert the recipe (with its attribution fields and `source_id`) and its ingredients in one transaction with `status='pending_review'`
   8. mark the raw doc `processed`, or record `failed` with `attempts++`
      Docs are retried up to 3 attempts.
5. Set `export const maxDuration` on the routes (within plan limits) and keep a time budget: stop claiming new docs when elapsed time passes 80% of the budget.
6. Update `etl_runs.stats` with `{fetched, processed, failed, unmatchedIngredients}`.

**Gate:**

- Fixture-based tests: the saved HTML for each source extracts correctly, and the pipeline runs end to end against the Neon `dev` branch with a mocked AI.
- Running collect twice does not create duplicate raw docs.
- A real manual run on 3 URLs produces 3 `pending_review` recipes with Blob images.

---

## STAGE 6: Pricing ETL Pipeline

**Goal:** weekly time-series prices normalized to PHP per 100 g.

1. **Sources, in order of priority:**
   - **DA Price Watch** (public, preferred). Parse the published daily/weekly price reports: PDF via `pdf-parse`, or HTML tables. They give commodity, unit (kg/piece/bundle) and prevailing price for NCR markets.
   - **E-grocers** (MetroMart, SM Markets): only if their ToS and robots allow it. Otherwise skip them, or contact them about a data partnership. The plan must not require them.
   - **Manual** admin entry (from Stage 11) as a backstop.
2. **Collect** runs daily as the first half of the single Hobby cron route `/api/cron/prices`. DA publishes daily prevailing prices, so a daily run fits the source. It stores raw reports or rows in `etl_raw_documents` (PDFs go to Blob, with the path stored in the row).
3. **Process** (same route, after collect, within the time budget), for each row:
   1. Parse price, quantity and unit deterministically first. Call `normalizePriceLabel` only when the label is ambiguous ("Tilapia, medium (5-6 pcs/kg)").
   2. Match the ingredient with the matcher.
   3. Compute `price_per_100g` with `lib/units` (piece-based units go through the conversion table).
   4. Insert into `ingredient_prices` (`ON CONFLICT DO NOTHING` on the daily-unique key).
4. **Anomaly guard** (`lib/pricing/anomalies.ts`): reject or flag a price when it is more than 3× or less than 0.33× the 30-day median for that ingredient. Flagged prices are stored with `flagged=true` (add this column) and are left out of the view.
5. At the end of the run: `REFRESH MATERIALIZED VIEW CONCURRENTLY ingredient_latest_prices`, then `revalidateTag('prices')`.

**Gate:** a fixture DA report parses into at least 90% matched rows, and the anomaly tests pass. After a run, a recipe's cost changes in a test that reads before and after the refresh.

---

## STAGE 7: UI/UX Design System, Motion and Filipino Visual Identity

**Goal:** define a distinct, Philippine-flavored look and one animation system before any real screen is built. Stages 8–12 then only put screens together from these pieces.

**Depends on:** Stage 1 only. It uses the Stage 3 fixture recipes for realistic previews, and it can run alongside Stages 2–6.

### 7.1 Design direction (`docs/DESIGN.md`)

1. **Brand idea:** _"Masustansya na, sakto pa sa budget."_ MealTap is about healthy Filipino home cooking that fits the household budget. The tone is warm, playful and Taglish-friendly, never preachy or "diet culture".
2. **Mood board:** described in DESIGN.md with notes, not copied images.
   - the colors of the palengke (wet market)
   - jeepney paint and signboards
   - banig weaving and capiz-shell windows
   - fiesta banderitas
   - sari-sari store price tags
   - bilao trays and palayok clay pots
3. **Cultural guardrails:**
   - All motifs are original, simplified SVGs.
   - No stereotypes or caricature.
   - No real brand's logos, typefaces or trade dress (no supermarket or jeepney-maker marks).
   - Visayas and Mindanao get as much space as Luzon in imagery and regional content.

### 7.2 Design tokens (`globals.css` `@theme`)

| Token               | Inspiration            | Use                                       |
| ------------------- | ---------------------- | ----------------------------------------- |
| `--color-pandan`    | pandan leaf green      | primary actions, "healthy" cues           |
| `--color-calamansi` | calamansi yellow-green | highlights, success states                |
| `--color-mangga`    | ripe mango yellow      | ₱ price tags, fiesta accents              |
| `--color-sili`      | siling labuyo red      | favorites, over-budget warnings           |
| `--color-ube`       | ube purple             | AI chat accents                           |
| `--color-palayok`   | terracotta clay        | secondary surfaces, illustrations         |
| `--color-niyog`     | coconut cream          | light background ("Umaga" theme)          |
| `--color-kape`      | brewed coffee brown    | dark background ("Gabi" theme), body text |

- **Colors** are defined in OKLCH, with a light theme ("Umaga") and a dark theme ("Gabi"). `scripts/check-contrast.ts` checks that every text/background pair meets WCAG AA.
- **Macro colors** (protein, carbs, fat) are fixed and color-blind-safe. Each macro also has its own icon and label, so color is never the only cue.
- **Type:**
  - Display font with character (e.g. `Bricolage Grotesque` or `Fraunces`).
  - Body font `Plus Jakarta Sans` (designed in Southeast Asia), loaded through `next/font` with the `latin-ext` subset so ñ renders correctly.
  - Tabular numbers for all prices and macros.
- **Other scales:** radius, spacing, soft "clay" shadows and z-index.

### 7.3 Filipino motif library (`components/brand/`)

- **Wordmark (no logo yet, per the owner):** "MealTap" set as text in the display font. The favicon and app icon are a simple "M" monogram generated with `app/icon.tsx`. A real logo can replace these later without code changes.
- **`BanigPattern`**: a tileable woven-mat SVG at low opacity (applied as a CSS mask). It's used for hero and section bands, and as the skeleton texture.
- **`CapizDivider`**: a capiz-lattice section divider with a soft shine as you scroll.
- **`BilaoFrame`**: a round woven-tray frame for featured recipe images and avatars.
- **`PresyoTag`**: the ₱ per-serving cost badge, styled as a hand-lettered sari-sari price tag with a slight tilt and a string hole.
- **`JeepneyStripe`**: a bold multicolor stripe accent for headers and the "Tipid Meals" collection, inspired by jeepney paint without copying any real jeepney.
- **`Banderitas`**: a fiesta bunting strip for celebrations and empty-state headers.
- **`PhRegionMap`**: an interactive SVG map of Luzon, Visayas and Mindanao with their regions. It filters recipes by `region_origin`.
- **Original SVG illustrations** (`public/illustrations/`, run through SVGO): palayok, kawali, rice cooker, bilao, a palengke tindera, and ingredient icons (calamansi, sili, bawang, sibuyas, kamatis, kangkong, malunggay, tilapia).
- **Empty and error states:**
  - "Wala pang laman ang plano mo" with a palayok illustration.
  - A 404 page, "Naligaw ka yata!", with a jeepney signboard that reads "404 – Wrong Route".

### 7.4 Microcopy (`lib/copy.ts`)

- One Taglish copy dictionary for the whole UI:
  - calls to action: "Kain na!", "Idagdag sa plano"
  - recurring labels: "Tipid tip", "Busog-lusog"
  - meal slots: Almusal / Tanghalian / Hapunan / Merienda
  - budget messages: "Pasok sa budget! 🎉" and "Lagpas ng ₱120 sa budget"
- English is the base language with Taglish flavor. The structure allows a full Filipino locale (`next-intl`) later without refactoring.
- Dates use PHT (`Asia/Manila`), and money is formatted as ₱ with `en-PH`.

### 7.5 Motion system

- **Libraries:**
  - `motion` (`motion/react`), loaded through `LazyMotion` + `domAnimation` to keep the bundle small.
  - Plain CSS transitions for simple hover and press states.
  - The View Transitions API (React `<ViewTransition>` / Next.js `viewTransition`, whichever the installed version supports) for page-to-page morphs.
- **`lib/motion.ts`** holds the motion tokens:
  - durations: fast 150 ms, base 250 ms, slow 400 ms
  - easing curves
  - spring presets `gentle` and `bouncy`
  - list stagger of 40 ms

**Signature animations** (primitives in `components/motion/`, used in Stages 8–12):

| Animation                | Where                          | Detail                                                                                                         |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Steaming palayok hero    | Landing                        | SVG steam paths loop. Ingredients (calamansi, sili, bawang) float in with scroll parallax.                     |
| Card → detail morph      | Recipe grid → detail           | Shared-element image transition, with a crossfade fallback.                                                    |
| Scroll reveal            | Card grids, sections           | Fade-up with stagger, played once.                                                                             |
| `NumberTicker`           | `PresyoTag`, macros            | ₱ and kcal count up or down when servings change.                                                              |
| `MacroRing`              | Nutrition panel, planner       | Ring segments draw one after another.                                                                          |
| Heart pop                | Favorite button                | A classic heart icon. It fills with a spring scale "pop" and a small ring burst, and unfavoriting reverses it. |
| `FiestaConfetti`         | Planner                        | Banderitas confetti when the week fits both budget and macro targets.                                          |
| Drag-and-drop            | Planner                        | dnd-kit plus motion layout animation, with a springy drop into the slot.                                       |
| Grocery check            | Grocery list                   | A hand-drawn strike-through draws across the item, which then slides into a "Nasa basket na" group.            |
| `SteamLoader`            | `loading.tsx`, chat "thinking" | A rice-cooker steam / sizzling kawali loader.                                                                  |
| Banig shimmer            | Skeletons                      | Woven-texture shimmer instead of flat gray.                                                                    |
| Jeepney signboard ticker | Landing                        | A marquee of live stats (recipe count, average ₱ per serving).                                                 |
| Map hover/tap            | `PhRegionMap`                  | The island lifts and fills with color, and a tooltip shows the recipe count.                                   |

**Motion rules:**

- Wrap the app in `MotionConfig reducedMotion="user"`. Every animation needs a reduced-motion version (a fade, or nothing). Parallax, confetti and looping steam turn off entirely.
- Animate only `transform` and `opacity`. Motion must never cause layout shift or block input.
- Design for mid-range Android phones on mobile data:
  - Lazy-load decorative animations with `next/dynamic` and `ssr: false`.
  - Skip them when `navigator.connection.saveData` is on.
  - Set a motion JS budget in DESIGN.md and check it with the bundle analyzer.
- No autoplaying sound. Avoid Lottie unless one hero illustration truly needs it, and use dotLottie if so.

### 7.6 Key screen designs

1. **Wireframes** go into DESIGN.md before any page code, and become prototypes in the styleguide. Screens: Landing, Browse, Recipe detail, Ingredient, Search, Chat, Favorites, Planner, Grocery list, Profile, Sign-in and Admin. Admin uses plain shadcn and favors density over decoration.
2. **Landing page sections:**
   1. Hero: the steaming palayok, the headline "Masustansyang ulam, sakto sa budget", and a search bar.
   2. Jeepney signboard stats ticker.
   3. "Tipid meals under ₱100" carousel.
   4. "Browse by region" map.
   5. "How it works", in three steps: _Hanap → Plano → Palengke_.
   6. Chat teaser.
   7. Footer with data-source credits.
3. **Mobile-first navigation:** most PH users browse on phones, so mobile gets a thumb-friendly bottom tab bar (Home · Hanap · Plano · Grocery · Ako). Desktop gets a top nav.

### 7.7 Living styleguide

- `app/(dev)/styleguide/page.tsx` returns `notFound()` in production. It shows:
  - the tokens and the type scale
  - every brand and motion component, in both themes
  - loading, empty and error states
  - a reduced-motion toggle
- Playwright `toHaveScreenshot` tests on the styleguide catch visual regressions.

**Gate:**

- The styleguide renders every component in both Umaga and Gabi, and its screenshot baselines are committed.
- The contrast script passes AA, and axe reports no issues on the styleguide or the landing page.
- With reduced motion emulated, no parallax, confetti or looping animation runs.
- Lighthouse mobile on the landing page: Performance at least 90 and CLS under 0.05. The Performance panel shows no long tasks over 50 ms caused by animation code.
- The owner approves the landing and recipe-detail designs before Stage 8 starts.

---

## STAGE 8: Public Recipe Experience (browse, detail, ingredient pages)

**Goal:** a fast, SEO-friendly public site that shows macros and live cost.

Build every screen from the Stage 7 components:

- `PresyoTag` and `NumberTicker` for cost
- `MacroRing` for nutrition
- `BilaoFrame` for featured images
- `Reveal` on grids
- the card → detail transition
- `SteamLoader` and the banig shimmer for loading states

1. **Query layer** (`server/queries/recipes.ts`):
   - `getRecipeBySlug(slug)` returns the recipe, its ingredients (joined with `ingredients` and `ingredient_latest_prices`) and the computed cost.
   - `listRecipes(filters, cursor)` uses keyset pagination and filters on meal type, max time, macros and max cost per serving. The cost filter uses a SQL CTE that sums `grams × price_per_100g / 100` per recipe.
   - Caching: wrap the queries in Next.js caching (`'use cache'` / `unstable_cache`, depending on version) with tags `recipes`, `recipe:<id>` and `prices`.
2. **`/recipes`:** a grid of `RecipeCard`s (image, title, time, kcal, protein, **₱ per serving** badge), plus `FilterSidebar` (shadcn sliders and selects, synced to URL search params) and a skeleton loading state.
3. **`/recipes/[slug]`:**
   - Hero image via `next/image` (Blob domain in `next.config.ts` `images.remotePatterns`).
   - A servings stepper (client component) that rescales amounts, macros and cost.
   - `NutritionPanel` (kcal, P/C/F with a bar or donut and % of the profile target when signed in).
   - `CostBadge` with a "prices as of {date} · source DA Price Watch" note, and "n ingredients without price" when that applies.
   - Ingredient list (local and English names), steps, and a favorite button.
   - A **credit card** near the top. It reads "Recipe by {author} · {site}", gives the original publish date, and has a prominent "View the original recipe" link (`rel="noopener"`, no `nofollow`, so the creator gets SEO credit). The image credit appears on the photo. Recipe cards also show "by {author}".
   - `generateStaticParams` for the top N recipes, ISR for the rest, and `generateMetadata`.
4. **`/ingredients/[slug]`:** nutrients per 100 g and a price history sparkline over 90 days (Recharts via the shadcn chart component).
5. **SEO:** schema.org `Recipe` JSON-LD (including `nutrition` and `recipeIngredient`, with `author` set to the original creator and `isBasedOn` pointing at the source URL), a `/credits` page listing every source, `sitemap.ts` (published recipes and ingredients), `robots.ts`, and dynamic OG images per recipe.
6. **Accessibility and mobile:** test at 360 px first, use semantic headings, put `aria` labels on badges, and meet AA color contrast.

**Gate:**

- The seeded fixture recipes render with correct macros and cost (spot-checked by hand against a calculation).
- Lighthouse on `/recipes/[slug]` scores at least 90 for Performance, Accessibility and SEO.
- The JSON-LD passes the Rich Results Test.

---

## STAGE 9: Authentication, Profiles and Favorites

**Goal:** secure sign-in, roles, and personalisation.

1. **Better Auth** with the Drizzle adapter (`lib/auth/auth.ts`):
   - **Sign in with Vercel** is the OAuth provider (owner's choice: simple, with no Google, Resend or other third-party keys).
     - Vercel is an OpenID Connect provider, so it's wired through Better Auth's generic OAuth/OIDC plugin.
     - Create the app in the Vercel dashboard to get the client ID and secret.
     - Check the current Vercel docs for the exact discovery URL and scopes.
   - **Email + password**, built into Better Auth with no external keys, is enabled alongside it. Only people who have a Vercel account can use Sign in with Vercel, and most home cooks don't.
     - Email verification and "forgot password" emails need an email sender, so they are deferred.
     - Until then, an admin can reset a user's password from `/admin` (Better Auth admin plugin).
   - Session cookies and the `admin` plugin (or a `role` column check).
   - Run the CLI to generate the auth tables, then a migration.
2. **`api/auth/[...all]/route.ts` handler, `auth-client.ts`, and `guards.ts`:**
   - `requireUser()` and `requireAdmin()` for server components and actions.
   - `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) does an optimistic redirect on `/favorites`, `/planner`, `/profile` and `/admin`. The real check still happens server-side.
3. **`/sign-in` page** and a user menu in the header.
4. **`/profile`:** a form (react-hook-form + zod) for calorie and protein targets, weekly budget, household size, allergies and dislikes, saved by an upsert in `actions/profile.ts`.
5. **Favorites:** `actions/favorites.ts` `toggleFavorite(recipeId)` with an optimistic UI (`useOptimistic`), and a `/favorites` grid.
6. Seed the first admin by email with `scripts/make-admin.ts <email>`.

**Gate:** e2e tests cover sign-in (email + password; the Sign in with Vercel flow is checked by hand once on a preview deployment), toggling a favorite, it persisting after reload, and a non-admin getting a 403/redirect on `/admin`.

---

## STAGE 10: Meal Planner and Grocery List

**Goal:** plan a week, see total macros and cost against goals, and get one consolidated shopping list.

1. **`/planner`:**
   - A week grid (7 days × 4 slots). Add a recipe through a `Command` search dialog or from the recipe page ("Add to plan"), and set servings per entry.
   - Entries can be dragged between slots (dnd-kit with the Stage 7 motion). `FiestaConfetti` plays when the week fits both budget and targets. Grocery items use the Stage 7 strike-through check animation.
   - Week navigation and multiple plans per week (e.g. "Tipid week").
2. **`lib/planner/aggregate.ts`:** daily and weekly totals for kcal, protein, carbs, fat and ₱. These are compared with the profile targets and budget, using progress bars and over/under indicators.
3. **`lib/planner/grocery.ts`:**
   - Merge every entry's `recipe_ingredients` scaled by servings, grouped by `ingredient_id`, summing grams.
   - Convert to shopper-friendly units (e.g. "≈ 1.2 kg" or "≈ 3 pcs") with `lib/units`.
   - Group by category and show estimated cost per line plus a total.
   - Unmatched raw items go in a separate "Other" group.
4. **`/planner/[planId]/grocery`:**
   - Checkbox list stored in `grocery_list_checks`.
   - "Copy as text" and print stylesheet.
   - Hide pantry staples with a toggle.
5. **Optional "Auto-fill my week"** button: calls the chat model with a tool (Stage 12) to propose a plan within budget and targets. The user confirms before it is saved.
6. Server actions: `addEntry`, `removeEntry`, `updateServings`, `createPlan`, `duplicatePlan`. Each one checks that the user owns the plan.

**Gate:**

- Unit tests for aggregation and grocery merging, including the same ingredient across recipes, servings scaling, and unit display.
- e2e: create a plan, add 3 recipes, see the totals, open the grocery list, check items, reload, and the state persists.

---

## STAGE 11: Admin Console

**Goal:** a human-in-the-loop quality control and operations area.

1. `admin/layout.tsx` with `requireAdmin()`, a sidebar, and a reusable `DataTable` (TanStack Table plus shadcn).
2. **Dashboard (`/admin`):**
   - Counts: pending recipes, unmatched ingredients, flagged prices, failed raw docs.
   - Recent ETL runs, and AI spend over 7 and 30 days from `ai_usage_log`.
3. **Recipe review (`/admin/recipes`, `/admin/recipes/[id]`):**
   - Queue filtered by status.
   - Editor with the raw source text on one side and the parsed fields (editable form) on the other.
   - Ingredient rows show the match confidence, with a combobox to remap.
   - "Recompute macros", "Regenerate embedding", "Re-parse with AI".
   - An attribution panel (author, site, source URL, publish date, image credit) that the admin can edit. **Publish stays disabled until the author and site are filled.**
   - **Publish** / **Reject**. Publishing sets `published_at`, recomputes the macros and calls `revalidateTag('recipes')`.
4. **Mappings (`/admin/mappings`):**
   - Distinct unmatched `raw_text` values with how often each occurs.
   - Map one to an existing ingredient (optionally adding the text as an alias, which re-resolves it everywhere), or create a new ingredient.
5. **Ingredients (`/admin/ingredients`):** edit nutrients, aliases, densities and unit conversions.
6. **Prices (`/admin/prices`):** a flagged-price queue (approve/reject) and a manual price entry form (`source=manual`).
7. **ETL (`/admin/etl`):**
   - Runs table with stats and errors.
   - Raw docs browser, with retry for failed ones.
   - "Run now" buttons that call the cron routes through a server action. The server action adds the secret on the server, so it never reaches the client. On Hobby this is also the way to work through a backlog between daily runs.
   - Sources tab (`/admin/sources`):
     - Manage `recipe_sources`: enable or disable a source, set its permission status and keep contact notes.
     - A one-click "Takedown", which disables the source and unpublishes all of its recipes.
8. Every admin mutation is a server action that calls `requireAdmin()`, validates with zod, and writes an audit field (`updated_by`).

**Gate:** e2e: an admin publishes a pending recipe → it appears on `/recipes`. Mapping an unmatched ingredient updates that recipe's `macros_complete`. A non-admin can't call the actions (direct POST test).

---

## STAGE 12: Search and AI Recipe Assistant

**Goal:** natural-language discovery ("high-protein ulam under ₱150 na walang baboy").

1. **`lib/search/hybrid.ts`:**
   - Full-text: `websearch_to_tsquery('simple', unaccent(q))` on `search_tsv`.
   - Vector: `embedding <=> queryEmbedding` through Drizzle `cosineDistance`, top 50.
   - Merge both with RRF (k=60), then apply the structured filters (cost, macros, time, meal type, exclusions) in SQL.
   - Cache query embeddings briefly (an in-memory LRU per instance is fine).
2. **`/search` page:** a search bar plus the filters from Stage 8 and the results grid.
3. **`/api/chat`** with AI SDK `streamText`, model `CHAT`, and tools:
   - `searchRecipes({query, maxCostPerServing?, minProtein?, maxCalories?, mealType?, exclude?[]})` calls `hybrid.ts`.
   - `getRecipe({slug})` returns a compact recipe with its macros and cost.
   - `getUserContext()` returns the profile targets and allergies when signed in.
   - `proposeMealPlan({days, budget})` returns a draft only. Saving it needs a user click, which calls a server action.
   - The system prompt sets a friendly Taglish-capable persona. It must answer only from tool results, always show ₱ and macros from the data, and never give medical advice beyond general nutrition.
   - Limit the conversation to a small `stopWhen` step count.
4. **`/chat` UI:**
   - `useChat` from `@ai-sdk/react`, streaming, with tool results rendered as `RecipeToolCard` (image, cost, macros, "Add to plan").
   - Suggested prompts.
5. **Guardrails:**
   - Rate limits per IP or user (Upstash Redis via the Vercel Marketplace, or a DB token bucket): for example 20 messages/hour for anonymous users and 100 for signed-in users.
   - Max input length and moderation of input length.
   - Token usage logged to `ai_usage_log`.
6. `scripts/backfill-embeddings.ts` covers any recipe or ingredient without an embedding.

**Gate:**

- Golden-query tests: 10 fixed queries return the expected recipe in the top 5 on a seeded DB.
- A chat e2e test with a mocked model streams and renders a tool card.
- Going over the rate limit returns 429.

---

## STAGE 13: Scheduling, Caching and Performance

1. **`vercel.json` crons, designed for the Vercel Hobby plan.** Hobby crons run at most once a day, fire somewhere within the scheduled hour, and are subject to the Hobby function-duration cap. Check the current limits at build time.
   - `/api/cron/prices` daily around 05:00 PHT. Cron times are UTC, so that is `0 21 * * *`.
   - `/api/cron/recipes` daily around 02:00 PHT (`0 18 * * *`).
   - Each run stops claiming new work at 80% of the time budget and leaves the rest for the next day. Keep batch sizes small (for example, 10 recipes per run).
   - **If the backlog grows:**
     - use the admin "Run now" button
     - or add a free GitHub Actions `schedule` workflow that calls the same routes with `CRON_SECRET` a few extra times a day
   - Note: Hobby is meant for personal, non-commercial projects. If MealTap is monetized, move to Pro. No code changes are needed, only cron frequency.
2. **All cron routes:**
   - Check `Authorization: Bearer ${CRON_SECRET}`.
   - Use `export const dynamic = 'force-dynamic'` and a `maxDuration` value.
   - Take a single-flight lock (`pg_try_advisory_lock`) so runs don't overlap.
3. **Cache tags:**
   - `recipes` (publish/reject)
   - `recipe:<id>` (edits)
   - `prices` (price refresh)
   - `user:<id>` (user-specific data, which is never cached across users)
4. **Performance:**
   - Image `sizes` attributes, Blob images pre-resized, `priority` on the hero image.
   - Route-level `loading.tsx`, and Suspense boundaries around the cost and nutrition panels.
   - Bundle check with `@next/bundle-analyzer`.
   - DB: run `EXPLAIN ANALYZE` on the list/cost query and the hybrid search. Add indexes where needed. Use Neon pooled connections for runtime.

**Gate:** a manual cron trigger with the wrong secret returns 401. Two overlapping triggers result in only one run. p95 server time for `/recipes` is under 300 ms on warm cache (from Vercel logs or local measurement).

---

## STAGE 14: Testing, Security and Quality Hardening

1. **Test pyramid:**
   - Vitest unit tests (domain libs, Stage 3)
   - integration tests (queries and actions against an ephemeral Neon branch created in CI via the Neon API/GitHub Action)
   - Playwright e2e (public browse, auth, favorites, planner, admin publish, chat with mocked AI)
2. **Security review checklist:**
   - Every server action and route checks auth and ownership (IDOR tests on `meal_plans`).
   - Every input is validated with zod.
   - No raw SQL string interpolation. Use Drizzle `sql` template parameters.
   - Secrets are server-only (`import 'server-only'` in `db`, `ai` and `blob` modules).
   - CSP and security headers in `next.config.ts` (`headers()`).
   - Blob uploads are only server-side, with content-type and size checks.
   - Prompt injection: scraped text goes in a delimited user message and is never treated as instructions. Tool outputs are data only. The chat model has no write tools without user confirmation.
   - `pnpm audit` and Dependabot.
3. **Data quality:**
   - A nightly report query: recipes with `macros_complete=false`, ingredients without a price in the last 30 days, and the AI failure rate.
   - These are shown on the admin dashboard.
4. **Accessibility:** run `@axe-core/playwright` on key pages, with zero serious violations.
5. Expand CI: lint → typecheck → unit → integration (Neon branch) → build → e2e (against `next start`) → delete the branch.

**Gate:** CI is green on a PR, axe is clean, and the security checklist is ticked in `docs/PROGRESS.md`.

---

## STAGE 15: Deployment to Production (Final Stage)

**Goal:** a reproducible, observable production launch on Vercel.

1. **Vercel project:** import the GitHub repo, use the Next.js framework preset, and set the production branch to `main`.
2. **Integrations (Vercel Marketplace / Storage):**
   - **Neon**: connect the integration so it injects `DATABASE_URL`/`DATABASE_URL_UNPOOLED` and creates **a Neon branch per Preview deployment**.
   - **Vercel Blob**: create the store, which sets `BLOB_READ_WRITE_TOKEN`.
   - **AI Gateway**: create the API key (`AI_GATEWAY_API_KEY`), set spend limits and alerts, and configure provider fallbacks.
   - **Upstash Redis** (rate limiting) if it was chosen in Stage 12.
3. **Environment variables:** set every key from `src/env.ts` for Production and Preview. Use a separate `CRON_SECRET` and `BETTER_AUTH_SECRET` per environment. Register the Sign in with Vercel callback URL (the path Better Auth's OAuth plugin exposes, e.g. `/api/auth/oauth2/callback/vercel`) for the production domain and a stable preview alias.
4. **Migrations strategy:** a GitHub Action on push to `main` runs `pnpm db:migrate` against the prod Neon branch **before** Vercel promotes the deployment (or as a `vercel-build` step, `drizzle-kit migrate && next build`). Migrations must be backward-compatible (expand → migrate → contract).
5. **Initial production data:**
   1. Run `seed-ingredients` and `seed-unit-conversions` against prod.
   2. `make-admin` for the owner.
   3. Trigger the price ETL manually, then refresh the view.
   4. Trigger the recipe ETL on the allowlisted sources.
   5. Review and publish the first batch of about 30 recipes in `/admin` before announcing.
6. **Domain and SEO:** add the custom domain and HTTPS, set `NEXT_PUBLIC_SITE_URL`, submit `sitemap.xml` to Google Search Console, and verify the OG previews.
7. **Observability:**
   - Vercel Analytics and Speed Insights.
   - Log drains or Vercel Observability for cron and route errors.
   - Optional Sentry (`@sentry/nextjs`) for exceptions.
   - Alerting: an ETL run `failed` sends an email or webhook (from the cron route's catch block). AI spend crosses a threshold.
8. **Crons:** confirm they are listed under Project → Cron Jobs and watch the first scheduled runs.
9. **Backups and recovery:** set the Neon PITR retention window. Document in `docs/RUNBOOK.md` how to restore, roll back a deployment (Vercel instant rollback), rotate secrets, re-run ETL, and disable a misbehaving scraper source (config flag).
10. **Launch checklist:**
    - Legal pages: Privacy Policy (Data Privacy Act of 2012 / RA 10173) and Terms.
    - Attributions for FNRI and DA in the footer. Every published recipe passes an attribution check (a SQL query finds 0 published recipes missing author, site or source URL). The `/credits` page is live with a contact and takedown email.
    - A disclaimer that nutrition and cost are estimates.
    - Cookie notice if analytics needs one.
    - 404/500 pages checked, mobile QA on real devices, Lighthouse run on prod.

**Final gate (definition of done):**

- The production URL serves published recipes with macros and ₱ cost.
- A user can sign in, favorite a recipe, build a weekly plan and get a grocery list.
- An admin can review, publish and remap.
- The chat answers a budget/macro query with real recipes.
- Both crons have run successfully at least once in prod.
- CI is green, the runbook is written and `PROGRESS.md` is complete.

---

## Appendix A: Stage Dependency Map

```
1 Bootstrap → 2 DB → 3 Domain libs → 4 AI layer → 5 Recipe ETL ─┐
     │                             └────────────→ 6 Price ETL ──┤
     └──→ 7 UI Design System ──┐                                │
                 3 (fixtures) ─┴→ 8 Public UI ◄─────────────────┘
                                   8 → 9 Auth → 10 Planner
                                   9 → 11 Admin (needs 5, 6)
                                   4 + 8 → 12 Search & Chat
                 all → 13 Scheduling/Perf → 14 Hardening → 15 Deploy
```

- Stage 7 (design) needs only Stage 1, so it can run alongside Stages 2–6.
- Stage 8 starts once Stages 3 and 7 are done. It uses the fixture recipes, so it doesn't wait for the ETL stages.

## Appendix B: Owner Decisions and Remaining Inputs

**Decided:**

- **Auth:** Sign in with Vercel, with no third-party API keys. Email + password is added so users without a Vercel account can still sign up (Stage 9).
- **Attribution:** every recipe credits its original author and site, with a link back. Publishing is blocked without credit, and there's a `/credits` page and a takedown flow (Stages 2, 5, 8, 11, 15).
- **Hosting:** Vercel Hobby plan, with two daily crons and time-budgeted batches (Stage 13).
- **Visual direction:** the Stage 7 palette, fonts and motifs are approved. There is no logo yet, so the brand uses a text wordmark and a monogram favicon.

**Still needed:**

1. **PhilFCT access.** Email philfct@fnri.dost.gov.ph to ask for the dataset and permission to display it (commercial use needs FNRI approval). Until then, the USDA interim data is used.
2. **Permission emails** to the 6 enabled recipe sources in `data/recipe-sources.json`. The list itself is done.
3. A Vercel "Sign in with Vercel" app (client ID and secret), needed by Stage 9, and optionally a custom domain.

**Resolved since planning:**

- Ingredient seed data: built from USDA SR Legacy (`data/ingredients.csv`).
- Recipe source allowlist: `data/recipe-sources.json` (6 enabled, 4 to check, 4 disabled because they block AI crawlers).
- Recipe photos are link-only unless a source grants permission.
- Repo: https://github.com/StewP8-2-1/MealTap-PH. Vercel project `mealtap-ph`.

## Verification Summary

Every stage ends with its own gate. The overall check is the Stage 15 definition of done, run against production:

- Design: the styleguide screenshot tests pass, reduced motion is respected, and the landing page hits the Lighthouse mobile scores.
- Build: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
- Data: a manual cron trigger shows the ETL writing to the DB.
- Admin: a pending recipe goes from pending to published.
- User: a full user journey from sign-in to grocery list.
- AI: a chat query returns grounded recipe cards.
