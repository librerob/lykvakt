/// <reference types="vite/client" />
import english from "./locales/en.json";
import { readPreference, savePreference } from "./preferences";
export const LANGUAGES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
  bn: "বাংলা",
  ur: "اردو",
  id: "Bahasa Indonesia",
  ja: "日本語",
  ko: "한국어",
  zh: "简体中文",
  tr: "Türkçe",
  ro: "Română",
  nb: "Norsk bokmål",
  fi: "Suomi",
  sv: "Svenska",
  is: "Íslenska",
  da: "Dansk",
} as const;
export type Language = keyof typeof LANGUAGES;
type Messages = Record<string, string>;
const loaders = import.meta.glob<{ default: Messages }>([
  "./locales/*.json",
  "!./locales/en.json",
  "!./locales/required.json",
]);
let language: Language = "en";
let messages: Messages = {};
let request = 0;
export function currentLanguage(): Language {
  return language;
}
export function resolveLanguage(candidates: readonly string[]): Language {
  for (const candidate of candidates) {
    const base = candidate
      .trim()
      .toLowerCase()
      .replaceAll("_", "-")
      .split("-")[0];
    const code = base === "no" ? "nb" : base;
    if (code && Object.hasOwn(LANGUAGES, code)) return code as Language;
  }
  return "en";
}
export async function setLanguage(
  code: Language,
  persist = true,
): Promise<boolean> {
  if (!Object.hasOwn(LANGUAGES, code)) throw new Error("Unsupported language.");
  const ticket = ++request;
  const next =
    code === "en"
      ? {}
      : (await loaders["./locales/" + code + ".json"]!()).default;
  if (ticket !== request) return false;
  language = code;
  messages = next;
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = code;
    document.documentElement.dir =
      code === "ar" || code === "ur" ? "rtl" : "ltr";
  }
  if (persist) savePreference("language", code);
  return true;
}
export async function initializeLanguage(
  candidates: readonly string[] = navigator.languages,
): Promise<void> {
  const stored = readPreference("language");
  const chosen =
    stored && Object.hasOwn(LANGUAGES, stored)
      ? (stored as Language)
      : resolveLanguage(candidates);
  try {
    await setLanguage(chosen, false);
  } catch {
    await setLanguage("en", false);
  }
}
export function t(
  source: string,
  values: Record<string, string | number> = {},
): string {
  const translated = Object.hasOwn(messages, source)
    ? messages[source]!
    : source;
  return translated.replace(
    /\{([a-z][a-zA-Z0-9]*)\}/g,
    (match, name: string) => {
      if (!Object.hasOwn(values, name)) return match;
      const value = String(values[name]);
      return language === "ar" || language === "ur"
        ? "\u2068" + value + "\u2069"
        : value;
    },
  );
}

export function isEnglishFallback(value: string): boolean {
  return (
    language !== "en" &&
    Object.hasOwn(english, value) &&
    !Object.hasOwn(messages, value)
  );
}
