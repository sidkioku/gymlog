import { REST_PRESETS } from '../models.js';
import { formatDateDE } from '../weight.js';
import { SAMPLE_CSV_TEMPLATE } from '../csv.js';
import { esc, icon } from '../icons.js';

export function renderSettingsView(store) {
  const unit = store.settings.preferredUnit;
  const restSec = store.settings.defaultRestDuration;
  const lastBackup = store.settings.lastFileBackupAt
    ? ` • Backup: ${formatDateDE(store.settings.lastFileBackupAt, false)}`
    : '';

  return `
    <div class="view-container">
      <header class="page-top-bar">
        <h1 class="page-title">Einstellungen</h1>
      </header>

      <section class="glass-card settings-block">
        <div class="section-header-inline">
          <span class="section-kicker" style="color:#C3F400">DATENSICHERUNG</span>
          <span class="muted-sm tabular">${store.machines.length} Geräte • ${store.sessions.length} Einheiten${esc(lastBackup)}</span>
        </div>

        <div class="vault-actions-stack">
          <button type="button" class="btn-cta-workout" data-action="quick-json-backup">
            ${icon('share', 18)}
            <span>Backup sichern (.json)</span>
          </button>

          <button type="button" class="btn-secondary-lime full-width" data-action="open-restore-modal">
            ${icon('upload', 17)}
            <span>Backup laden (.json)</span>
          </button>
        </div>
      </section>

      <section class="glass-card settings-block">
        <span class="section-kicker">TRAINING</span>

        <div class="setting-item-block">
          <div class="setting-label-row">
            <strong>Gewichtseinheit</strong>
          </div>
          <div class="unit-choice-grid">
            <button type="button" class="unit-choice-btn ${unit === 'kg' ? 'is-active' : ''}" data-action="set-unit" data-unit="kg">
              <strong class="tabular">KG</strong>
              <span>Kilogramm</span>
            </button>
            <button type="button" class="unit-choice-btn ${unit === 'lbs' ? 'is-active' : ''}" data-action="set-unit" data-unit="lbs">
              <strong class="tabular">LBS</strong>
              <span>Pfund</span>
            </button>
          </div>
        </div>

        <hr class="glass-divider" />

        <div class="setting-item-block">
          <div class="setting-label-row">
            <strong>Pausenzeit</strong>
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
            <strong>Signalton</strong>
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
            <strong>Display wach halten</strong>
          </div>
          <button type="button" class="switch-pill ${store.settings.keepScreenAwake ? 'is-on' : ''}"
            data-action="toggle-wakelock" role="switch" aria-checked="${store.settings.keepScreenAwake}">
            <span></span>
          </button>
        </div>
      </section>

      <section class="glass-card settings-block">
        <span class="section-kicker" style="color:#00DBE9">CSV</span>

        <div class="csv-buttons-stack">
          <button type="button" class="settings-nav-row" data-action="open-csv-modal">
            <span class="nav-row-icon cyan">${icon('upload', 19)}</span>
            <span class="nav-row-text">
              <strong>CSV importieren</strong>
            </span>
            ${icon('chevronRight', 16)}
          </button>

          <button type="button" class="settings-nav-row" data-action="export-machines-csv">
            <span class="nav-row-icon lime">${icon('dumbbell', 19)}</span>
            <span class="nav-row-text">
              <strong>Geräte exportieren (.csv)</strong>
            </span>
            ${icon('download', 16)}
          </button>

          <button type="button" class="settings-nav-row" data-action="export-workouts-csv">
            <span class="nav-row-icon orange">${icon('chart', 19)}</span>
            <span class="nav-row-text">
              <strong>Trainingsverlauf exportieren (.csv)</strong>
            </span>
            ${icon('download', 16)}
          </button>
        </div>
      </section>

      <section class="glass-card settings-block danger-zone">
        <span class="section-kicker">ZURÜCKSETZEN</span>
        <div class="danger-buttons-stack">
          <button type="button" class="btn-neutral-row" data-action="reset-default-machines">
            ${icon('reset', 17)}
            <span>Standard-Geräte laden</span>
          </button>
          <button type="button" class="btn-danger-outline full-width" data-action="clear-all-history">
            ${icon('trash', 17)}
            <span>Trainingsverlauf löschen</span>
          </button>
        </div>
      </section>
    </div>
  `;
}

export function renderRestoreBackupModal() {
  return `
    <form id="restore-backup-form" class="sheet-form">
      <div class="sheet-header">
        <div>
          <h2>Backup laden</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="form-group">
          <label for="restore-file-input">JSON-Datei</label>
          <input id="restore-file-input" type="file" accept=".json,application/json" required class="file-picker-input" />
        </div>

        <div class="form-group">
          <label>Modus</label>
          <div class="radio-stack">
            <label class="radio-card">
              <input type="radio" name="restoreMode" value="merge" checked />
              <div>
                <strong>Zusammenführen</strong>
                <small>Ergänzt fehlende Trainings und aktualisiert Geräte.</small>
              </div>
            </label>
            <label class="radio-card">
              <input type="radio" name="restoreMode" value="replace" />
              <div>
                <strong>Ersetzen</strong>
                <small>Überschreibt den aktuellen Stand.</small>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('upload', 18)}
          <span>Wiederherstellen</span>
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
          <h2>CSV importieren</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="form-group">
          <label>Datentyp</label>
          <div class="radio-chips-wrap">
            <label class="radio-chip">
              <input type="radio" name="csvType" value="machines" checked />
              <span>Geräte</span>
            </label>
            <label class="radio-chip">
              <input type="radio" name="csvType" value="workouts" />
              <span>Trainingsverlauf</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label for="csv-file-picker">CSV-Datei</label>
          <input id="csv-file-picker" type="file" accept=".csv,.tsv,.txt,text/csv" class="file-picker-input" />
        </div>

        <div class="form-group">
          <div class="label-with-link">
            <label for="csv-textarea">Oder Text einfügen</label>
            <button type="button" class="text-action-btn" data-action="load-sample-csv">Beispiel</button>
          </div>
          <textarea id="csv-textarea" name="csvText" rows="6" class="mono-textarea" placeholder="Gerätename,Muskelgruppe,Gerätetyp,Zielgewicht,Einheit,Zielsätze,Ziel-Wdh..."></textarea>
        </div>

        <div id="csv-live-preview" class="csv-preview-box is-hidden"></div>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('check', 18)}
          <span>Importieren</span>
        </button>
      </div>
    </form>
  `;
}

export { SAMPLE_CSV_TEMPLATE };
