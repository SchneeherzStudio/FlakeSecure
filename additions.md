# FlakeSecure — Future Additions

Items deferred from the v2.1 plan for future implementation.

---

## 1. Desktop Extension — QR Projection over Native Apps

**Priority:** Future  
**Status:** Not started  
**Directory:** `Desktop-Login/` (currently empty)

### Concept
A background desktop application that projects QR codes over in-app login screens on PC. When a native application (e.g., Riot Client, Steam, Discord) shows a login form, the Desktop Extension detects it and overlays a FlakeSecure QR code that the user can scan with the mobile app to auto-fill credentials.

### Key Requirements
- **Performance critical:** Low RAM, CPU, GPU usage (background daemon)
- **Security critical:** No app should be able to copy/intercept logins from memory
- **Compatibility:** Works with online links (e.g., riot-client gets same logins as `authenticate.riotgames.com`)
- User noted: "very complicated so maybe first select application, then QR code and copy paste manually" as a simpler v1

### Technical Decisions Needed
- **Technology:** Electron (consistent with Desktop-Admin), Tauri (Rust, much lighter), or native C++/C#?
- **QR Projection:** OS-level always-on-top transparent window with click-through support
- **App Detection:** How to identify which native app is showing a login screen (window title matching, process name matching, OCR?)
- **Application ↔ Domain Mapping:** Mapping `riot-client.exe` → `authenticate.riotgames.com` so the correct credentials are suggested. Needs a community-maintained mapping database or manual user configuration.
- **Security:** Process isolation, memory protection, anti-screenshot APIs
- **Cross-platform:** Windows first, potentially macOS/Linux later

### Suggested Phased Approach
1. **v0.1 — Manual mode:** User selects an application from a list, QR code appears, user scans and credentials are copied to clipboard (simplest)
2. **v0.2 — Overlay mode:** QR code projects as a floating overlay near the detected login window
3. **v0.3 — Auto-detect mode:** Automatic detection of login screens using window analysis
4. **v1.0 — Full integration:** Direct input simulation into native app fields (like the browser extension does for web forms)

---

## 2. Login with FlakeSecure Account (OAuth2 Provider)

**Priority:** Future  
**Status:** Not started

### Concept
Allow third-party websites to offer "Login with FlakeSecure" as an authentication option, similar to "Login with Google." Users authenticate via their FlakeSecure account (session + refresh token with email and username) and the third-party site receives verified user identity.

### Required Components
- **OAuth2 Authorization Server:**
  - `GET /oauth/authorize` — authorization endpoint (redirect-based consent flow)
  - `POST /oauth/token` — token exchange endpoint (authorization code → access + refresh tokens)
  - `POST /oauth/revoke` — token revocation
- **Client Registration System:**
  - Admin dashboard or self-service portal for third-party developers to register OAuth clients
  - Client ID + Client Secret generation
  - Redirect URI whitelist management
- **Consent Screen:**
  - New page showing which permissions the third-party app is requesting
  - User approves or denies access
  - Scope support: `profile` (username, email), `login` (trigger biometric login relay)
- **Database Tables:**
  - `oauth_clients` (client_id, client_secret_hash, name, redirect_uris, created_at)
  - `oauth_codes` (code, client_id, user_id, scope, expires_at, used_at)
  - `oauth_tokens` (access_token_hash, refresh_token_hash, client_id, user_id, scope, expires_at)
- **Session + Refresh Token Flow:**
  - Access tokens: short-lived (1 hour)
  - Refresh tokens: long-lived (30 days), rotated on use
  - Tokens carry `{ sub: user_id, email, username, scope }` claims

### Integration with Embed Widget
The existing embed/widget system (`embed.js`, `widget.html`) could be enhanced to support OAuth-based login as an alternative to QR-based credential relay. Third-party sites would get a "Login with FlakeSecure" button that redirects to the consent screen, and on approval, returns an auth code to the callback URL.

---

## 3. iOS AutoFill Credential Provider Extension (`ASCredentialProviderViewController`)

**Priority:** Future (once paid Apple Developer Program membership is active)  
**Status:** Deferred (Android `AutofillService` implemented in v2.1.0)  
**Prerequisite:** Paid Apple Developer Account with the `com.apple.developer.authentication-services.autofill-credential-provider` entitlement.

