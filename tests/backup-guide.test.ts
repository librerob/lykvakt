import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read = (name: string) =>
  readFileSync(new URL("../" + name, import.meta.url), "utf8");
it("links the supplied store listings with bundled artwork", () => {
  const readme = read("README.md");
  expect(readme).toContain(
    "https://chromewebstore.google.com/detail/lykvakt/mkdpeckmkminhpoehedicocglpdiicon",
  );
  expect(readme).toContain(
    "https://addons.mozilla.org/en-US/firefox/addon/lykvakt/",
  );
  for (const name of ["chrome-store", "firefox-addons"]) {
    expect(readme).toContain(`docs/assets/${name}.svg`);
    expect(read(`docs/assets/${name}.svg`)).toContain("<svg");
  }
});
it("distinguishes backup passwords, verification, fresh restore and explicit merge", () => {
  const guide = read("docs/backups.md");
  for (const text of [
    "master password",
    "backup passphrase",
    "does not change",
    "Exact account snapshot match",
    "Preview safe merge",
    "Test & recover accounts",
    "do not reuse",
    "no password reset",
  ])
    expect(guide).toContain(text);
  expect(read("docs/usage.md")).toContain("(backups.md)");
});
