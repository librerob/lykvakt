import { setupHelp } from "./setup-help";
import { t } from "../i18n";
import { qrImageInput } from "./qr-input";
import { enrollmentDraft } from "./enrollment-draft";
import { transferReview } from "./transfer";
import { fileChoice } from "./file-choice";
import { authenticateAction } from "./reauth";
import {
  button,
  el,
  input,
  select,
  form,
  submit,
  download,
  readText,
} from "../dom";
import { codeFor, normalizeSecret } from "../otp";
import { validateAccount, type Account } from "../model";
import {
  parseImport,
  previewImport,
  toURI,
  type SkippedEntry,
} from "../import";
import { dialogOperation, type AppContext } from "./context";
export function createEnrollment(ctx: AppContext, drawAccounts: () => void) {
  const { session, run, announce, modal, closeDialog, render, confirmAction } =
    ctx;

  function addAccount(): void {
    const draftForm: typeof form = (...args) =>
      enrollmentDraft(ctx, form(...args), "add");
    const issuer = input("issuer", t("Service name")),
      label = input("label", t("Account name or email")),
      secret = input("secret", t("Setup key"), "password");
    label.control.required = secret.control.required = true;
    secret.control.autocomplete = "off";
    const shortKey = el(
      "p",
      { class: "hint short-key-warning", role: "status" },
      t(
        "Short setup key: use the service's full key exactly. Short keys provide less protection.",
      ),
    );
    shortKey.hidden = true;
    secret.control.addEventListener("input", () => {
      if (secret.control.value.length > 1024) {
        shortKey.hidden = true;
        return;
      }
      try {
        shortKey.hidden = normalizeSecret(secret.control.value).length >= 16;
      } catch {
        shortKey.hidden = true;
      }
    });
    const algorithm = select(
      "algorithm",
      t("Algorithm"),
      {
        "SHA-1": "SHA-1 (standard OTP)",
        "SHA-256": "SHA-256",
        "SHA-512": "SHA-512",
      },
      "SHA-1",
    );
    const digits = select("digits", t("Digits"), { "6": "6", "8": "8" }, "6");
    const type = select(
      "type",
      t("Type"),
      {
        totp: "TOTP · time based",
        hotp: "HOTP · counter based",
        steam: "Steam support",
      },
      "totp",
    );
    const period = input("period", t("Period in seconds"), "number", "30"),
      counter = input("counter", t("HOTP counter"), "text", "0");
    const steamHint = el(
      "p",
      { class: "hint" },
      t(
        "Steam support provides sign-in codes only. Trade and market confirmations are not supported.",
      ),
    );
    steamHint.hidden = true;
    const steamSettings = () => {
      const steam = type.control.value === "steam";
      steamHint.hidden = !steam;
      for (const field of [algorithm, digits, period, counter])
        field.wrapper.hidden = steam;
    };
    type.control.addEventListener("change", steamSettings);
    const group = input("group", t("Group (optional)"));
    modal(
      t("Add account"),
      draftForm(
        async (data) =>
          run(async () => {
            const account = validateAccount({
              id: crypto.randomUUID(),
              issuer: data.get("issuer"),
              label: data.get("label"),
              secret: data.get("secret"),
              type: data.get("type"),
              algorithm:
                data.get("type") === "steam" ? "SHA-1" : data.get("algorithm"),
              digits:
                data.get("type") === "steam" ? 5 : Number(data.get("digits")),
              period:
                data.get("type") === "steam" ? 30 : Number(data.get("period")),
              counter: data.get("type") === "steam" ? "0" : data.get("counter"),
              favorite: false,
              group: data.get("group"),
            });
            const signal = dialogOperation(ctx),
              epoch = session.epoch();
            await codeFor(account);
            signal.throwIfAborted();
            session.check();
            if (epoch !== session.epoch()) return;
            const vaultData = session.accounts();
            const checked = previewImport([account], vaultData.accounts);
            if (checked.conflicts)
              throw new Error(
                "An existing account uses this setup key with different settings. Review that account before adding another.",
              );
            if (checked.duplicates) {
              announce(
                t("That account is already in your vault. Nothing was added."),
              );
              return;
            }
            vaultData.accounts.push(...checked.accounts);
            await session.save(vaultData, undefined, undefined, signal);
            signal.throwIfAborted();
            closeDialog();
            ctx.state.view = "codes";
            render();
            announce(
              t("Account added. Create and verify a new encrypted backup."),
            );
          }),
        el(
          "p",
          { class: "muted" },
          t(
            "Use the secret key shown when you set up two-step verification for a service.",
          ),
        ),

        issuer.wrapper,
        label.wrapper,
        secret.wrapper,
        el(
          "p",
          { class: "hint" },
          t(
            "Clipboard history may keep setup keys and QR images. Clear saved copies in your clipboard manager.",
          ),
        ),
        shortKey,
        el(
          "details",
          {},
          el("summary", {}, t("Advanced options")),
          el(
            "div",
            { class: "stack" },
            type.wrapper,
            steamHint,
            algorithm.wrapper,
            digits.wrapper,
            period.wrapper,
            counter.wrapper,
            group.wrapper,
          ),
        ),
        submit(t("Add account")),
        button(
          t("Import a link or QR image"),
          () => importAccounts(),
          "button text",
        ),
        setupHelp(),
      ),
    );
  }

  async function preview(
    accounts: Account[],
    skipped: SkippedEntry[] = [],
    source?: string,
    signal?: AbortSignal,
    warnings: SkippedEntry[] = [],
  ): Promise<void> {
    session.check();
    signal?.throwIfAborted();
    const previewEpoch = session.epoch();
    const result = previewImport(accounts, session.accounts().accounts);
    if (result.conflicts)
      throw new Error(
        `${result.conflicts} conflicting account(s) share an existing secret but differ in metadata or OTP settings. Nothing was imported. Resolve them in the source export first.`,
      );
    const rows = el("div", { class: "preview-list" });
    for (const a of result.accounts) {
      session.check();
      if (previewEpoch !== session.epoch()) return;
      const code = await codeFor(a);
      signal?.throwIfAborted();
      rows.append(
        el(
          "article",
          {},
          el("strong", {}, a.issuer || a.label),
          el("p", {}, a.label),
          el(
            "small",
            {},
            a.type === "steam"
              ? t("Steam · 5 characters · 30 seconds")
              : `${a.type.toUpperCase()} · ${a.algorithm} · ${a.digits} digits · ${a.type === "hotp" ? "counter " + a.counter : a.period + " seconds"}`,
          ),
          el("p", { class: "otp small" }, code),
        ),
      );
    }
    session.check();
    if (previewEpoch !== session.epoch()) return;
    signal?.throwIfAborted();
    modal(
      t("Review accounts"),
      el(
        "div",
        { class: "stack" },
        source
          ? el("p", { class: "hint" }, `Detected format: ${source}`)
          : null,
        el(
          "p",
          {},
          `${result.accounts.length} new account${result.accounts.length === 1 ? "" : "s"}. ${result.duplicates} exact duplicate${result.duplicates === 1 ? "" : "s"} will be skipped. ${skipped.length} skipped entr${skipped.length === 1 ? "y" : "ies"}.`,
        ),
        el(
          "p",
          { class: "hint" },
          t(
            "Compare codes with your existing authenticator before removing it. A preview does not verify acceptance by the service.",
          ),
        ),
        warnings.length
          ? el(
              "div",
              { class: "import-warnings", lang: "en", role: "note" },
              el(
                "p",
                {},
                "Some setup-link details were normalized. Review these notes before adding accounts.",
              ),
              el(
                "ul",
                {},
                ...warnings.map((entry) =>
                  el("li", {}, "Account " + entry.index + ": " + entry.reason),
                ),
              ),
            )
          : null,
        skipped.length
          ? el(
              "ul",
              {},
              ...skipped.map((entry) =>
                el("li", {}, `Account ${entry.index}: ${entry.reason}`),
              ),
            )
          : null,
        accounts.some((account) => account.secret.length < 16)
          ? el(
              "p",
              { class: "hint short-key-warning" },
              t(
                "Short setup key: use the service's full key exactly. Short keys provide less protection.",
              ),
            )
          : null,
        rows,
        result.accounts.length
          ? button(
              result.accounts.length === 1
                ? t("Add account")
                : t("Add {count} accounts", { count: result.accounts.length }),
              () =>
                run(async () => {
                  const signal = dialogOperation(ctx);
                  const data = session.accounts();
                  const checked = previewImport(result.accounts, data.accounts);
                  if (checked.conflicts || checked.duplicates)
                    throw new Error("Vault changed. Review the import again.");
                  data.accounts.push(...checked.accounts);
                  await session.save(data, undefined, undefined, signal);
                  signal.throwIfAborted();
                  closeDialog();
                  ctx.state.view = "codes";
                  render();
                  announce(
                    t(
                      "Accounts imported. Create and verify a new encrypted backup.",
                    ),
                  );
                }),
              "button primary",
            )
          : null,
      ),
    );
    if (skipped.length)
      announce(
        `${skipped.length} skipped. Account ${skipped[0]!.index}: ${skipped[0]!.reason} Review all reasons before importing.`,
      );
  }

  function importAccounts(qrOnly = false): void {
    const draftForm: typeof form = (...args) =>
      enrollmentDraft(ctx, form(...args), "import");
    const area = el("textarea", {
      name: "payload",
      rows: "4",
      spellcheck: "false",
      autocomplete: "off",
      placeholder: "otpauth://totp/…",
    });
    const file = input("file", t("Or select an export file"), "file");
    file.control.accept = ".txt,.json,.2fas,.maFile,.authpro";
    const sourcePassword = input(
      "sourcePassword",
      t("Export file password"),
      "password",
    );
    sourcePassword.wrapper.hidden = true;
    const qr = input("qr", t("Read a QR image locally"), "file");
    qr.control.accept = "image/png,image/jpeg,image/webp";
    qr.control.multiple = true;
    let reading = false;
    const readImages = (files: File[]) =>
      run(async () => {
        if (reading || area.isConnected === false || !files.length) return;
        reading = true;
        const epoch = session.epoch(),
          signal = dialogOperation(ctx);
        try {
          session.check();
          signal.throwIfAborted();
          if (
            files.length > 100 ||
            files.reduce((n, f) => n + f.size, 0) > 24_000_000
          )
            throw new Error(
              "Choose up to 100 QR images, at most 24 MB in total.",
            );
          if (ctx.isExtension) session.rememberDraft();
          area.disabled = true;
          announce(t("Reading QR image on this device…"));
          const { readQRs } = await import("../qr");
          const values: string[] = [];
          for (const file of files) {
            signal.throwIfAborted();
            values.push(...(await readQRs(file, signal)));
          }
          session.check();
          if (epoch !== session.epoch()) return;
          const imported = parseImport(values.join("\n"), "uri", true);
          signal.throwIfAborted();
          await preview(
            imported.accounts,
            imported.skipped,
            undefined,
            signal,
            imported.warnings,
          );
        } finally {
          reading = false;
          area.disabled = false;
          qr.control.value = "";
        }
      });
    qrImageInput(area, readImages, announce);
    qr.control.addEventListener("change", () => {
      void readImages([...(qr.control.files ?? [])]);
    });
    if (qrOnly) {
      area.setAttribute("readonly", "");
      area.removeAttribute("placeholder");
      area.className = "qr-drop-target";
      area.addEventListener("paste", (event) => {
        if (!(event as ClipboardEvent).clipboardData?.files.length) {
          event.preventDefault();
          announce(
            t(
              "No image was pasted. Copy the QR image itself, or choose an image file.",
            ),
          );
        }
      });
      modal(
        t("Import QR image"),
        el(
          "div",
          { class: "stack qr-import-view" },
          el(
            "p",
            { class: "hint" },
            t("Choose image, paste, or drop — PNG, JPEG or WebP"),
          ),
          el(
            "label",
            { class: "field" },
            el("span", {}, t("Paste or drop a QR image")),
            area,
          ),
          fileChoice(ctx, qr.wrapper),
          el(
            "p",
            { class: "hint" },
            t(
              "You can also paste a copied QR image here or drop an image file. Images are read locally and are not saved as drafts. Clipboard history may keep copied images.",
            ),
          ),
          setupHelp(),
        ),
      );
      return;
    }
    const qrAction = button(
      t("Import QR image"),
      () => importAccounts(true),
      "button tonal",
      { "aria-describedby": "qr-import-formats" },
    );
    modal(
      t("Import accounts"),
      draftForm(
        async (data) =>
          run(async () => {
            try {
              const epoch = session.epoch(),
                signal = dialogOperation(ctx);
              const f = file.control.files?.[0];
              const payload = f
                ? await readText(f)
                : String(data.get("payload"));
              session.check();
              if (epoch !== session.epoch()) return;
              signal.throwIfAborted();
              const { detectImport, readDetectedImport } =
                await import("../import-formats");
              signal.throwIfAborted();
              const detected = detectImport(payload);
              sourcePassword.wrapper.hidden = !detected.encrypted;
              if (detected.encrypted && !sourcePassword.control.value) {
                announce(
                  `Detected format: ${detected.name}. Enter the password for this export file, then preview again.`,
                );
                sourcePassword.control.focus();
                return;
              }
              const imported = await readDetectedImport(
                detected,
                sourcePassword.control.value,
                signal,
                true,
              );
              session.check();
              if (epoch !== session.epoch()) return;
              area.value = "";
              file.control.value = "";
              signal.throwIfAborted();
              await preview(
                imported.accounts,
                imported.skipped,
                imported.name,
                signal,
                imported.warnings,
              );
            } finally {
              sourcePassword.control.value = "";
            }
          }),
        el(
          "div",
          { class: "stack qr-import-entry" },
          qrAction,
          el(
            "p",
            { class: "hint", id: "qr-import-formats" },
            t("Choose image, paste, or drop — PNG, JPEG or WebP"),
          ),
        ),
        el(
          "p",
          { class: "hint" },
          t(
            "OTP setup link drafts can resume during this unlock session. Other pasted export text stays only in this form and is not remembered when you close it.",
          ),
        ),
        sourcePassword.wrapper,

        el(
          "label",
          { class: "field" },
          el("span", {}, t("Setup links or export text")),
          area,
        ),
        el(
          "p",
          { class: "hint" },
          t(
            "You can also paste a copied QR image here or drop an image file. Images are read locally and are not saved as drafts. Clipboard history may keep copied images.",
          ),
        ),
        fileChoice(ctx, file.wrapper, qr.wrapper),
        el(
          "p",
          { class: "hint" },
          t(
            "All parsing happens on this device. For Google Authenticator, choose Transfer accounts → Export accounts on your phone, then select images of every transfer QR together. Aegis and 2FAS password-protected exports can be opened locally. The file password is used only for this import. Invalid entries are listed for review before saving valid accounts. Incomplete batches and conflicting imports save nothing.",
          ),
        ),

        submit(t("Review import")),
      ),
    );
  }

  function editAccount(id: string): void {
    const a = session.accounts().accounts.find((x) => x.id === id)!;
    const issuer = input("issuer", t("Service name"), "text", a.issuer),
      label = input("label", t("Account name or email"), "text", a.label),
      group = input("group", t("Group"), "text", a.group);
    modal(
      t("Edit account"),
      form(
        async (fields) =>
          run(async () => {
            const signal = dialogOperation(ctx);
            const data = session.accounts(),
              entry = data.accounts.find((x) => x.id === id)!;
            entry.issuer = String(fields.get("issuer"));
            entry.label = String(fields.get("label"));
            entry.group = String(fields.get("group"));
            await session.save(data, undefined, undefined, signal);
            signal.throwIfAborted();
            closeDialog();
            drawAccounts();
          }),
        issuer.wrapper,
        label.wrapper,
        group.wrapper,
        el(
          "p",
          { class: "hint" },
          a.type === "steam"
            ? t("Steam · 5 characters · 30 seconds. Sign-in codes only.")
            : `${a.type.toUpperCase()} · ${a.algorithm} · ${a.digits} digits. OTP settings are preserved.`,
        ),
        submit(t("Save changes")),
        button(
          t("Show transfer QR…"),
          () =>
            run(() => {
              const review = transferReview([
                session.accounts().accounts.find((entry) => entry.id === id)!,
              ]);
              authenticateAction(
                ctx,
                t("Reveal account QR?"),
                t(
                  "This QR contains the setup secret. Anyone who scans it can generate codes. Scan it in the destination app, compare codes, then close this dialog.",
                ),
                t("Reveal QR"),
                async (signal) => {
                  const epoch = session.epoch();
                  const entry = review.accounts[0]!;
                  const QRCode = await import("qrcode");
                  const uri = toURI(entry);
                  if (uri.length > 1500)
                    throw new Error(
                      "This setup key is too large for a practical QR. Export its OTP link instead.",
                    );
                  const image = await QRCode.toDataURL(uri, {
                    width: 320,
                    margin: 4,
                    errorCorrectionLevel: "M",
                  });
                  session.check();
                  if (epoch !== session.epoch()) return;
                  signal.throwIfAborted();
                  modal(
                    t("Account transfer QR"),
                    el(
                      "div",
                      { class: "stack" },
                      el("p", {}, entry.issuer + " · " + entry.label),
                      el("img", {
                        src: image,
                        alt: "Secret account transfer QR",
                        class: "transfer-qr",
                      }),
                      el(
                        "p",
                        { class: "hint" },
                        entry.type === "steam"
                          ? t(
                              "Steam setup link. Only apps supporting otpauth://steam can read it. Favorites and groups are not transferred.",
                            )
                          : t(
                              "Standard otpauth QR. Check algorithm, digits, period and counter support in the destination app. Favorites and groups are not transferred.",
                            ),
                      ),
                    ),
                  );
                },
                review,
              );
            }),
          "button text",
        ),
        button(
          t("Export plaintext OTP URI…"),
          () =>
            run(() => {
              const review = transferReview([
                session.accounts().accounts.find((entry) => entry.id === id)!,
              ]);
              authenticateAction(
                ctx,
                t("Export secret in plaintext?"),
                t(
                  "Anyone with this file can generate codes for this account. Keep it private and remove the file when migration is complete.",
                ),
                t("Export this account"),
                async (signal) => {
                  session.check();
                  signal.throwIfAborted();
                  const entry = review.accounts[0]!;
                  download(toURI(entry), "otp-account.txt");
                },
                review,
              );
            }),
          "button text",
        ),
        button(
          t("Delete account…"),
          () =>
            confirmAction(
              t("Delete this account?"),
              t(
                "Make sure another authenticator or service recovery code works first. This removes the account from the current vault. The recent encrypted recovery copy may retain it until the next save or a master-password change. Browser storage cannot guarantee forensic erasure.",
              ),
              t("Delete account"),
              async (signal) => {
                const data = session.accounts();
                data.accounts = data.accounts.filter((x) => x.id !== id);
                await session.save(data, undefined, undefined, signal);
                signal.throwIfAborted();
                drawAccounts();
              },
            ),
          "button danger",
        ),
      ),
    );
  }

  function resumeDraft(): void {
    const saved = session.draft();
    if (saved?.mode === "add") addAccount();
    else if (saved?.mode === "import") importAccounts();
  }
  return { addAccount, preview, importAccounts, editAccount, resumeDraft };
}
