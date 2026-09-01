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
        preview: "App Preview",
        security: "Security",
        howItWorks: "How It Works",
        downloads: "Downloads",
        account: "Account Portal 🔐",
        legal: "Privacy & Legal",
        statusOnline: "Relay Online"
      },
      hero: {
        subtitle: "Zero-Knowledge Biometric Password Manager & Instant Browser Relay.",
        tagline: "End-to-End Encrypted • No Passwords On Server • Hardware Biometrics",
        btnApp: "📱 Get Mobile App",
        btnExt: "🧩 Browser Extension",
        btnFeatures: "✨ Explore Features",
        metricRelay: "Relay Connection",
        metricRelayVal: "Active & Operational",
        metricCrypto: "Cryptography",
        metricSessions: "Ephemeral Sessions"
      },
      security: {
        title: "Zero-Knowledge Architecture",
        desc: "Your master password and login credentials never touch our servers in plain text. Everything is encrypted directly on your mobile device hardware.",
        card1Title: "Argon2id Key Derivation",
        card1Desc: "State-of-the-art memory-hard hashing algorithm protects user authentication credentials against brute-force and GPU cracking.",
        card2Title: "AES-256-CTR End-to-End",
        card2Desc: "Real-time communication channels between browser extension and smartphone use ephemeral 256-bit AES encryption keys.",
        card3Title: "Hardware Biometrics",
        card3Desc: "Face ID, Touch ID, and Android BiometricPrompt ensure only your physical presence can authorize password transmissions."
      },
      downloads: {
        title: "Get FlakeSecure v2.0",
        appTitle: "Mobile App (iOS & Android)",
        appDesc: "Your biometric master vault. Scan QR codes to autofill logins instantly.",
        btnAndroid: "Download Android APK",
        btnIos: "Install on iOS (Expo)",
        extTitle: "Browser Extensions",
        extDesc: "One-click login relay directly inside your favorite browser.",
        btnChrome: "Download Chrome Extension",
        btnFirefox: "Download Firefox Extension"
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
        dangerTitle: "Permanent Account Deletion",
        dangerDesc: "Deleting your account will immediately remove all cloud-synced vaults, active sessions, and access keys. This action cannot be undone.",
        labelDeletePass: "Enter Password to Confirm Deletion",
        btnDeleteAccount: "Permanently Delete My Account"
      },
      imprint: {
        title: "Privacy & Imprint",
        subtitle: "Transparency, data privacy, and legal disclosures for FlakeSecure.",
        backHome: "← Back to Homepage"
      },
      footer: {
        tagline: "FlakeSecure v2.0.0 — Open, Secure, Zero-Knowledge.",
        copyright: "© 2026 SchneeherzStudio. All rights reserved."
      }
    },
    de: {
      nav: {
        preview: "App-Vorschau",
        security: "Sicherheit",
        howItWorks: "Funktionsweise",
        downloads: "Downloads",
        account: "Account Portal 🔐",
        legal: "Datenschutz & Impressum",
        statusOnline: "Relay Online"
      },
      hero: {
        subtitle: "Zero-Knowledge Biometrischer Passwort-Manager & Sofortiger Browser-Relay.",
        tagline: "Ende-zu-Ende verschlüsselt • Keine Passwörter auf Servern • Hardware-Biometrie",
        btnApp: "📱 Mobile App laden",
        btnExt: "🧩 Browser-Erweiterung",
        btnFeatures: "✨ Funktionen entdecken",
        metricRelay: "Relay-Verbindung",
        metricRelayVal: "Aktiv & Betriebsbereit",
        metricCrypto: "Kryptographie",
        metricSessions: "Aktive Sitzungen"
      },
      security: {
        title: "Zero-Knowledge Architektur",
        desc: "Dein Master-Passwort und deine Zugangsdaten erreichen unsere Server niemals im Klartext. Alles wird direkt auf deinem Gerät verschlüsselt.",
        card1Title: "Argon2id Schlüsselableitung",
        card1Desc: "Modernster speicherintensiver Hashing-Algorithmus schützt vor Brute-Force- und GPU-basierten Angriffen.",
        card2Title: "AES-256-CTR Ende-zu-Ende",
        card2Desc: "Echtzeitkommunikation zwischen Browser-Erweiterung und Smartphone nutzt flüchtige 256-Bit AES-Schlüssel.",
        card3Title: "Hardware-Biometrie",
        card3Desc: "Face ID, Touch ID und Android BiometricPrompt stellen sicher, dass nur du Passwörter freigeben kannst."
      },
      downloads: {
        title: "FlakeSecure v2.0 herunterladen",
        appTitle: "Mobile App (iOS & Android)",
        appDesc: "Dein biometrischer Safe. QR-Codes scannen, um Logins blitzschnell im Browser auszufüllen.",
        btnAndroid: "Android APK herunterladen",
        btnIos: "Auf iOS installieren (Expo)",
        extTitle: "Browser-Erweiterungen",
        extDesc: "Ein-Klick Login-Relay direkt in deinem bevorzugten Webbrowser.",
        btnChrome: "Chrome Extension herunterladen",
        btnFirefox: "Firefox Extension herunterladen"
      },
      accountPortal: {
        title: "Account-Portal & Sicherheitsverwaltung",
        subtitle: "Verwalte dein FlakeSecure Profil, aktive Sitzungen und Sicherheitseinstellungen.",
        tabLogin: "🔑 Anmelden",
        tabRegister: "✨ Registrieren",
        tabProfile: "👤 Profil",
        tabDelete: "⚠️ Gefahrenzone",
        labelEmailOrUser: "Benutzername oder E-Mail",
        labelPassword: "Passwort",
        btnLogin: "Im Portal anmelden",
        labelEmail: "E-Mail-Adresse",
        labelUsername: "Benutzername",
        labelConfirmPass: "Passwort wiederholen",
        btnSendOtp: "Bestätigungscode senden",
        btnResendOtp: "Code erneut senden",
        labelOtp: "6-stelliger E-Mail Bestätigungscode",
        btnRegister: "FlakeSecure Account erstellen",
        labelLanguage: "Spracheinstellung",
        btnSaveProfile: "Änderungen speichern",
        sessionsTitle: "Aktive Sitzungen & Verknüpfte Geräte",
        btnRevokeAll: "Alle Sitzungen beenden",
        dangerTitle: "Unwiderrufliche Account-Löschung",
        dangerDesc: "Das Löschen deines Accounts entfernt sofort alle Cloud-Tresore, aktiven Sitzungen und Zugriffsschlüssel.",
        labelDeletePass: "Passwort zur Bestätigung eingeben",
        btnDeleteAccount: "Account endgültig löschen"
      },
      imprint: {
        title: "Datenschutz & Impressum",
        subtitle: "Transparenz, Datenschutz und rechtliche Angaben für FlakeSecure.",
        backHome: "← Zurück zur Startseite"
      },
      footer: {
        tagline: "FlakeSecure v2.0.0 — Offen, Sicher, Zero-Knowledge.",
        copyright: "© 2026 SchneeherzStudio. Alle Rechte vorbehalten."
      }
    },
    fr: {
      nav: {
        preview: "Aperçu de l'app",
        security: "Sécurité",
        howItWorks: "Fonctionnement",
        downloads: "Téléchargements",
        account: "Portail Compte 🔐",
        legal: "Mentions Légales",
        statusOnline: "Relais en Ligne"
      },
      hero: {
        subtitle: "Gestionnaire de mots de passe biométrique Zero-Knowledge et relais navigateur.",
        tagline: "Chiffré de bout en bout • Aucun mot de passe sur serveur • Biométrie matérielle",
        btnApp: "📱 Application Mobile",
        btnExt: "🧩 Extension Navigateur",
        btnFeatures: "✨ Découvrir les fonctionnalités",
        metricRelay: "Connexion Relais",
        metricRelayVal: "Actif et Opérationnel",
        metricCrypto: "Cryptographie",
        metricSessions: "Sessions Éphémères"
      },
      security: {
        title: "Architecture Zero-Knowledge",
        desc: "Vos mots de passe ne transitent jamais en clair sur nos serveurs. Tout est chiffré directement sur votre appareil.",
        card1Title: "Dérivation Argon2id",
        card1Desc: "Algorithme de hachage à mémoire intensive protégeant vos accès contre les attaques par force brute.",
        card2Title: "AES-256-CTR Bout en Bout",
        card2Desc: "Canaux de communication temps réel sécurisés avec des clés AES 256 bits éphémères.",
        card3Title: "Biométrie Matérielle",
        card3Desc: "Face ID, Touch ID et Biométrie Android garantissent que seule votre présence physique autorise le remplissage."
      },
      downloads: {
        title: "Télécharger FlakeSecure v2.0",
        appTitle: "Application Mobile (iOS & Android)",
        appDesc: "Votre coffre-fort biométrique. Scannez un QR code pour vous connecter instantanément.",
        btnAndroid: "Télécharger l'APK Android",
        btnIos: "Installer sur iOS (Expo)",
        extTitle: "Extensions Navigateur",
        extDesc: "Relais de connexion en un clic directement dans votre navigateur favori.",
        btnChrome: "Extension Chrome",
        btnFirefox: "Extension Firefox"
      },
      accountPortal: {
        title: "Portail Compte & Sécurité",
        subtitle: "Gérez votre profil FlakeSecure, vos sessions actives et vos paramètres.",
        tabLogin: "🔑 Connexion",
        tabRegister: "✨ Inscription",
        tabProfile: "👤 Profil",
        tabDelete: "⚠️ Zone de Danger",
        labelEmailOrUser: "Nom d'utilisateur ou E-mail",
        labelPassword: "Mot de passe",
        btnLogin: "Se connecter au portail",
        labelEmail: "Adresse E-mail",
        labelUsername: "Nom d'utilisateur",
        labelConfirmPass: "Confirmer le mot de passe",
        btnSendOtp: "Envoyer le code de vérification",
        btnResendOtp: "Renvoyer le code",
        labelOtp: "Code à 6 chiffres reçu par e-mail",
        btnRegister: "Créer un compte FlakeSecure",
        labelLanguage: "Langue de l'interface",
        btnSaveProfile: "Enregistrer les modifications",
        sessionsTitle: "Sessions actives & Appareils liés",
        btnRevokeAll: "Déconnecter toutes les sessions",
        dangerTitle: "Suppression définitive du compte",
        dangerDesc: "La suppression de votre compte effacera immédiatement toutes les données synchronisées. Action irréversible.",
        labelDeletePass: "Entrez votre mot de passe pour confirmer",
        btnDeleteAccount: "Supprimer définitivement mon compte"
      },
      imprint: {
        title: "Confidentialité & Mentions Légales",
        subtitle: "Transparence, politique de confidentialité et informations légales pour FlakeSecure.",
        backHome: "← Retour à l'accueil"
      },
      footer: {
        tagline: "FlakeSecure v2.0.0 — Ouvert, Sécurisé, Zero-Knowledge.",
        copyright: "© 2026 SchneeherzStudio. Tous droits réservés."
      }
    },
    es: {
      nav: {
        preview: "Vista previa",
        security: "Seguridad",
        howItWorks: "Cómo funciona",
        downloads: "Descargas",
        account: "Portal de Cuenta 🔐",
        legal: "Privacidad y Legal",
        statusOnline: "Relé en línea"
      },
      hero: {
        subtitle: "Gestor de contraseñas biométrico Zero-Knowledge y relé instantáneo para navegadores.",
        tagline: "Cifrado de extremo a extremo • Sin contraseñas en servidores • Biometría de hardware",
        btnApp: "📱 App Móvil",
        btnExt: "🧩 Extensión Navegador",
        btnFeatures: "✨ Explorar funciones",
        metricRelay: "Conexión del Relé",
        metricRelayVal: "Activo y Operativo",
        metricCrypto: "Criptografía",
        metricSessions: "Sesiones Efímeras"
      },
      security: {
        title: "Arquitectura Zero-Knowledge",
        desc: "Tus contraseñas nunca llegan en texto plano a nuestros servidores. Todo se cifra directamente en tu dispositivo móvil.",
        card1Title: "Derivación Argon2id",
        card1Desc: "Algoritmo de hash de alta memoria que protege contra ataques de fuerza bruta y descifrado por GPU.",
        card2Title: "AES-256-CTR Extremo a Extremo",
        card2Desc: "Canales de comunicación en tiempo real protegidos con claves efímeras AES de 256 bits.",
        card3Title: "Biometría de Hardware",
        card3Desc: "Face ID, Touch ID y Biometría Android aseguran que solo tu presencia física autorice el inicio de sesión.",
      },
      downloads: {
        title: "Descargar FlakeSecure v2.0",
        appTitle: "App Móvil (iOS y Android)",
        appDesc: "Tu bóveda biométrica. Escanea códigos QR para rellenar inicios de sesión al instante.",
        btnAndroid: "Descargar APK Android",
        btnIos: "Instalar en iOS (Expo)",
        extTitle: "Extensiones para Navegadores",
        extDesc: "Relé de inicio de sesión con un clic directamente en tu navegador.",
        btnChrome: "Extensión Chrome",
        btnFirefox: "Extensión Firefox"
      },
      accountPortal: {
        title: "Portal de Cuenta y Seguridad",
        subtitle: "Administra tu perfil FlakeSecure, sesiones activas y configuración de seguridad.",
        tabLogin: "🔑 Iniciar sesión",
        tabRegister: "✨ Registrarse",
        tabProfile: "👤 Perfil",
        tabDelete: "⚠️ Zona de Peligro",
        labelEmailOrUser: "Usuario o correo electrónico",
        labelPassword: "Contraseña",
        btnLogin: "Entrar al portal",
        labelEmail: "Correo electrónico",
        labelUsername: "Nombre de usuario",
        labelConfirmPass: "Confirmar contraseña",
        btnSendOtp: "Enviar código de verificación",
        btnResendOtp: "Reenviar código",
        labelOtp: "Código de verificación de 6 dígitos",
        btnRegister: "Crear cuenta FlakeSecure",
        labelLanguage: "Idioma de la interfaz",
        btnSaveProfile: "Guardar cambios",
        sessionsTitle: "Sesiones activas y dispositivos vinculados",
        btnRevokeAll: "Cerrar todas las sesiones",
        dangerTitle: "Eliminación permanente de cuenta",
        dangerDesc: "Eliminar tu cuenta borrará inmediatamente todas las bóvedas sincronizadas. Esta acción no se puede deshacer.",
        labelDeletePass: "Introduce tu contraseña para confirmar",
        btnDeleteAccount: "Eliminar mi cuenta permanentemente"
      },
      imprint: {
        title: "Privacidad y Aviso Legal",
        subtitle: "Transparencia, privacidad de datos e información legal de FlakeSecure.",
        backHome: "← Volver al inicio"
      },
      footer: {
        tagline: "FlakeSecure v2.0.0 — Abierto, Seguro, Zero-Knowledge.",
        copyright: "© 2026 SchneeherzStudio. Todos los derechos reservados."
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
