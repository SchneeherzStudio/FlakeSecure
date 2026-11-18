/**
 * ============================================================================
 * FlakeSecure Mobile App - Internationalization (i18n) Setup
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. INTERNATIONALIZATION (i18n):
 *    - Initializes i18n-js with locale translations for English (en), German (de), French (fr), and Spanish (es).
 *    - Automatically detects device system locale via expo-localization as initial fallback.
 * ============================================================================
 */

export default {};

import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

const i18n = new I18n({ en, de, fr, es });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

const deviceLocale = Localization.getLocales?.()?.[0]?.languageCode || 'en';
i18n.locale = ['en', 'de', 'fr', 'es'].includes(deviceLocale) ? deviceLocale : 'en';

export { i18n };
