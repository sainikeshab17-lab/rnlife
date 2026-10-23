import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("mobile navigation renders its modal layer in a top-level portal above the sticky header", async () => {
  const navbar = await read("../src/components/layout/Navbar.tsx");
  assert.match(navbar, /createPortal\(/);
  assert.match(navbar, /createPortal\([\s\S]*?document\.body/);
  assert.match(navbar, /fixed inset-0 z-\[60\] lg:hidden/);
  assert.match(navbar, /sticky top-0 z-40/);
  assert.match(navbar, /h-\[100dvh\].*max-h-\[100dvh\].*overflow-hidden/);
  assert.match(navbar, /min-h-0 flex-1 .*overflow-y-auto overscroll-contain/);
  assert.match(navbar, /aria-label="Close mobile navigation"/);
  assert.match(navbar, /aria-label="Close menu"/);
});

test("opening the mobile drawer locks background scrolling and restores prior scroll and styles", async () => {
  const navbar = await read("../src/components/layout/Navbar.tsx");
  assert.match(navbar, /const scrollY = window\.scrollY/);
  assert.match(navbar, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(navbar, /document\.body\.style\.position = "fixed"/);
  assert.match(navbar, /document\.body\.style\.top = `-\$\{scrollY\}px`/);
  assert.match(navbar, /document\.body\.style\.position = bodyStyles\.position/);
  assert.match(navbar, /document\.documentElement\.style\.overflow = previousRootOverflow/);
  assert.match(navbar, /window\.scrollTo\(0, scrollY\)/);
});

test("account menu keeps customer account actions without exposing internal staff portals", async () => {
  const navbar = await read("../src/components/layout/Navbar.tsx");
  const accountMenu = navbar.slice(navbar.indexOf("{/* Account Dropdown */}"), navbar.indexOf("{/* Shopping Bag Trigger"));
  assert.doesNotMatch(accountMenu, /Internal Staff Portals|href="\/(?:seller|admin)"/);
  assert.match(accountMenu, /href="\/account"/);
  assert.match(accountMenu, /href="\/account\/orders"/);
  assert.match(accountMenu, /onClick=\{logout\}/);
});

test("public footer does not expose staff or admin portal links", async () => {
  const footer = await read("../src/components/layout/Footer.tsx");
  assert.doesNotMatch(footer, /href="\/(?:seller|admin)"/);
});

test("desktop navigation remains in its existing large-screen navigation region", async () => {
  const navbar = await read("../src/components/layout/Navbar.tsx");
  assert.match(navbar, /<nav className="hidden lg:flex items-center space-x-5">[\s\S]*?\{navLinks\.map/);
  assert.match(navbar, /className=\{`nav-link text-\[10px\] uppercase tracking-wider font-bold py-1/);
});
