import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Explore Menu motion uses the selected real Pexels grill footage and existing brand palette", async () => {
  const app = await read("../src/App.tsx");
  const css = await read("../src/index.css");

  assert.match(app, /function MenuMotionFeature\(/);
  assert.match(app, /856399\/856399-hd_1920_1080_25fps\.mp4/);
  assert.match(app, /autoPlay[\s\S]*muted[\s\S]*loop[\s\S]*playsInline/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /<MenuMotionFeature\/>/);
  assert.match(app, /bg-\[#21382d\]/);
  assert.match(app, /text-\[#ffc94a\]/);
  assert.match(css, /dsk-menu-motion__video/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
