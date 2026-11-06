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

test("homepage hero is compact on mobile while retaining the larger desktop layout", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /grid min-h-0 lg:min-h-\[360px\] lg:grid-cols/);
  assert.match(app, /relative min-h-\[180px\] sm:min-h-\[260px\] lg:min-h-full/);
  assert.match(app, /p-5 sm:p-10 lg:p-14/);
  assert.match(app, /sm:mt-5 sm:text-6xl/);
});

test("menu basket stays visible above mobile safe areas and content can scroll clear of it", async () => {
  const app = await read("../src/App.tsx");
  const css = await read("../src/index.css");
  assert.match(app, /dsk-basket-bar fixed/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /pt-8 pb-32 sm:px-6/);
  assert.match(css, /\.dsk-basket-bar \{ bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 1rem\); \}/);
});

test("menu loading clearly reports live refresh and saved-menu fallback states", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /type MenuLoadStatus = 'loading' \| 'ready' \| 'fallback'/);
  assert.match(app, /setMenuLoadStatus\('loading'\)/);
  assert.match(app, /setMenuLoadStatus\('ready'\)/);
  assert.match(app, /setMenuLoadStatus\('fallback'\)/);
  assert.match(app, /Showing the saved menu while checking for the latest updates/);
  assert.match(app, /The live menu could not be reached/);
  assert.match(app, /Checking the kitchen information…/);
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

test("Clerk sign-in and sign-up force stale OAuth redirect URLs back to the homepage", async () => {
  const app = await read("../src/App.tsx");
  assert.ok(app.includes('fallbackRedirectUrl="/" forceRedirectUrl="/"'));
  assert.ok(app.includes('signInForceRedirectUrl="/"'));
  assert.ok(app.includes('signUpForceRedirectUrl="/"'));
  assert.ok(!app.includes('fallbackRedirectUrl="/account"'));
  assert.ok(app.includes('<Route path="/account"><LegacyAccountRedirect/></Route>'));
});

test("the initial HTML shows a branded loading fallback before the app JavaScript loads", async () => {
  const html = await read("../index.html");
  assert.match(html, /id="root">[\s\S]*role="status"/);
  assert.match(html, /Getting the kitchen ready/);
  assert.match(html, /aria-busy="true"/);
});

test("the kitchen assistant offers one-tap prompts and answers basket questions from the live basket", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /Show me the Jollof menu/);
  assert.match(app, /What's in my basket\?/);
  assert.match(app, /onClick=\{\(\) => void ask\(text\)\}/);
  assert.match(app, /Your basket is empty at the moment/);
  assert.match(app, /Subtotal:/);
  assert.match(app, /AssistantPage basket=\{basket\}/);
});

test("legacy Clerk redirects to the removed account route safely return home", async () => {
  const app = await read("../src/App.tsx");
  assert.ok(app.includes('<Route path="/account"><LegacyAccountRedirect/></Route>'));
  assert.ok(app.includes('function LegacyAccountRedirect()'));
  assert.ok(app.includes('setLocation("/");'));
  assert.ok(app.includes('fallbackRedirectUrl="/"'));
});
