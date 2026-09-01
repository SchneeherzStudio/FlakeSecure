# Task Tracker: FlakeSecure v2.0 Additions

## Progress Status

- [x] **Phase 1: Server Infrastructure & Core APIs**
  - [x] Update database schema (`server/db/schema.sql`)
  - [x] Update server `package.json` (nodemailer, expo-server-sdk, express-rate-limit, v2.0.0)
  - [x] Update server `.env` (SMTP, ADMIN_SECRET)
  - [x] Create `server/routes/system.js` (Announcements, Status, Maintenance)
  - [x] Create `server/routes/otp.js` (Email OTP verification with nodemailer)
  - [x] Create `server/routes/vault.js` (Encrypted vault sync endpoints)
  - [x] Create `server/routes/notifications.js` (Expo push notification manager)
  - [x] Update `server/routes/auth.js` (OTP registration, push notification on login)
  - [x] Update `server/routes/account.js` (OTP deletion, active sessions endpoints)
  - [x] Update `server/routes/logs.js` (Enriched action labels)
  - [x] Update `server/server.js` (Mount routes, TOTP relay, push triggers, 2-min session persistence)

- [x] **Phase 2: Mobile App Core Features**
  - [x] Update `app/src/utils/api.js` (All new v2.0 endpoints)
  - [x] Create `app/src/utils/totp.js` (RFC 6238 TOTP generator, pure JS HMAC-SHA1, Base32)
  - [x] Create `app/src/utils/vault.js` (Zero-knowledge PBKDF2 AES-256-CTR cloud vault sync)
  - [x] Update `app/src/utils/storage.js` (TOTP items, full vault export/import, local wipe)
  - [x] Create `app/src/screens/MaintenanceScreen.js` (Blocking maintenance / outdated / offline screen)
  - [x] Create `app/src/screens/AuthenticatorScreen.js` (2FA authenticator with live 30s timer & stream)
  - [x] Update `App.js` (System check, blocking screens, popup announcements, TOTP routing)
  - [x] Update `app/src/screens/HomeScreen.js` (Logged-in user badge, quick action bar, announcement banners)
  - [x] Update `app/src/screens/LogsScreen.js` (Fixed response object bug, configurable date formats, action filters)
  - [x] Update `app/src/screens/SettingsScreen.js` (Active sessions manager, date format settings, manual vault sync)
  - [x] Update `app/src/screens/LoginScreen.js` (OTP email verification in registration mode)
  - [x] Update `app/src/screens/OnboardingScreen.js` (OTP email verification)
  - [x] Update `app/src/screens/ConfirmScreen.js` (Post-login TOTP streaming shortcut)
  - [x] Update `app/src/context/AuthContext.js` (Vault restoration on login, local purge on logout)
  - [x] Bump `app.json` & `package.json` to v2.0.0

- [x] **Phase 3: Browser Extensions**
  - [x] Update Chrome `content.js` (Pass domain on session join, autofill TOTP codes)
  - [x] Update Firefox `background.js` & `content.js` (Pass domain, relay `TOTP_DATA`, autofill)
  - [x] Re-pack `browser-extension.zip` and `browser-extension-firefox.zip`

- [x] **Phase 4: Web Management Portal**
  - [x] Create `server/static/account.html` (Full account portal with OTP register/delete & sessions)
  - [x] Update `server/static/index.html` (Add Account Portal navigation link)

- [x] **Phase 5: Scalability & SDK Mirror Sync**
  - [x] Create `SCALABILITY.md` (Regional GeoDNS, Redis Socket.IO adapter, sticky sessions)
  - [x] Mirror all app changes from `FlakeSecure (SDK57)` to `FlakeSecure (SDK54)`
  - [x] Bump `FlakeSecure (SDK54)` version to 2.0.0
