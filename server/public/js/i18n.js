/**
 * ============================================================================
 * FlakeSecure Website - Client-side Internationalization (i18n) Module v2.0.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. DICTIONARIES:
 *    - Full translation trees for 'en', 'de', 'fr', and 'es' covering landing page, account portal, and legal/imprint.
 * 
 * 2. LANGUAGE MANAGEMENT:
 *    - setWebsiteLanguage(lang): Updates localStorage('fs_lang'), sets document lang attribute, and updates all DOM elements.
 *    - initI18n(): Initializes language selector dropdowns and applies translations on DOMContentLoaded.
 * ============================================================================
 */

(function () {
  const TRANSLATIONS = {
    en: {
      nav: {
        downloads: "Downloads",
        features: "Features",
        account: "🔐 Account Portal",
        legal: "Privacy & Legal",
        statusOnline: "Online"
      },
      hero: {
        badge: "Zero-Knowledge Architecture • Hardware Biometrics",
        subtitle: "Your Biometric Password & 2FA Manager. Confirm logins on your smartphone with Face ID or fingerprint — autofilled instantly in your desktop browser.",
        btnDownload: "⬇️ Get Apps & Extensions",
        btnAccount: "🔐 Manage Account & Vault",
        metricCrypto: "Cryptography",
        metricRelay: "Relay Status",
        metricRelayVal: "Active & E2E Encrypted",
        metricSessions: "Active Sessions"
      },
      features: {
        badge: "Core Security",
        title: "Engineered for Frictionless Privacy",
        subtitle: "No plaintext passwords ever touch the server. Complete control stays on your physical devices.",
        f1Title: "Zero-Knowledge Vault",
        f1Desc: "Client-side 256-bit AES encryption derived via PBKDF2 & Argon2id. Even if the server were intercepted, your vault remains mathematically unbreakable.",
        f2Title: "1-Tap Biometric Relay",
        f2Desc: "Scan a QR code on your browser, authorize via Face ID or fingerprint, and your logins are autofilled in under a second over ephemeral encrypted websockets.",
        f3Title: "Built-in 2FA Authenticator",
        f3Desc: "Integrated RFC 6238 TOTP engine with live countdowns. Directly stream 2FA verification codes to your desktop browser with a single tap."
      },
      showcase: {
        c1Title: "Biometric Master Vault",
        c1Desc: "Securely organize logins, categories, and 2FA tokens protected by your phone's Secure Enclave.",
        c2Title: "Instant Authorization",
        c2Desc: "Confirm domain authorization with biometrics. Encrypted payloads self-destruct after consumption.",
        c3Title: "Secure P2P Sharing",
        c3Desc: "Send credentials with hidden view modes and auto-delete timers (1h to 30d) across verified recipients."
      },
      downloads: {
        badge: "Get Started",
        title: "Download FlakeSecure v2.0",
        subtitle: "Available on mobile and desktop platforms.",
        appTitle: "Mobile App (Android & iOS)",
        appDesc: "Your biometric master vault. Scan QR codes to autofill logins instantly.",
        btnAndroid: "Download Android APK",
        btnIos: "iOS (Expo Go)",
        btnChrome: "Download Chrome (.zip)",
        btnFirefox: "Download Firefox (.zip)"
      },
      accountPortal: {
        title: "Account Portal & Security Settings",
        subtitle: "Manage your FlakeSecure profile, active sessions, and multi-factor authentication.",
        tabLogin: "🔑 Login",
        tabRegister: "✨ Register",
        tabProfile: "👤 Profile",
        tabDelete: "⚠️ Danger Zone",
        labelEmailOrUser: "Username or Email",
        labelPassword: "Password",
        btnLogin: "Sign In to Portal",
        labelEmail: "E-Mail Address",
        labelUsername: "Username",
        labelConfirmPass: "Confirm Password",
        btnSendOtp: "Send Verification Code",
        btnResendOtp: "Resend Code",
        labelOtp: "6-Digit Email Verification Code",
        btnRegister: "Create FlakeSecure Account",
        labelLanguage: "Interface Language",
        btnSaveProfile: "Save Changes",
        sessionsTitle: "Active Sessions & Linked Devices",
        btnRevokeAll: "Revoke All Sessions",
        dangerTitle: "Account Deactivation & 30-Day Retention",
        dangerDesc: "Deactivating your account will immediately revoke all sessions. Data is preserved for a 30-day compliance retention period before permanent erasure.",
        labelDeletePass: "Enter Password to Confirm Deletion",
        btnDeleteAccount: "Deactivate & Delete My Account"
      },
      imprint: {
        backHome: "← Home"
      },
      footer: {
        home: "Home",
        features: "Features",
        downloads: "Downloads",
        account: "Account Portal",
        imprint: "Impressum / Imprint",
        legal: "Privacy & Legal",
        terms: "Terms of Service"
      }
    },
    de: {
      nav: {
        downloads: "Downloads",
        features: "Funktionen",
        account: "🔐 Account Portal",
        legal: "Datenschutz & Rechtliches",
        statusOnline: "Online"
      },
      hero: {
        badge: "Zero-Knowledge Architektur • Hardware-Biometrie",
        subtitle: "Dein biometrischer Passwort- & 2FA-Manager. Bestätige Logins auf deinem Smartphone per Face ID oder Fingerabdruck – blitzschnell im Browser ausgefüllt.",
        btnDownload: "⬇️ Apps & Erweiterungen",
        btnAccount: "🔐 Account & Tresor verwalten",
        metricCrypto: "Kryptografie",
        metricRelay: "Relay-Status",
        metricRelayVal: "Aktiv & Ende-zu-Ende verschlüsselt",
        metricSessions: "Aktive Sitzungen"
      },
      features: {
        badge: "Kern-Sicherheit",
        title: "Entwickelt für kompromisslose Privatsphäre",
        subtitle: "Keine Passwörter im Klartext auf dem Server. Volle Kontrolle direkt auf deinen Geräten.",
        f1Title: "Zero-Knowledge Tresor",
        f1Desc: "Clientseitige 256-Bit-AES-Verschlüsselung (PBKDF2 & Argon2id). Selbst bei Serverzugriff bleiben deine Daten mathematisch unknackbar.",
        f2Title: "1-Tap Biometrie-Relay",
        f2Desc: "Scanne den QR-Code im Browser, bestätige mit Fingerabdruck oder Face ID, und deine Logins werden in unter einer Sekunde ausgefüllt.",
        f3Title: "Integrierter 2FA Authenticator",
        f3Desc: "Eingebauter RFC 6238 TOTP-Generator mit Live-Timer. Übertrage 2FA-Codes mit nur einem Fingertipp direkt in deinen Desktop-Browser."
      },
      showcase: {
        c1Title: "Biometrischer Haupttresor",
        c1Desc: "Organisiere Logins, Kategorien und 2FA-Tokens geschützt durch die Secure Enclave deines Smartphones.",
        c2Title: "Sofortige Autorisierung",
        c2Desc: "Domainfreigabe per Biometrie bestätigen. Verschlüsselte Datenblöcke zerstören sich nach Gebrauch selbst.",
        c3Title: "Sicheres P2P-Teilen",
        c3Desc: "Übertrage Zugangsdaten mit ausgeblendeter Ansicht und Auto-Löschfristen (1h bis 30d) an erlaubte Empfänger."
      },
      downloads: {
        badge: "Jetzt starten",
        title: "FlakeSecure v2.0 herunterladen",
        subtitle: "Verfügbar für Smartphone und Desktop-Browser.",
        appTitle: "Mobile App (Android & iOS)",
        appDesc: "Dein biometrischer Haupttresor. QR-Codes scannen und blitzschnell einloggen.",
        btnAndroid: "Android APK herunterladen",
        btnIos: "iOS (Expo Go)",
        btnChrome: "Chrome Erweiterung (.zip)",
        btnFirefox: "Firefox Erweiterung (.zip)"
      },
      accountPortal: {
        title: "Account-Portal & Sicherheitseinstellungen",
        subtitle: "Verwalte dein FlakeSecure Profil, aktive Sitzungen und Zwei-Faktor-Authentifizierung.",
        tabLogin: "🔑 Anmelden",
        tabRegister: "✨ Registrieren",
        tabProfile: "👤 Profil",
        tabDelete: "⚠️ Gefahrenbereich",
        labelEmailOrUser: "Benutzername oder E-Mail",
        labelPassword: "Passwort",
        btnLogin: "Im Portal anmelden",
        labelEmail: "E-Mail-Adresse",
        labelUsername: "Benutzername",
        labelConfirmPass: "Passwort bestätigen",
        btnSendOtp: "Bestätigungscode senden",
        btnResendOtp: "Code erneut senden",
        labelOtp: "6-stelliger E-Mail-Bestätigungscode",
        btnRegister: "FlakeSecure Account erstellen",
        labelLanguage: "Sprache der Benutzeroberfläche",
        btnSaveProfile: "Änderungen speichern",
        sessionsTitle: "Aktive Sitzungen & Verbundene Geräte",
        btnRevokeAll: "Alle Sitzungen beenden",
        dangerTitle: "Konto-Deaktivierung & 30-Tage Aufbewahrung",
        dangerDesc: "Die Kontolöschung beendet sofort alle Sitzungen. Deine Daten verbleiben für 30 Tage in der gesicherten Aufbewahrungsfrist, bevor sie endgültig gelöscht werden.",
        labelDeletePass: "Passwort zur Bestätigung eingeben",
        btnDeleteAccount: "Mein Konto unwiderruflich löschen"
      },
      imprint: {
        backHome: "← Home"
      },
      footer: {
        home: "Home",
        features: "Funktionen",
        downloads: "Downloads",
        account: "Account Portal",
        imprint: "Impressum",
        legal: "Datenschutz",
        terms: "AGB"
      }
    },
    fr: {
      nav: {
        downloads: "Téléchargements",
        features: "Fonctionnalités",
        account: "🔐 Portail Compte",
        legal: "Confidentialité & Mentions",
        statusOnline: "En ligne"
      },
      hero: {
        badge: "Architecture Zero-Knowledge • Biométrie Matérielle",
        subtitle: "Votre gestionnaire de mots de passe et 2FA biométrique. Validez vos connexions sur mobile avec Face ID ou empreinte digitale.",
        btnDownload: "⬇️ Télécharger l'App & Extensions",
        btnAccount: "🔐 Gérer le Compte & Coffre",
        metricCrypto: "Cryptographie",
        metricRelay: "État du Relais",
        metricRelayVal: "Actif & Chiffré E2E",
        metricSessions: "Sessions Actives"
      },
      features: {
        badge: "Sécurité Centrale",
        title: "Conçu pour une Confidentialité Totale",
        subtitle: "Aucun mot de passe en clair ne transite par les serveurs.",
        f1Title: "Coffre-fort Zero-Knowledge",
        f1Desc: "Chiffrement AES 256 bits côté client avec PBKDF2 et Argon2id.",
        f2Title: "Relais Biométrique 1-Clic",
        f2Desc: "Scannez un code QR sur votre navigateur et remplissez vos identifiants instantanément.",
        f3Title: "Authentificateur 2FA Intégré",
        f3Desc: "Générateur TOTP RFC 6238 avec compte à rebours en direct."
      },
      showcase: {
        c1Title: "Coffre-fort Biométrique",
        c1Desc: "Organisez vos identifiants protégés par la Secure Enclave de votre téléphone.",
        c2Title: "Autorisation Instantanée",
        c2Desc: "Confirmez l'accès avec vos données biométriques.",
        c3Title: "Partage P2P Sécurisé",
        c3Desc: "Partagez des accès avec minuteries d'expiration automatique."
      },
      downloads: {
        badge: "Commencer",
        title: "Télécharger FlakeSecure v2.0",
        subtitle: "Disponible sur mobile et navigateurs.",
        appTitle: "Application Mobile (Android & iOS)",
        appDesc: "Votre coffre-fort maître biométrique.",
        btnAndroid: "Télécharger APK Android",
        btnIos: "iOS (Expo Go)",
        btnChrome: "Extension Chrome (.zip)",
        btnFirefox: "Extension Firefox (.zip)"
      },
      accountPortal: {
        title: "Portail du Compte & Sécurité",
        subtitle: "Gérez votre profil FlakeSecure et vos sessions actives.",
        tabLogin: "🔑 Connexion",
        tabRegister: "✨ Inscription",
        tabProfile: "👤 Profil",
        tabDelete: "⚠️ Zone de Danger",
        labelEmailOrUser: "Identifiant ou E-mail",
        labelPassword: "Mot de passe",
        btnLogin: "Se connecter",
        labelEmail: "Adresse e-mail",
        labelUsername: "Nom d'utilisateur",
        labelConfirmPass: "Confirmer mot de passe",
        btnSendOtp: "Envoyer le code",
        btnResendOtp: "Renvoyer le code",
        labelOtp: "Code à 6 chiffres",
        btnRegister: "Créer un compte",
        labelLanguage: "Langue",
        btnSaveProfile: "Enregistrer",
        sessionsTitle: "Sessions actives",
        btnRevokeAll: "Fermer toutes les sessions",
        dangerTitle: "Désactivation du compte (30 jours)",
        dangerDesc: "Les données sont conservées pendant 30 jours pour des raisons de conformité avant suppression définitive.",
        labelDeletePass: "Mot de passe de confirmation",
        btnDeleteAccount: "Supprimer mon compte"
      },
      imprint: {
        backHome: "← Accueil"
      },
      footer: {
        home: "Accueil",
        features: "Fonctionnalités",
        downloads: "Téléchargements",
        account: "Portail Compte",
        imprint: "Mentions Légales",
        legal: "Confidentialité",
        terms: "Conditions Générales"
      }
    },
    es: {
      nav: {
        downloads: "Descargas",
        features: "Funciones",
        account: "🔐 Portal de Cuenta",
        legal: "Privacidad y Legal",
        statusOnline: "En línea"
      },
      hero: {
        badge: "Arquitectura Zero-Knowledge • Biometría",
        subtitle: "Tu gestor de contraseñas y 2FA biométrico. Confirma inicios de sesión en tu smartphone con Face ID o huella.",
        btnDownload: "⬇️ Descargar Apps y Extensiones",
        btnAccount: "🔐 Gestionar Cuenta y Bóveda",
        metricCrypto: "Criptografía",
        metricRelay: "Estado del Relay",
        metricRelayVal: "Activo y Cifrado E2E",
        metricSessions: "Sesiones Activas"
      },
      features: {
        badge: "Seguridad Central",
        title: "Diseñado para Privacidad Absoluta",
        subtitle: "Ninguna contraseña en texto plano llega al servidor.",
        f1Title: "Bóveda Zero-Knowledge",
        f1Desc: "Cifrado AES de 256 bits en el cliente con derivación PBKDF2 y Argon2id.",
        f2Title: "Relay Biométrico de 1 Toque",
        f2Desc: "Escanea un código QR en el navegador y rellena tus datos al instante.",
        f3Title: "Autenticador 2FA Integrado",
        f3Desc: "Generador TOTP RFC 6238 con temporizador en vivo."
      },
      showcase: {
        c1Title: "Bóveda Maestra Biométrica",
        c1Desc: "Organiza credenciales protegidas por el enclave seguro de tu teléfono.",
        c2Title: "Autorización Instantánea",
        c2Desc: "Confirma autorizaciones con biometría.",
        c3Title: "Compartir P2P Seguro",
        c3Desc: "Envía accesos con temporizadores de autoeliminación."
      },
      downloads: {
        badge: "Comenzar",
        title: "Descargar FlakeSecure v2.0",
        subtitle: "Disponible en móviles y navegadores.",
        appTitle: "App Móvil (Android e iOS)",
        appDesc: "Tu bóveda biométrica maestra.",
        btnAndroid: "Descargar APK Android",
        btnIos: "iOS (Expo Go)",
        btnChrome: "Extensión Chrome (.zip)",
        btnFirefox: "Extensión Firefox (.zip)"
      },
      accountPortal: {
        title: "Portal de Cuenta y Seguridad",
        subtitle: "Gestiona tu perfil de FlakeSecure y sesiones activas.",
        tabLogin: "🔑 Iniciar Sesión",
        tabRegister: "✨ Registrarse",
        tabProfile: "👤 Perfil",
        tabDelete: "⚠️ Zona de Peligro",
        labelEmailOrUser: "Usuario o Correo",
        labelPassword: "Contraseña",
        btnLogin: "Entrar al Portal",
        labelEmail: "Correo Electrónico",
        labelUsername: "Nombre de Usuario",
        labelConfirmPass: "Confirmar Contraseña",
        btnSendOtp: "Enviar Código",
        btnResendOtp: "Reenviar Código",
        labelOtp: "Código de 6 Dígitos",
        btnRegister: "Crear Cuenta",
        labelLanguage: "Idioma",
        btnSaveProfile: "Guardar Cambios",
        sessionsTitle: "Sesiones Activas",
        btnRevokeAll: "Cerrar Todas las Sesiones",
        dangerTitle: "Desactivación de Cuenta (30 Días)",
        dangerDesc: "Los datos se conservan durante 30 días por motivos de seguridad antes de su borrado permanente.",
        labelDeletePass: "Contraseña de confirmación",
        btnDeleteAccount: "Eliminar mi Cuenta"
      },
      imprint: {
        backHome: "← Inicio"
      },
      footer: {
        home: "Inicio",
        features: "Funciones",
        downloads: "Descargas",
        account: "Portal de Cuenta",
        imprint: "Aviso Legal",
        legal: "Privacidad",
        terms: "Términos y Condiciones"
      }
    }
  };

  function getNestedTranslation(obj, path) {
    return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : null), obj);
  }

  function getCurrentLanguage() {
    const saved = localStorage.getItem('fs_lang');
    if (saved && ['en', 'de', 'fr', 'es'].includes(saved)) {
      return saved;
    }
    const navLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (navLang.startsWith('de')) return 'de';
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('es')) return 'es';
    return 'en';
  }

  function setWebsiteLanguage(lang) {
    if (!['en', 'de', 'fr', 'es'].includes(lang)) return;
    localStorage.setItem('fs_lang', lang);
    document.documentElement.lang = lang;

    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const text = getNestedTranslation(dict, key) || getNestedTranslation(TRANSLATIONS.en, key);
      if (text) el.textContent = text;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = getNestedTranslation(dict, key) || getNestedTranslation(TRANSLATIONS.en, key);
      if (text) el.setAttribute('placeholder', text);
    });

    document.querySelectorAll('[data-lang]').forEach((el) => {
      if (el.getAttribute('data-lang') === lang) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });

    document.querySelectorAll('.fs-lang-select').forEach((sel) => {
      sel.value = lang;
    });

    const event = new CustomEvent('fs_language_changed', { detail: { lang } });
    window.dispatchEvent(event);
  }

  function initI18n() {
    const current = getCurrentLanguage();
    setWebsiteLanguage(current);

    document.querySelectorAll('.fs-lang-select').forEach((sel) => {
      sel.value = current;
      sel.addEventListener('change', (e) => {
        setWebsiteLanguage(e.target.value);
      });
    });
  }

  window.fsI18n = {
    setWebsiteLanguage,
    getCurrentLanguage,
    t: (key) => {
      const lang = getCurrentLanguage();
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
      return getNestedTranslation(dict, key) || getNestedTranslation(TRANSLATIONS.en, key) || key;
    },
    init: initI18n
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
