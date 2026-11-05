import { documentationLink, el } from "../dom";
import { t } from "../i18n";
export function setupHelp(): HTMLElement {
  return el(
    "details",
    { class: "setup-help" },
    el("summary", {}, t("Can't find the setup key?")),
    el(
      "div",
      { class: "stack", lang: "en" },
      el(
        "p",
        {},
        "Look for “Can’t scan?” or “Enter manually” beside the service’s QR code. The short sign-in code is not the setup key.",
      ),
      el(
        "p",
        {},
        "If there is no text key, copy the QR image or take a cropped screenshot of just the QR. Choose Import a link or QR image, focus Setup links or export text, and paste. You can also drop an image file there.",
      ),
      el(
        "p",
        {},
        "To select an image file, open Lykvakt in a window. Review the accounts before adding them. Some QR codes belong to a service’s own approval app and are not compatible OTP setup codes.",
      ),
      el(
        "p",
        {},
        "Windows: Win+Shift+S. Mac: Control+Shift+Command+4. On Linux, use your screenshot tool’s copy-region option. Screenshot tools may also save a file.",
      ),
      documentationLink("#if-you-cannot-find-a-setup-key"),
    ),
  );
}
