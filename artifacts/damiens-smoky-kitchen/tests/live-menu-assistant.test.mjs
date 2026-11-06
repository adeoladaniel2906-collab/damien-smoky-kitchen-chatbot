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
  assert.match(app, /Create account to view menu/);
  assert.doesNotMatch(app, /Popular right now/);
});

test("floating assistant opens with welcome message and accessible animated panel", async () => {
  const app = await read("../src/App.tsx");
  const css = await read("../src/index.css");
  assert.match(app, /Welcome to Kitchen Assistant\. How can we help you today\?/);
  assert.match(app, /id="dsk-assistant-panel"/);
  assert.match(app, /Need help\?/);
  assert.match(app, /onOpenChange\(!open\)/);
  assert.match(css, /@keyframes dsk-assistant-open/);
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
