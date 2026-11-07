/**
 * Builds data/ingredients.csv and data/ingredient-portions.csv from the curated
 * map plus the USDA FoodData Central SR Legacy CSV export (public domain, CC0).
 *
 * 1. Download and unzip
 *    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 * 2. pnpm tsx scripts/build-ingredients-from-usda.ts <path-to-unzipped-folder>
 */
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";

import {
  buildIngredientRows,
  buildPortionRows,
  NUTRIENT_IDS,
  parseIngredientMap,
  type NutrientTable,
  type UsdaPortion,
} from "./lib/usda-ingredients";

const DATA_DIR = path.resolve(__dirname, "..", "data");

async function* readCsv(file: string): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(file).pipe(
    parse({ columns: true, skip_empty_lines: true }),
  );
  for await (const record of parser) yield record as Record<string, string>;
}

async function main() {
  const usdaDir = process.argv[2];
  if (!usdaDir) {
    console.error(
      "Usage: pnpm tsx scripts/build-ingredients-from-usda.ts <usda-sr-legacy-folder>",
    );
    process.exit(1);
  }

  const map = parseIngredientMap(
    await readFile(path.join(DATA_DIR, "ingredient-map.csv"), "utf8"),
  );
  const wanted = new Set(
    map.flatMap((row) => (row.usda_fdc_id ? [row.usda_fdc_id] : [])),
  );
  const wantedNutrients = new Set<number>(Object.values(NUTRIENT_IDS));

  const descriptions = new Map<string, string>();
  for await (const food of readCsv(path.join(usdaDir, "food.csv"))) {
    const id = food.fdc_id;
    if (id && wanted.has(id)) descriptions.set(id, food.description ?? "");
  }

  const nutrients: NutrientTable = new Map();
  for await (const row of readCsv(path.join(usdaDir, "food_nutrient.csv"))) {
    const id = row.fdc_id;
    const nutrientId = Number(row.nutrient_id);
    if (!id || !wanted.has(id) || !wantedNutrients.has(nutrientId)) continue;
    const perFood = nutrients.get(id) ?? new Map<number, number>();
    perFood.set(nutrientId, Number(row.amount));
    nutrients.set(id, perFood);
  }

  const portions: UsdaPortion[] = [];
  for await (const row of readCsv(path.join(usdaDir, "food_portion.csv"))) {
    const id = row.fdc_id;
    if (!id || !wanted.has(id)) continue;
    portions.push({
      fdcId: id,
      amount: Number(row.amount),
      unitText: (row.modifier || row.portion_description || "").trim(),
      gramWeight: Number(row.gram_weight),
    });
  }

  const ingredientRows = buildIngredientRows(map, descriptions, nutrients);
  const portionRows = buildPortionRows(map, portions);

  await writeFile(
    path.join(DATA_DIR, "ingredients.csv"),
    stringify(ingredientRows, { header: true }),
  );
  await writeFile(
    path.join(DATA_DIR, "ingredient-portions.csv"),
    stringify(portionRows, { header: true }),
  );

  const pending = ingredientRows.filter(
    (row) => row.nutrient_source === "pending_philfct",
  );
  console.log(
    `ingredients.csv: ${ingredientRows.length} rows (${ingredientRows.length - pending.length} from USDA, ${pending.length} pending PhilFCT: ${pending.map((row) => row.slug).join(", ")})`,
  );
  console.log(`ingredient-portions.csv: ${portionRows.length} rows`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
