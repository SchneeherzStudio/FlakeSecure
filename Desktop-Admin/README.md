 FlakeSecure Desktop Admin (Windows & Linux)

Cross-Platform Electron Desktop-Anwendung zur grafischen Administration von **FlakeSecure** gemäß [`message.md`](../message.md).

Bietet eine vollständige Benutzeroberfläche zur Steuerung von:
**Mitteilungen an die Mobile Apps** (Popups und Banner erstellen, Prioritäten setzen, Einmalig/Immer-Modus, automatisches Ablaufdatum mit interaktiver Smartphone-Live-Vorschau).
**Aktive Mitteilungen verwalten & löschen** mit 1-Klick-Löschung und Bestätigungsschutz.
**Wartungsmodus steuern** (Aktivierung mit individueller Nutzersperrmeldung und Endzeit-Presets wie +30m, +1h, +2h, +4h oder sofortige Freigabe).
**Echtzeit-Serverdiagnose** (Status, Uptime, aktive WebSocket-Sitzungen, Antwortzeiten aller API-Endpunkte).
**Verbindungsverwaltung** (Speichern von Server-URL und `x-admin-secret` mit Verbindungstest).

---

 Plattform-Unterstützung (Windows & Linux)

Die Anwendung ist zu 100 % plattformunabhängig konzipiert:
- **Windows**: Windows 10 & 11 (64-Bit) als Portable `.exe` oder NSIS-Installer.
- **Linux**: Alle gängigen Distributionen (Ubuntu, Debian, Fedora, Arch, etc.) als `.AppImage` oder `.deb`-Paket.
- **Keine nativen C++-Build-Abhängigkeiten**: Reine Web- und Node.js-APIs für maximale Stabilität.

---

 Schnellstart (Entwicklung)

1. Abhängigkeiten installieren:
   ```bash
   cd Desktop-Admin
   npm install
   ```

2. Desktop-App starten:
   ```bash
   npm start
   ```

---

 Build für Produktion (Installer & Binaries erstellen)

 Standard-Build (Aktuelle Plattform):
```bash
npm run build
```
- Unter **Windows**: Erstellt automatisch die Windows `.exe` (Portable & Setup-Installer) in `dist/`.
- Unter **Linux**: Erstellt automatisch `.AppImage` & `.deb` in `dist/`.

 Für Windows bauen (.exe Portable & Installer):
```bash
npm run build:win
```
Die fertigen Binärdateien befinden sich im Ordner `Desktop-Admin/dist/`:
- `FlakeSecure Admin 2.0.2.exe` (Standalone Portable – sofort startbar)
- `FlakeSecure Admin Setup 2.0.2.exe` (NSIS Setup-Installer)

 Für Linux bauen (.AppImage & .deb):
```bash
npm run build:linux
```
> [!NOTE]
> Ein `.AppImage` benötigt das Linux-Tool `mksquashfs`. Führe `npm run build:linux` daher direkt auf einem Linux-System, in einer Linux-VM oder via **WSL** (`wsl npm run build:linux`) aus.
> 
> Auf einem Windows-Host kannst du das kompilierte Linux-Binary alternativ über `npm run pack` erzeugen (befindet sich lauffähig in `dist/linux-unpacked/flakesecure-desktop-admin`).

---

 Einrichtung & Bedienung

 1. Verbindung herstellen:
1. Öffne den Reiter ** Einstellungen**.
2. Gib deine Server-URL ein (z. B. `https://flakesecure.snowystudio.dev` oder `http://localhost:4000`).
3. Gib dein **Admin-Secret** ein (entspricht `ADMIN_SECRET` aus der `server/.env`).
4. Klicke auf **„ Verbindung testen“** und anschließend auf **„ Einstellungen speichern“**.
   *(Die Einstellungen werden persistent und sicher im lokalen Benutzerverzeichnis gespeichert).*

 2. Mitteilung verfassen (Tab ):
- **Nachrichtentext**: Gib den Text ein. Die **Smartphone-Live-Vorschau** zeigt in Echtzeit, wie das Ergebnis auf mobilen Geräten aussieht.
- **Typ**:
  - ` Popup (Mitte)`: Großes modales Dialogfenster.
  - ` Banner (Oben)`: Dezenter Benachrichtigungsstreifen am oberen Bildschirmrand.
- **Häufigkeit**:
  - `once`: Wird nach Bestätigung für den jeweiligen Nutzer nicht mehr angezeigt.
  - `always`: Erscheint bei jedem App-Start erneut.
- **Priorität**: Höhere Zahl = Höhere Anzeigereihenfolge (Schnellauswahl: 0 Normal, 10 Wichtig, 50 Kritisch).
- **Ablaufdatum (optional)**: Wähle z. B. `+1 Tag`, `+1 Woche` oder einen exakten Zeitpunkt.
- Klicke auf **„ Nachricht an alle Apps senden“**.

 3. Aktive Mitteilungen verwalten:
- In der rechten Spalte siehst du alle aktuell aktiven Mitteilungen.
- Klicke bei einer Nachricht auf **„ Löschen“**, um sie sofort vom Server zu entfernen.

 4. Wartungsmodus aktivieren / beenden (Tab ):
- **Wartung aktivieren**:
  1. Gib die Meldung ein, die Nutzern auf dem roten Sperrbildschirm angezeigt werden soll.
  2. Wähle optional das geplante Ende (z. B. `In 1 Std`).
  3. Klicke auf **„ Wartungsmodus aktivieren“** und bestätige die Sicherheitsabfrage.
  4. Die App schaltet sofort für alle mobilen Nutzer auf den Sperrbildschirm um.
- **Wartung beenden**:
  1. Klicke auf den grünen Button **„ Wartungsmodus beenden (Apps freigeben)“**.
  2. Die Apps sind sofort wieder regulär benutzbar.

---

 Sicherheit
- **Context Isolation**: Renderer-Prozess läuft isoliert ohne direkten Node.js-Zugriff (`contextIsolation: true`, `nodeIntegration: false`).
- **CORS-Frei**: Alle HTTP-Requests an den FlakeSecure-Server werden über den sicheren Electron-Hauptprozess (`ipcMain`) ausgeführt.
- **x-admin-secret Header**: Wird ausschließlich bei administrativen Endpunkten übertragen und bleibt lokal auf deinem Rechner geschützt.
