/**
 * Turns the curated Filipino ingredient map (data/ingredient-map.csv) plus
 * USDA FoodData Central SR Legacy CSVs into the ingredient seed files.
 *
 * Nutrient values are copied from USDA exactly. Nothing is estimated. Rows
 * without a USDA match keep empty nutrients and `pending_philfct` as their
 * source, so they're easy to fill in from PhilFCT later.
 */
import { parse } from "csv-parse/sync";
import { z } from "zod";

export const INGREDIENT_CATEGORIES = [
  "vegetable",
  "fruit",
  "meat",
  "poultry",
  "seafood",
  "egg_dairy",
  "grain_starch",
  "legume",
  "condiment_sauce",
  "oil_fat",
  "spice_herb",
  "other",
] as const;

/** USDA FDC nutrient ids, all per 100 g of food. */
export const NUTRIENT_IDS = {
  calories_kcal: 1008,
  protein_g: 1003,
  carbs_g: 1005,
  fat_g: 1004,
  fiber_g: 1079,
  sugars_g: 2000,
  sodium_mg: 1093,
} as const;

export type NutrientKey = keyof typeof NUTRIENT_IDS;

const mapRowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be kebab-case"),
  name_en: z.string().min(1),
  name_local: z.string().min(1),
  aliases: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split("|")
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean),
    ),
  category: z.enum(INGREDIENT_CATEGORIES),
  usda_fdc_id: z
    .string()
    .regex(/^\d*$/, "usda_fdc_id must be digits or empty")
    .transform((value) => (value === "" ? null : value)),
  notes: z.string().default(""),
});

export type IngredientMapRow = z.infer<typeof mapRowSchema>;

/** Parses and validates the curated map. Throws on bad rows or duplicates. */
export function parseIngredientMap(csvText: string): IngredientMapRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows = records.map((record, index) => {
    const result = mapRowSchema.safeParse(record);
    if (!result.success) {
      throw new Error(
        `ingredient-map.csv row ${index + 2}: ${z.prettifyError(result.error)}`,
      );
    }
    return result.data;
  });

  assertUnique(
    rows.map((row) => row.slug),
    "slug",
  );
  // An alias that points at two ingredients would make matching ambiguous.
  assertUnique(
    rows.flatMap((row) => row.aliases),
    "alias",
  );
  return rows;
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size > 0) {
    throw new Error(`Duplicate ${label}(s): ${[...duplicates].join(", ")}`);
  }
}

export type NutrientTable = Map<string, Map<number, number>>;

export type IngredientSeedRow = {
  slug: string;
  name_en: string;
  name_local: string;
  aliases: string;
  category: string;
  nutrient_source: "usda_sr_legacy" | "pending_philfct";
  source_ref: string;
  source_description: string;
  notes: string;
} & Record<NutrientKey, number | "">;

export function buildIngredientRows(
  map: IngredientMapRow[],
  descriptions: Map<string, string>,
  nutrients: NutrientTable,
): IngredientSeedRow[] {
  return map.map((row) => {
    const base = {
      slug: row.slug,
      name_en: row.name_en,
      name_local: row.name_local,
      aliases: row.aliases.join("|"),
      category: row.category,
      notes: row.notes,
    };

    if (row.usda_fdc_id === null) {
      return {
        ...base,
        nutrient_source: "pending_philfct" as const,
        source_ref: "",
        source_description: "",
        ...emptyNutrients(),
      };
    }

    const description = descriptions.get(row.usda_fdc_id);
    if (!description) {
      throw new Error(
        `${row.slug}: FDC id ${row.usda_fdc_id} is not in the USDA food table`,
      );
    }
    const values = nutrients.get(row.usda_fdc_id) ?? new Map<number, number>();
    if (!values.has(NUTRIENT_IDS.calories_kcal)) {
      throw new Error(
        `${row.slug}: FDC id ${row.usda_fdc_id} has no energy value`,
      );
    }

    const nutrientValues = Object.fromEntries(
      (Object.entries(NUTRIENT_IDS) as [NutrientKey, number][]).map(
        ([key, id]) => [key, values.get(id) ?? ""],
      ),
    ) as Record<NutrientKey, number | "">;

    return {
      ...base,
      nutrient_source: "usda_sr_legacy" as const,
      source_ref: row.usda_fdc_id,
      source_description: description,
      ...nutrientValues,
    };
  });
}

function emptyNutrients(): Record<NutrientKey, ""> {
  return Object.fromEntries(
    Object.keys(NUTRIENT_IDS).map((key) => [key, ""]),
  ) as Record<NutrientKey, "">;
}

export type UsdaPortion = {
  fdcId: string;
  amount: number;
  /** USDA "modifier" or portion description, e.g. "clove", "cup, chopped". */
  unitText: string;
  gramWeight: number;
};

export type PortionSeedRow = {
  slug: string;
  amount: number;
  unit_text: string;
  gram_weight: number;
  grams_per_unit: number;
  source_ref: string;
};

/** Real USDA household-measure weights for each mapped ingredient. */
export function buildPortionRows(
  map: IngredientMapRow[],
  portions: UsdaPortion[],
): PortionSeedRow[] {
  const slugByFdcId = new Map(
    map
      .filter((row) => row.usda_fdc_id !== null)
      .map((row) => [row.usda_fdc_id as string, row.slug]),
  );

  return portions
    .filter((portion) => slugByFdcId.has(portion.fdcId))
    .filter((portion) => portion.amount > 0 && portion.gramWeight > 0)
    .map((portion) => ({
      slug: slugByFdcId.get(portion.fdcId) as string,
      amount: portion.amount,
      unit_text: portion.unitText,
      gram_weight: portion.gramWeight,
      grams_per_unit: Number((portion.gramWeight / portion.amount).toFixed(2)),
      source_ref: portion.fdcId,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
