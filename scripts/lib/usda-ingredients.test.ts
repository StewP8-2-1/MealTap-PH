import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildIngredientRows,
  buildPortionRows,
  NUTRIENT_IDS,
  parseIngredientMap,
} from "./usda-ingredients";

const HEADER = "slug,name_en,name_local,aliases,category,usda_fdc_id,notes";

describe("parseIngredientMap", () => {
  it("parses aliases into a lowercase list and empty ids into null", () => {
    const rows = parseIngredientMap(
      `${HEADER}\nbawang,Garlic,Bawang,Bawang|Garlic,spice_herb,169230,\nkangkong,Water spinach,Kangkong,kangkong,vegetable,,Needs PhilFCT`,
    );
    expect(rows[0]?.aliases).toEqual(["bawang", "garlic"]);
    expect(rows[0]?.usda_fdc_id).toBe("169230");
    expect(rows[1]?.usda_fdc_id).toBeNull();
  });

  it("rejects an unknown category", () => {
    expect(() => parseIngredientMap(`${HEADER}\nx,X,X,x,snack,1,`)).toThrow(
      /row 2/,
    );
  });

  it("rejects an alias used by two ingredients", () => {
    expect(() =>
      parseIngredientMap(
        `${HEADER}\na,A,A,shared,vegetable,1,\nb,B,B,shared,vegetable,2,`,
      ),
    ).toThrow(/Duplicate alias/);
  });

  it("accepts the real curated map in data/", () => {
    const csv = readFileSync(
      path.resolve(__dirname, "../../data/ingredient-map.csv"),
      "utf8",
    );
    const rows = parseIngredientMap(csv);
    expect(rows.length).toBeGreaterThan(100);
  });
});

describe("buildIngredientRows", () => {
  const map = parseIngredientMap(
    `${HEADER}\nbawang,Garlic,Bawang,bawang,spice_herb,169230,\nkangkong,Water spinach,Kangkong,kangkong,vegetable,,`,
  );

  it("copies USDA values exactly and leaves missing nutrients blank", () => {
    const nutrients = new Map([
      [
        "169230",
        new Map([
          [NUTRIENT_IDS.calories_kcal, 149],
          [NUTRIENT_IDS.protein_g, 6.36],
        ]),
      ],
    ]);
    const [garlic, kangkong] = buildIngredientRows(
      map,
      new Map([["169230", "Garlic, raw"]]),
      nutrients,
    );

    expect(garlic).toMatchObject({
      nutrient_source: "usda_sr_legacy",
      source_ref: "169230",
      source_description: "Garlic, raw",
      calories_kcal: 149,
      protein_g: 6.36,
      fiber_g: "",
    });
    expect(kangkong).toMatchObject({
      nutrient_source: "pending_philfct",
      calories_kcal: "",
    });
  });

  it("fails loudly when an FDC id is not in the USDA data", () => {
    expect(() => buildIngredientRows(map, new Map(), new Map())).toThrow(
      /169230/,
    );
  });
});

describe("buildPortionRows", () => {
  it("keeps portions for mapped foods and computes grams per unit", () => {
    const map = parseIngredientMap(
      `${HEADER}\nbawang,Garlic,Bawang,bawang,spice_herb,169230,`,
    );
    const rows = buildPortionRows(map, [
      { fdcId: "169230", amount: 3, unitText: "cloves", gramWeight: 9 },
      { fdcId: "999999", amount: 1, unitText: "cup", gramWeight: 100 },
      { fdcId: "169230", amount: 0, unitText: "bad", gramWeight: 5 },
    ]);
    expect(rows).toEqual([
      {
        slug: "bawang",
        amount: 3,
        unit_text: "cloves",
        gram_weight: 9,
        grams_per_unit: 3,
        source_ref: "169230",
      },
    ]);
  });
});
