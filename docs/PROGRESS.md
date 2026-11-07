# MealTap: Build Progress

Tick a stage only after its verification gate in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) passes. Every stage also requires `pnpm lint && pnpm typecheck && pnpm test` to be green and a commit `feat(stage-N): …`.

| #   | Stage                                                    | Status        | Gate passed | Notes                             |
| --- | -------------------------------------------------------- | ------------- | ----------- | --------------------------------- |
| 1   | Project Bootstrap and Tooling                            | ✅ Done       | 2026-11-07  | Next 16.4.5, shadcn (Base UI), CI |
| 2   | Database Architecture (NeonDB + Drizzle + pgvector)      | ☐ Not started |             |                                   |
| 3   | Reference Data and Core Domain Libraries                 | ☐ Not started |             | Seed data ready (USDA interim)    |
| 4   | AI Layer (Vercel AI Gateway)                             | ☐ Not started |             |                                   |
| 5   | Recipe ETL Pipeline                                      | ☐ Not started |             | Source list ready (6 enabled)     |
| 6   | Pricing ETL Pipeline                                     | ☐ Not started |             | DA Price Watch only by default    |
| 7   | UI/UX Design System, Motion and Filipino Visual Identity | ☐ Not started |             | Direction approved, no logo yet   |
| 8   | Public Recipe Experience                                 | ☐ Not started |             |                                   |
| 9   | Authentication, Profiles and Favorites                   | ☐ Not started |             | Needs Sign in with Vercel app     |
| 10  | Meal Planner and Grocery List                            | ☐ Not started |             |                                   |
| 11  | Admin Console                                            | ☐ Not started |             |                                   |
| 12  | Search and AI Recipe Assistant                           | ☐ Not started |             |                                   |
| 13  | Scheduling, Caching and Performance                      | ☐ Not started |             | Hobby plan: daily crons           |
| 14  | Testing, Security and Quality Hardening                  | ☐ Not started |             |                                   |
| 15  | Deployment to Production                                 | ☐ Not started |             |                                   |

## Security checklist (Stage 14)

- [ ] Auth and ownership checks on every server action and route (IDOR tests)
- [ ] Zod validation on all inputs
- [ ] No raw SQL interpolation
- [ ] `server-only` on db, ai and blob modules
- [ ] CSP and security headers
- [ ] Server-side-only Blob uploads with type and size checks
- [ ] Prompt-injection guards on scraped text and chat tools
- [ ] `pnpm audit` clean and Dependabot enabled

## Launch checklist (Stage 15)

- [ ] 0 published recipes missing author, site or source URL
- [ ] `/credits` page live with a takedown contact
- [ ] Privacy Policy (RA 10173) and Terms
- [ ] Disclaimer that nutrition and cost are estimates
- [ ] Both daily crons ran successfully in production
