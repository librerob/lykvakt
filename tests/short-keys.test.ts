import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import {
  codeFor,
  decodeBase32,
  encodeBase32,
  hotp,
  normalizeSecret,
} from "../src/otp";
import { parseImport, parseURI, toURI, verifyBackup } from "../src/import";
import { createEnvelope } from "../src/crypto";
import { emptyVault } from "../src/model";
const uri = "otpauth://totp/2FAS:test?secret=2FASTEST&issuer=2FAS";
it("accepts the public 2FAS demonstration key without altering its bytes", () => {
  expect(normalizeSecret("2FASTEST")).toBe("2FASTEST");
  expect(Buffer.from(decodeBase32("2FASTEST")).toString("hex")).toBe(
    "d141299253",
  );
  expect(parseImport(uri, "uri").accounts[0]!.secret).toBe("2FASTEST");
  expect(parseURI(toURI(parseURI(uri))).secret).toBe("2FASTEST");
});
it.each(["SHA-1", "SHA-256", "SHA-512"] as const)(
  "matches independent Node HMAC for the short key with %s",
  async (algorithm) => {
    for (const count of [0n, 1n, 18446744073709551615n]) {
      const message = Buffer.alloc(8);
      message.writeBigUInt64BE(count);
      const digest = createHmac(
        algorithm.toLowerCase().replace("-", ""),
        Buffer.from("d141299253", "hex"),
      )
        .update(message)
        .digest();
      const offset = digest.at(-1)! & 15;
      const expected = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
        .toString()
        .padStart(6, "0");
      expect(await hotp("2FASTEST", count, algorithm)).toBe(expected);
    }
  },
);
it("accepts one through nine bytes while preserving malformed-input and upper bounds", async () => {
  for (let n = 1; n < 10; n++) {
    const bytes = new Uint8Array(n).fill(102),
      secret = encodeBase32(bytes);
    expect(decodeBase32(secret)).toEqual(bytes);
    expect(await codeFor({ ...parseURI(uri), secret }, 0)).toMatch(/^\d{6}$/);
  }
  for (const key of ["", "A", "ABC", "MZ", "MY=", "2FASTES!"])
    expect(() => normalizeSecret(key)).toThrow(Error);
  expect(() => normalizeSecret("A".repeat(1026))).toThrow("1 to 640 bytes");
  expect(decodeBase32("A".repeat(1024))).toHaveLength(640);
});
it("retains short-key accounts through encrypted backup verification", async () => {
  const data = {
    ...emptyVault(),
    accounts: [
      parseURI(uri),
      {
        ...parseURI(uri),
        id: crypto.randomUUID(),
        label: "one byte",
        secret: "MY",
      },
    ],
  };
  const saved = await createEnvelope(
    "synthetic short-key backup password",
    data,
    "backup",
  );
  const checked = await verifyBackup(
    saved.envelope,
    "synthetic short-key backup password",
    data,
  );
  expect(checked.matches).toBe(true);
  expect(checked.data.accounts.map((a) => a.secret)).toEqual([
    "2FASTEST",
    "MY",
  ]);
}, 15000);
