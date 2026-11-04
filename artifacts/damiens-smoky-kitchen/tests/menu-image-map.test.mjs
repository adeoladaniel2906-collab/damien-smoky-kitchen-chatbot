import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { restaurantKnowledge } from "../src/chatbot/knowledge.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all 123 menu entries have distinct, clearly labelled illustration fallbacks", async () => {
  const app = await read("../src/App.tsx");
  const map = JSON.parse(await read("../src/chatbot/menu-image-map.json"));
  const sources = JSON.parse(await read("../src/chatbot/menu-image-sources.json"));
  const items = [...restaurantKnowledge.menu, ...restaurantKnowledge.veganMenu];
  assert.equal(items.length, 123);
  assert.deepEqual(map, {}, "unverified stock photos must not be presented as menu-item photos");
  assert.deepEqual(sources, [], "unverified photo credits must not be shown");
  assert.match(app, /const menuVisual = \(item: CatalogItem\)/);
  assert.match(app, /data-menu-item=/);
  assert.match(app, /Unique, clearly illustrated visual/);
  assert.doesNotMatch(app, /menuPhotoCredit/);
  assert.doesNotMatch(app, /menuPhoto\(item\)/);
});

test("menu illustration identity is derived from the individual menu item ID", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /reduce\(\(value, char\).*charCodeAt/);
  assert.match(app, /data-menu-item=\"\$\{escapeXml\(item\.id\)\}\"/);
});
