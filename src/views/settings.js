import { REST_PRESETS } from '../models.js';
import { formatDateDE } from '../weight.js';
import { SAMPLE_CSV_TEMPLATE } from '../csv.js';
import { isStandalonePWA } from '../storage.js';
import { esc, icon } from '../icons.js';

export function renderSettingsView(store) {
  const unit = store.settings.preferredUnit;
  const restSec = store.settings.defaultRestDuration;
  const storageStatus = store.storage?.status || {};
  const standalone = isStandalonePWA();
  const lastBackup = store.settings.lastFileBackupAt
    ? formatDateDE(store.settings.lastFileBackupAt)
    : 'Noch kein Datei-Backup exportiert';

  return `
    <div class="view-container">
      <header class="page-top-bar">
        <div>
          <span class="kicker-lime">EINSTELLUNGEN & DATENSCHUTZ</span>
          <h1 class="page-title">Präferenzen</h1>
        </div>
      </header>

      <!-- 1. DATENSICHERHEIT & HISTORIE SPEICHERN (HERZSTÜCK) -->
      <section class="glass-card backup-vault-card">
        <div class="vault-head">
          <span class="vault-shield">${icon('shield', 22)}</span>
          <div>
            <span class="kicker-lime">HISTORIE & BACKUP-TRESOR</span>
            <h2 class="section-title">Deine Trainingsdaten sichern</h2>
          </div>
        </div>

        <div class="vault-status-grid">
          <div class="vault-badge-item">
            <span class="status-dot-ok"></span>
            <div>
              <strong>IndexedDB + LocalStorage aktiv</strong>
              <small>${store.machines.length} Geräte • ${store.sessions.length} Trainings gespeichert</small>
            </div>
          </div>
          <div class="vault-badge-item">
            <span class="status-dot-ok ${storageStatus.persisted || standalone ? '' : 'is-amber'}"></span>
            <div>
              <strong>${
                standalone
                  ? 'Home-Bildschirm WebApp Modus'
                  : storageStatus.persisted
                    ? 'Dauerhafter Browser-Speicher geschützt'
                    : 'Browser-Modus (Home-Screen empfohlen)'
              }</strong>
              <small>${
                storageStatus.serverSyncAvailable
                  ? 'Zusätzlich automatisches Mac-Backup aktiv!'
                  : `Letztes Datei-Backup: ${esc(lastBackup)}`
              }</small>
            </div>
          </div>
        </div>

        <div class="vault-actions-stack">
          <button type="button" class="btn-cta-workout" data-action="quick-json-backup">
            ${icon('share', 18)}
            <span>Komplett-Backup sichern (.json / Dateien)</span>
          </button>

          <button type="button" class="btn-secondary-lime full-width" data-action="open-restore-modal">
            ${icon('upload', 17)}
            <span>Backup-Datei wiederherstellen (.json)</span>
          </button>
        </div>

        <p class="vault-footnote">
          Tipp fürs iPhone: Über <b>„Komplett-Backup sichern“</b> öffnet sich das iOS-Teilen-Menü – wähle <b>„In Dateien sichern“</b> (iCloud Drive), um deine komplette Historie jederzeit 100 % sicher aufzubewahren.
        </p>
      </section>

      <!-- 2. TRAININGS-PRÄFERENZEN -->
      <section class="glass-card settings-block">
        <span class="section-kicker">TRAININGS-PRÄFERENZEN</span>

        <div class="setting-item-block">
          <div class="setting-label-row">
            <strong>Bevorzugte Gewichtseinheit</strong>
            <small>Rechnet alle Geräte automatisch um (2,5er Schritte)</small>
          </div>
          <div class="unit-choice-grid">
            <button type="button" class="unit-choice-btn ${unit === 'kg' ? 'is-active' : ''}" data-action="set-unit" data-unit="kg">
              <strong class="tabular">KG</strong>
              <span>Kilogramm</span>
            </button>
            <button type="button" class="unit-choice-btn ${unit === 'lbs' ? 'is-active' : ''}" data-action="set-unit" data-unit="lbs">
              <strong class="tabular">LBS</strong>
              <span>Pfund (2.5 Schritte)</span>
            </button>
          </div>
        </div>

        <hr class="glass-divider" />

        <div class="setting-item-block">
          <div class="setting-label-row">
            <strong>Standard-Pausenzeit nach Satz</strong>
            <small>Startet automatisch nach dem Abhaken eines Satzes</small>
          </div>
          <div class="rest-presets-row tabular">
            ${REST_PRESETS.map(
              (sec) => `
              <button type="button" class="preset-sec-pill ${restSec === sec ? 'is-default' : ''}"
                data-action="set-default-rest" data-seconds="${sec}">
                ${sec}s
              </button>`
            ).join('')}
          </div>
        </div>

        <hr class="glass-divider" />

        <div class="setting-toggle-row">
          <div>
            <strong>Signalton bei Pausenende</strong>
            <small> Dezenter Gong wenn der Timer 00:00 erreicht</small>
          </div>
          <div class="toggle-inline-actions">
            <button type="button" class="pill-btn-ghost" data-action="test-chime">Test</button>
            <button type="button" class="switch-pill ${store.settings.soundEnabled ? 'is-on' : ''}"
              data-action="toggle-sound" role="switch" aria-checked="${store.settings.soundEnabled}">
              <span></span>
            </button>
          </div>
        </div>

        <div class="setting-toggle-row">
          <div>
            <strong>Display im Training wach halten</strong>
            <small>Verhindert automatisches Abdunkeln im aktiven Workout</small>
          </div>
          <button type="button" class="switch-pill ${store.settings.keepScreenAwake ? 'is-on' : ''}"
            data-action="toggle-wakelock" role="switch" aria-checked="${store.settings.keepScreenAwake}">
            <span></span>
          </button>
        </div>
      </section>

      <!-- 3. EXCEL / CSV STUDIO -->
      <section class="glass-card settings-block">
        <span class="section-kicker" style="color:#00DBE9">EXCEL & CSV DATENAUSTAUSCH</span>

        <div class="csv-buttons-stack">
          <button type="button" class="settings-nav-row" data-action="open-csv-modal">
            <span class="nav-row-icon cyan">${icon('upload', 19)}</span>
            <span class="nav-row-text">
              <strong>Aus Excel / CSV importieren</strong>
              <small>Geräte oder Trainingsverlauf per Datei oder Copy-Paste laden</small>
            </span>
            ${icon('chevronRight', 16)}
          </button>

          <button type="button" class="settings-nav-row" data-action="export-machines-csv">
            <span class="nav-row-icon lime">${icon('dumbbell', 19)}</span>
            <span class="nav-row-text">
              <strong>Geräte & Zielgewichte als CSV</strong>
              <small>${store.machines.length} Geräte mit Sitz- & Pin-Positionen für Excel/Numbers</small>
            </span>
            ${icon('download', 16)}
          </button>

          <button type="button" class="settings-nav-row" data-action="export-workouts-csv">
            <span class="nav-row-icon orange">${icon('chart', 19)}</span>
            <span class="nav-row-text">
              <strong>Trainingsverlauf als CSV</strong>
              <small>${store.sessions.length} Einheiten mit allen Sätzen, Gewichten & Wdh.</small>
            </span>
            ${icon('download', 16)}
          </button>
        </div>
      </section>

      <!-- 4. IPHONE HOME-SCREEN GUIDE -->
      <section class="glass-card settings-block">
        <span class="section-kicker">${icon('iphone', 14)} AUF DEM IPHONE INSTALLIEREN</span>
        <ol class="iphone-steps-list">
          <li>Öffne diese Seite in <b>Safari</b> auf deinem iPhone.</li>
          <li>Tippe unten auf das <b>Teilen-Symbol</b> ${icon('share', 14)}.</li>
          <li>Wähle <b>„Zum Home-Bildschirm“</b> und tippe auf <b>Hinzufügen</b>.</li>
        </ol>
        <p class="vault-footnote">
          Vorteil gegenüber Xcode: Die WebApp läuft <b>niemals nach 7 Tagen ab</b>, braucht kein Entwickler-Zertifikat und funktioniert im Fitnessstudio auch komplett <b>offline ohne Empfang</b>!
        </p>
      </section>

      <!-- 5. ZURÜCKSETZEN -->
      <section class="glass-card settings-block danger-zone">
        <span class="section-kicker">ZURÜCKSETZEN</span>
        <div class="danger-buttons-stack">
          <button type="button" class="btn-neutral-row" data-action="reset-default-machines">
            ${icon('reset', 17)}
            <span>Standard-Geräte wiederherstellen</span>
          </button>
          <button type="button" class="btn-danger-outline full-width" data-action="clear-all-history">
            ${icon('trash', 17)}
            <span>Alle Trainingsprotokolle löschen</span>
          </button>
        </div>
      </section>

      <footer class="app-version-footer">
        <strong>GymLog WebApp • iPhone Edition</strong>
        <span>Offline-fähige Progressive Web App • Kein 7-Tage-Ablauf</span>
      </footer>
    </div>
  `;
}

