import { describe, expect, it } from "vitest";

import { isActivePath } from "./nav";

describe("isActivePath", () => {
  it("matches home only on the exact root path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/recipes", "/")).toBe(false);
  });

  it("matches a section and its child pages", () => {
    expect(isActivePath("/recipes", "/recipes")).toBe(true);
    expect(isActivePath("/recipes/sinigang-na-baboy", "/recipes")).toBe(true);
  });

  it("does not match paths that only share a prefix", () => {
    expect(isActivePath("/recipes-old", "/recipes")).toBe(false);
  });
});