### Concept
Integrate FlakeSecure into iOS system-wide Password & 2FA AutoFill (*Settings → General → AutoFill & Passwords*) so Safari and native iOS apps suggest FlakeSecure accounts directly above the QuickType keyboard and unlock them via Face ID / Touch ID.

### Required Components
- **Expo Config Plugin (`withFlakeSecureIOSAutofill`)**:
  - Adds a secondary iOS App Extension target (`FlakeSecureAutoFillExtension`) embedding an `ASCredentialProviderViewController` subclass in Swift (`CredentialProviderViewController.swift`).
  - Configures shared entitlements for both the main app and the extension target:
    - **Keychain Sharing (`keychain-access-groups`)**: `$(AppIdentifierPrefix)com.snowy.studio.FlakeSecure.shared` so the extension can read hardware-encrypted credentials written by the main React Native app.
    - **App Groups (`com.apple.security.application-groups`)**: `group.com.snowy.studio.FlakeSecure` for non-sensitive domain index metadata and theme preferences.
    - **AutoFill Credential Provider (`com.apple.developer.authentication-services.autofill-credential-provider`)**: `true`.
- **QuickType Keyboard Suggestions (`ASCredentialIdentityStore`)**:
  - Whenever credentials or linked 2FA items are added/updated/deleted in `storage.js`, the JS bridge (`autofillBridge.js`) registers `ASPasswordCredentialIdentity` (and on iOS 18+ `ASOneTimeCodeCredentialIdentity`) records with `ASCredentialIdentityStore.shared` using `ASPasskeyCredentialIdentity` / `ASPasswordCredentialIdentity(serviceIdentifier: user: recordIdentifier:)`.
- **Extension Lifecycle (`CredentialProviderViewController.swift`)**:
  - `prepareCredentialList(for serviceIdentifiers:)`: Displays matching accounts for the requested domain (supporting multiple logins per domain with their custom display names) after Face ID / Touch ID verification via `LAContext`.
  - `provideCredentialWithoutUserInteraction(for credentialIdentity:)`: Evaluates `LAContext` biometrics if required and completes the request with `ASPasswordCredential(user: password:)`.
  - **Linked 2FA / TOTP**: If the selected credential has a linked TOTP secret, automatically copies the current 6/8-digit TOTP code to `UIPasteboard.general` (with 45s expiration via `UIPasteboard.OptionsKey.expirationDate`) or fills via iOS 18+ `provideOneTimeCodeCredentialWithoutUserInteraction`.
  - `prepareInterfaceForExtensionConfiguration()`: Renders a quick status & biometric setup screen when opened from iOS Settings.

---

## 4. Simple Overlay (Redesign) — Apple Pay-Inspired System Overlay

**Priority:** Future  
**Status:** Planned  
**Scope:** Browser Extensions (`chrome-extension`, `firefox-extension`), Embed Widget (`embed.js` / `widget.html`), and future Desktop Overlay (`Desktop-Login`)

### Vision & Design Philosophy
A complete visual redesign of the FlakeSecure login/autofill overlay inspired by **Apple Pay on Desktop (macOS/Safari)**:
- **Simple, Clean & Unobtrusive:** Minimalist sheet/modal that feels like a native OS system prompt rather than a heavy third-party widget.
- **System-Native Aesthetics:**
  - Adaptive translucent surface (`backdrop-filter: blur(24px) saturate(180%)`) that harmonizes with the user's system theme (Dark / Light mode) and OS typography (`system-ui`, `-apple-system`, `Segoe UI Variable`).
  - Subtle hairline borders, soft ambient elevation shadows, and smooth spring-based entrance/exit animations.
- **Focused Interaction Flow:**
  - Compact header with service favicon, verified domain badge, and single-click dismiss.
  - Clean, scannable QR code presentation (or account/card selector) with a subtle FlakeSecure emblem and status indicator ("Mit FlakeSecure auf dem Handy scannen" / "Scan with FlakeSecure").
  - Seamless transition states: *Waiting for Scan* → *Biometric Verification on Phone* → *Animated Checkmark (Apple Pay-style completion ring)* → *Auto-Close & Fill*.

---

*Last updated: 2026-10-27*
