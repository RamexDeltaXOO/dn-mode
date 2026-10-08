import { describe, expect, it } from "vitest";
import { stockFor, variantKey, variantKeys } from "@contracts/constants";

describe("stock par variante", () => {
  it("genere toutes les combinaisons couleur x taille", () => {
    expect(variantKeys(["Noir", "Beige"], ["S", "M"])).toEqual(["Noir|S", "Noir|M", "Beige|S", "Beige|M"]);
    expect(variantKeys(["Noir"], [])).toEqual(["Noir|"]);
    expect(variantKeys([], ["S"])).toEqual(["|S"]);
  });

  it("lit le stock de la variante choisie", () => {
    const product = { inventoryQuantity: 5, variantStock: { [variantKey("Noir", "S")]: 2, [variantKey("Noir", "M")]: 0 } };
    expect(stockFor(product, "Noir", "S")).toBe(2);
    expect(stockFor(product, "Noir", "M")).toBe(0);
    expect(stockFor(product, "Beige", "S")).toBe(0);
  });

  it("se rabat sur le stock global sans stock par variante", () => {
    expect(stockFor({ inventoryQuantity: 4, variantStock: null }, "Noir", "S")).toBe(4);
    expect(stockFor({ inventoryQuantity: 4, variantStock: {} }, null, null)).toBe(4);
  });
});
