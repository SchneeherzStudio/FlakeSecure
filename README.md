# ❄️ FlakeSecure

> Biometrischer Login-Manager: QR-Code auf dem PC scannen → Face ID / Fingerabdruck auf dem Handy → Browser loggt sich ein.

---

## 🏗 Projektstruktur

```
flakesecure/
├── browser-extension/     # Chrome/Edge Extension (Manifest V3)
│   ├── manifest.json
│   ├── content.js         # Erkennt Passwortfelder, zeigt Overlay + QR
│   ├── popup.html/js      # Extension-Popup (Einstellungen)
│   └── lib/
│       ├── qrcode.min.js  # QR-Code Generator (lokal)
│       └── socket.io.min.js
│
├── server/                # Node.js Relay Server
│   ├── server.js
│   └── package.json
│
└── mobile-app/            # React Native (Expo)
    ├── App.js
    ├── src/
    │   ├── screens/
    │   │   ├── HomeScreen.js       # Übersicht + gespeicherte Zugangsdaten
    │   │   ├── ScanScreen.js       # QR-Scanner
    │   │   ├── ConfirmScreen.js    # Biometrie + Versand
    │   │   └── CredentialsScreen.js # Neue Zugangsdaten hinzufügen
    │   └── utils/
    │       ├── crypto.js           # AES-256-GCM Ver-/Entschlüsselung
    │       └── storage.js          # Sicherer Lokalspeicher
    └── package.json
```

---

## 🚀 Setup

### 1. Relay Server starten

```bash
cd server
npm install
npm start
# → Läuft auf http://localhost:3000
```

**Für Remote-Zugriff** (Handy im selben WLAN):
```bash
# IP-Adresse deines PCs herausfinden:
ip addr show  # Linux
ipconfig      # Windows

# In mobile-app/src/screens/ConfirmScreen.js anpassen:
const SERVER_URL = 'https://flakesecure.snowystudio.dev/';
```

---

### 2. Browser-Extension installieren

1. **Bibliotheken herunterladen:**
   - [qrcode.min.js](https://github.com/davidshimjs/qrcodejs) → `browser-extension/lib/qrcode.min.js`
   - [socket.io.min.js](https://cdn.socket.io/4.7.2/socket.io.min.js) → `browser-extension/lib/socket.io.min.js`

2. **In Chrome/Edge laden:**
   - `chrome://extensions` öffnen
   - "Entwicklermodus" aktivieren
   - "Entpackte Erweiterung laden" → `browser-extension/` Ordner wählen

3. **Server-URL konfigurieren:**
   - Extension-Icon klicken → URL eintragen → Speichern

---

### 3. Mobile App starten

```bash
cd mobile-app
npm install
npx expo start

# iOS:  Expo Go App öffnen → QR scannen
# Android: Expo Go App öffnen → QR scannen
# Oder direkt: npx expo run:ios / npx expo run:android
```

---

## 🔐 Sicherheitsarchitektur

```
Browser                    Server                    Smartphone
  │                           │                           │
  │  ① Session erstellen      │                           │
  │  (SID + AES-Key)          │                           │
  │                           │                           │
  │  ② Socket.join(SID) ─────►│                           │
  │                           │                           │
  │  ③ QR anzeigen            │                           │
  │  flakesecure://auth?      │                           │
  │  sid=XYZ&key=ABC          │                           │
  │  &domain=ea.com           │                           │
  │                           │        ④ QR scannen       │
  │                           │◄──────────────────────────│
  │                           │                           │
  │                           │        ⑤ Biometrie OK    │
  │                           │                           │
  │                           │  ⑥ POST /send-login       │
  │                           │  { sid, payload:          │
  │                           │    AES-GCM({user,pass}) } │
  │                           │◄──────────────────────────│
  │                           │                           │
  │  ⑦ Socket: login-data ◄───│                           │
  │  (Ciphertext)             │                           │
  │                           │                           │
  │  ⑧ Entschlüsseln          │                           │
  │  mit lokalem AES-Key      │                           │
  │                           │                           │
  │  ⑨ Felder ausfüllen       │                           │
  └───────────────────────────┴───────────────────────────┘
```

**Sicherheitseigenschaften:**
- 🔑 AES-256-GCM: Ende-zu-Ende-Verschlüsselung (der Server sieht nur Ciphertext)
- 🎲 Ephemere Keys: Jede Session bekommt einen neuen zufälligen Key
- ⏱ Session-TTL: Sessions laufen nach 5 Minuten automatisch ab
- 🧬 Biometrie: Face ID / Fingerabdruck vor jedem Login
- 💾 Secure Storage: Keychain (iOS) / Keystore (Android) für Passwörter
- 🗑 One-Time-Use: Sessions werden nach Nutzung gelöscht

---

## 🌐 Produktiv-Deployment (Server)

```bash
# Heroku
heroku create flakesecure-relay
git push heroku main

# Railway / Render / Fly.io (kostenlose Optionen)

# Dann in content.js und ConfirmScreen.js anpassen:
const SERVER_URL = 'https://flakesecure-relay.herokuapp.com';
```

---

## 🛠 Nächste Schritte

- [ ] QR-Code App-Logo einbetten (als zentriertes Bild)
- [ ] HTTPS für den Relay-Server (Let's Encrypt)
- [ ] Passwort-Generator in der App
- [ ] Browser-Extension: Auto-Submit nach Login
- [ ] App: Passwort-Import aus 1Password / Bitwarden CSV
- [ ] E2E Tests

---

## 📦 Dependencies

| Teil | Pakete |
|------|--------|
| Server | `express`, `socket.io`, `cors` |
| Extension | `qrcode.js`, `socket.io-client` |
| App | `expo-camera`, `expo-local-authentication`, `expo-secure-store` |
