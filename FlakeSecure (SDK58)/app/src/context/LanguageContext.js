/**
 * ============================================================================
 * FlakeSecure Mobile App - Language Context & Provider v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & WORKFLOW:
 * 
 * 1. PERSISTENT LANGUAGE MANAGEMENT:
 *    - Loads user language preference (app_language) from persistent AsyncStorage.
 *    - changeLanguage(newLang): Updates i18n locale, triggers reactive React re-renders, and saves preference locally and to server.
 *    - t(key, options): Reactive translation helper ensuring live UI updates across all screens.
 * ============================================================================
 */

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '../i18n';
import { updateAccount } from '../utils/api';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(i18n.locale || 'en');

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

  const changeLanguage = useCallback(async (newLang) => {
    if (!['en', 'de', 'fr', 'es'].includes(newLang)) return;
    i18n.locale = newLang;
    setLocale(newLang);
    await AsyncStorage.setItem('app_language', newLang);

    try {
      await updateAccount({ language: newLang });
    } catch (e) {}
  }, []);

  const t = useCallback((key, options = {}) => {
    return i18n.t(key, { locale, ...options });
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: i18n.locale,
      changeLanguage: async (lang) => { i18n.locale = lang; },
      t: (key, opts) => i18n.t(key, opts)
    };
  }
  return context;
};
