import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { restaurantKnowledge } from "../src/chatbot/knowledge.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("licensed menu photographs are unique, correctly attributed and attached only to matching dishes", async () => {
  const app = await read("../src/App.tsx");
  const map = JSON.parse(await read("../src/chatbot/menu-image-map.json"));
  const sources = JSON.parse(await read("../src/chatbot/menu-image-sources.json"));
  const items = [...restaurantKnowledge.menu, ...restaurantKnowledge.veganMenu];
  const ids = new Set(items.map((item) => `${item.category}:${item.name}:${item.price ?? "ask"}`));
  const photos = Object.values(map);

  assert.equal(items.length, 123);
  assert.ok(photos.length >= 4, "the menu should have a useful starter set of verified photos");
  assert.equal(sources.length, photos.length);
  assert.ok(Object.keys(map).every((id) => ids.has(id)), "every photo must point to a real menu item");
  assert.equal(new Set(photos.map((photo) => photo.url)).size, photos.length, "no photograph may be reused for multiple menu entries");
  assert.deepEqual(sources.map((source) => source.menuItemId).sort(), Object.keys(map).sort());

  for (const photo of photos) {
    assert.match(photo.url, /^https:\/\/upload\.wikimedia\.org\//);
    assert.match(photo.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(photo.licenseUrl, /^https:\/\/creativecommons\.org\/licenses\//);
    assert.equal(photo.license, "CC BY-SA 4.0");
    assert.ok(photo.author.trim());
    assert.ok(photo.alt.trim());
  }

  assert.match(app, /menuImageMap as Record<string, MenuPhoto>/);
  assert.match(app, /menuImageCredit\(item\)/);
  assert.match(app, /menuPhoto\?\.url \?\? menuIllustration\(item\)/);
});

test("the original illustrated fallback remains for menu entries without a verified matching photograph", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /const menuIllustration = \(item: CatalogItem\)/);
  assert.match(app, /data-menu-item=/);
});
