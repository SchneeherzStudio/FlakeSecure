# FlakeSecure - Firefox Extension

Dies ist die angepasste Firefox-Version der FlakeSecure Browser-Erweiterung. Die Anpassungen umfassen die Verwendung der `browser.*` Promise-basierten API (der Mozilla-Standard) anstelle der alten `chrome.*` Callback-basierten API. Die `manifest.json` war durch die `browser_specific_settings` bereits für Firefox vorbereitet.

## Installation in Firefox (Developer Mode)

Da diese Erweiterung lokal entwickelt wird und (noch) nicht im Firefox Add-ons Store (AMO) verfügbar ist, musst du sie als temporäres Add-on laden. 

Gehe dazu wie folgt vor:

1. Öffne Firefox.
2. Gib in der Adresszeile `about:debugging#/runtime/this-firefox` ein (oder gehe über das Menü: *Weitere Werkzeuge* -> *Web-Entwickler-Werkzeuge* -> *Erweiterungen* -> *Dieser Firefox*).
3. Klicke auf den Button **Temporäres Add-on laden...**.
4. Wähle im sich öffnenden Dateifenster die Datei `manifest.json` aus dem Ordner `browser-extension-firefox/extension` aus.
5. Die Erweiterung ist nun installiert und aktiv! Oben rechts in der Symbolleiste deines Browsers sollte nun das FlakeSecure-Icon auftauchen (unter Umständen musst du es erst über das Puzzleteil-Icon anpinnen).

> [!NOTE]
> Temporäre Add-ons werden aus Sicherheitsgründen von Firefox nach einem Neustart des Browsers wieder entfernt. Für eine dauerhafte Installation müsste die Erweiterung von Mozilla signiert werden oder als `.xpi`-Datei gebündelt werden, was bei bestimmten Firefox-Versionen (z.B. Developer Edition oder Nightly) durch das Deaktivieren der Signaturprüfung umgangen werden kann.

## Funktion testen
- Öffne eine Seite mit einem Login-Feld (z.B. GitHub, Twitter, etc.).
- Das Overlay der Erweiterung sollte sich automatisch öffnen und den QR-Code generieren.
- Über einen Klick auf das Erweiterungs-Icon in der Leiste lassen sich die Einstellungen (z.B. der Relay-Server) anpassen.
