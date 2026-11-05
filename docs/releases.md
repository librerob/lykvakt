# Checking a release

A release should be traceable to the source you can read and build yourself. The draft-release workflow checks the browser ZIPs, their SHA-256 files and the source commit before creating a draft. It does not submit anything to a browser store.

## Clean rebuilds

Each browser validation job packages the source, installs the locked dependencies in a new temporary directory with install scripts disabled, and rebuilds its browser ZIP. The rebuilt ZIP must match the original byte for byte. A mismatch fails that browser job and blocks the required validation gate.

The rebuild report records the source commit, source archive hash, browser ZIP hash and toolchain versions. This is a repeat-build check in CI, not an independent review of the code or proof that every possible build environment produces identical output.

Build only source you trust: this command runs the project's build scripts. Verify signed provenance first when it is available; a matching checksum or a commit written inside a ZIP is not proof of its origin.

To repeat it yourself, check out the release commit and put the matching source ZIP, browser ZIP and their separate .sha256 files in artifacts/. Use Node 24:

```sh
npm ci --ignore-scripts
npm run verify:rebuild -- artifacts firefox COMMIT
```

Replace COMMIT with the full 40-character commit from the release notes. Use chrome or edge instead of firefox for those packages. The command builds only from the supplied source archive in a fresh directory and compares the complete ZIP, including its metadata. It removes its own temporary directory after the check. The result is written to artifacts/rebuild-firefox.json.

## Signed build records

When prepare_release runs on main, GitHub's attestation service signs a build-provenance statement for the verified Chrome, Edge, Firefox and source ZIPs. The workflow verifies those signatures before creating or updating a draft and attaches the signature bundle as provenance.json. No long-lived private signing key is stored in this repository.

Signing uses GitHub Actions permissions only in the main-branch draft-release job. Pull-request validation has no signing permissions. The extension's browser permissions do not change.

Using a current GitHub CLI, verify a downloaded ZIP against the repository, workflow, main branch and exact release commit:

```sh
gh attestation verify lykvakt-VERSION-firefox.zip --repo librerob/lykvakt --signer-workflow librerob/lykvakt/.github/workflows/ci.yml --source-ref refs/heads/main --source-digest COMMIT --deny-self-hosted-runners
```

Replace VERSION and COMMIT with the values in the release notes. Repeat for any other ZIP you use. The command checks its SHA-256 digest as part of signature verification; it needs network access to GitHub and the signing trust services.

Older archives are not signed retroactively. A checksum file alone is not a signed build record. These statements cover the original GitHub upload ZIPs, not files repackaged or signed by a browser store. Mozilla signing and browser-store review are separate steps.

A valid signature establishes the claimed build origin. It does not establish that the source is free of bugs, that dependencies are trustworthy or that the application has received an independent security audit. For a critical review, start with [the reviewer brief](../REVIEW.md).

References: [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) and [GitHub CLI verification](https://cli.github.com/manual/gh_attestation_verify).
