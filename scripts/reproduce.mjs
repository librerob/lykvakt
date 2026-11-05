import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { unzipSync, strFromU8 } from "fflate";

const MAX_ARCHIVE = 8 * 1024 * 1024;
const MAX_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 32 * 1024 * 1024;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function sourceFiles(bytes, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/, "Invalid source commit.");
  assert(bytes.length <= MAX_ARCHIVE, "Source archive is too large.");
  let total = 0;
  const names = new Set();
  const files = unzipSync(bytes, {
    filter(file) {
      const name = file.name;
      assert(
        name &&
          !name.startsWith("/") &&
          !name.includes("\\") &&
          !name.includes(":") &&
          !name.includes("\0") &&
          !name.split("/").some((part) => part === "." || part === ".."),
        "Unsafe source archive path.",
      );
      assert(
        name
          .split("/")
          .filter(Boolean)
          .every(
            (part) =>
              !/[. ]$/.test(part) &&
              !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
          ) && !/[\x00-\x1f]/.test(name),
        "Unsafe source archive path.",
      );
      if (name.endsWith("/")) return false;
      assert(
        !name.split("/").some((part) => part === ""),
        "Invalid source path.",
      );
      assert(!names.has(name.toLowerCase()), "Duplicate source path.");
      names.add(name.toLowerCase());
      assert(names.size <= 1000, "Too many source files.");
      assert(file.originalSize <= MAX_FILE, "Source file is too large.");
      total += file.originalSize;
      assert(total <= MAX_TOTAL, "Expanded source archive is too large.");
      return true;
    },
  });
  assert(files["README-BUILD.txt"], "Missing source build instructions.");
  assert(
    strFromU8(files["README-BUILD.txt"]).startsWith(
      "Lykvakt source at commit " + commit + "\n",
    ),
    "Source commit mismatch.",
  );
  assert(files["package.json"], "Missing source package metadata.");
  return files;
}

export function compareArchives(original, rebuilt) {
  assert(
    Buffer.from(original).equals(Buffer.from(rebuilt)),
    "Rebuilt ZIP differs from the validated package.",
  );
  return digest(original);
}

async function checkedArchive(path) {
  const bytes = await readFile(path);
  assert.equal(
    (await readFile(path + ".sha256", "utf8")).trim(),
    digest(bytes) + "  " + basename(path),
    "Archive checksum mismatch.",
  );
  return bytes;
}

export async function reproduce(directory, target, commit) {
  assert(
    ["chrome", "edge", "firefox"].includes(target),
    "Unknown browser target.",
  );
  const npm = process.env.npm_execpath;
  assert(npm && isAbsolute(npm), "Run through npm run verify:rebuild.");
  const version = JSON.parse(await readFile("package.json", "utf8")).version;
  const base = resolve(directory);
  const source = await checkedArchive(
    join(base, "lykvakt-" + version + "-source.zip"),
  );
  const original = await checkedArchive(
    join(base, "lykvakt-" + version + "-" + target + ".zip"),
  );
  const files = sourceFiles(source, commit);
  assert.equal(
    JSON.parse(strFromU8(files["package.json"])).version,
    version,
    "Source version mismatch.",
  );
  const work = await mkdtemp(join(tmpdir(), "lykvakt-rebuild-"));
  try {
    for (const [name, bytes] of Object.entries(files)) {
      const path = join(work, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
    const npmRun = async (...args) => {
      try {
        const result = await promisify(execFile)(
          process.execPath,
          [npm, ...args],
          {
            cwd: work,
            maxBuffer: 8 * 1024 * 1024,
            timeout: 300_000,
            windowsHide: true,
          },
        );
        process.stdout.write(result.stdout);
        return result.stdout;
      } catch (error) {
        process.stderr.write(error.stdout ?? "");
        process.stderr.write(error.stderr ?? "");
        throw error;
      }
    };
    const npmVersion = (await npmRun("--version")).trim();
    await npmRun("ci", "--ignore-scripts");
    await npmRun("run", target === "chrome" ? "build" : "build:" + target);
    await npmRun("run", target === "chrome" ? "package" : "package:" + target);
    const rebuilt = await readFile(
      join(work, "artifacts", "lykvakt-" + version + "-" + target + ".zip"),
    );
    const sha256 = compareArchives(original, rebuilt);
    const result = {
      commit,
      version,
      target,
      sha256,
      sourceSha256: digest(source),
      node: process.version,
      npm: npmVersion,
      byteIdentical: true,
    };
    await writeFile(
      join(base, "rebuild-" + target + ".json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      "Reproduced " +
        target +
        " ZIP byte-for-byte from source at " +
        commit +
        ".",
    );
    return result;
  } finally {
    assert(
      dirname(resolve(work)) === resolve(tmpdir()) &&
        basename(work).startsWith("lykvakt-rebuild-"),
      "Unsafe rebuild cleanup path.",
    );
    await rm(work, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await reproduce(process.argv[2], process.argv[3], process.argv[4]);
