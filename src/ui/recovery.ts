import { t } from "../i18n";
import { VaultCreatedError } from "../session";
import { transferReview } from "./transfer";
import { fileChoice } from "./file-choice";
import { backupCompatibilityMessage, busyCopy } from "../help";
import { savePreference } from "../preferences";
import { withGenerator } from "./passphrase";
import { authenticateAction, verifyMasterPassword } from "./reauth";
import { button, el, input, form, submit, download, readText } from "../dom";
import { load } from "../storage";
import { createEnvelope, snapshot } from "../crypto";
import { toURI, verifyBackup } from "../import";
import type { Account, VaultData } from "../model";
import { dialogOperation, type AppContext } from "./context";
export async function needsBackup(data: VaultData): Promise<boolean> {
  return !data.verifiedAt || data.verifiedSnapshot !== (await snapshot(data));
}
export function createRecovery(
  ctx: AppContext,
  preview: (
    accounts: Account[],
    skipped?: import("../import").SkippedEntry[],
    signal?: AbortSignal,
  ) => Promise<void>,
  importAccounts?: () => void | Promise<void>,
) {
  const { session, state, run, announce, modal, closeDialog, render } = ctx;

  function backupsView(): HTMLElement {
    const data = session.accounts();
    const health = el(
      "div",
      { class: "health" },
      el("h2", {}, t("Vault health")),
      el(
        "dl",
        {},
        el("dt", {}, t("Accounts")),
        el("dd", {}, String(data.accounts.length)),
        el("dt", {}, t("Storage")),
        el("dd", {}, t("Password protected on this device")),
        el("dt", {}, t("Unlock methods")),
        el("dd", {}, t("Master password")),
        el("dt", {}, t("Last matching file verification")),
        el(
          "dd",
          {},
          data.verifiedAt
            ? new Date(data.verifiedAt).toLocaleString()
            : t("Not yet verified"),
        ),
      ),
    );
    void needsBackup(data).then((needed) => {
      if (!health.isConnected) return;
      health.append(
        el(
          "p",
          { class: "hint" },
          !needed
            ? t(
                "The last tested backup matched this account snapshot. Keep the file somewhere safe; its continued availability is not monitored.",
              )
            : t("Your current accounts need a matching, verified backup."),
        ),
      );
    });
    return el(
      "section",
      { class: "content stack" },
      el("h1", {}, t("Backup")),
      el(
        "ol",
        { class: "backup-steps" },
        el("li", {}, t("Save an encrypted backup outside this browser.")),
        el(
          "li",
          {},
          t("Open the saved file and check it with your backup passphrase."),
        ),
        el(
          "li",
          {},
          t(
            "To restore on a new browser, choose Restore an encrypted backup on its setup screen.",
          ),
        ),
      ),
      importAccounts
        ? el(
            "div",
            { class: "settings-section stack" },
            el("h2", {}, t("Import accounts")),
            el(
              "p",
              {},
              t(
                "Add accounts from setup links, QR images or compatible export files.",
              ),
            ),
            button(t("Import accounts"), importAccounts, "button tonal"),
          )
        : null,
      el(
        "p",
        { class: "muted" },
        t("A backup is useful when you know it restores."),
      ),
      health,

      el(
        "div",
        { class: "settings-section stack" },
        el("h2", {}, t("Recent copy")),
        el(
          "p",
          {},
          t(
            "This browser keeps a recent locked copy for recovery when the current copy cannot be read. It is separate from the backup file you save elsewhere.",
          ),
        ),
      ),
      el(
        "div",
        { class: "settings-section" },
        el("h2", {}, t("Move to another authenticator")),

        el(
          "p",
          {},
          t(
            "Export accounts as OTP links. Steam links need an app supporting otpauth://steam. For a scannable QR, open an account’s Edit menu. Destination apps may support different OTP settings.",
          ),
        ),
        button(
          t("Export plaintext OTP links…"),
          () =>
            run(() => {
              const review = transferReview(session.accounts().accounts);
              authenticateAction(
                ctx,
                t("Export every setup secret?"),
                t(
                  "This unencrypted file lets anyone generate your codes. It excludes favorites and groups. Keep it private, verify the destination app, then remove the file.",
                ),
                t("Export all OTP links"),
                async (signal) => {
                  session.check();
                  signal.throwIfAborted();
                  download(
                    review.accounts.map(toURI).join("\n") + "\n",
                    "lykvakt-otp-links.txt",
                  );
                },
                review,
              );
            }),
          "button text",
        ),
      ),
      el(
        "div",
        { class: "settings-section" },
        el("h2", {}, t("1. Save an encrypted backup")),
        el("p", { class: "hint" }, t(backupCompatibilityMessage)),

        el(
          "p",
          {},
          t(
            "Includes every account, secret, algorithm, period, counter, favorite and group. Choose a separate backup passphrase.",
          ),
        ),
        button(
          t("Create encrypted backup"),
          () => backupExport(),
          "button primary",
        ),
      ),
      el(
        "div",
        { class: "settings-section" },
        el("h2", {}, t("2. Test the file you saved")),

        el(
          "p",
          {},
          t(
            "Open the actual downloaded file. Decrypt it in memory, validate every record, generate test codes, and compare it with this vault.",
          ),
        ),
        button(
          t("Verify or restore a backup"),
          () => backupVerify(),
          "button tonal",
        ),
      ),
      el(
        "aside",
        { class: "notice" },
        el("strong", {}, t("Keep recovery independent")),
        el(
          "p",
          {},
          t(
            "Store the file and its passphrase safely, separately from this browser. Password loss cannot be reversed. Keep website recovery codes and your old authenticator until migration is verified.",
          ),
        ),
      ),
    );
  }

  function backupExport(): void {
    const master = input("masterPassword", t("Master password"), "password"),
      password = input("password", t("Backup passphrase"), "password"),
      confirmation = input(
        "confirmation",
        t("Confirm backup passphrase"),
        "password",
      );
    master.control.required = true;
    master.control.maxLength = 1024;
    password.control.autocomplete = confirmation.control.autocomplete =
      "new-password";
    modal(
      t("Create encrypted backup"),
      form(
        async (fields, f) =>
          run(async () => {
            const password = String(fields.get("password"));
            const data = session.accounts(),
              epoch = session.epoch(),
              signal = dialogOperation(ctx);
            let contents: string;
            announce(t(busyCopy.backup));
            try {
              if (password !== fields.get("confirmation"))
                throw new Error("Passphrases do not match.");
              await verifyMasterPassword(ctx, master.control.value, signal);
              contents = JSON.stringify(
                (await createEnvelope(password, data, "backup", signal))
                  .envelope,
              );
            } finally {
              f.reset();
            }
            session.check();
            signal.throwIfAborted();
            if (epoch !== session.epoch()) return;
            download(
              contents,
              `lykvakt-backup-${new Date().toISOString().slice(0, 10)}.json`,
            );
            closeDialog();
            announce(
              t(
                "Encrypted backup exported. Verify the saved file to test restoration.",
              ),
            );
          }),
        master.wrapper,
        el(
          "p",
          { class: "hint" },
          t("Confirm your master password before exporting setup secrets."),
        ),
        withGenerator(password),

        confirmation.wrapper,
        el(
          "p",
          { class: "hint" },
          t("This file restores using its own passphrase."),
        ),
        submit(t("Save encrypted file")),
      ),
    );
  }

  function backupVerify(): void {
    if (ctx.isPopup) {
      modal(t("Choose a backup file"), fileChoice(ctx));
      return;
    }
    const file = input("file", t("Encrypted backup file"), "file"),
      password = input("password", t("Backup passphrase"), "password");
    file.control.accept = ".json";
    modal(
      t("Verify backup restoration"),
      form(
        async (_fields, f) =>
          run(async () => {
            const selected = file.control.files?.[0];
            if (!selected) throw new Error("Choose the backup file you saved.");
            const current = session.accounts(),
              epoch = session.epoch(),
              signal = dialogOperation(ctx);
            const passwordValue = password.control.value;
            let result: Awaited<ReturnType<typeof verifyBackup>>;
            announce(t(busyCopy.verify));
            try {
              const text = await readText(selected);
              signal.throwIfAborted();
              result = await verifyBackup(
                JSON.parse(text),
                passwordValue,
                current,
                signal,
              );
            } finally {
              f.reset();
            }
            session.check();
            signal.throwIfAborted();
            if (epoch !== session.epoch()) return;
            if (result.matches) {
              const updated = session.accounts();
              updated.verifiedAt = new Date().toISOString();
              updated.verifiedSnapshot = result.fingerprint;
              await session.save(updated, undefined, undefined, signal);
              signal.throwIfAborted();
            }
            modal(
              t("Restoration tested"),
              el(
                "div",
                { class: "stack" },
                el(
                  "p",
                  {},
                  `${result.count} account(s) decrypted, schema validated, and test codes generated.`,
                ),
                el(
                  "p",
                  {},
                  result.matches
                    ? t("Exact account snapshot match with this vault.")
                    : t(
                        "This file differs from the current vault. It may be an older or different backup. It has not been marked as a matching backup.",
                      ),
                ),
                el(
                  "p",
                  { class: "hint" },
                  t(
                    "No active accounts were replaced. This test does not prove codes will be accepted by websites.",
                  ),
                ),
                result.matches
                  ? null
                  : button(
                      t("Preview safe merge"),
                      () =>
                        run(() => {
                          dialogOperation(ctx).throwIfAborted();
                          return preview(
                            result.data.accounts,
                            [],
                            dialogOperation(ctx),
                          );
                        }),
                      "button tonal",
                    ),
                button(
                  t("Done"),
                  () => {
                    closeDialog();
                    render();
                  },
                  "button primary",
                ),
              ),
            );
          }),
        file.wrapper,
        password.wrapper,

        submit(t("Decrypt & test restoration")),
      ),
    );
  }

  function recoverySetup(): void {
    if (ctx.isPopup) {
      modal(t("Choose a backup file"), fileChoice(ctx));
      return;
    }
    const file = input("file", t("Encrypted backup file"), "file"),
      backup = input("backup", t("Backup passphrase"), "password"),
      password = input("password", t("New master password"), "password"),
      confirm = input("confirm", t("Confirm new master password"), "password");
    password.control.autocomplete = confirm.control.autocomplete =
      "new-password";
    modal(
      t("Recover into a new vault"),
      form(
        async (_fields, f) =>
          run(async () => {
            const epoch = session.epoch(),
              signal = dialogOperation(ctx);
            try {
              if (await load())
                throw new Error(
                  "A vault already exists. Unlock it and use the safe merge workflow.",
                );
              signal.throwIfAborted();
              const selected = file.control.files?.[0];
              if (!selected) throw new Error("Choose an encrypted backup.");
              if (password.control.value !== confirm.control.value)
                throw new Error("Passwords do not match.");
              const masterPassword = password.control.value;
              announce(t(busyCopy.verify));
              const text = await readText(selected);
              signal.throwIfAborted();
              const result = await verifyBackup(
                JSON.parse(text),
                backup.control.value,
                undefined,
                signal,
              );
              signal.throwIfAborted();
              if (epoch !== session.epoch())
                throw new Error("Recovery cancelled by locking.");
              f.reset();
              announce(t(busyCopy.setup));
              await session.setup(
                masterPassword,
                { ...result.data, verifiedAt: null, verifiedSnapshot: null },
                signal,
              );
              state.exists = true;
              if (!session.unlocked) {
                render();
                return;
              }
              state.firstRunTip = true;
              savePreference("firstRunTips", "true");
              closeDialog();
              render();
              announce(
                `Recovered ${result.count} account(s). Verify their codes before retiring your previous authenticator.`,
              );
            } catch (error) {
              if (!(error instanceof VaultCreatedError)) throw error;
              state.exists = true;
              state.recovery = undefined;
              closeDialog();
              render();
              announce(error.message, true);
            } finally {
              f.reset();
            }
          }),
        file.wrapper,
        backup.wrapper,

        withGenerator(password),

        confirm.wrapper,
        submit(t("Test & recover accounts")),
      ),
    );
  }

  return { backupsView, recoverySetup };
}
