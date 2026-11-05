import { expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { compareArchives, sourceFiles } from "../scripts/reproduce.mjs";

const commit = "a".repeat(40);
function source(extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    "README-BUILD.txt": strToU8("Lykvakt source at commit " + commit + "\n"),
    "package.json": strToU8('{"version":"0.5.8"}'),
    ...extra,
  });
}
it("accepts source with its recorded commit and preserves its bytes", () => {
  const files = sourceFiles(
    source({ "src/example.ts": strToU8("synthetic") }),
    commit,
  );
  expect(files["src/example.ts"]).toEqual(strToU8("synthetic"));
});
it("rejects a different source commit", () => {
  expect(() => sourceFiles(source(), "b".repeat(40))).toThrow(
    "Source commit mismatch",
  );
});
it.each([
  "../outside.txt",
  "/outside.txt",
  "C:/outside.txt",
  "src\\outside.txt",
  "src/../outside.txt",
  "src//outside.txt",
  "src/.. /outside.txt",
  "src/CON.txt",
  "src/name. /outside.txt",
])("rejects unsafe extraction path %s before it can be written", (path) => {
  expect(() =>
    sourceFiles(source({ [path]: strToU8("synthetic") }), commit),
  ).toThrow();
});
it("rejects case-colliding paths on every operating system", () => {
  expect(() =>
    sourceFiles(
      source({ "src/A.ts": strToU8("a"), "src/a.ts": strToU8("b") }),
      commit,
    ),
  ).toThrow("Duplicate source path");
});
it("rejects a highly compressed oversized source file before extraction", () => {
  expect(() =>
    sourceFiles(
      source({ "large.txt": new Uint8Array(8 * 1024 * 1024 + 1) }),
      commit,
    ),
  ).toThrow("Source file is too large");
});
it("rejects an archive that exceeds the total expanded source budget", () => {
  const extra = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => [
      i + ".txt",
      new Uint8Array(7 * 1024 * 1024),
    ]),
  );
  expect(() => sourceFiles(source(extra), commit)).toThrow(
    "Expanded source archive is too large",
  );
});
it("requires a byte-identical ZIP, including its metadata", () => {
  const archive = source();
  expect(compareArchives(archive, archive.slice())).toMatch(/^[a-f0-9]{64}$/);
  const changed = archive.slice();
  changed[10] = changed[10]! ^ 1;
  expect(() => compareArchives(archive, changed)).toThrow(
    "Rebuilt ZIP differs",
  );
});
