# Using Lykvakt

Lykvakt keeps your authenticator accounts in an encrypted vault on this device. The toolbar button, Ctrl+Shift+Y, or Command+Shift+Y on Mac opens a small popup. Edge uses Ctrl+Shift+7 (Command+Shift+7 on Mac). Firefox on Linux also uses Ctrl+Shift+7.

## Opening and locking

Closing or switching away from the popup keeps your unlock session available. You can copy a setup key from a website, reopen Lykvakt and continue the Add account form. Small OTP setup-link drafts are remembered too. Other pasted export text stays only in the open form; file selections and authentication passwords are not remembered.

In **Settings → Auto-lock**, choose 1, 5, 15 or 30 minutes, or 1 hour of inactivity. The default is five minutes. If you previously chose **When this window closes**, the update changes that setting to five minutes. **When the browser restarts** turns off the inactivity timer. **Lock** ends the session in every view; use it before leaving your computer.

The separate window is still used for choosing files and QR images. It uses the current unlock session, so it asks for your password only if the session has ended. Chrome clears the temporary session when it restarts or the extension reloads, updates or is disabled. Closing all Chrome windows does not always quit Chrome if background apps are enabled.

## Passwords

You choose the length of a new vault or backup password. It must be non-empty; the 1,024-character maximum bounds input size. We recommend a long, unique passphrase of at least 14 characters. Short passwords are easier to guess if somebody obtains your encrypted file.

**Generate** offers seven randomly chosen words. Write the phrase down before continuing, then confirm it. The suggestion disappears when you leave the field. Passwords are normalized consistently, so avoid relying on visually similar characters as different passwords.

There is no password reset or developer recovery service. Keep the password and a verified backup somewhere safe.

Choosing **When the browser restarts** turns off the inactivity timer. The browser keeps the key needed to reopen your vault in temporary memory, so closing the popup or window does not lock it. It does not keep your master password. Use **Lock** when you are finished, and choose a timed option on a shared computer.

## Adding or importing accounts

Use the setup key or QR image supplied when you enable two-step sign-in on a service. This is different from the short code used to sign in.

Open **Backup → Import accounts**. Pasting setup links, export text or QR images works in either mode. Image files can also be dropped into the import text box. To choose an export file, QR image or backup, select **Open in a window to choose a file**. The window uses your current unlock session and asks for your password only if that session has ended. File selection uses a separate window because browsers can close the small popup while a file picker is open.

