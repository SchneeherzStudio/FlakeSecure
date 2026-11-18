/**
 * ============================================================================
 * FlakeSecure - Extension Onboarding / Welcome Page Script v2.1.0
 * ============================================================================
 */

const WELCOME_I18N = {
  de: {
    badgeGuide: "Erste Schritte",
    heroBadge: "Erfolgreich installiert",
    heroTitle: "Willkommen bei FlakeSecure",
    heroSubtitle: "Dein sicherer Zero-Knowledge Passwort-Manager für den Browser. In nur 4 Schritten bist du startklar.",
    step1Title: "Mobile App herunterladen",
    step1Desc: "Scanne den QR-Code mit deiner Smartphone-Kamera, um zur Download-Seite zu gelangen, oder lade die Android APK direkt herunter.",
    step1BtnApk: "Android APK herunterladen",
    step1BtnAll: "Alle Versionen & Downloads",
    step2Title: "Tresor einrichten & Biometrie",
    step2Desc: "Öffne die FlakeSecure Mobile App und erstelle deinen Account. Aktiviere Face ID oder deinen Fingerabdruck für sichere Freigaben ohne Tippen von Master-Passwörtern.",
    step2Pill1: "Zero-Knowledge AES-256",
    step2Pill2: "Face ID / Fingerabdruck",
    step2Pill3: "Lokale Schlüsselerzeugung",
    step3Title: "Browser-Erweiterung koppeln",
    step3Desc: "Klicke oben rechts auf das FlakeSecure-Symbol in der Browser-Toolbar. Es erscheint ein QR-Code. Scanne ihn mit deiner FlakeSecure Mobile App – schon sind Browser und Smartphone Ende-zu-Ende gekoppelt.",
    step3Btn: "Jetzt koppeln",
    step4Title: "Automatisches Ausfüllen im Web",
    step4Desc: "Wenn du Anmeldeseiten besuchst, erkennt FlakeSecure die Formulare automatisch. Bestätige den Login einfach per Fingertipp auf deinem Smartphone – Passwörter werden automatisch sicher eingetragen.",
    step4Pill1: "1-Klick Auto-Fill",
    step4Pill2: "TOTP Authenticator Unterstützung",
    step4Pill3: "Phishing-Schutz",
    pinTitle: "Tipp: FlakeSecure an die Toolbar pinnen",
    pinDesc: "Klicke oben rechts im Browser auf das Puzzleteil-Symbol (Erweiterungen) und aktiviere die Stecknadel neben FlakeSecure, damit du jederzeit mit einem Klick darauf zugreifen kannst.",
    modalTitle: "So koppelst du die Erweiterung",
    modalIntro: "Folge diesen einfachen Schritten:",
    modalStep1: "Klicke oben rechts auf das FlakeSecure-Icon in deiner Browserleiste.",
    modalStep2: "Ein sicherer Kopplungs-QR-Code wird im Popup angezeigt.",
    modalStep3: "Öffne die FlakeSecure Mobile App auf deinem Smartphone.",
    modalStep4: "Tippe auf das Scan-Symbol und halte deine Kamera auf den QR-Code.",
    modalStep5: "Bestätige kurz mit deinem Fingerabdruck / Face ID – fertig!",
    modalBtn: "Verstanden",
    footerDownloads: "Downloads",
    footerAccount: "Web Vault",
    footerLegal: "Datenschutz",
    footerTerms: "AGB"
  },
  en: {
    badgeGuide: "Getting Started",
    heroBadge: "Successfully Installed",
    heroTitle: "Welcome to FlakeSecure",
    heroSubtitle: "Your secure Zero-Knowledge password manager for the browser. Get ready in just 4 simple steps.",
    step1Title: "Download Mobile App",
    step1Desc: "Scan the QR code with your phone camera to reach the downloads page, or download the Android APK directly.",
    step1BtnApk: "Download Android APK",
    step1BtnAll: "All Versions & Downloads",
    step2Title: "Setup Vault & Biometrics",
    step2Desc: "Open the FlakeSecure mobile app and create your account. Enable Face ID or fingerprint unlock for instant approvals without typing master passwords.",
    step2Pill1: "Zero-Knowledge AES-256",
    step2Pill2: "Face ID / Fingerprint",
    step2Pill3: "Local Key Derivation",
    step3Title: "Pair Browser Extension",
    step3Desc: "Click the FlakeSecure icon in your browser toolbar. A pairing QR code will appear. Scan it with your FlakeSecure mobile app – and you're paired end-to-end.",
    step3Btn: "Pair Now",
    step4Title: "Auto-Fill Across the Web",
    step4Desc: "When visiting login pages, FlakeSecure automatically detects login forms. Confirm on your phone with a single tap – credentials are autofilled securely.",
    step4Pill1: "1-Click Auto-Fill",
    step4Pill2: "TOTP Authenticator Support",
    step4Pill3: "Anti-Phishing Protection",
    pinTitle: "Tip: Pin FlakeSecure to your toolbar",
    pinDesc: "Click the puzzle piece icon (Extensions) at the top right of your browser and pin FlakeSecure so you can access it anytime with a single click.",
    modalTitle: "How to pair the extension",
    modalIntro: "Follow these simple steps:",
    modalStep1: "Click the FlakeSecure icon in your browser toolbar.",
    modalStep2: "A secure pairing QR code will be displayed in the popup.",
    modalStep3: "Open the FlakeSecure mobile app on your phone.",
    modalStep4: "Tap the Scan icon and point your camera at the QR code.",
    modalStep5: "Confirm with your fingerprint or Face ID – that's it!",
    modalBtn: "Got it",
    footerDownloads: "Downloads",
    footerAccount: "Web Vault",
    footerLegal: "Privacy Policy",
    footerTerms: "Terms"
  },
  fr: {
    badgeGuide: "Premiers pas",
    heroBadge: "Installé avec succès",
    heroTitle: "Bienvenue sur FlakeSecure",
    heroSubtitle: "Votre gestionnaire de mots de passe Zero-Knowledge pour le navigateur. Soyez prêt en 4 étapes simples.",
    step1Title: "Télécharger l'application mobile",
    step1Desc: "Scannez le code QR avec l'appareil photo de votre smartphone pour accéder aux téléchargements ou téléchargez l'APK Android.",
    step1BtnApk: "Télécharger l'APK Android",
    step1BtnAll: "Toutes les versions",
    step2Title: "Configurer le coffre & la biométrie",
    step2Desc: "Ouvrez l'application mobile FlakeSecure et créez votre compte. Activez Face ID ou votre empreinte digitale pour des validations sécurisées.",
    step2Pill1: "Zero-Knowledge AES-256",
    step2Pill2: "Face ID / Empreinte digitale",
    step2Pill3: "Génération locale des clés",
    step3Title: "Associer l'extension de navigateur",
    step3Desc: "Cliquez sur l'icône FlakeSecure dans la barre d'outils du navigateur. Un code QR s'affiche. Scannez-le avec votre application mobile pour associer vos appareils.",
    step3Btn: "Associer maintenant",
    step4Title: "Remplissage automatique sur le web",
    step4Desc: "Lorsque vous visitez des pages de connexion, FlakeSecure détecte automatiquement les formulaires. Confirmez sur votre smartphone et les identifiants sont renseignés.",
    step4Pill1: "Remplissage en 1 clic",
    step4Pill2: "Support Authenticator TOTP",
    step4Pill3: "Protection anti-hameçonnage",
    pinTitle: "Astuce : Épinglez FlakeSecure à votre barre d'outils",
    pinDesc: "Cliquez sur l'icône en forme de puzzle (Extensions) en haut à droite du navigateur et épinglez FlakeSecure pour y accéder facilement.",
    modalTitle: "Comment associer l'extension",
    modalIntro: "Suivez ces étapes simples :",
    modalStep1: "Cliquez sur l'icône FlakeSecure dans la barre de votre navigateur.",
    modalStep2: "Un code QR d'association s'affiche dans le popup.",
    modalStep3: "Ouvrez l'application mobile FlakeSecure sur votre smartphone.",
    modalStep4: "Appuyez sur l'icône Scanner et visez le code QR.",
    modalStep5: "Confirmez avec votre empreinte ou Face ID – c'est fait !",
    modalBtn: "Compris",
    footerDownloads: "Téléchargements",
    footerAccount: "Web Vault",
    footerLegal: "Confidentialité",
    footerTerms: "Conditions"
  },
  es: {
    badgeGuide: "Primeros pasos",
    heroBadge: "Instalado con éxito",
    heroTitle: "Bienvenido a FlakeSecure",
    heroSubtitle: "Tu gestor de contraseñas Zero-Knowledge para el navegador. Listo en solo 4 sencillos pasos.",
    step1Title: "Descargar la app móvil",
    step1Desc: "Escanea el código QR con la cámara de tu smartphone para acceder a las descargas, o descarga directamente el APK de Android.",
    step1BtnApk: "Descargar APK para Android",
    step1BtnAll: "Todas las versiones",
    step2Title: "Configurar bóveda & biometría",
    step2Desc: "Abre la aplicación móvil FlakeSecure y crea tu cuenta. Activa Face ID o huella dactilar para autorizaciones instantáneas sin escribir contraseñas maestras.",
    step2Pill1: "Zero-Knowledge AES-256",
    step2Pill2: "Face ID / Huella dactilar",
    step2Pill3: "Generación de claves local",
    step3Title: "Vincular extensión del navegador",
    step3Desc: "Haz clic en el icono de FlakeSecure en la barra del navegador. Aparecerá un código QR. Escanéalo con tu app móvil para vincular tus dispositivos.",
    step3Btn: "Vincular ahora",
    step4Title: "Autorrelleno automático en la web",
    step4Desc: "Al visitar páginas de inicio de sesión, FlakeSecure detecta los formularios automáticamente. Confirma en tu smartphone con un solo toque y listo.",
    step4Pill1: "Autorrelleno en 1 clic",
    step4Pill2: "Soporte TOTP Authenticator",
    step4Pill3: "Protección contra phishing",
    pinTitle: "Consejo: Fija FlakeSecure en la barra de herramientas",
    pinDesc: "Haz clic en el icono de la pieza de puzzle (Extensiones) en la esquina superior derecha y fija FlakeSecure para tenerla siempre accesible.",
    modalTitle: "Cómo vincular la extensión",
    modalIntro: "Sigue estos sencillos pasos:",
    modalStep1: "Haz clic en el icono de FlakeSecure en la barra de herramientas.",
    modalStep2: "Aparecerá un código QR seguro de vinculación en el popup.",
    modalStep3: "Abre la app móvil FlakeSecure en tu smartphone.",
    modalStep4: "Toca el icono de Escanear y apunta tu cámara al código QR.",
    modalStep5: "Confirma con tu huella dactilar o Face ID – ¡y listo!",
    modalBtn: "Entendido",
    footerDownloads: "Descargas",
    footerAccount: "Web Vault",
    footerLegal: "Privacidad",
    footerTerms: "Términos"
  }
};

