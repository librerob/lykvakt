import { el, select } from "../dom";
import {
  currentLanguage,
  LANGUAGES,
  setLanguage,
  t,
  type Language,
} from "../i18n";
let labelSequence = 0;
export function languageChoice(): HTMLElement {
  const field = select(
    "language",
    t("Language"),
    LANGUAGES,
    currentLanguage(),
    `label-language-${++labelSequence}`,
  );
  field.control.dir = "ltr";
  field.control.addEventListener("change", () => {
    const chosen = field.control.value as Language;
    field.control.disabled = true;
    void setLanguage(chosen)
      .then((changed) => {
        if (changed) window.dispatchEvent(new Event("lykvakt-language"));
      })
      .catch(() => {
        field.control.value = currentLanguage();
      })
      .finally(() => {
        field.control.disabled = false;
      });
  });
  return el(
    "div",
    { class: "language-choice" },
    field.wrapper,
    el(
      "p",
      { class: "hint", lang: "en" },
      "Some longer help and import reports are still in English.",
    ),
  );
}
