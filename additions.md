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

*Last updated: 2026-09-23*
