/**
 * FlakeSecure Website - Client-side Internationalization (i18n) Module v2.0.4
 * Clean, technical translations with zero emojis and zero em dashes.
 */
(function () {
  const TRANSLATIONS = {
    en: {
      nav: {
        home: "Home",
        downloads: "Downloads",
        features: "Features",
        embed: "For Websites",
        account: "Account Portal",
        legal: "Privacy & Legal",
        statusOnline: "Online"
      },
      donation: {
        badge: "100% Free & Open Security",
        title: "Support Independent Privacy",
        desc: "FlakeSecure is completely free to use. No subscriptions, no ads, no trackers, and no paywalls. Your master passwords and 2FA tokens remain entirely under your control on your devices. We self-fund high-availability servers, encrypted WebSocket relays, and zero-knowledge storage. If FlakeSecure secures your digital life, a small coffee donation helps keep the relays fast and servers online.",
        btnBmac: "Support on Buy Me a Coffee"
      },
      hero: {
        badge: "Zero-Knowledge Architecture | Hardware Biometrics",
        subtitle: "Zero-Knowledge Biometric Authentication & Secret Relay. Encrypted locally with 256-bit AES-CTR and Argon2id. No passwords stored on servers.",
        btnDownload: "Get Apps & Extensions",
        btnAccount: "Manage Account & Vault",
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
        badgeConsole: "CONSOLE",
        statusPill: "AES-256-CTR | ZERO-KNOWLEDGE",
        btnHome: "Home",
        btnSignOut: "Sign Out",
        authBadge: "AUTHENTICATION TERMINAL",
        authTitle: "Zero-Knowledge Security Console",
        authSubtitle: "Secure management portal for your FlakeSecure master identity, active device sessions, and encrypted vault synchronizations.",
        spec1Title: "Zero-Knowledge Storage",
        spec1Desc: "Vault records and credentials reside exclusively as client-side ciphertexts. Master keys never reach our servers.",
        spec2Title: "30-Day Protected Retention",
        spec2Desc: "Account terminations trigger an immediate session revocation and a protected 30-day compliance retention window before permanent purge.",
        spec3Title: "Active Fleet Telemetry",
        spec3Desc: "Audit connected mobile apps and browser extensions with remote revocation.",
        tabLogin: "Sign In",
        tabRegister: "Create Account",
        btnForgotPass: "Forgot Password?",
        forgotDesc: "Enter your registered email address:",
        btnSendResetLink: "Send Reset Link",
        btnCancel: "Cancel",
        msgForgotSuccess: "If an account exists with this email, a reset link has been sent.",
        labelEmailOrUser: "Username or Email",
        placeholderEmailOrUser: "alice or alice@domain.com",
        labelPassword: "Password",
        placeholderPassword: "Master Password",
        btnLogin: "Sign In to Console",
        labelEmail: "Email Address",
        placeholderEmail: "alice@domain.com",
        btnSendCode: "Send Code",
        btnResendCode: "Resend",
        labelOtp: "6-Digit Verification Code",
        placeholderOtp: "123456",
        labelUsername: "Username",
        placeholderUsername: "alice",
        labelMasterPass: "Master Password",
        placeholderMinPass: "Min. 8 characters",
        labelConfirmPass: "Confirm Password",
        placeholderRepeatPass: "Repeat Master Password",
        termsAgreementPrefix: "I accept the",
        termsLink: "Terms of Service",
        andText: "and",
        privacyLink: "Privacy Policy",
        btnRegister: "Create Account",
        navOverview: "Overview",
        navFleet: "Device Fleet",
        navVault: "Vault Sync",
        navSecurity: "Security & Key",
        navDanger: "Danger Zone",
        stageTelemetryPath: "CONSOLE // SYSTEM TELEMETRY",
        stageOverviewTitle: "Master Identity & System Health",
        telemetryIdentity: "Identity Status",
        valAuthenticated: "AUTHENTICATED",
        telemetrySessions: "Active Fleet Sessions",
        telemetryEngine: "Encryption Engine",
        telemetryInvariant: "Zero-Knowledge Invariant",
        valEnforced: "ENFORCED",
        identityParamsTitle: "Identity Parameters",
        paramUsername: "Master Username",
        paramEmail: "Registered E-Mail",
        paramLanguage: "Language Preference",
        stageFleetPath: "CONSOLE // FLEET // SESSIONS",
        stageFleetTitle: "Connected Devices & Active Sessions",
        fleetCardTitle: "Session Fleet",
        btnRefreshFleet: "Refresh Fleet",
        noSessions: "No active sessions found.",
        btnRevoke: "Revoke",
        tagActive: "ACTIVE",
        tagCurrent: "CURRENT",
        stageVaultPath: "CONSOLE // VAULT // CIPHERTEXT SYNC",
        stageVaultTitle: "Cloud Vault Synchronization",
        vaultCardTitle: "Zero-Knowledge Cloud Backup",
        vaultCardDesc: "Your encrypted vault blob is stored on the server exclusively in ciphertext form. Decryption requires your client-derived master key, which is never transmitted over the network.",
        vaultStatusLabel: "Vault Ciphertext Status",
        vaultChecking: "Checking status...",
        btnDownloadVault: "Download Encrypted Vault Backup",
        stageSecurityPath: "CONSOLE // SECURITY // CREDENTIALS",
        stageSecurityTitle: "Master Password & Key Rotation",
        securityCardTitle: "Password Reset",
        securityCardDesc: "Request a secure password reset link sent to your verified email address. Password reset links expire automatically after 30 minutes.",
        btnSendResetEmail: "Send Password Reset Email",
        stageDangerPath: "CONSOLE // COMPLIANCE // DEACTIVATION",
        stageDangerTitle: "Account Deactivation & Retention",
        dangerCardTitle: "30-Day Soft-Delete Protocol",
        dangerCardDesc: "Initiating account deletion immediately revokes all active fleet sessions. Under our security and compliance retention protocol, encrypted data remains locked for a 30-day grace period before permanent erasure. Mandatory email verification code is required.",
        labelDelEmail: "Account Email Address",
        labelDelOtp: "6-Digit Verification Code",
        labelDelPassword: "Master Password Confirmation",
        placeholderDelPassword: "Enter password to confirm",
        btnDeactivateAccount: "Deactivate & Request Deletion",
        ageConfirmCheckbox: "I confirm I am at least 16 years old"
      },
      embedSection: {
        badge: "For Website Providers & Developers",
        title: "Embed FlakeSecure on Your Website",
        desc: "Offer your users zero-knowledge biometric QR login directly on your web pages via an iframe or 1-line script tag. Login credentials are automatically filled and submitted via your standard login form.",
        btnDemo: "Interactive Demo & Code Snippets ->",
        btnDocs: "Documentation & Guide"
      },
      imprint: {
        backHome: "<- Home"
      },
      footer: {
        home: "Home",
        features: "Features",
        downloads: "Downloads",
        embed: "Website Integration (SDK)",
        account: "Account Portal",
        imprint: "Impressum / Imprint",
        legal: "Privacy & Legal",
        terms: "Terms of Service"
      }
    },
    de: {
      nav: {
        home: "Home",
        downloads: "Downloads",
        features: "Funktionen",
        embed: "Für Websites",
        account: "Account Portal",
        legal: "Datenschutz & Rechtliches",
        statusOnline: "Online"
      },
      donation: {
        badge: "100% Kostenlose & Unabhängige Sicherheit",
        title: "Unterstütze unabhängige Zero-Knowledge-Sicherheit",
        desc: "FlakeSecure ist komplett kostenlos nutzbar. Keine Abos, keine Werbung, keine Tracker und keine Paywalls. Deine Master-Passwörter und 2FA-Tokens verbleiben vollständig unter deiner Kontrolle auf deinen Endgeräten. Wir finanzieren die gesamte Infrastruktur eigenständig. Wenn dir FlakeSecure gefällt, hilft eine kleine Kaffee-Spende, die Relays schnell und die Server online zu halten.",
        btnBmac: "Unterstütze uns auf Buy Me a Coffee"
      },
      hero: {
        badge: "Zero-Knowledge Architektur | Hardware-Biometrie",
        subtitle: "Zero-Knowledge Biometrie-Authentifizierung und Tresor-Relay. Lokal verschlüsselt mit 256-Bit AES-CTR und Argon2id. Keine Klartext-Passwörter auf Servern.",
        btnDownload: "Apps & Erweiterungen",
        btnAccount: "Account & Tresor verwalten",
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
        badgeConsole: "KONSOLE",
        statusPill: "AES-256-CTR | ZERO-KNOWLEDGE",
        btnHome: "Startseite",
        btnSignOut: "Abmelden",
        authBadge: "AUTHENTIFIZIERUNGS-TERMINAL",
        authTitle: "Zero-Knowledge Sicherheitskonsole",
        authSubtitle: "Sicheres Verwaltungsportal für deine FlakeSecure Master-Identität, aktive Gerätesitzungen und verschlüsselte Tresor-Synchronisationen.",
        spec1Title: "Zero-Knowledge Speicherung",
        spec1Desc: "Tresordaten und Zugangsdaten existieren ausschließlich als clientseitige Chiffretexte. Master-Keys erreichen niemals unsere Server.",
        spec2Title: "30-Tage Schutzfrist",
        spec2Desc: "Eine Kontokündigung widerruft sofort alle aktiven Sitzungen und aktiviert eine geschützte 30-tägige Aufbewahrungsfrist vor der endgültigen Löschung.",
        spec3Title: "Aktive Geräte-Telemetrie",
        spec3Desc: "Überwache verbundene mobile Apps und Browser-Erweiterungen mit sofortigem Remote-Widerruf.",
        tabLogin: "Anmelden",
        tabRegister: "Account erstellen",
        btnForgotPass: "Passwort vergessen?",
        forgotDesc: "Geben Sie Ihre registrierte E-Mail-Adresse ein:",
        btnSendResetLink: "Reset-Link senden",
        btnCancel: "Abbrechen",
        msgForgotSuccess: "Wenn ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.",
        labelEmailOrUser: "Benutzername oder E-Mail",
        placeholderEmailOrUser: "alice oder alice@domain.com",
        labelPassword: "Passwort",
        placeholderPassword: "Master-Passwort",
        btnLogin: "In Konsole anmelden",
        labelEmail: "E-Mail-Adresse",
        placeholderEmail: "alice@domain.com",
        btnSendCode: "Code senden",
        btnResendCode: "Erneut senden",
        labelOtp: "6-stelliger Bestätigungscode",
        placeholderOtp: "123456",
        labelUsername: "Benutzername",
        placeholderUsername: "alice",
        labelMasterPass: "Master-Passwort",
        placeholderMinPass: "Mindestens 8 Zeichen",
        labelConfirmPass: "Passwort bestätigen",
        placeholderRepeatPass: "Master-Passwort wiederholen",
        termsAgreementPrefix: "Ich akzeptiere die",
        termsLink: "AGB",
        andText: "und die",
        privacyLink: "Datenschutzerklärung",
        btnRegister: "Account erstellen",
        navOverview: "Übersicht",
        navFleet: "Geräteflotte",
        navVault: "Tresor-Sync",
        navSecurity: "Sicherheit & Schlüssel",
        navDanger: "Gefahrenbereich",
        stageTelemetryPath: "KONSOLE // SYSTEM-TELEMETRIE",
        stageOverviewTitle: "Master-Identität & Systemstatus",
        telemetryIdentity: "Identitätsstatus",
        valAuthenticated: "AUTHENTIFIZIERT",
        telemetrySessions: "Aktive Flottensitzungen",
        telemetryEngine: "Verschlüsselungs-Engine",
        telemetryInvariant: "Zero-Knowledge Invariante",
        valEnforced: "AKTIV / ERZWUNGEN",
        identityParamsTitle: "Identitätsparameter",
        paramUsername: "Master-Benutzername",
        paramEmail: "Registrierte E-Mail",
        paramLanguage: "Spracheinstellung",
        stageFleetPath: "KONSOLE // FLOTTE // SITZUNGEN",
        stageFleetTitle: "Verbundene Geräte & Aktive Sitzungen",
        fleetCardTitle: "Sitzungsflotte",
        btnRefreshFleet: "Flotte aktualisieren",
        noSessions: "Keine aktiven Sitzungen gefunden.",
        btnRevoke: "Widerrufen",
        tagActive: "AKTIV",
        tagCurrent: "AKTUELL",
        stageVaultPath: "KONSOLE // TRESOR // CHIFFRETEXT-SYNC",
        stageVaultTitle: "Cloud-Tresorsynchronisation",
        vaultCardTitle: "Zero-Knowledge Cloud-Sicherung",
        vaultCardDesc: "Dein verschlüsselter Tresor-Blob wird auf dem Server ausschließlich in Chiffretextform gespeichert. Die Entschlüsselung erfordert deinen clientseitigen Hauptschlüssel, der niemals über das Netzwerk übertragen wird.",
        vaultStatusLabel: "Tresor-Chiffretext-Status",
        vaultChecking: "Status wird geprüft...",
        btnDownloadVault: "Verschlüsseltes Tresor-Backup herunterladen",
        stageSecurityPath: "KONSOLE // SICHERHEIT // ANMELDEDATEN",
        stageSecurityTitle: "Master-Passwort & Schlüssel-Rotation",
        securityCardTitle: "Passwort-Zurücksetzung",
        securityCardDesc: "Fordere einen sicheren Link zum Zurücksetzen des Passworts an deine verifizierte E-Mail-Adresse an. Der Link läuft nach 30 Minuten automatisch ab.",
        btnSendResetEmail: "Passwort-Reset E-Mail senden",
        stageDangerPath: "KONSOLE // COMPLIANCE // DEAKTIVIERUNG",
        stageDangerTitle: "Konto-Deaktivierung & Aufbewahrung",
        dangerCardTitle: "30-Tage Aufbewahrungsprotokoll",
        dangerCardDesc: "Die Kontodeaktivierung beendet sofort alle aktiven Gerätesitzungen. Deine verschlüsselten Daten verbleiben für eine 30-tägige Schutzfrist gesperrt, bevor sie unwiderruflich gelöscht werden. Ein E-Mail-Bestätigungscode ist erforderlich.",
        labelDelEmail: "Konto-E-Mail-Adresse",
        labelDelOtp: "6-stelliger Bestätigungscode",
        labelDelPassword: "Master-Passwort Bestätigung",
        placeholderDelPassword: "Passwort zur Bestätigung eingeben",
        btnDeactivateAccount: "Konto deaktivieren & löschen",
        ageConfirmCheckbox: "Ich bestätige, dass ich mindestens 16 Jahre alt bin"
      },
      embedSection: {
        badge: "Für Website-Betreiber & Entwickler",
        title: "FlakeSecure auf deiner Website einbinden",
        desc: "Biete deinen Nutzern biometrischen QR-Login direkt auf deiner Website an. Über ein 1-Zeilen-Script oder ein sicheres Iframe: ganz ohne Browser-Extension. Die Anmeldedaten werden automatisch in dein bestehendes Formular eingetragen und per normalem Formular-POST übermittelt (100% Zero-Knowledge).",
        btnDemo: "Interaktive Demo & Code-Snippets ->",
        btnDocs: "Dokumentation & Anleitung"
      },
      imprint: {
        backHome: "<- Home"
      },
      footer: {
        home: "Home",
        features: "Funktionen",
        downloads: "Downloads",
        embed: "Website-Integration (SDK)",
        account: "Account Portal",
        imprint: "Impressum",
        legal: "Datenschutz",
        terms: "AGB"
      }
    },
    fr: {
      nav: {
        home: "Accueil",
        downloads: "Téléchargements",
        features: "Fonctionnalités",
        embed: "Pour Sites Web",
        account: "Portail Compte",
        legal: "Confidentialité & Mentions",
        statusOnline: "En ligne"
      },
      donation: {
        badge: "Sécurité 100% Gratuite & Indépendante",
        title: "Soutenez la sécurité Zero-Knowledge indépendante",
        desc: "FlakeSecure est entièrement gratuit. Sans abonnement, sans publicité, sans traceur et sans paywall. Vos mots de passe et jetons 2FA restent sous votre contrôle exclusif sur vos appareils. Nous finançons l'infrastructure de manière indépendante. Si FlakeSecure sécurise votre quotidien, un don de café aide à maintenir les serveurs en ligne.",
        btnBmac: "Soutenir sur Buy Me a Coffee"
      },
      hero: {
        badge: "Architecture Zero-Knowledge | Biométrie Matérielle",
        subtitle: "Authentification biométrique Zero-Knowledge et relais de secrets. Chiffrement local AES-256-CTR et Argon2id. Aucun mot de passe stocké sur serveur.",
        btnDownload: "Télécharger l'App & Extensions",
        btnAccount: "Gérer le Compte & Coffre",
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
        badgeConsole: "CONSOLE",
        statusPill: "AES-256-CTR | ZERO-KNOWLEDGE",
        btnHome: "Accueil",
        btnSignOut: "Déconnexion",
        authBadge: "TERMINAL D'AUTHENTIFICATION",
        authTitle: "Console de Sécurité Zero-Knowledge",
        authSubtitle: "Portail sécurisé pour gérer votre identité maître FlakeSecure, vos sessions actives et la synchronisation de coffre.",
        spec1Title: "Stockage Zero-Knowledge",
        spec1Desc: "Les données du coffre résident exclusivement sous forme chiffrée côté client. Les clés maîtresses ne touchent jamais les serveurs.",
        spec2Title: "Rétention Protégée de 30 Jours",
        spec2Desc: "La clôture du compte révoque immédiatement les sessions et applique un délai de rétention de conformité de 30 jours avant purge finale.",
        spec3Title: "Télémétrie de Flotte Active",
        spec3Desc: "Inspectez les applications mobiles et extensions de navigateur connectées avec révocation à distance.",
        tabLogin: "Connexion",
        tabRegister: "Créer un compte",
        btnForgotPass: "Mot de passe oublié ?",
        forgotDesc: "Entrez votre adresse e-mail enregistrée :",
        btnSendResetLink: "Envoyer le lien",
        btnCancel: "Annuler",
        msgForgotSuccess: "Si un compte existe avec cet e-mail, un lien a été envoyé.",
        labelEmailOrUser: "Identifiant ou E-mail",
        placeholderEmailOrUser: "alice ou alice@domaine.com",
        labelPassword: "Mot de passe",
        placeholderPassword: "Mot de passe maître",
        btnLogin: "Connexion à la Console",
        labelEmail: "Adresse e-mail",
        placeholderEmail: "alice@domaine.com",
        btnSendCode: "Envoyer le code",
        btnResendCode: "Renvoyer",
        labelOtp: "Code à 6 chiffres",
        placeholderOtp: "123456",
        labelUsername: "Nom d'utilisateur",
        placeholderUsername: "alice",
        labelMasterPass: "Mot de passe maître",
        placeholderMinPass: "Min. 8 caractères",
        labelConfirmPass: "Confirmer le mot de passe",
        placeholderRepeatPass: "Répéter le mot de passe maître",
        termsAgreementPrefix: "J'accepte les",
        termsLink: "Conditions d'utilisation",
        andText: "et la",
        privacyLink: "Politique de confidentialité",
        btnRegister: "Créer le compte",
        navOverview: "Vue d'ensemble",
        navFleet: "Flotte d'appareils",
        navVault: "Sync Coffre-fort",
        navSecurity: "Sécurité & Clé",
        navDanger: "Zone de Danger",
        stageTelemetryPath: "CONSOLE // TÉLÉMÉTRIE DU SYSTÈME",
        stageOverviewTitle: "Identité Maître & Santé du Système",
        telemetryIdentity: "Statut d'identité",
        valAuthenticated: "AUTHENTIFIÉ",
        telemetrySessions: "Sessions de flotte actives",
        telemetryEngine: "Moteur de chiffrement",
        telemetryInvariant: "Invariant Zero-Knowledge",
        valEnforced: "APPLIQUÉ",
        identityParamsTitle: "Paramètres d'identité",
        paramUsername: "Nom d'utilisateur maître",
        paramEmail: "E-mail enregistré",
        paramLanguage: "Préférence de langue",
        stageFleetPath: "CONSOLE // FLOTTE // SESSIONS",
        stageFleetTitle: "Appareils Connectés & Sessions Actives",
        fleetCardTitle: "Flotte de sessions",
        btnRefreshFleet: "Actualiser la flotte",
        noSessions: "Aucune session active trouvée.",
        btnRevoke: "Révoquer",
        tagActive: "ACTIF",
        tagCurrent: "ACTUEL",
        stageVaultPath: "CONSOLE // COFFRE // SYNC CHIFFRÉE",
        stageVaultTitle: "Synchronisation du Coffre Cloud",
        vaultCardTitle: "Sauvegarde Cloud Zero-Knowledge",
        vaultCardDesc: "Votre blob de coffre chiffré est stocké sur le serveur exclusivement sous forme chiffrée. Le déchiffrement nécessite votre clé maîtresse qui n'est jamais transmise.",
        vaultStatusLabel: "Statut du Chiffretexte du Coffre",
        vaultChecking: "Vérification de l'état...",
        btnDownloadVault: "Télécharger la sauvegarde chiffrée",
        stageSecurityPath: "CONSOLE // SÉCURITÉ // IDENTIFIANTS",
        stageSecurityTitle: "Mot de passe maître & Rotation des clés",
        securityCardTitle: "Réinitialisation du mot de passe",
        securityCardDesc: "Demandez un lien sécurisé de réinitialisation de mot de passe envoyé à votre adresse e-mail vérifiée (valable 30 minutes).",
        btnSendResetEmail: "Envoyer l'e-mail de réinitialisation",
        stageDangerPath: "CONSOLE // CONFORMITÉ // DÉSACTIVATION",
        stageDangerTitle: "Désactivation & Rétention du Compte",
        dangerCardTitle: "Protocole de suppression sous 30 jours",
        dangerCardDesc: "La suppression du compte révoque immédiatement toutes les sessions. Vos données chiffrées restent verrouillées pendant 30 jours avant suppression définitive. Un code par e-mail est obligatoire.",
        labelDelEmail: "Adresse e-mail du compte",
        labelDelOtp: "Code de vérification à 6 chiffres",
        labelDelPassword: "Confirmation du mot de passe maître",
        placeholderDelPassword: "Entrez le mot de passe pour confirmer",
        btnDeactivateAccount: "Désactiver & Demander la suppression",
        ageConfirmCheckbox: "Je confirme avoir au moins 16 ans"
      },
      embedSection: {
        badge: "Pour Propriétaires de Sites & Développeurs",
        title: "Intégrez FlakeSecure sur votre site web",
        desc: "Proposez à vos utilisateurs une connexion biométrique par QR code directement sur votre page de connexion via un iframe ou un script d'une ligne. Remplissage et envoi automatique via votre formulaire habituel (Zero-Knowledge).",
        btnDemo: "Démo interactive & extraits de code ->",
        btnDocs: "Documentation"
      },
      imprint: {
        backHome: "<- Accueil"
      },
      footer: {
        home: "Accueil",
        features: "Fonctionnalités",
        downloads: "Téléchargements",
        embed: "Intégration Web (SDK)",
        account: "Portail Compte",
        imprint: "Mentions Légales",
        legal: "Confidentialité",
        terms: "Conditions Générales"
      }
    },
    es: {
      nav: {
        home: "Inicio",
        downloads: "Descargas",
        features: "Funciones",
        embed: "Para Sitios Web",
        account: "Portal de Cuenta",
        legal: "Privacidad y Legal",
        statusOnline: "En línea"
      },
      donation: {
        badge: "Seguridad 100% Gratuita e Independiente",
        title: "Apoya la seguridad Zero-Knowledge independiente",
        desc: "FlakeSecure es completamente gratuito. Sin suscripciones, sin publicidad, sin rastreadores y sin muros de pago. Tus contraseñas y tokens 2FA permanecen bajo tu exclusivo control en tus dispositivos. Financiamos la infraestructura de forma independiente. Si FlakeSecure protege tu vida digital, una pequeña donación de café ayuda a mantener los servidores en línea.",
        btnBmac: "Apóyanos en Buy Me a Coffee"
      },
      hero: {
        badge: "Arquitectura Zero-Knowledge | Biometría",
        subtitle: "Autenticación biométrica Zero-Knowledge y transmisión de secretos. Cifrado local AES-256-CTR y Argon2id. Sin contraseñas en servidores.",
        btnDownload: "Descargar Apps y Extensiones",
        btnAccount: "Gestionar Cuenta y Bóveda",
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
        badgeConsole: "CONSOLA",
        statusPill: "AES-256-CTR | ZERO-KNOWLEDGE",
        btnHome: "Inicio",
        btnSignOut: "Cerrar Sesión",
        authBadge: "TERMINAL DE AUTENTICACIÓN",
        authTitle: "Consola de Seguridad Zero-Knowledge",
        authSubtitle: "Portal seguro para gestionar su identidad maestra FlakeSecure, sesiones de dispositivos activos y sincronización del baúl.",
        spec1Title: "Almacenamiento Zero-Knowledge",
        spec1Desc: "Los registros del baúl residen exclusivamente como texto cifrado del lado del cliente. Las claves maestras nunca llegan a nuestros servidores.",
        spec2Title: "Retención Protegida de 30 Días",
        spec2Desc: "La cancelación de la cuenta revoca de inmediato las sesiones y aplica un período de retención protegido de 30 días antes de la purga permanente.",
        spec3Title: "Telemetría de Flota Activa",
        spec3Desc: "Audite aplicaciones móviles y extensiones de navegador conectadas con revocación remota.",
        tabLogin: "Iniciar Sesión",
        tabRegister: "Crear Cuenta",
        btnForgotPass: "¿Olvidó su contraseña?",
        forgotDesc: "Ingrese su correo electrónico registrado:",
        btnSendResetLink: "Enviar enlace",
        btnCancel: "Cancelar",
        msgForgotSuccess: "Si existe una cuenta con este correo, se ha enviado un enlace.",
        labelEmailOrUser: "Usuario o Correo",
        placeholderEmailOrUser: "alice o alice@dominio.com",
        labelPassword: "Contraseña",
        placeholderPassword: "Contraseña Maestra",
        btnLogin: "Ingresar a la Consola",
        labelEmail: "Correo Electrónico",
        placeholderEmail: "alice@dominio.com",
        btnSendCode: "Enviar Código",
        btnResendCode: "Reenviar",
        labelOtp: "Código de 6 Dígitos",
        placeholderOtp: "123456",
        labelUsername: "Nombre de Usuario",
        placeholderUsername: "alice",
        labelMasterPass: "Contraseña Maestra",
        placeholderMinPass: "Mín. 8 caracteres",
        labelConfirmPass: "Confirmar Contraseña",
        placeholderRepeatPass: "Repetir Contraseña Maestra",
        termsAgreementPrefix: "Acepto los",
        termsLink: "Términos de Servicio",
        andText: "y la",
        privacyLink: "Política de Privacidad",
        btnRegister: "Crear Cuenta",
        navOverview: "Resumen",
        navFleet: "Flota de Dispositivos",
        navVault: "Sincronización del Baúl",
        navSecurity: "Seguridad y Claves",
        navDanger: "Zona de Peligro",
        stageTelemetryPath: "CONSOLA // TELEMETRÍA DEL SISTEMA",
        stageOverviewTitle: "Identidad Maestra y Estado del Sistema",
        telemetryIdentity: "Estado de Identidad",
        valAuthenticated: "AUTENTICADO",
        telemetrySessions: "Sesiones de Flota Activas",
        telemetryEngine: "Motor de Cifrado",
        telemetryInvariant: "Invariante Zero-Knowledge",
        valEnforced: "APLICADO",
        identityParamsTitle: "Parámetros de Identidad",
        paramUsername: "Nombre de Usuario Maestro",
        paramEmail: "Correo Registrado",
        paramLanguage: "Preferencia de Idioma",
        stageFleetPath: "CONSOLA // FLOTA // SESIONES",
        stageFleetTitle: "Dispositivos Conectados y Sesiones Activas",
        fleetCardTitle: "Flota de Sesiones",
        btnRefreshFleet: "Actualizar Flota",
        noSessions: "No se encontraron sesiones activas.",
        btnRevoke: "Revocar",
        tagActive: "ACTIVO",
        tagCurrent: "ACTUAL",
        stageVaultPath: "CONSOLA // BAÚL // SINC CIFRADA",
        stageVaultTitle: "Sincronización del Baúl en la Nube",
        vaultCardTitle: "Copia de Seguridad Cloud Zero-Knowledge",
        vaultCardDesc: "El blob de su baúl cifrado se almacena en el servidor exclusivamente en forma de texto cifrado. El descifrado requiere su clave maestra que nunca se transmite.",
        vaultStatusLabel: "Estado del Texto Cifrado del Baúl",
        vaultChecking: "Comprobando estado...",
        btnDownloadVault: "Descargar copia de seguridad cifrada",
        stageSecurityPath: "CONSOLA // SEGURIDAD // CREDENCIALES",
        stageSecurityTitle: "Contraseña Maestra y Rotación de Claves",
        securityCardTitle: "Restablecimiento de Contraseña",
        securityCardDesc: "Solicite un enlace seguro de restablecimiento de contraseña enviado a su correo verificado (expira en 30 minutos).",
        btnSendResetEmail: "Enviar Correo de Restablecimiento",
        stageDangerPath: "CONSOLA // CUMPLIMIENTO // DESACTIVACIÓN",
        stageDangerTitle: "Desactivación y Retención de Cuenta",
        dangerCardTitle: "Protocolo de Retención de 30 Días",
        dangerCardDesc: "La desactivación de la cuenta revoca de inmediato todas las sesiones activas. Los datos cifrados permanecen bloqueados durante un período de 30 días antes de su eliminación permanente. Se requiere código de verificación por correo.",
        labelDelEmail: "Correo de la Cuenta",
        labelDelOtp: "Código de Verificación de 6 Dígitos",
        labelDelPassword: "Confirmación de Contraseña Maestra",
        placeholderDelPassword: "Ingrese contraseña para confirmar",
        btnDeactivateAccount: "Desactivar y Solicitar Eliminación",
        ageConfirmCheckbox: "Confirmo que tengo al menos 16 años"
      },
      embedSection: {
        badge: "Para Propietarios de Sitios Web & Desarrolladores",
        title: "Integra FlakeSecure en tu sitio web",
        desc: "Ofrece a tus usuarios inicio de sesión biométrico con código QR directamente en tu página mediante un iframe o script de 1 línea. Relleno automático y envío a través de tu formulario habitual (Zero-Knowledge).",
        btnDemo: "Ver demo interactiva y código ->",
        btnDocs: "Documentación"
      },
      imprint: {
        backHome: "<- Inicio"
      },
      footer: {
        home: "Inicio",
        features: "Funciones",
        downloads: "Descargas",
        embed: "Integración Web (SDK)",
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
      if (!sel._i18nBound) {
        sel._i18nBound = true;
        sel.addEventListener('change', (e) => {
          setWebsiteLanguage(e.target.value);
        });
      }
    });
  }

  // Delegated change listener for any language dropdowns
  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('fs-lang-select')) {
      setWebsiteLanguage(e.target.value);
    }
  });

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
