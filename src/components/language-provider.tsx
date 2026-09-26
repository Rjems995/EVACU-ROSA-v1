'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { filipino } from '@/lib/filipino';
type Language = 'en' | 'fil';
const LanguageContext = createContext({
  language: 'en' as Language,
  setLanguage: (_: Language) => {},
  t: (text: string) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => {
    try {
      if (localStorage.getItem('evacu-language') === 'fil') setLanguage('fil');
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const change = (value: Language) => {
    setLanguage(value);
    try {
      localStorage.setItem('evacu-language', value);
    } catch {}
  };
  const t = useCallback(
    (text: string) => (language === 'fil' && Object.hasOwn(filipino, text) ? filipino[text] : text),
    [language],
  );
  return (
    <LanguageContext.Provider value={{ language, setLanguage: change, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <label className="language-control">
      <span className="sr-only">Language / Wika</span>
      <select
        aria-label="Language / Wika"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="fil">Filipino</option>
      </select>
    </label>
  );
}
