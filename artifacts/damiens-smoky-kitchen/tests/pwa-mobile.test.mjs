import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("PWA manifest has the required install metadata and scalable app icons", async () => {
  const manifest = JSON.parse(await read("../public/manifest.webmanifest"));
  assert.equal(manifest.name, "Damien's Smoky Kitchen");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes.includes("192x192") && icon.sizes.includes("512x512") && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("service worker caches the app shell but never caches API responses", async () => {
  const worker = await read("../public/service-worker.js");
  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /caches\.match\("\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return/);
});

test("mobile viewport permits zoom and accounts for device safe areas", async () => {
  const html = await read("../index.html");
  const css = await read("../src/index.css");
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /maximum-scale\s*=\s*1/);
  assert.match(html, /rel="manifest"/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test("customer sign-in returns to an existing route, not the removed account page", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /fallbackRedirectUrl="\/"/);
  assert.doesNotMatch(app, /fallbackRedirectUrl="\/account"/);
});