Review the accounts and every skipped entry before saving. Check the new codes before retiring your existing authenticator. The [design guide](design.md#import-contracts-and-sources) explains format support and limits.

Steam support covers authentication codes, not trade or market confirmations. Its setup secret normally comes from a compatible export or another authenticator. Files containing it can also hold other sensitive data, so keep them private.

## Codes, copying and counters

Click an account row to copy the current code. The confirmation names the account. Clipboard managers and other apps may retain copied values.

Codes start hidden. Reveal a code separately to read it; timed reveals hide after 30 seconds. Switching away masks revealed codes; closing a view drops its local key references while the timed session remains available. **Always show codes** and the **Next** preview are optional settings. Copy always uses the current code.

Search for part of an account name and press Enter to copy the first match. An empty search copies nothing. Use **Settings → Change shortcut** if another app uses it. This opens the shortcut controls for your browser; in Firefox, open the gear menu in the add-ons manager and choose **Manage Extension Shortcuts**.

HOTP accounts use a counter. Copying does not advance it. Confirm **More → Advance counter** only after the service consumes that code. Do not reuse a counter value you already submitted.

## Backups

For numbered instructions, see [Back up and restore your accounts](backups.md). It covers saving, checking, restoring into a fresh vault and merging into an existing one.

In **Backup**, create an encrypted backup with a separate passphrase. You must confirm the master password before exporting account secrets.

Save the file outside the browser. Then choose **Verify or restore a backup**, open the actual saved file and enter its backup passphrase. Verification tests the file and compares its accounts without replacing your active vault. A matching result does not prove that websites will accept the codes.

To recover into a fresh vault, choose **Restore an encrypted backup** on setup. If a vault already exists, you review the accounts before merging them. Keep website recovery codes and independently stored backups.

## Moving accounts out

**Export plaintext OTP links** and an account's transfer QR contain setup secrets. Confirm the master password first. Anybody holding the file or QR can generate the same codes.

Check that the destination supports your account settings, verify its codes and remove temporary plaintext copies. Favorites and groups are not included in portable OTP links.

## Older copies and older versions

The browser keeps a previous encrypted revision for corruption recovery. If offered, you must choose it and enter its password. It can be missing recent changes; HOTP counters may be behind, so do not reuse submitted codes.

Very old preview formats need export through the working old app. See [migration and recovery](design.md#before-updating) before erasing an old vault. Renaming the extension or changing its interface does not make the old format readable.

## Security and privacy

A fake sign-in page can steal a code, and compromised software can read unlocked data. Check the site before entering a code. There has been no independent security audit; the [security policy](../SECURITY.md), [privacy policy](../PRIVACY.md) and [design guide](design.md) explain the limits.

The extension uses clipboardWrite for copying, storage for the temporary session, and alarms for expiry. Its small background worker handles local session state only. There are no content scripts, host permissions or automatic uploads. It never reads or changes websites. Open in a window only finds and focuses Lykvakt's own extension window.

The vault and code generation work offline. Essential help is bundled in the app and works offline. The optional full-guide link opens GitHub in a browser tab and needs an internet connection.

## Paste a QR image

For an image-first screen, choose **Backup → Import accounts → Import QR image**. Choose an image in window mode, or paste/drop it into **Paste or drop a QR image**. PNG, JPEG and WebP are supported. Review the decoded accounts before adding them.

Copy the QR image or a cropped screenshot, open **Backup → Import accounts**, focus **Setup links or export text** and paste with Ctrl+V (Command+V on Mac). Review the accounts, then choose **Add account** or **Add N accounts**. Image-file drops use the same review. A dropped website image may supply only a URL; Lykvakt explains this and never downloads it.

On Windows, Win+Shift+S opens Snipping Tool; select the QR and copy the image if needed. On Mac, Control+Shift+Command+4 copies a selected region. Screenshot tools may save files automatically, and clipboard history may retain images containing setup secrets. Check those settings if you want to avoid extra copies. See [Microsoft’s screenshot guide](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots) and [Apple’s guide](https://support.apple.com/en-gb/102646).

## If you cannot find a setup key

Some services show a QR code first and hide the text key behind **Can't scan?**, **Enter manually**, **Show key** or a similar link. Use the full setup key supplied by the service, not the short code used to sign in. Do not invent extra characters or pad a short key.

If there is only a QR image:

1. Copy the QR image, or take a tightly cropped screenshot of just the QR. On Windows, use Win+Shift+S. On Mac, Control+Shift+Command+4 copies a region to the clipboard. On Linux, use your screenshot tool's copy-region option.
2. Open Lykvakt, choose **Add account → Import a link or QR image** or **Backup → Import accounts**, and focus **Setup links or export text**.
3. Paste with Ctrl+V or Command+V. You can also drop an image file into that box. To choose a saved image, use the separate window.
4. Review the account details, any compatibility notes and any skipped entries, then choose **Add account**. Check the codes before removing your old authenticator.

Lykvakt reads the image on your device. It does not capture the page, fetch a dropped image URL or upload the image. Screenshot tools may also save a file, and clipboard history may keep the image. See the next section before sharing screenshots.

Not every QR is an OTP setup code. Some are login links, device-pairing codes or approvals for a service's own app. If Lykvakt cannot import it, use the service's manual setup option, a supported export, or its recovery instructions. A screenshot cannot convert a proprietary approval method into standard OTP.

Standard OTP setup keys shorter than 10 bytes, including the public `2FASTEST` demonstration key, are accepted with a warning. A short key is weaker, but changing it would generate the wrong codes. Older Lykvakt versions reject these short keys. Manual entry saves with **Add account** after validation; bulk imports still require a review.

## Clipboard and screenshot copies

A setup key or account QR is a long-lived secret: someone holding it can generate your codes. Clipboard history, clipboard-sync tools and screenshot folders may keep copies. Lykvakt cannot erase those copies or guarantee secure deletion.

- **Windows:** open clipboard history with Win+V and remove the sensitive item. **Clear all** leaves pinned items, so remove those separately. Check clipboard-sync settings and any other clipboard manager too. See [Microsoft's clipboard guide](https://support.microsoft.com/en-us/windows/apps/using-the-clipboard).
- **Mac:** check clipboard history, any clipboard manager and Handoff/Universal Clipboard settings. Universal Clipboard can make copied content available on nearby Apple devices. See [Apple's guide](https://support.apple.com/en-nz/102430).
- **Linux:** use the history and clearing controls of your desktop environment or clipboard manager; there is no single procedure shared by every desktop.
- **All systems:** copying unrelated text replaces the current clipboard item but does not clear copies saved elsewhere. Check whether your screenshot tool saved an image file and remove temporary copies after verifying the account.

Lykvakt does not automatically overwrite the clipboard: a delayed clear could destroy something you copied afterward and would still leave history copies. It does not request clipboard-read access. Images pasted into Import accounts are read from that explicit paste event.

## If unlocking feels slow

A password unlock deliberately runs Argon2id locally with 64 MiB, three passes and one lane. Memory cost is only part of the work; browser JavaScript engines, device load and power settings also affect the delay. The account list is not the main password-checking work.

An unexpired unlock session reopens without running the password derivation again. Keep the default five-minute inactivity timer, or choose a longer timed option in Settings if that fits your device use. **Lock** still ends the session in every view. The browser-restart option disables inactivity locking and has a different security trade-off.

Lykvakt does not silently lower password protection to speed up a device. A benchmark from a different browser or computer is not a guarantee for yours. Maintainers can use the synthetic Node benchmark and browser CI's unlock measurements without uploading a real vault or password.

A backward system-clock correction ends an unlock session, even if the correction is small. Unlock again after checking your system clock; the app does not extend the old session to compensate.

Translations are an initial, unreviewed pass. Some safety instructions and detailed import reports are still in English. Switch to English if a translation is unclear, and keep a verified backup before moving accounts.
