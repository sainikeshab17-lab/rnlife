import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMoodQuotes, MOOD_QUOTE_REQUEST_SCHEMA } from "../src/services/mood-quotes.ts";
import { PRODUCTS } from "../src/data/mock-data.ts";

test("each supported mood and style returns five distinct, concise fallback quotes", () => {
  for (const mood of ["happy", "confident", "savage", "heartbroken", "overthinking", "energetic", "exhausted", "angry", "funny", "emotional"]) {
    for (const style of ["deep", "savage", "minimal", "funny"]) {
      const quotes = generateMoodQuotes({ mood, style });
      assert.equal(quotes.length, 5);
      assert.equal(new Set(quotes).size, 5);
      assert.ok(quotes.every((quote) => quote.length <= 60));
    }
  }
});

test("optional empty story works and broad themes can influence fallback without echoing personal text", () => {
  assert.equal(MOOD_QUOTE_REQUEST_SCHEMA.safeParse({ mood: "happy", style: "deep", story: "" }).success, true);
  const quotes = generateMoodQuotes({ mood: "happy", style: "deep", story: "Deadline at work; my private project is Acme-42" });
  assert.ok(quotes.includes("Deadline season, still me"));
  assert.ok(!quotes.some((quote) => quote.includes("Acme-42")));
});

test("invalid moods, styles, and overlong stories are rejected", () => {
  assert.equal(MOOD_QUOTE_REQUEST_SCHEMA.safeParse({ mood: "unknown", style: "deep" }).success, false);
  assert.equal(MOOD_QUOTE_REQUEST_SCHEMA.safeParse({ mood: "happy", style: "unknown" }).success, false);
  assert.equal(MOOD_QUOTE_REQUEST_SCHEMA.safeParse({ mood: "happy", style: "deep", story: "x".repeat(241) }).success, false);
});

test("the existing eight catalog items preserve their IDs and ₹999 prices", () => {
  assert.deepEqual(PRODUCTS.map((product) => product.id), Array.from({ length: 8 }, (_, i) => `rnl-design-0${i + 1}`));
  assert.ok(PRODUCTS.every((product) => product.price === 999));
});
