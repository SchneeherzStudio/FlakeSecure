# ❄️ FlakeSecure

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Chrome%20%7C%20Firefox-success.svg)](#-platform-support)
[![Security](https://img.shields.io/badge/encryption-AES--256--CTR%20%2B%20HMAC--SHA256-orange.svg)](#-security-architecture--protocols)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](#)

> **Zero-Knowledge Biometric Cross-Platform Password & Login Manager**  
> Scan QR code on your desktop browser → Confirm via Face ID / Touch ID / Fingerprint on your smartphone → Browser logs in automatically via end-to-end encryption.

---

## 📋 Table of Contents

- [✨ What's New in Version 1.2.0 (Changelog)](#-whats-new-in-version-120-changelog)
- [✨ Core Features](#-core-features)
- [🏗 Project Structure](#-project-structure)
- [🚀 Setup & Installation](#-setup--installation)
  - [1. Relay & API Server](#1-relay--api-server)
  - [2. Chrome / Edge / Chromium Extension](#2-chrome--edge--chromium-extension)
  - [3. Firefox Extension](#3-firefox-extension)
  - [4. Mobile App (iOS / Android)](#4-mobile-app-ios--android)
- [🔐 Security Architecture & Protocols](#-security-architecture--protocols)
- [📦 Dependencies & Tech Stack](#-dependencies--tech-stack)
- [📄 License](#-license)

---

## ✨ What's New in Version 1.2.0 (Changelog)

With the **v1.2.0** release, FlakeSecure evolved from a lightweight login relay into a full-featured, zero-knowledge identity and credential ecosystem.

### 🌟 Key Changes & Improvements:

1. 🦊 **Firefox WebExtension Support (`browser-extension-firefox/`)**:
   - Native Firefox extension powered by modern `browser.*` promise-based WebExtension APIs.
   - Dedicated manifest configuration and a detailed [Firefox Installation Guide](browser-extension-firefox/INSTALL_FIREFOX.md).
   - Modular CSS styling (`styles/content.css`) providing clean UI isolation on target web pages.

2. 🛡️ **Account System & Cloud Infrastructure**:
   - **PostgreSQL Backend**: Persistent relational database schema (`users`, `sessions`, `login_logs`, `allowed_recipients`, `shared_payloads`, `received_credentials`).
   - **Argon2 Password Hashing**: State-of-the-art cryptographic password hashing for user accounts.
   - **JWT Authentication & Session Management**: 24-hour token sessions with active monitoring and remote session revocation.
   - **Biometric App Lock**: Instant biometric verification upon app launch or resume (`BiometricUnlockScreen`).

3. 👥 **Secure Credential Sharing & Whitelist Control (`ShareImportScreen`)**:
   - End-to-end encrypted sharing of credentials between users without exposing plaintext secrets (one-time E2E encryption).
   - Configurable access permission modes: `only_me` (block inbound shares), `whitelist` (only trusted contacts), `all`.
   - Whitelist recipient manager featuring live user search.
   - Time-limited credential sharing with expiration timestamps (`expiresInHours`) and one-time consumption confirmation status.

4. 📝 **Registration Autofill & Profile Presets (`RegisterFillScreen`)**:
   - Smart detection of registration and sign-up forms across websites.
   - Automated autofill of registration details (email, username, name, phone) directly from the mobile app.
   - Default profile presets stored locally in the app for 1-tap website sign-ups.
   - Integrated customizable random password generator.

5. 🏷️ **Categories & Custom Icons**:
   - Organize credentials into custom categories (e.g. Work, Finance, Social, Gaming, Shopping).
   - Custom emoji/icon assignment (`👤`, `💼`, `💳`, `🎮`, `🛍️`, `🔑`, etc.).
   - Fast filter bar on the HomeScreen with category counts and quick switching.

6. 🗺️ **Security Audit & GeoIP Login Logs (`LogsScreen`)**:
   - Comprehensive audit logging for all authentication and credential relay operations.
   - GeoIP location resolution (City, Region, Country) along with IP address and User-Agent tracking to identify suspicious access.
   - User controls to review and clear audit history.

7. 🌍 **Full Multi-Language Support (i18n)**:
   - Complete localization in **German (DE)**, **English (EN)**, **Spanish (ES)**, and **French (FR)**.
   - Automatic system language detection with in-app manual language switcher.

8. 🌐 **Web Landing Page & Deep Link Routing**:
   - Built-in web pages for Home (`/`), Imprint (`/imprint`), and Privacy Policy (`/legal`).
   - Smart web redirect endpoints (`/auth`, `/share`) that automatically trigger deep linking into the native mobile app (`flakesecure://`).

9. 📱 **Modernized React Native & Expo SDK**:
   - Upgraded to modern Expo SDK with React 19, `@react-navigation/native-stack` v7, and EAS Build support (`eas.json`).
   - Refreshed onboarding walkthrough for first-time users (`OnboardingScreen`).

---

## ✨ Core Features

- **⚡ Instant QR Login**: No need to type lengthy master passwords or secrets on public or desktop devices.
- **🔒 End-to-End Encryption**: AES-256-CTR + HMAC-SHA256 with ephemeral session keys – the server never accesses plaintext data.
- **🧬 Native Biometrics**: Face ID, Touch ID, or Android Biometric authentication required before releasing credentials.
- **📂 Secure Storage**: All credentials stored encrypted inside the hardware-backed SecureStore (iOS Keychain / Android Keystore).
- **🛡️ Whitelist Sharing**: Share credentials securely with friends, family, or colleagues with fine-grained permission control.
- **📱 Universal Deep Linking**: Seamless QR code recognition via camera scan or direct web links.

---

## 🏗 Project Structure

```
flakesecure/
├── browser-extension/              # Chrome / Edge / Chromium Extension (Manifest V3)
│   └── extension/
│       ├── manifest.json
│       ├── content.js              # Detects forms, injects overlay & QR modal
│       ├── popup.html / popup.js   # Extension popup & settings (Relay URL)
│       ├── styles/content.css      # Isolated overlay stylesheet
│       ├── lib/                    # qrcode.min.js & socket.io.min.js
│       └── icons/
│
├── browser-extension-firefox/      # Native Mozilla Firefox Extension
│   ├── INSTALL_FIREFOX.md          # Guide for temporary add-on installation
│   └── extension/
│       ├── manifest.json
│       ├── background.js           # Firefox WebExtension background worker
│       ├── content.js              # Form detection using browser.* API
│       ├── popup.html / popup.js
│       ├── styles/content.css
│       └── lib/ & icons/
│
├── server/                         # Node.js Relay, Auth & Web Server
│   ├── server.js                   # Express + Socket.IO Relay + Web Routes
│   ├── db.js                       # PostgreSQL Connection Pool
│   ├── db/
│   │   └── schema.sql              # Database schema & indexes
│   ├── middleware/
│   │   └── auth.js                 # JWT & session token validation
│   ├── routes/
│   │   ├── auth.js                 # Register, Login, Logout, /me
│   │   ├── account.js              # Profile, Whitelist, User search, Delete
│   │   ├── logs.js                 # GeoIP audit logs & history
│   │   └── share.js                # Encrypted P2P payloads & status
│   ├── static/                     # Static HTML pages (Landing, Imprint, Legal)
│   └── public/                     # CSS stylesheets & image assets
│
└── FlakeSecure/                    # React Native Mobile App (Expo SDK)
    ├── App.js                      # Root Navigator & Deep Link router
    ├── app.json / eas.json         # Expo & EAS Build configuration
    └── app/src/
        ├── context/
        │   ├── AuthContext.js      # Auth state, token management, auto-lock
        │   └── LanguageContext.js  # Dynamic i18n language provider
        ├── i18n/
        │   ├── index.js            # i18n-js initialization
        │   └── locales/            # de.json, en.json, es.json, fr.json
        ├── screens/
        │   ├── HomeScreen.js       # Vault overview, category filter, quick actions
        │   ├── ScanScreen.js       # QR scanner for Auth, Share & Registration
        │   ├── ConfirmScreen.js    # Biometric prompt & encrypted login dispatch
        │   ├── CredentialsScreen.js # Add & categorize new credentials
        │   ├── ViewCredentialScreen.js # Biometrically protected detail & edit view
        │   ├── RegisterFillScreen.js # Registration autofill & password generator
        │   ├── ShareImportScreen.js # Encrypted QR & server-based credential exchange
        │   ├── LoginScreen.js      # Server account login & registration
        │   ├── BiometricUnlockScreen.js # Quick unlock on app launch/resume
        │   ├── OnboardingScreen.js # Initial setup & permissions walkthrough
        │   ├── SettingsScreen.js   # Language, Whitelist, Profile presets & Account
        │   └── LogsScreen.js       # Security audit logs with GeoIP location
        └── utils/
            ├── api.js              # REST API client
            ├── crypto.js           # AES-256-CTR & HMAC-SHA256 encrypt/decrypt
            └── storage.js          # SecureStore / AsyncStorage abstraction
```

---

## 🚀 Setup & Installation

### 1. Relay & API Server

#### Prerequisites:
- Node.js (v18+)
- PostgreSQL Database

#### Installation:
```bash
cd server
npm install
```

#### Configuration (`server/.env`):
Create a `.env` file in the `server/` directory:
```env
PORT=4000
PGHOST=localhost
PGPORT=5432
PGDATABASE=flakesecure
PGUSER=postgres
PGPASSWORD=your_password
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters
```

#### Database Setup:
```bash
psql -U postgres -d flakesecure -f db/schema.sql
```

#### Run Server:
```bash
# Development mode with auto-reload:
npm run dev

# Production start:
npm start
# → Server runs by default on port 4000
```

---

### 2. Chrome / Edge / Chromium Extension

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the folder `browser-extension/extension/`.
5. *(Optional)* Click the FlakeSecure icon in your toolbar to configure the Relay Server URL (Default: `https://flakesecure.snowystudio.dev`).

---

### 3. Firefox Extension

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside `browser-extension-firefox/extension/`.
4. The extension is immediately active. For details, see [INSTALL_FIREFOX.md](browser-extension-firefox/INSTALL_FIREFOX.md).

---

### 4. Mobile App (iOS / Android)

#### Installation:
```bash
cd FlakeSecure
npm install
```

#### Start in Development Mode:
```bash
npx expo start
```
- **Android**: Open the Expo Go app → scan the QR code, or press `a` for Android Emulator.
- **iOS**: Open the Camera app → scan the QR code (Expo Go), or press `i` for iOS Simulator.

#### Native Production Builds (EAS Build):
```bash
# Build Android APK / AAB
eas build -p android --profile preview

# Build iOS IPA
eas build -p ios --profile preview
```

---

## 🔐 Security Architecture & Protocols

FlakeSecure is built on the **Zero-Knowledge Principle**: The relay server only transports encrypted ciphertexts and never possesses cryptographic keys or plaintext credentials.

### 🔄 Login Flow (Sequence Diagram)

```
Browser Extension                Relay Server                   Mobile App
      │                               │                              │
      │  ① Generate session & AES key │                              │
      │     (sid, key, domain)        │                              │
      │                               │                              │
      │  ② Socket: join(sid) ────────►│                              │
      │                               │                              │
      │  ③ Display QR code:           │                              │
      │     flakesecure://auth?       │                              │
      │     sid=...&key=...&domain=.. │                              │
      │                               │        ④ Scan QR code        │
      │                               │◄─────────────────────────────│
      │                               │                              │
      │                               │        ⑤ Verify biometrics   │
      │                               │          (Face ID / TouchID) │
      │                               │                              │
      │                               │        ⑥ AES-256 Encrypt     │
      │                               │          + HMAC-SHA256 Tag   │
      │                               │                              │
      │                               │  ⑦ POST /send-login          │
      │                               │     { sid, payload }         │
      │                               │◄─────────────────────────────│
      │                               │                              │
      │  ⑧ Socket: login-data ◄───────│                              │
      │     (Encrypted payload)       │  (Session purged from RAM)   │
      │                               │                              │
      │  ⑨ Decrypt with local key     │                              │
      │     & verify HMAC tag         │                              │
      │                               │                              │
      │  ⑩ Autofill form fields       │                              │
      │     & optionally submit       │                              │
      ▼                               ▼                              ▼
```

### 🛡️ Core Security Features:
- **🔑 Authenticated Encryption**: AES-256-CTR combined with HMAC-SHA256 provides confidentiality and cryptographic integrity verification.
- **🎲 Ephemeral Keys**: Each login and sharing session generates a fresh 256-bit key pair transmitted solely through the optical QR channel.
- **⏱ Session TTL & One-Time Consumption**: Sessions expire within minutes and are instantly deleted upon relay retrieval.
- **💾 Hardware-Backed Storage**: Sensitive credentials are kept in the iOS Keychain and Android Keystore via `expo-secure-store`.
- **👤 Whitelist & Access Control**: Granular inbound sharing policies allow users to accept credentials only from verified accounts.
- **🌍 GeoIP & Audit Logs**: Transparent activity logging including IP address, client device, and approximate location.

---

## 📦 Dependencies & Tech Stack

| Component | Technologies & Packages |
|-----------|-------------------------|
| **Server** | `Node.js`, `Express`, `Socket.IO`, `PostgreSQL` (`pg`), `Argon2`, `JSONWebToken`, `GeoIP-Lite`, `CORS`, `dotenv` |
| **Chrome Extension** | Manifest V3, Web Crypto API (`crypto.subtle`), `qrcode.js`, `socket.io-client`, Vanilla JS & CSS3 |
| **Firefox Extension** | Manifest V3 (Gecko WebExtension), `browser.*` API, Web Crypto API, `qrcode.js`, `socket.io-client` |
| **Mobile App** | `React Native`, `Expo SDK`, `expo-camera`, `expo-local-authentication`, `expo-secure-store`, `expo-crypto`, `@react-navigation/native-stack`, `i18n-js`, `expo-linear-gradient`, `react-native-qrcode-svg` |

---

## 📄 License

This project is licensed under the **MIT License**. For privacy and legal terms, see `/legal` and `/imprint` in the web application.
