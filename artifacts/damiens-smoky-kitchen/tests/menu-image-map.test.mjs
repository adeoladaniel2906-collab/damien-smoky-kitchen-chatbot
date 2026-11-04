import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
test("verified menu photos are unique and carry source and license records", async () => {
 const map=JSON.parse(await read("../src/chatbot/menu-image-map.json"));
 const sources=JSON.parse(await read("../src/chatbot/menu-image-sources.json"));
 const urls=Object.values(map); assert.ok(urls.length>0);
 assert.equal(new Set(urls).size,urls.length,"menu photos must not be reused");
 assert.equal(sources.length,urls.length);
 for(const [id,url] of Object.entries(map)){const s=sources.find(x=>x.url===url);assert.ok(s,id);assert.ok(s.source);assert.ok(s.license);}
});
test("unmapped menu items use item-specific illustrations instead of a shared photo fallback", async () => {
 const app=await read("../src/App.tsx");assert.match(app,/Unique, branded illustration fallback/);assert.match(app,/data-menu-item=/);assert.match(app,/menuImageMap\[item\.id/);
});
