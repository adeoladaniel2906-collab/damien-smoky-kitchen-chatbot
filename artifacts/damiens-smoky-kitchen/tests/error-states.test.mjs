import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("offline, broken-image, empty-search and empty-basket states are visible", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /You are offline/);
  assert.match(app, /onError=\{\(event\) => \{ event\.currentTarget\.onerror = null; event\.currentTarget\.src = menuIllustration\(item\); \}\}/);
  assert.match(app, /No menu items match that search/);
  assert.match(app, /Your basket is empty/);
});

test("customer pages require sign-in while staff routes use their separate login", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /const isPublicPage = location === "\/" \|\| location === "\/delivery"/);
  assert.match(app, /if \(!isStaffArea && !isPublicPage && !isSignedIn\)/);
  assert.match(app, /location === "\/menu" \? "register" : "login"/);
  assert.match(app, /<Route path="\/staff\/login"><StaffLoginPage\/>/);
  assert.match(app, /<Route path="\/login"><CustomerAuthPage mode="login"\/>/);
});

test("staff status lookup failures are not misreported as disabled configuration", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /We could not check staff sign-in/);
  assert.match(app, /This does not necessarily mean staff access is disabled/);
  assert.match(app, /Try again/);
  assert.match(app, /role="alert"/);
});

test("checkout status lookup failures are distinct from deliberately disabled online ordering", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /We could not check checkout availability/);
  assert.match(app, /Your basket is safe/);
  assert.match(app, /We are completing the data-protection and secure order-processing setup/);
});

test("navigation gives the menu priority and keeps the kitchen assistant discoverable", async () => {
  const app = await read("../src/App.tsx");
  assert.match(app, /aria-label="Main navigation"/);
  assert.match(app, /aria-label="Mobile navigation"/);
  assert.match(app, /onClick=\{\(\) => openMenu\(\)\}/);
  assert.match(app, /className="dsk-assistant-launcher"/);
  assert.match(app, /Need help\?/);
  assert.match(app, /KitchenAssistantWidget/);
});
