import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupHelp } from "../src/ui/setup-help";
import { testDocument, type TestElement } from "./helpers/dom";
import { readFileSync } from "node:fs";
beforeEach(() => vi.stubGlobal("document", testDocument));
afterEach(() => vi.unstubAllGlobals());
it("keeps QR-only setup guidance offline with one optional trusted documentation link", () => {
  const help = setupHelp() as unknown as TestElement;
  expect(help.tagName).toBe("DETAILS");
  for (const text of [
    "Can't find the setup key?",
    "Enter manually",
    "short sign-in code",
    "cropped screenshot",
    "paste",
    "approval app",
    "may also save a file",
  ])
    expect(help.textContent).toContain(text);
  const link = help.querySelector("a")!;
  expect(link.getAttribute("href")).toBe(
    "https://github.com/librerob/lykvakt/blob/main/docs/usage.md#if-you-cannot-find-a-setup-key",
  );
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(help.querySelectorAll("img")).toHaveLength(0);
});
it("documents clipboard history and pinned Windows items without promising secure erasure", () => {
  const usage = readFileSync(
    new URL("../docs/usage.md", import.meta.url),
    "utf8",
  );
  for (const text of [
    "Clipboard history",
    "pinned",
    "Universal Clipboard",
    "Linux",
    "cannot erase",
    "does not clear",
  ])
    expect(usage).toContain(text);
});
it("leaves the three permissions and clipboard-read boundary unchanged", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"),
  );
  expect(manifest.permissions).toEqual(["clipboardWrite", "storage", "alarms"]);
  const helper = readFileSync(
    new URL("../src/ui/setup-help.ts", import.meta.url),
    "utf8",
  );
  expect(helper).not.toMatch(
    /clipboard\.read|clipboard\.write|setTimeout|captureVisibleTab|fetch\(/,
  );
});
