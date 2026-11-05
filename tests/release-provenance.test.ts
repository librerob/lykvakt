import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );

it("keeps signing privileges out of push and pull-request validation jobs", () => {
  const workflow = read(".github/workflows/ci.yml");
  const [validation, release] = workflow.split("\n  release:");
  expect(validation).not.toMatch(/id-token: write|attestations: write/);
  expect(release).toContain(
    "github.event_name == 'workflow_dispatch' && inputs.prepare_release && github.ref == 'refs/heads/main'",
  );
  expect(release).toContain("needs: validate");
  expect(release).toContain("id-token: write");
  expect(release).toContain("attestations: write");
  expect(release).toContain("create-storage-record: false");
});
it("verifies all packages before signing and verifies the signer before changing a draft", () => {
  const workflow = read(".github/workflows/ci.yml");
  const release = workflow.slice(workflow.indexOf("\n  release:"));
  const verify = release.indexOf("node scripts/verify-release.mjs");
  const sign = release.indexOf("uses: actions/attest@");
  const verifySignature = release.indexOf("gh attestation verify");
  const draft = release.indexOf("gh release view");
  expect(verify).toBeGreaterThan(-1);
  expect(sign).toBeGreaterThan(verify);
  expect(verifySignature).toBeGreaterThan(sign);
  expect(draft).toBeGreaterThan(verifySignature);
  expect(release).toContain('--source-digest "$GITHUB_SHA"');
  expect(release).toContain("--source-ref refs/heads/main");
  expect(release).toContain(
    "--signer-workflow librerob/lykvakt/.github/workflows/ci.yml",
  );
  expect(release).toContain("--deny-self-hosted-runners");
  expect(release).toMatch(/uses: actions\/attest@[a-f0-9]{40}/);
});
it("requires a fresh source rebuild before browser validation jobs can finish", () => {
  const chrome = read(".github/workflows/ci.yml").split("\n  browsers:")[0];
  const browsers = read(".github/workflows/browsers.yml");
  expect(chrome).toContain(
    'npm run verify:rebuild -- artifacts chrome "$GITHUB_SHA"',
  );
  expect(browsers).toContain(
    'npm run verify:rebuild -- artifacts edge "$GITHUB_SHA"',
  );
  expect(browsers).toContain(
    'npm run verify:rebuild -- artifacts firefox "$GITHUB_SHA"',
  );
  expect(chrome).not.toMatch(/continue-on-error/);
  expect(browsers).not.toMatch(/continue-on-error/);
});
