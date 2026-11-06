import { expect, it } from "vitest";
import { parseImport } from "../src/import";
import { validateAccount } from "../src/model";
it("bounds 5000 deterministic mutations of compatibility-mode setup links", () => {
  let seed = 0x51afe123,
    accepted = 0,
    rejected = 0;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
  const base =
    "otpauth://TOTP/Old:synthetic?secret=MZ&issuer=Explicit&extra=metadata";
  for (let i = 0; i < 5000; i++) {
    const n = next(),
      position = n % base.length;
    const input = [
      () => base + "&unused=" + n,
      () => base.slice(0, position),
      () =>
        base.slice(0, position) +
        String.fromCharCode(n & 65535) +
        base.slice(position + 1),
      () => base + "&secret=AA",
      () =>
        base +
        "&nested=" +
        encodeURIComponent('{"x":'.repeat(n % 40) + "0" + "}".repeat(n % 40)),
      () => base.replace("secret=MZ", "secret=" + "A".repeat(4096)),
      () => "\n\n" + base + "\ninvalid",
      () => base.replace("MZ", "MY"),
    ][i % 8]!();
    const start = performance.now();
    let result: ReturnType<typeof parseImport> | undefined, error: unknown;
    try {
      result = parseImport(input, "uri", true);
    } catch (e) {
      error = e;
    }
    expect(performance.now() - start).toBeLessThan(250);
    if (error !== undefined) {
      expect(error).toBeInstanceOf(Error);
      rejected++;
      continue;
    }
    expect(result!.accounts.length).toBeGreaterThan(0);
    for (const account of result!.accounts)
      expect(validateAccount(account)).toEqual(account);
    for (const note of result!.warnings ?? []) {
      expect(Number.isSafeInteger(note.index) && note.index > 0).toBe(true);
      expect(note.reason.length).toBeLessThan(300);
    }
    accepted++;
  }
  expect(accepted).toBeGreaterThan(0);
  expect(rejected).toBeGreaterThan(0);
});
