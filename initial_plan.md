Act as an expert Full Stack Next.js Engineer and Database Architect.

I am building "CleanEats PH", a Philippine-focused healthy recipe web application. The app helps users discover local healthy recipes, tracks nutritional macros using Philippine food data, and calculates real-time estimated meal costs based on scraped local grocery prices.

### 1. Tech Stack

- **Framework:** Next.js (App Router), React, TypeScript.
- **Styling & UI:** Tailwind CSS, shadcn/ui, Lucide Icons.
- **Database:** NeonDB (Serverless PostgreSQL) with Drizzle ORM. Use `pgvector` for semantic recipe/ingredient search.
- **Object Storage:** Vercel Blob (for scraped/uploaded recipe and ingredient images).
- **AI & Processing:** Vercel AI Gateway routing to Groq/Claude.
- **ETL Pipeline:** Vercel Cron Jobs triggering Next.js API routes that use Cheerio/Playwright for web scraping.

### 2. Core Architecture & ETL Process

- **Recipe Pipeline:** Scrape local recipe blogs -> Pass raw Taglish text through Vercel AI Gateway with a strict JSON schema prompt -> Standardize ingredients, amounts, and macros -> Upload images to Vercel Blob -> Save to NeonDB.
- **Pricing Pipeline:** Scrape local e-groceries (MetroMart, SM) or DA Price Watch weekly -> Pass through AI Gateway to normalize prices to a standard base unit (e.g., PHP per 100g) -> Insert as time-series data in NeonDB.
- **Client Rendering:** Fetch recipes with Drizzle, joining the latest ingredient prices to dynamically calculate and display the total cost of the meal alongside its macros.

### 3. Database Schema Requirements

Design a relational schema in Drizzle ORM with the following structure:

- `ingredients`: id, name_en, name_local, fnri_calories_per_100g, protein, carbs, fats.
- `ingredient_prices`: id, ingredient_id, price, currency (PHP), unit (e.g., 100g), source, recorded_at (timestamp).
- `recipes`: id, title, description, instructions (JSON/Array), image_url, prep_time, cook_time.
- `recipe_ingredients`: recipe_id, ingredient_id, amount, unit.

### 4. Your First Task

Please initialize the project by completing these steps:

1. Generate the exact Next.js folder structure for this architecture.
2. Write the complete Drizzle ORM `schema.ts` file implementing the tables mentioned above, including the necessary relations.
3. Write a sample Next.js API route (`app/api/etl/recipes/route.ts`) demonstrating how to use Vercel AI Gateway with the `@ai-sdk/openai` or `@ai-sdk/anthropic` package to enforce a structured JSON response for standardizing a messy Taglish recipe.

Do not write explanations, just provide the file structures and code.
