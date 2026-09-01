<!--
============================================================================
FlakeSecure v2.0 - Server Admin Guide: Announcements & Maintenance
============================================================================

FUNCTION OVERVIEW & DOCUMENTATION:
This document explains how to send broadcast notifications / popups to the
FlakeSecure mobile app and how to activate/deactivate the maintenance screen.
All endpoints require the 'x-admin-secret' header matching ADMIN_SECRET in server/.env.
============================================================================
-->

# ❄️ FlakeSecure Admin-Anleitung: Nachrichten & Wartungsmodus

Diese Anleitung beschreibt, wie du administrative Mitteilungen (Popups/Banner) an die Mobile Apps schickst und den Wartungsmodus aktivierst oder beendest.

---

## 🔑 Authentifizierung (Admin-Secret)

Alle Admin-Endpunkte erfordern den HTTP-Header `x-admin-secret`.  
Der geheime Schlüssel wird auf dem Server in der Datei `server/.env` definiert:

```env
ADMIN_SECRET=DEIN_GEHEIMES_ADMIN_SECRET
```

---

## 📢 1. Nachrichten an die App senden (`POST /api/system/announcement`)

Du kannst Nachrichten an die App schicken, die beim Start der App angezeigt werden.

### ⚙️ Parameter (JSON Body):

| Parameter | Typ | Erforderlich | Beschreibung |
| :--- | :--- | :--- | :--- |
| `message` | `String` | **Ja** | Der Nachrichtentext, der dem Nutzer angezeigt wird. |
| `type` | `String` | **Ja** | `'popup'` (Großes Dialogfenster in der Mitte) oder `'banner'` (Kompakte Hinweisbox am oberen Rand). |
| `display` | `String` | **Ja** | `'once'` (Wird nach Bestätigung nicht mehr angezeigt) oder `'always'` (Erscheint bei jedem App-Start). |
| `priority` | `Integer` | *Nein* | Höhere Zahl = Höhere Priorität bei der Anzeige (Standard: `0`). |
| `expires_at` | `ISO 8601 String` | *Nein* | Automatisches Ablaufdatum (z. B. `"2026-09-10T18:00:00Z"`). |

---

### 💻 Beispiele: Nachricht erstellen

#### Option A: PowerShell
```powershell
$headers = @{
    "Content-Type"   = "application/json"
    "x-admin-secret" = "DEIN_GEHEIMES_ADMIN_SECRET"
}

$body = @{
    message = "Wartungsarbeiten am 05.09 von 14:00 bis 16:00 Uhr. Bitte speichert eure Daten rechtzeitig."
    type    = "popup"   # 'popup' oder 'banner'
    display = "once"    # 'once' oder 'always'
    priority = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://flakesecure.snowystudio.dev/api/system/announcement" -Method Post -Headers $headers -Body $body
```

#### Option B: cURL (Bash / Terminal)
```bash
curl -X POST https://flakesecure.snowystudio.dev/api/system/announcement \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: DEIN_GEHEIMES_ADMIN_SECRET" \
  -d '{
    "message": "Wartungsarbeiten am 05.09 von 14:00 bis 16:00 Uhr.",
    "type": "popup",
    "display": "once",
    "priority": 10
  }'
```

---

## 🗑️ 2. Nachrichten verwalten & löschen

### 📋 Alle aktiven Nachrichten abrufen (`GET /api/system/announcements`):
```bash
curl https://flakesecure.snowystudio.dev/api/system/announcements
```

### ❌ Eine Nachricht vorzeitig löschen (`DELETE /api/system/announcement/:id`):
```powershell
Invoke-RestMethod -Uri "https://flakesecure.snowystudio.dev/api/system/announcement/<ANNOUNCEMENT_UUID>" -Method Delete -Headers @{ "x-admin-secret" = "DEIN_GEHEIMES_ADMIN_SECRET" }
```

---

## 🛠️ 3. Wartungsmodus aktivieren & aufheben (`POST /api/system/maintenance`)

Wenn der Wartungsmodus aktiv ist, schaltet die Mobile App automatisch auf den unbenutzbaren **Wartungs-Screen (`MaintenanceScreen`)** um, bis der Modus deaktiviert wird.

### ⚙️ Parameter (JSON Body):

| Parameter | Typ | Erforderlich | Beschreibung |
| :--- | :--- | :--- | :--- |
| `active` | `Boolean` | **Ja** | `true` (Wartung aktivieren) oder `false` (Wartung beenden). |
| `message` | `String` | *Nein* | Wartungsmeldung für die Nutzer (z. B. `"Server-Wartung aktiv"`). |
| `until` | `ISO 8601 String` | *Nein* | Geplantes Ende der Wartung (z. B. `"2026-09-01T18:00:00Z"`). |

---

### 💻 Wartung aktivieren:

#### PowerShell:
```powershell
$headers = @{
    "Content-Type"   = "application/json"
    "x-admin-secret" = "DEIN_GEHEIMES_ADMIN_SECRET"
}

$body = @{
    active  = $true
    message = "Wartungsarbeiten laufen – Server vorübergehend nicht erreichbar."
    until   = "2026-09-01T18:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://flakesecure.snowystudio.dev/api/system/maintenance" -Method Post -Headers $headers -Body $body
```

#### cURL:
```bash
curl -X POST https://flakesecure.snowystudio.dev/api/system/maintenance \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: DEIN_GEHEIMES_ADMIN_SECRET" \
  -d '{
    "active": true,
    "message": "Wartungsarbeiten laufen – Server vorübergehend nicht erreichbar.",
    "until": "2026-09-01T18:00:00Z"
  }'
```

---

### 💻 Wartung beenden (App wieder freigeben):

#### PowerShell:
```powershell
$headers = @{
    "Content-Type"   = "application/json"
    "x-admin-secret" = "DEIN_GEHEIMES_ADMIN_SECRET"
}

$body = @{
    active = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://flakesecure.snowystudio.dev/api/system/maintenance" -Method Post -Headers $headers -Body $body
```

#### cURL:
```bash
curl -X POST https://flakesecure.snowystudio.dev/api/system/maintenance \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: DEIN_GEHEIMES_ADMIN_SECRET" \
  -d '{"active": false}'
```
