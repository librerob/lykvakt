import { afterEach, expect, it, vi } from "vitest";
import { parseImport } from "../src/import";
import { MAX_ACCOUNTS, MAX_FILE_BYTES } from "../src/model";
function vint(n: number): Buffer {
  const out: number[] = [];
  do {
    out.push((n & 127) | (n > 127 ? 128 : 0));
    n = Math.floor(n / 128);
  } while (n);
  return Buffer.from(out);
}
const integer = (key: number, value: number) =>
  Buffer.concat([vint(key * 8), vint(value)]);
const bytes = (key: number, value: Uint8Array) =>
  Buffer.concat([vint(key * 8 + 2), vint(value.length), value]);
function entry(index = 0) {
  const secret = Buffer.alloc(10, 49);
  secret.writeUInt16BE(index, 8);
  return bytes(
    1,
    Buffer.concat([
      bytes(1, secret),
      bytes(2, Buffer.from("synthetic")),
      integer(6, 2),
    ]),
  );
}
function batch(size: number, entries: (index: number) => Buffer) {
  return Array.from(
    { length: size },
    (_, index) =>
      "otpauth-migration://offline?data=" +
      encodeURIComponent(
        Buffer.concat([
          entries(index),
          integer(2, 1),
          integer(3, size),
          integer(4, index),
          integer(5, 42),
        ]).toString("base64"),
      ),
  );
}
afterEach(() => vi.restoreAllMocks());
it("stops oversized batches before materializing accounts beyond the aggregate limit", () => {
  const repeated = Buffer.concat(
    Array.from({ length: MAX_ACCOUNTS }, () => entry()),
  );
  const text = batch(100, () => repeated).join("\n");
  expect(Buffer.byteLength(text)).toBeLessThan(MAX_FILE_BYTES);
  const identifiers = vi.spyOn(crypto, "randomUUID");
  expect(() => parseImport(text, "uri")).toThrow(
    "Too many transferred accounts",
  );
  expect(identifiers.mock.calls.length).toBeLessThanOrEqual(MAX_ACCOUNTS);
});
it("still accepts all 2000 accounts spread across 100 transfer parts in reverse input order", () => {
  const parts = batch(100, (part) =>
    Buffer.concat(Array.from({ length: 20 }, (_, i) => entry(part * 20 + i))),
  );
  const result = parseImport(parts.reverse().join("\n"), "uri");
  expect(result.accounts).toHaveLength(MAX_ACCOUNTS);
  expect(new Set(result.accounts.map((account) => account.secret)).size).toBe(
    MAX_ACCOUNTS,
  );
  expect(result.skipped).toEqual([]);
});
