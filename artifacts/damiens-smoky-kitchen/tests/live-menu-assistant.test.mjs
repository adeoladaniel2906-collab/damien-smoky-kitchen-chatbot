import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("homepage and delivery information are public while menu and checkout stay account-gated", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /const isPublicPage = location === "\/" \|\| location === "\/delivery"/);
  assert.match(app, /if \(!isStaffArea && !isPublicPage && !isSignedIn\)/);
  assert.match(app, /redirectTo=\{redirectTo\}/);
  assert.match(app, /<Route path="\/menu">/);
});

test("menu actions route visitors through account creation before the menu", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /if \(!isSignedIn\) \{\s*setLocation\('\/menu'\)/);
  assert.match(app, /location === "\/menu" \? "register" : "login"/);
  assert.doesNotMatch(app, /Create account to view menu/);
  assert.doesNotMatch(app, /Ready to explore the full menu/);
  assert.match(app, /onClick=\{\(\) => onBrowse\(\)\}/);
  assert.doesNotMatch(app, /Popular right now/);
});

test("homepage hero uses a responsive flex layout and has no standalone signup CTA", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /flex flex-col items-stretch lg:min-h-\[420px\] lg:flex-row/);
  assert.match(app, /flex min-w-0 flex-1 flex-col justify-center/);
  assert.doesNotMatch(app, /Create account to view menu/);
  assert.match(app, /A few customer favourites/);
  assert.match(app, /items\.findIndex\(\(candidate\) => menuPhotoFor\(candidate\)\?\.url === photo\?\.url\)/);
  assert.match(app, /onClick=\{\(\) => onBrowse\(item\.displayCategory\)\}/);
});

test("assistant opens as a full-screen view with a letter-by-letter welcome animation", async () => {
  const app = await read("../src/App.tsx");
  const css = await read("../src/index.css");
  assert.match(app, /Array\.from\("WELCOME"\)/);
  assert.match(app, /dsk-assistant-fullscreen/);
  assert.match(app, /How can we be of help today\?/);
  assert.match(app, /aria-modal="true"/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(css, /@keyframes dsk-assistant-screen-enter/);
  assert.match(css, /@keyframes dsk-assistant-letter-in/);
  assert.match(css, /min-height: 4rem/);
  assert.match(css, /prefers-reduced-motion/);
});

test("menu questions use live D1 data and fail closed if lookup fails", async () => {
  const worker = await read("../src/worker.ts");
  assert.match(worker, /liveMenuRows = await readMenu\(env, true\)/);
  assert.match(worker, /buildLiveMenuContext\(liveMenuRows\)/);
  assert.match(worker, /getLiveMenuFastReply\(question, liveMenuRows\)/);
  assert.match(worker, /LIVE DATABASE MENU/);
  assert.match(worker, /currently unavailable/);
  assert.match(worker, /Live menu lookup failed/);
});

test("assistant launcher remains fixed and floating while preserving the welcome animation", async () => {
  const app = await read("../src/App.tsx");
  const css = await read("../src/index.css");
  assert.match(app, /return <div className="dsk-assistant-widget">[\\s\\S]*dsk-assistant-launcher/);
  assert.match(css, /\\.dsk-assistant-widget \\{ position: fixed/);
  assert.match(app, /Array\\.from\\("WELCOME"\\)/);
});

test("assistant memory is keyed to verified customer identity and stores preferences rather than transcripts", async () => {
  const worker = await read("../src/worker.ts");
  const migration = await read("../migrations/0008_assistant_customer_memory.sql");
  assert.match(worker, /getClerkIdentity\\(request, env, url\\)/);
  assert.match(worker, /loadAndUpdateCustomerPreferences/);
  assert.match(worker, /assistant_customer_memory/);
  assert.match(worker, /CUSTOMER PREFERENCES/);
  assert.match(migration, /clerk_user_id TEXT PRIMARY KEY/);
  assert.doesNotMatch(migration, /conversation|transcript|messages_json/i);
});
