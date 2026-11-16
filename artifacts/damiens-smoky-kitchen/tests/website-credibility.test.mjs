import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("browser favicon uses the restaurant's branded flame mark", async () => {
  const favicon = await read("../public/favicon.svg");
  assert.match(favicon, /viewBox="0 0 512 512"/);
  assert.match(favicon, /#e96d2c/i);
  assert.match(favicon, /<path\b/);
});

test("homepage keeps the copyright year current instead of hard-coding it", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /new Date\(\)\.getFullYear\(\)/);
});

test("homepage does not invent customer testimonials or trust badges", async () => {
  const app = await read("../src/App.tsx");
  assert.doesNotMatch(app, /trusted by \d+|verified customer testimonial|five-star reviews/i);
});
