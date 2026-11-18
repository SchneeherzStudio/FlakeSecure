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

const PAIRING_TRANSLATIONS = {
  de: {
    'pair.biometricPrompt': 'Browser-Erweiterung koppeln',
    'pair.success': 'Browser-Erweiterung erfolgreich gekoppelt!',
    'pair.notLoggedIn': 'Bitte melde dich zuerst in der App an, um eine Browser-Erweiterung zu koppeln.',
    'home.breachAlertSubtitle': 'Folgende Zugangsdaten wurden in bekannten Datenpannen (HaveIBeenPwned) gefunden:',
    'home.breachChangeNowBtn': 'Jetzt ändern',
    'home.breachDismissBtn': 'Schließen',
    'home.breachedBadge': 'Kompromittiert',
    'onboarding.skip': 'Überspringen',
    'onboarding.notifications.title': 'Benachrichtigungen & Sicherheitswarnungen',
    'onboarding.notifications.subtitle': 'Wichtig für Echtzeitschutz und mobile Freigaben',
    'onboarding.notifications.reason1Title': 'Echtzeit-Login-Freigaben',
    'onboarding.notifications.reason1Desc': 'Blitzschnelle Freigabe von Anmeldungen am Computer ohne Passwort-Eingabe.',
    'onboarding.notifications.reason2Title': 'Passwort-Datenpannen (Breach-Alerts)',
    'onboarding.notifications.reason2Desc': 'Sofortige Warnung, falls ein gespeichertes Passwort in einer bekannten Datenpanne auftaucht.',
    'onboarding.notifications.reason3Title': 'Karten-Ablaufwarnungen',
    'onboarding.notifications.reason3Desc': 'Rechtzeitige Erinnerung 30 Tage vor Ablauf hinterlegter Bankkarten.',
    'onboarding.notifications.enableBtn': 'Benachrichtigungen aktivieren',
    'onboarding.notifications.declineBtn': 'Nicht jetzt / Ablehnen',
    'onboarding.notifications.note': 'Hinweis: Du kannst Benachrichtigungen jederzeit nachträglich in den Einstellungen (unter Einstellungen → Benachrichtigungen) aktivieren.'
  },
  en: {
    'pair.biometricPrompt': 'Pair Browser Extension',
    'pair.success': 'Browser extension successfully paired!',
    'pair.notLoggedIn': 'Please log in to the app first to pair a browser extension.',
    'home.breachAlertSubtitle': 'The following credentials were found in known data breaches (HaveIBeenPwned):',
    'home.breachChangeNowBtn': 'Change now',
    'home.breachDismissBtn': 'Dismiss',
    'home.breachedBadge': 'Compromised',
    'onboarding.skip': 'Skip',
    'onboarding.notifications.title': 'Notifications & Security Alerts',
    'onboarding.notifications.subtitle': 'Essential for real-time security and instant approvals',
    'onboarding.notifications.reason1Title': 'Real-Time Login Approvals',
    'onboarding.notifications.reason1Desc': 'Lightning-fast desktop login approvals without typing any master password.',
    'onboarding.notifications.reason2Title': 'Breach Alerts',
    'onboarding.notifications.reason2Desc': 'Immediate warnings if one of your saved passwords appears in a known data breach.',
    'onboarding.notifications.reason3Title': 'Card Expiration Reminders',
    'onboarding.notifications.reason3Desc': 'Timely alerts 30 days before your stored payment cards expire.',
    'onboarding.notifications.enableBtn': 'Enable Notifications',
    'onboarding.notifications.declineBtn': 'Not Now / Decline',
    'onboarding.notifications.note': 'Note: You can enable notifications anytime later in Settings (under Settings → Notifications).'
  },
  fr: {
    'pair.biometricPrompt': "Associer l'extension de navigateur",
    'pair.success': 'Extension de navigateur associée avec succès !',
    'pair.notLoggedIn': "Veuillez d'abord vous connecter à l'application pour associer une extension.",
    'home.breachAlertSubtitle': 'Les identifiants suivants ont été trouvés dans des fuites de données connues (HaveIBeenPwned) :',
    'home.breachChangeNowBtn': 'Modifier',
    'home.breachDismissBtn': 'Ignorer',
    'home.breachedBadge': 'Compromis',
    'onboarding.skip': 'Passer',
    'onboarding.notifications.title': 'Notifications & Alertes de sécurité',
    'onboarding.notifications.subtitle': 'Essentiel pour la protection en temps réel et les approbations instantanées',
    'onboarding.notifications.reason1Title': 'Validations de connexion en direct',
    'onboarding.notifications.reason1Desc': 'Approbation ultra-rapide des connexions sur ordinateur sans saisir de mot de passe.',
    'onboarding.notifications.reason2Title': 'Alertes de fuite de données',
    'onboarding.notifications.reason2Desc': 'Alerte immédiate si un mot de passe enregistré apparaît dans une violation connue.',
    'onboarding.notifications.reason3Title': 'Rappels d\'expiration de carte',
    'onboarding.notifications.reason3Desc': 'Rappel préventif 30 jours avant l\'expiration de vos cartes bancaires.',
    'onboarding.notifications.enableBtn': 'Activer les notifications',
    'onboarding.notifications.declineBtn': 'Pas maintenant / Refuser',
    'onboarding.notifications.note': 'Remarque : Vous pouvez activer les notifications à tout moment dans les Paramètres (sous Paramètres → Notifications).'
  },
  es: {
    'pair.biometricPrompt': 'Vincular extensión del navegador',
    'pair.success': '¡Extensión de navegador vinculada con éxito!',
    'pair.notLoggedIn': 'Por favor, inicia sesión en la aplicación primero para vincular una extensión.',
    'home.breachAlertSubtitle': 'Las siguientes credenciales se encontraron en filtraciones de datos conocidas (HaveIBeenPwned):',
    'home.breachChangeNowBtn': 'Cambiar ahora',
    'home.breachDismissBtn': 'Cerrar',
    'home.breachedBadge': 'Comprometido',
    'onboarding.skip': 'Omitir',
    'onboarding.notifications.title': 'Notificaciones y alertas de seguridad',
    'onboarding.notifications.subtitle': 'Imprescindible para protección en tiempo real y aprobaciones instantáneas',
    'onboarding.notifications.reason1Title': 'Aprobaciones de inicio en tiempo real',
    'onboarding.notifications.reason1Desc': 'Aprobación ultrarrápida de inicios de sesión en tu ordenador sin escribir contraseña.',
    'onboarding.notifications.reason2Title': 'Alertas de filtraciones',
    'onboarding.notifications.reason2Desc': 'Aviso inmediato si una contraseña guardada aparece en una filtración conocida.',
    'onboarding.notifications.reason3Title': 'Avisos de caducidad de tarjetas',
    'onboarding.notifications.reason3Desc': 'Recordatorio oportuno 30 días antes de que caduquen tus tarjetas registradas.',
    'onboarding.notifications.enableBtn': 'Activar notificaciones',
    'onboarding.notifications.declineBtn': 'Ahora no / Rechazar',
    'onboarding.notifications.note': 'Nota: Puedes activar las notificaciones en cualquier momento desde Ajustes (en Ajustes → Notificaciones).'
  }
};

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
    const custom = PAIRING_TRANSLATIONS[locale]?.[key];
    if (custom) return custom;
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
