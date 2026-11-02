# GymLog — iPhone Progressive Web App (PWA)

**GymLog** ist eine speziell für das **iPhone im Fitnessstudio** entwickelte Progressive Web App (PWA). Sie benötigt **keinen kostenpflichtigen Apple-Developer-Account**, läuft **niemals nach 7 Tagen ab** (kein Xcode-Sideloading mehr) und funktioniert dank Offline-Service-Worker auch im Keller-Gym komplett ohne Empfang.

---

## Live-WebApp (GitHub Pages)

Direkt auf deinem iPhone in Safari öffnen:
👉 **https://sidkioku.github.io/gymlog/**

1. Öffne **https://sidkioku.github.io/gymlog/** in **Safari auf deinem iPhone**.
2. Tippe unten auf **Teilen** → **„Zum Home-Bildschirm“** → **Hinzufügen**.
3. Fertig! GymLog startet ab sofort im Vollbild wie eine native App und funktioniert im Fitnessstudio auch komplett offline.

---

## Weitere Nutzungsoptionen

### Lokal auf deinem Mac starten (mit automatischem Mac-Backup)
1. Doppelklicke auf `start.command` (oder führe im Terminal `npm start` aus).
2. Im Terminal wird dir direkt die **iPhone-Adresse im selben WLAN** angezeigt (z. B. `http://192.168.178.xx:3000`).
3. Öffne diese Adresse in Safari auf dem iPhone. Solange du im Heim-WLAN die App öffnest, synchronisiert GymLog deine gesamte Trainingshistorie automatisch zusätzlich in `./data/gymlog-backup.json` auf deinem Mac.

---

## Wie deine Historie sicher gespeichert wird

Deine Trainingsdaten sind mehrfach abgesichert:
1. **Doppelte Gerätespeicherung (`IndexedDB` + `localStorage` + Persistent Storage):** Jede Gewichtsänderung und jeder abgehakte Satz wird sofort lokal auf deinem iPhone gespeichert.
2. **1-Tap Voll-Backup in Apple Dateien / iCloud Drive (`.json`):**
   - Tippe unter **Einstellungen → Voll-Backup sichern (.json)**.
   - Auf dem iPhone öffnet sich direkt das **iOS-Teilen-Menü** → wähle **„In Dateien sichern“** (z. B. in *iCloud Drive*).
   - Über **Backup wiederherstellen (.json)** kannst du jederzeit wählen zwischen **Zusammenführen (Merge)** oder **Komplett ersetzen** (unterstützt auch ältere JSON-Exporte der früheren App).
3. **Excel / Numbers CSV-Export & Import (`.csv`):**
   - Vollständiger Export & Import für **Trainingsverlauf** und **Geräte & Sitzpositionen** (inkl. UTF-8 BOM für saubere Umlaute in Excel).
4. **Automatischer Mac-Sync (`./data/gymlog-backup.json`):** Automatisch aktiv, sobald die App über `node server.mjs` (`npm start`) geladen wird.

---

## Enthaltene Funktionen

- **Home-Dashboard:** Tageszeit-Begrüßung, schneller `KG`/`LBS`-Umschalter, 3 Aktivitätsringe (Zeit, Volumen, Sätze), aktives Workout-Banner, **Smart Progressive Overload** Empfehlungen, Favoriten-Schnellstart, zuletzt trainierte Geräte & **7-/30-Tage Muskel-Heatmap**.
- **Geräte & Übungen:** 18 vorinstallierte Studio-Geräte mit deinen persönlichen Gewichten, Sofortsuche, Muskelgruppen-Filter, Ergonomie-Einstellungen (Sitzhöhe, Lehne, Pin/Stecker, Griff/Aufsatz, Notizen) sowie einstellbare Gewichtsschritte (Standard **2,5 Pfund** / kg, auch **1,25**-Schritte möglich).
- **Geräte-Detailansicht:** Direkt speicherbares Zielgewicht (`−`/`+` inkl. Gedrückthalten, Schnell-Pills und manuelle Zahleneingabe mit deutschem Komma `,`), Overload-Vorschlag mit 1-Tap-Übernahme, PR & geschätztes **1RM (Epley-Formel)** sowie interaktiver **Progressions-Chart** (Max-Gewicht, 1RM, Volumen über 1M / 3M / 6M / Alle).
- **Aktives Workout:** Vollbild-Ansicht + minimierbare Schwebeleiste, Fokus-Karte für den aktuellen Satz, `VORHER`-Referenzwerte aus dem letzten Training, `+ Satz` / `Entfernen` (auch nach dem letzten Satz jederzeit erweiterbar), `Alle offenen Sätze anpassen` (erledigte Sätze bleiben unberührt!), sekundengenauer **Pausen-Timer** (läuft auch bei gesperrtem iPhone-Bildschirm exakt weiter), Web-Audio-Signalton & **Screen Wake Lock**.
- **Fortschritt & Historie:** Lifetime-Statistiken, Muskel- & Gerätefilter, Session-Detailansicht mit nachträglichem Bearbeiten/Löschen einzelner Sätze sowie **vergangenes Training nachtragen**.

---

## Tests ausführen

```bash
npm test
```
