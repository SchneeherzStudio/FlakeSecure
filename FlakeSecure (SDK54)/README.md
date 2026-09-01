# ❄️ FlakeSecure

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Chrome%20%7C%20Firefox-success.svg)](#-platform-support)
[![Security](https://img.shields.io/badge/encryption-AES--256--CTR%20%2B%20HMAC--SHA256-orange.svg)](#-security-architecture--protocols)
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](#)

> **Zero-Knowledge Biometric Cross-Platform Password & 2FA Manager**  
> Scan QR code on your desktop browser → Confirm via Face ID / Touch ID / Fingerprint on your smartphone → Browser logs in and auto-fills 2FA TOTP codes seamlessly via end-to-end encryption.

---

## 📋 Table of Contents

- [✨ What's New in Version 2.0.0 (Changelog)](#-whats-new-in-version-200-changelog)
- [✨ Core Features](#-core-features)
- [🏗 Project Structure](#-project-structure)
- [🚀 Setup & Installation](#-setup--installation)
  - [1. Relay & API Server](#1-relay--api-server)
  - [2. Chrome / Edge / Chromium Extension](#2-chrome--edge--chromium-extension)
  - [3. Firefox Extension](#3-firefox-extension)
  - [4. Mobile App (iOS / Android)](#4-mobile-app-ios--android)
- [🔐 Security Architecture & Protocols](#-security-architecture--protocols)
- [🌐 Scalability & Multi-Region Clustering](#-scalability--multi-region-clustering)
- [📦 Dependencies & Tech Stack](#-dependencies--tech-stack)
- [📄 License](#-license)

---

## ✨ What's New in Version 2.0.0 (Changelog)

With the **v2.0.0** release, FlakeSecure expands into a unified zero-knowledge security platform, introducing a built-in 2FA Authenticator, zero-knowledge cloud vault synchronization, email OTP verifications, in-app announcement pushups, maintenance blocking screens, and a revamped UI.

### 🌟 Key Changes & New Features:

1. 🔑 **Built-in 2FA TOTP Authenticator (`AuthenticatorScreen.js`, `totp.js`)**:
   - Integrated **RFC 6238 TOTP engine** with pure JavaScript HMAC-SHA1 and Base32 decoding (zero external native dependencies).
   - Rotating **30-second live countdown timer**, visual progress indicator, and 1-tap clipboard copying.
   - Support for manual Base32 key entry and `otpauth://totp/...` URI parsing from QR codes.
   - **Seamless Relay Streaming**: Socket.IO connection is maintained for 2 minutes after login relay, allowing 1-tap streaming of 2FA codes directly to browser extensions for automatic OTP autofill.

2. ☁️ **Account-Bound Zero-Knowledge Cloud Vault Sync (`vault.js`, `/api/vault/sync`)**:
   - Client-side 256-bit AES key derivation using PBKDF2 with SHA-256 iterations from user password and salt.
   - Full end-to-end encrypted backup and synchronization of credentials, categories, autofill profile presets, and 2FA secrets.
   - **Automatic restore on login** and **complete local SecureStore purge on logout** ensuring account-bound data isolation.

3. ✉️ **One-Time-Code (OTP) Email Verification (`/api/otp`, `nodemailer`)**:
   - Cryptographically random 6-digit OTP verification codes delivered via branded HTML emails.
   - Enforced during new account registration in the mobile app, onboarding, and the web portal.
   - High-security double confirmation required for permanent account deletion.

4. 📢 **Server Announcements & Pushup System (`/api/system/announcements`)**:
   - Admin endpoints to broadcast maintenance alerts, updates, and notices.
   - Support for **Popup Modals** upon app startup and **Top Banners** with customizable display behavior (`once` or `always`).
   - Per-user dismissal tracking in PostgreSQL (`dismissed_announcements`).

5. 🛠️ **Maintenance Mode & Outdated Version Blocking (`MaintenanceScreen.js`)**:
   - Real-time blocking screen triggered when a maintenance window is active or the client version is outdated.
   - Offline connectivity indicator (*"Du bist zurzeit offline – Funktionen eingeschränkt"* / *"Server nicht erreichbar"*).
   - Automated 30-second polling to smoothly resume app operation once the server is available.

6. 📋 **Fixed Activity Logs & Custom Date Formatting (`LogsScreen.js`)**:
   - Fixed response object extraction bug for paginated audit logs.
   - Enriched human-readable action labels (`Login`, `Credential Sent`, `QR Share`, `Account Created`, `Account Deleted`).
   - Customizable timestamp formats in Settings: *Systemstandard*, German (*HH:MM TT.MM.JJJJ*), or ISO (*YYYY-MM-DD*).
   - Filter chips for fast inspection (All, Logins, Transfers, Shares).

7. 📱 **Mobile UI Redesign & Quick Action Navigation (`HomeScreen.js`)**:
   - Current logged-in user pill badge prominently displayed in the top header.
   - Quick Action Bar on the Home screen for immediate access to **2FA Codes**, **Logs**, **Neu (Add Login)**, and **Teilen (Share)**.
   - Active session manager in `SettingsScreen.js` with remote session termination.

8. 🌐 **Web Account Portal (`/account`)**:
   - Dedicated web interface for registration with OTP, login, active session inspection, and OTP-confirmed account deletion.

9. 📲 **Push Notifications (Expo Server SDK)**:
   - Push notifications dispatched to registered mobile devices upon new account logins and browser extension triggers.

10. 🌍 **Scalability Architecture (`SCALABILITY.md`)**:
    - Comprehensive technical specification for regional GeoDNS edge clusters (`de.flakesecure...`, `us.flakesecure...`), Socket.IO Redis pub/sub adapters, and Nginx sticky load balancing.

---

## ✨ Core Features

- **⚡ Instant QR Login**: No need to type lengthy master passwords or secrets on public or desktop devices.
- **🔑 Seamless 2FA Autofill**: Generate and stream 6-digit TOTP codes directly to browser extension input fields.
- **🔒 End-to-End Encryption**: AES-256-CTR + HMAC-SHA256 with ephemeral session keys – the server processes only ciphertext.
- **☁️ Zero-Knowledge Cloud Vault**: Client-side encrypted cloud backup and multi-device synchronization.
- **🧬 Native Biometrics**: Face ID, Touch ID, or Android Biometric authentication required before releasing credentials.
- **📂 Secure Storage**: All credentials stored encrypted inside hardware-backed SecureStore (iOS Keychain / Android Keystore).
- **🛡️ Whitelist Sharing**: Share credentials securely with friends, family, or colleagues with fine-grained permission control.
- **📱 Universal Deep Linking**: Seamless QR code recognition via camera scan or direct web links (`flakesecure://`).

---

## 🏗 Project Structure

```
flakesecure/
├── browser-extension/              # Chrome / Edge / Chromium Extension (Manifest V3)
│   └── extension/
│       ├── manifest.json
│       ├── content.js              # Detects forms, injects overlay, QR & TOTP autofill
│       ├── popup.html / popup.js   # Extension popup, account login & settings
│       ├── styles/content.css      # Isolated overlay stylesheet
│       ├── lib/                    # qrcode.min.js & socket.io.min.js
│       └── icons/
│
├── browser-extension-firefox/      # Native Mozilla Firefox Extension (Manifest V3)
│   ├── INSTALL_FIREFOX.md          # Guide for temporary add-on installation
│   └── extension/
│       ├── manifest.json
│       ├── background.js           # Firefox WebExtension background worker & TOTP relay
│       ├── content.js              # Form detection & TOTP autofill using browser.* API
│       ├── popup.html / popup.js
│       ├── styles/content.css
│       └── lib/ & icons/
│
├── server/                         # Node.js Relay, Auth, Vault & Web Server
│   ├── server.js                   # Express + Socket.IO Relay + 2-min TOTP streaming
│   ├── db.js                       # PostgreSQL Connection Pool
│   ├── db/
│   │   └── schema.sql              # Database schema (users, vault, otp_codes, announcements)
│   ├── middleware/
│   │   └── auth.js                 # JWT & session token validation
│   ├── routes/
│   │   ├── auth.js                 # Register with OTP, Login (push trigger), /me
│   │   ├── account.js              # Profile, Active Sessions, Whitelist, OTP Delete
│   │   ├── logs.js                 # Paginated audit logs with enriched action labels
│   │   ├── share.js                # Encrypted P2P payloads & status
│   │   ├── system.js               # Status, maintenance window & announcements
│   │   ├── otp.js                  # Email OTP generation & verification (nodemailer)
│   │   ├── vault.js                # Encrypted zero-knowledge vault sync
│   │   └── notifications.js        # Expo push notification manager
│   ├── static/                     # Static HTML pages (index.html, account.html, imprint.html)
│   └── public/                     # CSS stylesheets & image assets
│
├── FlakeSecure (SDK57)/            # React Native Mobile App (Expo SDK 57 - Primary)
│   ├── App.js                      # Root Navigator, system check & popup manager
│   ├── app.json / eas.json         # Expo & EAS Build configuration
│   └── app/src/
│       ├── context/
│       │   ├── AuthContext.js      # Auth state, vault auto-sync, auto-lock
│       │   └── LanguageContext.js  # Dynamic i18n language provider
│       ├── i18n/
│       │   ├── index.js            # i18n-js initialization
│       │   └── locales/            # de.json, en.json, es.json, fr.json
│       ├── screens/
│       │   ├── HomeScreen.js       # Vault overview, user badge, quick action bar, filters
│       │   ├── ScanScreen.js       # QR scanner for Auth, Share & Registration
│       │   ├── ConfirmScreen.js    # Biometric prompt & post-login 2FA streaming shortcut
│       │   ├── AuthenticatorScreen.js # 2FA TOTP manager with 30s timer & streaming
│       │   ├── MaintenanceScreen.js # Blocking maintenance / outdated / offline screen
│       │   ├── CredentialsScreen.js # Add & categorize new credentials
│       │   ├── ViewCredentialScreen.js # Biometrically protected detail & edit view
│       │   ├── RegisterFillScreen.js # Registration autofill & password generator
│       │   ├── ShareImportScreen.js # Encrypted QR & server-based credential exchange
│       │   ├── LoginScreen.js      # Server login & OTP email registration
│       │   ├── BiometricUnlockScreen.js # Quick unlock on app launch/resume
│       │   ├── OnboardingScreen.js # Initial setup, language & OTP registration
│       │   ├── SettingsScreen.js   # Active sessions, date formats, vault sync, profile
│       │   └── LogsScreen.js       # Filterable security audit logs with custom dates
│       └── utils/
│           ├── api.js              # REST API client (v2.0 endpoints)
│           ├── crypto.js           # AES-256-CTR & HMAC-SHA256 encrypt/decrypt
│           ├── totp.js             # RFC 6238 TOTP generator, HMAC-SHA1, Base32
│           ├── vault.js            # PBKDF2 key derivation & cloud vault synchronization
│           └── storage.js          # SecureStore storage & TOTP item abstraction
│
├── FlakeSecure (SDK54)/            # Mirror synchronization build for SDK 54
├── SCALABILITY.md                  # Regional clustering & Redis Socket.IO architecture
├── browser-extension.zip           # Packaged Chrome extension archive
└── browser-extension-firefox.zip   # Packaged Firefox add-on archive
```

---

## 🚀 Setup & Installation

### 1. Relay & API Server

#### Prerequisites:
- Node.js (v18+)
- PostgreSQL Database
- SMTP Server credentials (for email OTPs)

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
PGPASSWORD=your_postgres_password
JWT_SECRET=your_super_secret_jwt_key_at_least_64_characters
ADMIN_SECRET=your_secret_admin_header_key

# SMTP Configuration for Email OTP:
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=noreply@flakesecure.snowystudio.dev
SMTP_PASS=your_smtp_password
SMTP_FROM=FlakeSecure <noreply@flakesecure.snowystudio.dev>
```

#### Database Setup:
```bash
psql -U postgres -d flakesecure -f db/schema.sql
```

#### Run Server:
```bash
# Development mode:
npm run dev

# Production start:
npm start
# → Server runs on port 4000
```

---

### 2. Chrome / Edge / Chromium Extension

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the folder `browser-extension/extension/` (or extract `browser-extension.zip`).
5. *(Optional)* Click the FlakeSecure icon in your toolbar to configure the Relay Server URL (Default: `https://flakesecure.snowystudio.dev`).

---

### 3. Firefox Extension

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `manifest.json` file inside `browser-extension-firefox/extension/` (or `browser-extension-firefox.zip`).
4. The extension is immediately active. For details, see [INSTALL_FIREFOX.md](browser-extension-firefox/INSTALL_FIREFOX.md).

---

### 4. Mobile App (iOS / Android)

#### Installation:
```bash
cd "FlakeSecure (SDK57)"
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

FlakeSecure is built strictly upon the **Zero-Knowledge Principle**: The relay server transports only authenticated ciphertexts and never possesses cryptographic keys or plaintext passwords.

### 🔄 Login & 2FA Streaming Flow (Sequence Diagram)

```
Browser Extension                Relay Server                   Mobile App
      │                               │                              │
      │  ① Generate session & AES key │                              │
      │     (sid, key, domain)        │                              │
      │                               │                              │
      │  ② Socket: join(sid, domain) ─►│                              │
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
      │  ⑧ Socket: login-data ◄───────│  (Keep session open for 2m)  │
      │     (Encrypted payload)       │                              │
      │                               │                              │
      │  ⑨ Decrypt with local key     │                              │
      │     & autofill login form     │                              │
      │                               │                              │
      │                               │  ⑩ (Optional) Stream 2FA:    │
      │                               │     POST /send-totp          │
      │                               │◄─────────────────────────────│
      │                               │                              │
      │  ⑪ Socket: totp-data ◄────────│                              │
      │     & autofill OTP input      │  (Session purged from RAM)   │
      ▼                               ▼                              ▼
```

### 🛡️ Security Highlights:
- **🔑 Authenticated Encryption**: AES-256-CTR with HMAC-SHA256 (Encrypt-then-MAC) prevents both eavesdropping and tampering.
- **🎲 Ephemeral Keys**: Unique 256-bit session keys transmitted exclusively over the physical optical QR channel.
- **☁️ Zero-Knowledge Cloud Vault**: PBKDF2 (SHA-256) client-side derived key protects all server-stored vault backups.
- **✉️ Cryptographic OTP**: Argon2 hashed OTP codes with 10-minute expiry and attempt rate-limiting.
- **💾 Hardware-Backed Storage**: Credentials isolated in the iOS Keychain / Android Keystore via `expo-secure-store`.

---

## 🌐 Scalability & Multi-Region Clustering

For large-scale deployments, FlakeSecure supports horizontal scaling and geo-distributed clustering. See [SCALABILITY.md](SCALABILITY.md) for details on:
- **GeoDNS Regional Routing** (`de.flakesecure...`, `us.flakesecure...`, `ap.flakesecure...`).
- **Socket.IO Redis Pub/Sub Adapter** (`@socket.io/redis-adapter`) for cross-instance WebSocket broadcasting.
- **Nginx Sticky Session Load Balancing** and **PgBouncer Database Connection Pooling**.

---

## 📦 Dependencies & Tech Stack

| Component | Technologies & Packages |
|-----------|-------------------------|
| **Server** | `Node.js`, `Express`, `Socket.IO`, `PostgreSQL` (`pg`), `Argon2`, `JSONWebToken`, `Nodemailer`, `Expo-Server-SDK`, `GeoIP-Lite`, `CORS`, `dotenv` |
| **Chrome Extension** | Manifest V3, Web Crypto API (`crypto.subtle`), `qrcode.js`, `socket.io-client`, Vanilla JS & CSS3 |
| **Firefox Extension** | Manifest V3 (Gecko WebExtension), `browser.*` API, Web Crypto API, `qrcode.js`, `socket.io-client` |
| **Mobile App** | `React Native`, `Expo SDK 57`, `expo-camera`, `expo-local-authentication`, `expo-secure-store`, `expo-crypto`, `expo-clipboard`, `@react-navigation/native-stack`, `i18n-js`, `expo-linear-gradient`, `react-native-qrcode-svg` |

---

## 📄 License

This project is licensed under the **MIT License**. For legal notices, see `/legal` and `/imprint` in the web application.
