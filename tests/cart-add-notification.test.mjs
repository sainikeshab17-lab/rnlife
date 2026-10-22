import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("cart add actions have one shared success notification source", async () => {
  const [cart, card, selector, wishlist, builder] = await Promise.all([
    read("../src/context/cart-context.tsx"),
    read("../src/components/product/ProductCard.tsx"),
    read("../src/components/product/VariantSelector.tsx"),
    read("../src/app/account/wishlist/page.tsx"),
    read("../src/components/product/WearYourMoodBuilder.tsx"),
  ]);

  assert.equal((cart.match(/title: "Added to Bag"/g) ?? []).length, 1);
  assert.match(cart, /setItems\(\(prev\) => \{/);
  assert.match(cart, /updated\[existingIdx\]\.quantity \+= qty/);
  for (const caller of [card, selector, wishlist, builder]) {
    assert.match(caller, /addToBag\(/);
    assert.doesNotMatch(caller, /title:\s*["']Added to Bag["']/);
  }
});