let currentLang = 'de';

function applyWelcomeTranslations(lang) {
  currentLang = ['de', 'en', 'fr', 'es'].includes(lang) ? lang : 'de';
  const t = WELCOME_I18N[currentLang];

  const map = {
    't-badge-guide': t.badgeGuide,
    't-hero-badge': t.heroBadge,
    't-hero-title': t.heroTitle,
    't-hero-subtitle': t.heroSubtitle,
    't-step1-title': t.step1Title,
    't-step1-desc': t.step1Desc,
    't-step1-btn-apk': t.step1BtnApk,
    't-step1-btn-all': t.step1BtnAll,
    't-step2-title': t.step2Title,
    't-step2-desc': t.step2Desc,
    't-step2-pill1': t.step2Pill1,
    't-step2-pill2': t.step2Pill2,
    't-step2-pill3': t.step2Pill3,
    't-step3-title': t.step3Title,
    't-step3-desc': t.step3Desc,
    't-step3-btn': t.step3Btn,
    't-step4-title': t.step4Title,
    't-step4-desc': t.step4Desc,
    't-step4-pill1': t.step4Pill1,
    't-step4-pill2': t.step4Pill2,
    't-step4-pill3': t.step4Pill3,
    't-pin-title': t.pinTitle,
    't-pin-desc': t.pinDesc,
    't-modal-title': t.modalTitle,
    't-modal-intro': t.modalIntro,
    't-modal-step1': t.modalStep1,
    't-modal-step2': t.modalStep2,
    't-modal-step3': t.modalStep3,
    't-modal-step4': t.modalStep4,
    't-modal-step5': t.modalStep5,
    't-modal-btn': t.modalBtn,
    't-footer-downloads': t.footerDownloads,
    't-footer-account': t.footerAccount,
    't-footer-legal': t.footerLegal,
    't-footer-terms': t.footerTerms
  };

  for (const [id, text] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  const langSelect = document.getElementById('lang-select');
  if (langSelect) langSelect.value = currentLang;
  document.documentElement.lang = currentLang;
}

document.addEventListener('DOMContentLoaded', () => {
  const storageAPI = (typeof browser !== 'undefined' && browser.storage) 
    ? browser.storage 
    : (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : null);

  // 1. QR Code for Downloads
  const qrContainer = document.getElementById('download-qr-code');
  if (qrContainer && typeof QRCode !== 'undefined') {
    while (qrContainer.firstChild) {
      qrContainer.removeChild(qrContainer.firstChild);
    }
    new QRCode(qrContainer, {
      text: 'https://flakesecure.snowystudio.dev/downloads',
      width: 140,
      height: 140,
      colorDark: '#080a12',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // 2. Theme Management
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    } else {
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    }
  }

  if (storageAPI) {
    storageAPI.local.get(['ext_theme'], (res) => {
      let activeTheme = res?.ext_theme;
      if (!activeTheme) {
        activeTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      applyTheme(activeTheme);
    });
  } else {
    const local = localStorage.getItem('ext_theme');
    applyTheme(local || 'dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      if (storageAPI) {
        storageAPI.local.set({ ext_theme: nextTheme });
      } else {
        localStorage.setItem('ext_theme', nextTheme);
      }
    });
  }

  // 3. Language Selector
  const langSelect = document.getElementById('lang-select');
  if (storageAPI && storageAPI.sync) {
    storageAPI.sync.get(['app_language'], (res) => {
      const savedLang = res?.app_language || (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');
      applyWelcomeTranslations(savedLang);
    });
  } else {
    const sysLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
    applyWelcomeTranslations(sysLang);
  }

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      if (storageAPI && storageAPI.sync) {
        storageAPI.sync.set({ app_language: newLang });
      }
      applyWelcomeTranslations(newLang);
    });
  }

  // 4. Modal for "Jetzt koppeln"
  const startPairingBtn = document.getElementById('start-pairing-btn');
  const modalBackdrop = document.getElementById('guide-modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalGotItBtn = document.getElementById('modal-gotit-btn');

  function openModal() {
    if (modalBackdrop) modalBackdrop.classList.add('active');
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.classList.remove('active');
  }

  if (startPairingBtn) startPairingBtn.addEventListener('click', openModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalGotItBtn) modalGotItBtn.addEventListener('click', closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }
});
