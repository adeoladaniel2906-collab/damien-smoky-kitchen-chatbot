import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { restaurantKnowledge } from "../src/chatbot/knowledge.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("menu photos are unique, attributed, licensed and attached only to matching dishes", async () => {
  const app = await read("../src/App.tsx");
  const map = JSON.parse(await read("../src/chatbot/menu-image-map.json"));
  const sources = JSON.parse(await read("../src/chatbot/menu-image-sources.json"));
  const items = [...restaurantKnowledge.menu, ...restaurantKnowledge.veganMenu];
  const ids = new Set(items.map((item) => `${item.category}:${item.name}:${item.price ?? "ask"}`));
  const photos = Object.values(map);

  assert.equal(items.length, 123);
  assert.ok(photos.length >= 10, "restore the saved matching photos and add a broad set of distinct menu photographs");
  assert.equal(sources.length, photos.length);
  assert.ok(Object.keys(map).every((id) => ids.has(id)), "every photo must point to a real menu item");
  assert.equal(new Set(photos.map((photo) => photo.url)).size, photos.length, "no photograph may be reused for multiple menu entries");
  assert.deepEqual(sources.map((source) => source.menuItemId).sort(), Object.keys(map).sort());

  assert.equal(new Set(photos.map((photo) => photo.sourceUrl)).size, photos.length, "no source page may be reused for multiple menu entries");

  const allowedLicenses = new Map([
    ["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
    ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
    ["CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"],
    ["CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"],
    ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"],
    ["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"],
    ["CC BY 2.5", "https://creativecommons.org/licenses/by/2.5/"],
    ["CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
    ["Public domain", "https://commons.wikimedia.org/wiki/Commons:Licensing"],
  ]);
  const sourceById = new Map(sources.map((source) => [source.menuItemId, source]));

  for (const [id, photo] of Object.entries(map)) {
    const source = sourceById.get(id);
    assert.match(photo.url, /^https:\/\/(?:upload\.wikimedia\.org\/|commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/);
    assert.match(photo.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.equal(allowedLicenses.get(photo.license), photo.licenseUrl, `unsupported or mismatched licence for ${id}`);
    assert.equal(source.url, photo.url);
    assert.equal(source.sourceUrl, photo.sourceUrl);
    assert.equal(source.author, photo.author);
    assert.equal(source.license, photo.license);
    assert.equal(source.licenseUrl, photo.licenseUrl);
    assert.equal(source.alt, photo.alt);
    assert.ok(photo.author.trim());
    assert.ok(photo.alt.trim());
  }

  assert.match(app, /menuImageMap as Record<string, MenuPhoto>/);
  assert.match(app, /menuImageCredit\(item\)/);
  assert.match(app, /menuPhotoFor\(item\)\?\.url \?\? menuIllustration\(item\)/);
  assert.ok(map["Rice:Jollof Rice:800"].sourceUrl.includes("A_Nigeria_Jollof_Rice_with_chicken.jpg"), "restore the original Nigerian jollof photograph");
});

test("every homepage category card can use a distinct assigned food photograph", async () => {
  const app = await read("../src/App.tsx");
  const map = JSON.parse(await read("../src/chatbot/menu-image-map.json"));
  const items = [...restaurantKnowledge.menu, ...restaurantKnowledge.veganMenu];
  const categories = new Set(items.map((item) => item.category.replace(/^Vegan /, "")));
  const photographedCategories = new Set(Object.keys(map).map((id) => id.split(":")[0].replace(/^Vegan /, "")));
  assert.deepEqual([...categories].filter((category) => !photographedCategories.has(category)), []);
  assert.match(app, /menuItems\.find\(\(item\) => item\.displayCategory === category && menuPhotoFor\(item\)\)/);
  assert.match(app, /photo \? <img src=\{photo\.url\} alt="" loading="lazy"/);
});

test("menu entries without verified matching photographs keep unique branded illustrations", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /const menuIllustration = \(item: CatalogItem\)/);
  assert.match(app, /data-menu-item=/);
});
