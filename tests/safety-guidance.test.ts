import { afterEach, expect, it, vi } from "vitest";
import { input } from "../src/dom";
import { withGenerator } from "../src/ui/passphrase";
import { languageChoice } from "../src/ui/language";
import { setLanguage } from "../src/i18n";
import { requirePassword } from "../src/crypto";
import { testDocument, type TestElement } from "./helpers/dom";
afterEach(async () => {
  await setLanguage("en", false);
  vi.unstubAllGlobals();
});
it("gives backup-specific guidance and keeps password length the user's choice", () => {
  vi.stubGlobal("document", testDocument);
  const field = input("password", "New password", "password");
  const view = withGenerator(field) as unknown as TestElement;
  expect(view.textContent).toContain("14+ characters");
  expect(view.textContent).toContain(
    "A backup file can be attacked without opening this app.",
  );
  expect(view.querySelector("button")).not.toBeNull();
  expect(field.control.getAttribute("minlength")).toBeNull();
  expect(() => requirePassword("x")).not.toThrow();
});
it.each(["de", "ar", "ur"] as const)(
  "discloses unreviewed translations with explicit English direction in %s",
  async (code) => {
    vi.stubGlobal("document", testDocument);
    await setLanguage(code, false);
    const view = languageChoice() as unknown as TestElement;
    const disclosure = view
      .querySelectorAll("p")
      .find((p) => p.textContent.includes("independently reviewed"));
    expect(disclosure?.getAttribute("lang")).toBe("en");
    expect(disclosure?.getAttribute("dir")).toBe("ltr");
    expect(disclosure?.textContent).toContain(
      "safety instructions are still in English",
    );
    const passwords = withGenerator(
      input("password", "New password", "password"),
    ) as unknown as TestElement;
    const guidance = passwords
      .querySelectorAll("p")
      .find((p) => p.textContent.includes("backup file can be attacked"));
    expect(guidance?.getAttribute("lang")).toBe("en");
    expect(guidance?.getAttribute("dir")).toBe("ltr");
  },
);