export function renderRestoreBackupModal() {
  return `
    <form id="restore-backup-form" class="sheet-form">
      <div class="sheet-header">
        <div>
          <span class="kicker-lime">DATEN WIEDERHERSTELLEN</span>
          <h2>JSON-Backup laden</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <p class="sheet-lead">
          Wähle eine gespeicherte <b>.json</b> Backup-Datei aus der iPhone Dateien-App (unterstützt auch alte <code>gymlog_machines_de.json</code> / <code>gymlog_sessions_de.json</code> Dateien).
        </p>

        <div class="form-group">
          <label for="restore-file-input">Backup-Datei auswählen (.json)</label>
          <input id="restore-file-input" type="file" accept=".json,application/json" required class="file-picker-input" />
        </div>

        <div class="form-group">
          <label>Import-Modus</label>
          <div class="radio-stack">
            <label class="radio-card">
              <input type="radio" name="restoreMode" value="merge" checked />
              <div>
                <strong>Zusammenführen (Empfohlen)</strong>
                <small>Ergänzt fehlende Trainings & aktualisiert Geräte, ohne vorhandene Daten zu verlieren.</small>
              </div>
            </label>
            <label class="radio-card">
              <input type="radio" name="restoreMode" value="replace" />
              <div>
                <strong>Komplett ersetzen</strong>
                <small>Überschreibt den aktuellen Stand vollständig mit dem Inhalt der Backup-Datei.</small>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('upload', 18)}
          <span>Backup jetzt einspielen</span>
        </button>
      </div>
    </form>
  `;
}

