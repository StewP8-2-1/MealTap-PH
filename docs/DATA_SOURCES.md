# Data Sources

MealTap never invents nutrition values, prices or recipes. This page lists where each kind of data comes from, its license or terms, and how to update it.

## 1. Nutrition (food composition)

### Target source: DOST-FNRI PhilFCT

The Philippine Food Composition Tables (PhilFCT) are the best source for Filipino foods (about 1,500 items).

- They are published online at https://i.fnri.dost.gov.ph/fct/library. Access needs a free i.FNRI account (register, then go to iServe → PhilFCT).
- There is **no bulk download**. To get a dataset for app use, email **philfct@fnri.dost.gov.ph** and ask for the data and permission to display it with attribution.
- License: works of the Philippine government aren't copyrighted (IP Code, Sec. 176), but **commercial use needs the agency's prior approval**. Ask before launch.

### Interim source: USDA FoodData Central, SR Legacy (in use now)

- Public domain (CC0). Cite as: _U.S. Department of Agriculture, Agricultural Research Service. FoodData Central: SR Legacy, 2018._ https://fdc.nal.usda.gov
- `data/ingredient-map.csv` is curated by hand. It holds about 140 Filipino staples with Tagalog names, aliases, category and the matching USDA food ID. It holds **no** nutrient numbers. The notes column flags close matches, such as saba → plantain or tahong → blue mussel.
- `scripts/build-ingredients-from-usda.ts` copies the USDA values exactly into:
  - `data/ingredients.csv`: per 100 g, kcal, protein, carbs, fat, fiber, sugars and sodium, with `nutrient_source` and `source_ref` (the FDC ID).
  - `data/ingredient-portions.csv`: real USDA household weights, such as 1 clove garlic = 3 g or 1 large egg = 50 g. Stage 3's unit conversions use these.
- **7 items have no USDA equivalent:** kangkong, calamansi, galunggong, banana ketchup, bagoong alamang, atsuete and tausi. They are marked `pending_philfct` with blank nutrients, and are not filled with lookalikes.

Rebuild:

```bash
# download + unzip https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
pnpm tsx scripts/build-ingredients-from-usda.ts <unzipped-folder>
```

When PhilFCT data arrives, PhilFCT values replace USDA values for the same ingredient. `nutrient_source` records which source each row uses.

## 2. Prices

- **DA Bantay Presyo / Price Watch** (Department of Agriculture): daily prevailing retail prices in NCR markets. These are public government reports. Credit: _Department of Agriculture, Philippines_.
- E-grocers (MetroMart, SM Markets) are **not used** unless their terms allow it.

## 3. Recipes

`data/recipe-sources.json` seeds the `recipe_sources` table, which is the scraping allowlist. robots.txt for every site was checked on **2026-11-07**.

| Status                                                    | Sites                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Enabled** (open robots.txt, structured recipe data)     | Panlasang Pinoy, Kawaling Pinoy, Foxy Folksy, Ang Sarap, Manila Spoon, Recipes by Nora |
| **Check first** (no recipe markup found on the home page) | Riverten Kitchen, Overseas Pinoy Cooking, Lutong Bahay Recipe, Pinoy Cooking Recipes   |
| **Disabled: owner blocks AI crawlers**                    | Yummy.ph, Salu Salo, Mama's Guide Recipes, The Peach Kitchen                           |

Rules (enforced in Stage 5 and the admin console):

1. **Credit every recipe:** author (taken from the page's JSON-LD, never guessed), site name, publish date and a followed link to the original. A recipe can't be published without them.
2. **Store facts, not the original prose:** ingredients, amounts, times and servings, plus steps rewritten in our own words.
3. **Photos are link-only by default.** We don't copy a blog's photos without permission. A source's `image_policy` changes to `rehost` only when its `permission_status` is `granted`.
4. **Respect opt-outs:** sites that block AI crawlers stay disabled unless the owner gives written permission. A takedown request disables the source and unpublishes its recipes.
5. **Ask permission:** a permissive robots.txt isn't a license. Email each enabled source and record the reply in `permission_status`.
