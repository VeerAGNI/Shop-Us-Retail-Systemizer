import React, { createContext, useContext, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './i18n';
import { useShopMemory } from './store';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { memory, updateMemory } = useShopMemory();
  
  const language = (memory?.language as Language) || 'en';

  const setLanguage = async (lang: Language) => {
    await updateMemory({ language: lang });
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
