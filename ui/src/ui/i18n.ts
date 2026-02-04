/**
 * Lightweight i18n module for the OpenClaw Control UI.
 * Supports English (en) and Chinese (zh-CN).
 */

import enLocale from "./locales/en.json" with { type: "json" };
import zhCNLocale from "./locales/zh-CN.json" with { type: "json" };

export type Locale = "en" | "zh-CN";

type LocaleMessages = Record<string, string>;

const locales: Record<Locale, LocaleMessages> = {
  en: enLocale as LocaleMessages,
  "zh-CN": zhCNLocale as LocaleMessages,
};

// Storage key for locale preference
const LOCALE_KEY = "openclaw.control.locale";

// Current locale (module-level state)
let currentLocale: Locale = inferLocale();

/**
 * Infer locale from localStorage or navigator.language.
 */
function inferLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "en" || stored === "zh-CN") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  // Infer from browser language
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set the locale and persist to localStorage.
 * Dispatches a custom "locale-change" event on window.
 */
export function setLocale(locale: Locale): void {
  if (locale !== "en" && locale !== "zh-CN") {
    return;
  }
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // localStorage unavailable
  }
  window.dispatchEvent(new CustomEvent("locale-change", { detail: { locale } }));
}

/**
 * Translate a key to the current locale.
 * Falls back to English if key not found in current locale.
 * Returns the key itself if not found in any locale.
 */
export function t(key: string): string {
  const messages = locales[currentLocale];
  if (messages && key in messages) {
    return messages[key];
  }
  // Fallback to English
  const en = locales.en;
  if (en && key in en) {
    return en[key];
  }
  // Return key as fallback
  return key;
}

/**
 * Check if current locale is Chinese.
 */
export function isZhCN(): boolean {
  return currentLocale === "zh-CN";
}

/**
 * Get available locales with display names.
 */
export function getAvailableLocales(): Array<{ value: Locale; label: string }> {
  return [
    { value: "en", label: "English" },
    { value: "zh-CN", label: "中文" },
  ];
}
