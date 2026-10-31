"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Locale, LOCALES, TranslationKey, translate } from "./translations";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locales: typeof LOCALES;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "vyapaarai_locale";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && LOCALES.some((l) => l.code === saved)) setLocaleState(saved);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "en" ? "en" : next;
    }
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      locales: LOCALES,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
