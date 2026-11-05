import { expect, it } from "vitest";
import { parseImport, parseURI } from "../src/import";
import { decodeBase32 } from "../src/otp";
const secret = "JBSWY3DPEHPK3PXP";
const read = (uri: string) => parseImport(uri, "uri", true);
it("ignores extra URI metadata only with an explicit review warning and no value echo", () => {
  const r = read(
    "otpauth://totp/Example:alice?secret=" +
      secret +
      "&issuer=Example&image=https://example.test/PRIVATE_METADATA&extra=PRIVATE_VALUE",
  );
  expect(r.accounts).toHaveLength(1);
  expect(r.accounts[0]!.secret).toBe(secret);
  expect(r.warnings).toEqual([
    {
      index: 1,
      reason:
        "Ignored extra setup-link options. Check the account settings before adding.",
    },
  ]);
  expect(JSON.stringify(r.warnings)).not.toMatch(/PRIVATE|https/);
});
it("accepts uppercase OTP types with a review note", () => {
  const r = read(
    "otpauth://TOTP/Example:alice?secret=" + secret + "&issuer=Example",
  );
  expect(r.accounts[0]!.type).toBe("totp");
  expect(r.warnings![0]!.reason).toContain("capitalization");
});
it("uses the explicit service name on a prefix mismatch and requires review", () => {
  const r = read(
    "otpauth://totp/Old:alice?secret=" + secret + "&issuer=Explicit",
  );
  expect(r.accounts[0]).toMatchObject({ issuer: "Explicit", label: "alice" });
  expect(r.warnings![0]!.reason).toContain("Service names");
});
it("normalizes only unused Base32 bits without adding or changing key bytes", () => {
  const r = read("otpauth://totp/Demo?secret=MZ");
  expect(r.accounts[0]!.secret).toBe("MY");
  expect([...decodeBase32(r.accounts[0]!.secret)]).toEqual([102]);
  expect(r.warnings![0]!.reason).toContain("unused Base32 bits");
});
it("retains original line indexes on compatibility notes", () => {
  const r = read("\n\notpauth://TOTP/Demo?secret=" + secret);
  expect(r.warnings![0]!.index).toBe(3);
});
it("keeps ordinary import result shapes unchanged", () => {
  expect(
    Object.keys(read("otpauth://totp/Demo?secret=" + secret)).sort(),
  ).toEqual(["accounts", "skipped"]);
});
it("accepts FreeOTP's irrelevant standard HOTP period with an explicit note", () => {
  const r = read(
    "otpauth://hotp/Demo?secret=" + secret + "&counter=8&period=30",
  );
  expect(r.accounts[0]).toMatchObject({ type: "hotp", counter: "8" });
  expect(r.warnings![0]!.reason).toContain("counter-based");
});
it.each([
  "otpauth://totp/Demo?secret=" + secret + "&secret=" + secret,
  "otpauth://totp/Demo?secret=" + secret + "&extra=1&extra=2",
  "otpauth://totp/Demo?secret=" + secret + "&issuer=A&issuer=B",
  "otpauth://totp/Demo?secret=" + secret + "&algorithm=MD5",
  "otpauth://hotp/Demo?secret=" + secret + "&counter=1&period=20",
  "otpauth://totp/Demo?secret=M!",
])(
  "still rejects duplicate, conflicting or invalid security settings %#",
  (uri) => {
    expect(() => read(uri)).toThrow("No valid accounts");
  },
);
it("keeps the strict URI validator available for stored/exported formats", () => {
  expect(() =>
    parseURI("otpauth://totp/A:alice?secret=" + secret + "&issuer=B"),
  ).toThrow();
  expect(() => parseURI("otpauth://totp/Demo?secret=MZ")).toThrow();
  expect(() =>
    parseURI("otpauth://totp/Demo?secret=" + secret + "&extra=1"),
  ).toThrow();
});

it("recognizes uppercase schemes through the actual detected-import path", async () => {
  const { detectImport, readDetectedImport } =
    await import("../src/import-formats");
  const detected = detectImport("OTPAUTH://TOTP/Demo?secret=" + secret);
  const result = await readDetectedImport(detected, undefined, undefined, true);
  expect(result.accounts[0]!.type).toBe("totp");
});
it("can keep uppercase setup links as bounded session drafts", async () => {
  const { validateDraft } = await import("../src/session-cache");
  const draft = {
    mode: "import",
    fields: { payload: "OTPAUTH://TOTP/Demo?secret=" + secret },
  };
  expect(validateDraft(draft)).toEqual(draft);
});
