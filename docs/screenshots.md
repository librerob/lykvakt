# Screenshots

These are captures of the running extension in Chromium, using synthetic accounts. They show the extension document, without browser chrome. No account details or controls were redrawn.

Every image is 400 px wide. The popup capture is 400 × 580; window captures are 400 × 700. These captures come from [the Chromium CI run](https://github.com/librerob/lykvakt/actions/runs/42005878815) for app source [729c8884](https://github.com/librerob/lykvakt/commit/729c8884cef128db16218c52f9100297ea33a272).

Account cards put the name and menu above the code controls. The current code and countdown stay together on the left; the optional Next code label and preview form a smaller block on the right.

## Popup

The default toolbar view keeps its header in place while the account list scrolls.

![Popup with synthetic accounts](screenshots/popup-mode.png)

## Window

File selection uses an explicitly opened window. Its default inactivity limit is five minutes; the setting can be changed.

![Window with synthetic accounts](screenshots/window-mode.png)

## Other views

- [Code controls and countdown](screenshots/accounts-expiring.png)
- [Account list](screenshots/accounts-amoled.png)
- [Current and next codes](screenshots/next-code.png)
- [Empty vault](screenshots/empty.png)
- [Setup](screenshots/setup.png)
- [Locked vault](screenshots/locked.png)
- [Settings](screenshots/settings.png)
- [Verified backup](screenshots/backup-verified.png)
- [Fresh-profile restoration](screenshots/recovered-fresh-profile.png)
- [Eight-digit codes](screenshots/desktop-eight-digit.png)
- [Long names](screenshots/long-name.png)
- [Steam support](screenshots/steam-row.png)
- [Older vault format](screenshots/old-format.png)

The older-format screen refers to the old version's Recovery menu. The current app groups import, export and backups in Backup.
