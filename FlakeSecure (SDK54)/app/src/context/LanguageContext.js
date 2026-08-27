/**
 * ============================================================================
 * FlakeSecure Mobile App - Language Context & Provider
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. LANGUAGE MANAGEMENT:
 *    - Loads user language preference (app_language) from persistent AsyncStorage.
 *    - changeLanguage(newLang): Updates i18n locale, updates React state, and persists the choice.
 *    - useLanguage(): Custom hook for consuming locale state and switching language.
 * ============================================================================
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '../i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem('app_language');
        if (savedLang && ['en', 'de', 'fr', 'es'].includes(savedLang)) {
          i18n.locale = savedLang;
          setLocale(savedLang);
        }
      } catch (err) {
        console.log('[Language] Load error:', err.message);
      }
    })();
  }, []);

  const changeLanguage = async (newLang) => {
    i18n.locale = newLang;
    setLocale(newLang);
    await AsyncStorage.setItem('app_language', newLang);
  };

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
