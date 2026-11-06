import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("restaurant demo makes kitchen location and delivery area distinct", async () => {
  const app = await read("../src/App.tsx");
  const knowledge = await read("../src/chatbot/knowledge.ts");
  assert.match(app, /Kitchen in Ibafo, Ogun State/);
  assert.match(app, /Delivery across Lagos State/);
  assert.match(app, /Our kitchen is in Ibafo, Ogun State\. Delivery is available across Lagos State only\./);
  assert.match(knowledge, /Delivery coverage: Lagos State only\. The kitchen is in Ibafo, Ogun State/);
});

test("rice size variants are labelled separately without changing menu item IDs", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /Jollof Rice · \$\{item\.price === 800 \? 'Small' : 'Large'\}/);
  assert.match(app, /Fried Rice · \$\{item\.price === 900 \? 'Small' : 'Large'\}/);
  assert.match(app, /id: \x60\$\{item\.category\}:\$\{item\.name\}:\$\{item\.price \?\? 'ask'\}\x60/);
});

test("alcohol category is visibly age-labelled in menu and terms", async () => {
  const app = await read("../src/App.tsx");
  const worker = await read("../src/worker.ts");
  const terms = await read("../src/pages/LegalPages.tsx");
  assert.match(app, /Alcoholic Drinks \(18\+\)/);
  assert.match(app, /18\+ only\. Alcoholic drinks are not sold to anyone under 18/);
  assert.match(worker, /"Alcoholic Drinks \(18\+\)"/);
  assert.match(terms, /Alcoholic drinks are available only to customers aged 18 or older/);
});

test("homepage copy is restaurant-specific and the placeholder domain is gone", async () => {
  const app = await read("../src/App.tsx");
  const knowledge = await read("../src/chatbot/knowledge.ts");
  assert.match(app, /Nigerian favourites, made fresh in Ibafo\./);
  assert.match(app, /Cooked fresh in Ibafo\. Delivered across Lagos\./);
  assert.doesNotMatch(app, /Good food\. No guesswork\.|Your next favourite meal is closer/);
  assert.doesNotMatch(knowledge, /DamienStore\.food\.com/);
  assert.match(knowledge, /https:\/\/damiens-kitchen\.adeoladaniel2906\.workers\.dev/);
});
