import { languageChoice } from "../src/ui/language";
import { el } from "../src/dom";
import { testDocument, type TestElement } from "./helpers/dom";
import { isEnglishFallback } from "../src/i18n";
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  LANGUAGES,
  currentLanguage,
  initializeLanguage,
  resolveLanguage,
  setLanguage,
  t,
} from "../src/i18n";
import required from "../src/locales/required.json";
afterEach(async () => {
  await setLanguage("en", false);
  vi.unstubAllGlobals();
});
it("offers 21 languages including the requested Nordic languages and Romanian", () => {
  expect(Object.keys(LANGUAGES)).toHaveLength(21);
  for (const code of ["ro", "nb", "fi", "sv", "is", "da"])
    expect(LANGUAGES).toHaveProperty(code);
});
it.each(Object.keys(LANGUAGES).filter((code) => code !== "en"))(
  "%s has the complete core catalogue with matching placeholders",
  (code) => {
    const en = JSON.parse(
      readFileSync(new URL("../src/locales/en.json", import.meta.url), "utf8"),
    );
    const translated = JSON.parse(
      readFileSync(
        new URL("../src/locales/" + code + ".json", import.meta.url),
        "utf8",
      ),
    );
    for (const key of required) expect(translated[key], key).toBeTruthy();
    for (const [key, value] of Object.entries(translated)) {
      expect(Object.hasOwn(en, key), key).toBe(true);
      expect(typeof value).toBe("string");
      const placeholders = (s: string) =>
        [...s.matchAll(/\{[a-z][a-zA-Z0-9]*\}/g)].map((m) => m[0]).sort();
      expect(placeholders(value as string), key).toEqual(placeholders(key));
    }
  },
);
it.each(Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[])(
  "%s loads its UI text locally",
  async (code) => {
    await setLanguage(code, false);
    expect(currentLanguage()).toBe(code);
    expect(t("Close")).toBeTruthy();
    if (code !== "en") expect(t("Close")).not.toBe("Close");
    expect(t("Not yet translated")).toBe("Not yet translated");
  },
);
it("resolves browser languages without treating storage values as module paths", async () => {
  expect(resolveLanguage(["xx", "no-NO"])).toBe("nb");
  expect(resolveLanguage(["pt_BR"])).toBe("pt");
  expect(resolveLanguage(["en-US", "de"])).toBe("en");
  expect(resolveLanguage(["../secret"])).toBe("en");
  vi.stubGlobal("localStorage", { getItem: () => "../../outside" });
  await initializeLanguage(["sv-SE"]);
  expect(currentLanguage()).toBe("sv");
  await expect(setLanguage("../../outside" as "en")).rejects.toThrow(
    "Unsupported language",
  );
});
it("persists a user choice and follows it instead of browser preferences", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  await setLanguage("fi");
  expect(values.get("language")).toBe("fi");
  await initializeLanguage(["de"]);
  expect(currentLanguage()).toBe("fi");
});
it("sets RTL metadata and isolates inserted names without translating or recursively interpolating them", async () => {
  const root = { lang: "", dir: "" };
  vi.stubGlobal("document", { documentElement: root });
  await setLanguage("ar", false);
  expect(root).toEqual({ lang: "ar", dir: "rtl" });
  const name = "Backup <img src=x> {code}";
  const result = t("Code for {name}: {code}", { name, code: "123456" });
  expect(result).toContain("\u2068" + name + "\u2069");
  expect(result).toContain("\u2068123456\u2069");
  await setLanguage("ur", false);
  expect(root.dir).toBe("rtl");
  await setLanguage("en", false);
  expect(root.dir).toBe("ltr");
});
it("keeps English announcements byte-for-byte and ignores inherited properties", async () => {
  await setLanguage("en", false);
  expect(
    t("Copied code for {name}. Clipboard managers may keep a copy.", {
      name: "Example demo",
    }),
  ).toBe("Copied code for Example demo. Clipboard managers may keep a copy.");
  expect(t("toString")).toBe("toString");
  expect(t("{name}", Object.create({ name: "secret" }))).toBe("{name}");
});

it("marks untranslated English guidance for screen readers without changing account text", async () => {
  vi.stubGlobal("document", testDocument);
  await setLanguage("fr", false);
  const source =
    "These tips work offline. The full guide on GitHub is optional.";
  expect(isEnglishFallback(source)).toBe(true);
  const node = el("p", {}, t(source)) as unknown as TestElement;
  expect(node.getAttribute("lang")).toBe("en");
  const name = el("p", {}, "Close");
  expect(name.textContent).toBe("Close");
});

it("gives each language selector its own accessible label", () => {
  vi.stubGlobal("document", testDocument);
  const choices = [
    languageChoice(),
    languageChoice(),
  ] as unknown as TestElement[];
  const ids = choices.map((choice) => {
    const label = choice.querySelector("span")!;
    const control = choice.querySelector("select")!;
    expect(control.getAttribute("aria-labelledby")).toBe(
      label.getAttribute("id"),
    );
    return label.getAttribute("id");
  });
  expect(new Set(ids).size).toBe(2);
});
