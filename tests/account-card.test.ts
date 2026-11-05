import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAccounts } from "../src/ui/accounts";
import { emptyVault } from "../src/model";
import { parseURI } from "../src/import";
import type { Session } from "../src/session";
import { context } from "./helpers/ui";
import { testDocument, type TestElement } from "./helpers/dom";
let accounts: ReturnType<typeof createAccounts>;
beforeEach(() => {
  vi.stubGlobal("document", testDocument);
  vi.stubGlobal("localStorage", { getItem: () => null });
});
afterEach(() => {
  accounts?.clear();
  vi.unstubAllGlobals();
});
function card(type: string, digits: number) {
  const data = emptyVault();
  data.accounts.push(
    parseURI(
      "otpauth://" +
        type +
        "/Example:synthetic?secret=JBSWY3DPEHPK3PXP&digits=" +
        digits +
        (type === "hotp" ? "&counter=0" : "&period=30"),
    ),
  );
  const session = {
    unlocked: true,
    accounts: () => structuredClone(data),
    check() {},
    epoch: () => 0,
  } as unknown as Session;
  accounts = createAccounts(context(session));
  return (accounts.codesView() as unknown as TestElement).querySelector(
    ".account",
  )!;
}
it.each([
  ["totp", 6],
  ["totp", 8],
  ["steam", 5],
])(
  "%s/%i keeps its countdown with the current code and its next label with the preview",
  (type, digits) => {
    const row = card(String(type), Number(digits));
    const current = row.querySelector(".current-code")!;
    expect(current.querySelector(".otp")).not.toBeNull();
    expect(current.querySelector(".remaining")).not.toBeNull();
    expect(current.querySelector(".next-code")).toBeNull();
    const next = row.querySelector(".next-code")!;
    expect(next.parentElement).toBe(row.querySelector(".code-cell"));
    expect(next.querySelector(".hint")!.textContent).toBe("Next code");
    expect(next.getAttribute("aria-label")).toBe(
      "Next code, valid after the current one expires",
    );
    expect(next.hidden).toBe(true);
    expect(next.querySelector(".next-code-value")!.textContent).toBe("");
  },
);
it("keeps HOTP's counter separate from the current code without a next preview", async () => {
  const row = card("hotp", 6);
  await accounts.tick();
  expect(row.querySelector(".next-code")).toBeNull();
  expect(
    row.querySelector(".current-code")!.querySelector(".remaining"),
  ).toBeNull();
  expect(row.querySelector(".counter")!.parentElement).toBe(
    row.querySelector(".code-cell"),
  );
  expect(row.querySelector(".counter")!.getAttribute("aria-label")).toBe(
    "Counter 0",
  );
});
