# Back up and restore your accounts

Your vault lives in this browser. Uninstalling Lykvakt, clearing browser data or losing the device can remove it. A backup is an encrypted file you keep somewhere else. Lykvakt does not upload it for you.

## Save a backup

1. Unlock Lykvakt and open **Backup**.
2. Choose **Create encrypted backup**.
3. Enter your **master password** to approve the export. Then choose and confirm a **backup passphrase**. The saved file uses that backup passphrase, even if you later change your master password.
4. Choose **Save encrypted file**. Keep the downloaded `lykvakt-backup-YYYY-MM-DD.json` outside this browser, somewhere you can reach if the device is lost. Store the passphrase safely too.
5. Check that exact file using the steps below. Downloading it alone does not mark it as verified.

Use a long, unique passphrase. There is no password reset, and the developer cannot recover either password. Keep website recovery codes separately.

## Check the file you saved

1. In **Backup**, choose **Verify or restore a backup**. If the popup offers **Open in a window to choose a file**, use that button, then open Backup in the window.
2. Select the downloaded backup file and enter its **backup passphrase**, not your master password.
3. Choose **Decrypt & test restoration**.
4. Look for **Exact account snapshot match with this vault.** Your current accounts have not been replaced. This checks the file, its passphrase and the saved account data; it does not sign in to websites.

If the file differs, it may be older or belong to another vault. Nothing is merged automatically. Choose **Preview safe merge** only if you intend to review and add accounts from that file.

Make and check a new backup after adding, editing or deleting accounts. HOTP counter advances also change the account snapshot. Verification records the check; it cannot tell whether you later move or delete the file.

## Restore in a new browser or after losing a vault

1. Install Lykvakt and open it. On the setup screen, choose **Restore an encrypted backup**. Open the separate window if prompted.
2. Select the backup file and enter its **backup passphrase**.
3. Choose and confirm a **new master password** for the vault on this browser. This does not change the backup file's passphrase.
4. Choose **Test & recover accounts**. Check your account names and compare codes with your working authenticator before removing it. HOTP counters in an older backup may be behind: do not reuse codes you already submitted.
5. Save and verify a new backup when you have finished.

If a vault already exists, unlock it and use **Backup → Verify or restore a backup** instead. A different backup leads to a review before accounts are merged. It does not silently overwrite the vault.

## If something goes wrong

- **Password does not work:** check Caps Lock and use the backup passphrase. Changing the vault's master password does not change old backup files.
- **File is damaged or cannot be read:** keep the original file and try another backup. Do not erase a working vault to troubleshoot.
- **Backup is from an older version:** see [migration and recovery](design.md#before-updating). Backups made with this version need this version or newer to restore.
- **Moving to another authenticator:** use [portable account exports](usage.md#moving-accounts-out). Lykvakt's encrypted backup is for Lykvakt; plaintext OTP links and transfer QR images expose the setup secrets.

For the first restore, practise with a synthetic account in a separate browser profile. Keep your real vault and working authenticator until you have checked the result.
