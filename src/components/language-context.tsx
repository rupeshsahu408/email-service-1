"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { type Language, getLanguage, DEFAULT_LANGUAGE } from "@/lib/languages";
import { type Translations, getTranslations } from "@/lib/translations";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: getTranslations("en"),
});

const COOKIE_NAME = "sendora_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookieLang(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieLang(code: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const saved = getCookieLang();
    if (saved) {
      const lang = getLanguage(saved);
      setLanguageState(lang);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setCookieLang(lang.code);
  }, []);

  const t = getTranslations(language.code);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