export function renderCSVImportModal() {
  return `
    <form id="csv-import-form" class="sheet-form">
      <div class="sheet-header">
        <div>
          <span class="kicker-lime">EXCEL & CSV ASSISTENT</span>
          <h2>CSV-Daten importieren</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="form-group">
          <label>Was möchtest du importieren?</label>
          <div class="radio-chips-wrap">
            <label class="radio-chip">
              <input type="radio" name="csvType" value="machines" checked />
              <span>Geräte & Zielgewichte</span>
            </label>
            <label class="radio-chip">
              <input type="radio" name="csvType" value="workouts" />
              <span>Trainingsverlauf (Sätze)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="csv-file-picker">CSV-Datei laden (optional)</label>
          <input id="csv-file-picker" type="file" accept=".csv,.tsv,.txt,text/csv" class="file-picker-input" />
        </div>

        <div class="form-group">
          <div class="label-with-link">
            <label for="csv-textarea">Oder Zeilen aus Excel / Numbers einfügen</label>
            <button type="button" class="text-action-btn" data-action="load-sample-csv">Beispiel laden</button>
          </div>
          <textarea id="csv-textarea" name="csvText" rows="6" class="mono-textarea" placeholder="Gerätename,Muskelgruppe,Gerätetyp,Zielgewicht,Einheit,Zielsätze,Ziel-Wdh..."></textarea>
        </div>

        <div id="csv-live-preview" class="csv-preview-box is-hidden"></div>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('check', 18)}
          <span>Daten importieren</span>
        </button>
      </div>
    </form>
  `;
}

export { SAMPLE_CSV_TEMPLATE };
