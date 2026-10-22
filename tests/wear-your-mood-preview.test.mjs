import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getWearYourMoodPreviewModel } from "../src/services/wear-your-mood-preview.ts";

test("selected quote and customization choices are reflected by the shirt overlay model", () => {
  const first = getWearYourMoodPreviewModel({
    quote: "Monday needs a restart",
    font: "bold",
    printColor: "ink",
    size: "M",
    placement: "center",
  });
  assert.equal(first.quoteText, "Monday needs a restart");
  assert.match(first.ariaLabel, /Monday needs a restart/);

  const updated = getWearYourMoodPreviewModel({
    quote: "I choose the plot twist",
    font: "serif",
    printColor: "berry",
    size: "XL",
    placement: "chest",
  });
  assert.equal(updated.quoteText, "I choose the plot twist");
  assert.notEqual(updated.fontClassName, first.fontClassName);
  assert.notEqual(updated.color, first.color);
  assert.notEqual(updated.garmentScale, first.garmentScale);
  assert.notEqual(updated.left, first.left);
  assert.match(updated.ariaLabel, /size XL, left chest placement, serif font, berry print/);
});

test("long quotes shrink to fit the masked print region", () => {
  const short = getWearYourMoodPreviewModel({ quote: "Short line", font: "bold", printColor: "ink", size: "M", placement: "center" });
  const long = getWearYourMoodPreviewModel({ quote: "This quote is intentionally much longer to test print fit and readability", font: "bold", printColor: "ink", size: "M", placement: "center" });
  assert.ok(long.fontSizePx < short.fontSizePx);
});

test("builder uses the exact blank RNL PNG base, overlays the selected quote, and has a neutral fallback", () => {
  const component = fs.readFileSync(path.join(process.cwd(), "src/components/product/WearYourMoodBuilder.tsx"), "utf8");
  const imagePath = path.join(process.cwd(), "public/products/wear-your-mood-base.png");
  const image = fs.readFileSync(imagePath);
  assert.ok(image.length > 10_000);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "base asset must be a valid PNG");
  assert.match(component, /src="\/products\/wear-your-mood-base\.png"/);
  assert.match(component, /\{preview\.quoteText\}/);
  assert.match(component, /color: preview\.color/);
  assert.match(component, /fontClassName/);
  assert.match(component, /onError=\{\(\) => setPreviewImageLoaded\(false\)\}/);
  assert.match(component, /<svg viewBox="0 0 320 340"/);
  assert.doesNotMatch(component, /wear-your-mood-base\.jpg|tshirt_product_images|design_\d+_\d+_front/);
});
