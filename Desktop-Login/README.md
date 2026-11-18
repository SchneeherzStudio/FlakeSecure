# FlakeSecure Desktop Login (`Desktop-Login/`)

Ressourcensparender Zero-Knowledge Hintergrund-Daemon, Vordergrund-Menü und Apple Pay-inspiriertes QR-Overlay für native Desktop-Anwendungen (Tauri v2 + Rust).

## Architektur & Features

- **Minimaler Ressourcenverbrauch:**
  - Der Rust-Core läuft im System-Tray (mit ~350 ms leichtgewichtiger Fokus-Prüfung ohne Polling-Overhead).
  - Das Vordergrund-Menü lässt sich per Klick auf das Tray-Icon öffnen und beim Schließen (`×`) wieder in den Tray minimieren.
- **3-stufige Login-Erkennung (`src-tauri/src/detector.rs` & `mappings.rs`):**
  1. Überwachung des aktiven Vordergrundfensters (`GetForegroundWindow`, Prozessname via `QueryFullProcessImageNameW`, Fenstertitel & Geometrie).
  2. Abgleich mit App-Profilen (inklusive Fenstertitel- und Größen-Heuristiken zur Unterscheidung zwischen Login-Screen und Hauptfenster).
  3. Automatisches Andocken des Overlays neben dem Ziel-Login-Fenster (DPI-aware Multi-Monitor-Platzierung) sowie Cooldown für manuell geschlossene Fenster.
- **Zero-Knowledge Kryptografie & Memory Hardening (`crypto.rs`, `security.rs`):**
  - Ephemere `sid` (16 Bytes) & AES-256-Schlüssel (32 Bytes) via `OsRng`.
  - SHA-256-MAC Verifikation in konstanter Zeit (`subtle::ConstantTimeEq`) und `AES-256-CTR` Entschlüsselung direkt in Rust.
  - Entschlüsselte Zugangsdaten verbleiben in `Zeroizing`-Puffern mit `VirtualLock` im Rust-Speicher und werden nach Nutzung bzw. spätestens nach 120 Sekunden automatisch genullt.
  - Anti-Screenshot-Schutz für das Overlay-Fenster via `SetWindowDisplayAffinity(..., WDA_EXCLUDEFROMCAPTURE)`.
- **Hybride Zugangsdaten-Übergabe (`autofill.rs`):**
  - **Hybrid Auto-Type (Standard):** Fokussiert das Ziel-Login-Fenster, tippt Benutzername & Passwort direkt per `SendInput` (`KEYEVENTF_UNICODE`) ein (unterstützt 1-Step- und 2-Step-Logins sowie 2FA/TOTP).
  - **Smart Sequential Clipboard:** Schreibt erst den Benutzernamen in die geschützte Zwischenablage (`ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory = 0`, `CanUploadToCloudClipboard = 0`), wechselt nach `Strg+V` automatisch zum Passwort und leert die Zwischenablage nach dem Einfügen.
  - **Manuelle Buttons:** Direkte Aktions-Buttons im Overlay (`Auto-Fill starten`, `Username`, `Passwort`, `2FA Code`).

## Enthaltene Standard-Mappings

- Riot Client (`RiotClientServices.exe` → `authenticate.riotgames.com`)
- Steam (`steam.exe`, `steamwebhelper.exe` → `store.steampowered.com`)
- Discord (`Discord.exe` → `discord.com`)
- Battle.net (`Battle.net.exe` → `account.battle.net`)
- Epic Games Launcher (`EpicGamesLauncher.exe` → `epicgames.com`)
- Spotify (`Spotify.exe` → `accounts.spotify.com`)
- Ubisoft Connect (`upc.exe`, `UbisoftConnect.exe` → `ubisoft.com`)
- EA App (`EADesktop.exe`, `EALauncher.exe` → `ea.com`)
- Minecraft Launcher (`MinecraftLauncher.exe` → `minecraft.net`)
- GOG Galaxy (`GalaxyClient.exe` → `gog.com`)
- GitHub Desktop (`GitHubDesktop.exe` → `github.com`)
- Slack (`Slack.exe` → `slack.com`)
- Zoom (`Zoom.exe` → `zoom.us`)
- Telegram Desktop (`Telegram.exe` → `telegram.org`)

Eigene Mappings können jederzeit über das Vordergrund-Menü (Tab **App-Mappings** → **Aus laufender App**) hinzugefügt werden.

## Build & Entwicklung

Stelle sicher, dass Rust (`%USERPROFILE%\.cargo\bin`) und der MinGW-w64 Linker (`gcc`) im `PATH` liegen:

```powershell
cd Desktop-Login/src-tauri
cargo test
cargo build --release
```

Die fertige Binary liegt anschließend unter:
`Desktop-Login/src-tauri/target/release/flakesecure-desktop-login.exe`

Mit dem Argument `--minimized` (oder `--tray`) startet der Hintergrund-Daemon direkt minimiert im System-Tray.
