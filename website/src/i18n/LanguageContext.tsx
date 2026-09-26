import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "de" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: <T = string>(deText: T, enText: T) => T;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("fagent_lang");
      if (saved === "de" || saved === "en") return saved;
      if (typeof navigator !== "undefined" && navigator.language?.startsWith("en")) {
        return "en";
      }
    } catch {
      /* ignore storage errors */
    }
    return "de";
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem("fagent_lang", next);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  };

  const toggleLang = () => {
    setLang(lang === "de" ? "en" : "de");
  };

  const t = <T = string,>(deText: T, enText: T): T => {
    return lang === "en" ? enText : deText;
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
