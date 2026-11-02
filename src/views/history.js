import {
  getCompletedSets,
  getMuscleMeta,
  getSessionBest1RM,
  getSessionMaxWeight,
  getSessionTotalVolume,
  MUSCLE_GROUPS,
} from '../models.js';
import {
  convertWeight,
  dualWeight,
  formatDateDE,
  formatNumber,
} from '../weight.js';
import { renderMuscleHeatmapCard } from './dashboard.js';
import { renderProgressionChartCard } from '../chart.js';
import { esc, icon } from '../icons.js';

export function renderHistoryView(store) {
  const unit = store.settings.preferredUnit;
  const allSessions = store.sessions;

  const lifetimeVolume = allSessions.reduce((total, session) => {
    const vol = getCompletedSets(session).reduce(
      (sum, set) =>
        sum + convertWeight(set.weight, session.weightUnit || 'kg', unit) * set.reps,
      0
    );
    return total + vol;
  }, 0);

  const lifetimeSets = allSessions.reduce(
    (sum, session) => sum + getCompletedSets(session).length,
    0
  );

  let maxWeightLogged = 0;
  for (const s of allSessions) {
    for (const set of getCompletedSets(s)) {
      const w = convertWeight(set.weight, s.weightUnit || 'kg', unit);
      if (w > maxWeightLogged) maxWeightLogged = w;
    }
  }

  let filtered = allSessions;
  if (store.ui.historyMuscleFilter !== 'Alle') {
    filtered = filtered.filter((s) => s.muscleGroup === store.ui.historyMuscleFilter);
  }
  if (store.ui.historyMachineFilter) {
    filtered = filtered.filter((s) => s.machineId === store.ui.historyMachineFilter);
  }

  const muscleChips = MUSCLE_GROUPS.map((mg) => {
    const selected = store.ui.historyMuscleFilter === mg.id;
    return `
      <button type="button" class="muscle-filter-chip ${selected ? 'is-selected' : ''}"
        data-action="filter-history-muscle" data-muscle="${esc(mg.id)}"
        style="--chip-color:${mg.color}">
        ${icon(mg.icon, 14)}
        <span>${esc(mg.label)}</span>
      </button>
    `;
  }).join('');

  const machineOptions = [
    `<option value="">Alle Geräte (${allSessions.length})</option>`,
    ...store.machines
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map(
        (m) =>
          `<option value="${esc(m.id)}" ${store.ui.historyMachineFilter === m.id ? 'selected' : ''}>${esc(m.name)}</option>`
      ),
  ].join('');

  const selectedFilterMachine = store.ui.historyMachineFilter
    ? store.machines.find((m) => m.id === store.ui.historyMachineFilter)
    : null;

  const sessionCards = filtered.length
    ? filtered
        .map((session) => {
          const meta = getMuscleMeta(session.muscleGroup);
          const completed = getCompletedSets(session);
          const maxW = getSessionMaxWeight(session);
          const vol = getSessionTotalVolume(session);
          const dualMax = dualWeight(maxW, session.weightUnit, unit);
          const setPills = completed
            .slice(0, 6)
            .map(
              (s) =>
                `<span class="mini-set-badge tabular">${formatNumber(s.weight)}×${s.reps}</span>`
            )
            .join('');

          return `
            <button type="button" class="session-history-card" data-action="open-session-detail" data-session-id="${esc(session.id)}">
              <div class="session-card-head">
                <div class="session-head-left">
                  <span class="muscle-dot" style="background:${meta.color}"></span>
                  <strong>${esc(session.machineName)}</strong>
                </div>
                <span class="session-max-badge tabular">${esc(dualMax.primary)}</span>
              </div>

              <div class="session-card-meta tabular">
                <span>${esc(formatDateDE(session.date))}</span>
                <span>•</span>
                <span class="text-lime">${completed.length} Sätze</span>
                <span>•</span>
                <span>Vol: ${Math.round(convertWeight(vol, session.weightUnit, unit))} ${esc(unit)}</span>
              </div>

              <div class="history-mini-sets">${setPills}</div>
              ${session.notes ? `<p class="history-mini-note">„${esc(session.notes)}“</p>` : ''}
            </button>
          `;
        })
        .join('')
    : `
      <div class="glass-card empty-state-card">
        <div class="empty-icon-circle">${icon('chart', 30)}</div>
        <h3>Noch keine Einheiten</h3>
        ${
          allSessions.length === 0
            ? `<button type="button" class="btn-secondary-sm" data-action="open-manual-session">Training nachtragen</button>`
            : ''
        }
      </div>
    `;

  return `
    <div class="view-container">
      <header class="page-top-bar">
        <h1 class="page-title">Fortschritt</h1>
        <button type="button" class="pill-btn-ghost" data-action="open-manual-session">
          ${icon('plus', 15)} <span>Nachtragen</span>
        </button>
      </header>

      <!-- Lifetime Bento Stats -->
      <section class="glass-card bento-lifetime-card">
        <div class="bento-four-grid">
          <div class="bento-metric-tile">
            <span class="micro-label">VOLUMEN GESAMT</span>
            <strong class="tabular text-cyan">${Math.round(lifetimeVolume).toLocaleString('de-DE')} ${esc(unit)}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">SÄTZE GESAMT</span>
            <strong class="tabular text-lime">${lifetimeSets}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">EINHEITEN</span>
            <strong class="tabular">${allSessions.length}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">TOP GEWICHT</span>
            <strong class="tabular text-orange">${formatNumber(maxWeightLogged)} ${esc(unit)}</strong>
          </div>
        </div>
      </section>

      ${renderMuscleHeatmapCard(store)}

      <!-- Filter Sektion -->
      <section class="history-filters-block">
        <div class="chip-scroll-row">${muscleChips}</div>
        <div class="select-filter-wrap">
          <select id="history-machine-select" aria-label="Nach Gerät filtern">
            ${machineOptions}
          </select>
        </div>
      </section>

      ${
        selectedFilterMachine
          ? renderProgressionChartCard(
              selectedFilterMachine,
              store.sessions,
              store.ui.chartMetric,
              store.ui.chartRange,
              unit
            )
          : ''
      }

      <section class="dashboard-section">
        <div class="section-header-inline">
          <h2 class="section-title">Absolvierte Einheiten (${filtered.length})</h2>
        </div>
        <div class="card-stack">
          ${sessionCards}
        </div>
      </section>
    </div>
  `;
}

export function renderSessionDetailModal(store, sessionId) {
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return `<div class="sheet-form"><p>Einheit nicht gefunden.</p></div>`;
  }

  const unit = store.settings.preferredUnit;
  const meta = getMuscleMeta(session.muscleGroup);
  const vol = getSessionTotalVolume(session);
  const maxW = getSessionMaxWeight(session);
  const best1RM = getSessionBest1RM(session);
  const completedCount = getCompletedSets(session).length;
  const machine = store.machines.find((m) => m.id === session.machineId) || null;

  const setsRows = session.sets
    .map((set, idx) => {
      const dual = dualWeight(set.weight, session.weightUnit, unit);
      return `
        <div class="session-edit-set-row">
          <span class="set-badge-num tabular">Satz ${set.setNumber}</span>
          <label class="inline-num-field">
            <span>${esc(session.weightUnit)}</span>
            <input type="text" inputmode="decimal" name="set_weight_${idx}" value="${esc(formatNumber(set.weight))}" class="tabular" />
          </label>
          <span class="times-symbol">×</span>
          <label class="inline-num-field reps">
            <span>Wdh</span>
            <input type="number" inputmode="numeric" min="1" max="300" name="set_reps_${idx}" value="${set.reps}" class="tabular" />
          </label>
          <label class="inline-check-field" title="${esc(dual.secondary)}">
            <input type="checkbox" name="set_done_${idx}" ${set.isCompleted ? 'checked' : ''} />
            <span>✓</span>
          </label>
        </div>
      `;
    })
    .join('');

  return `
    <form id="session-detail-form" class="sheet-form" data-session-id="${esc(session.id)}">
      <div class="sheet-header">
        <div>
          <span class="muscle-tag-pill" style="--m-color:${meta.color}">
            ${icon(meta.icon, 13)} ${esc(session.muscleGroup)}
          </span>
          <h2>${esc(session.machineName)}</h2>
          <span class="muted-sm">${esc(formatDateDE(session.date))}</span>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="bento-four-grid">
          <div class="bento-metric-tile">
            <span class="micro-label">VOLUMEN</span>
            <strong class="tabular text-cyan">${formatNumber(vol)} ${esc(session.weightUnit)}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">MAX GEWICHT</span>
            <strong class="tabular text-lime">${formatNumber(maxW)} ${esc(session.weightUnit)}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">1RM (EPLEY)</span>
            <strong class="tabular">${formatNumber(best1RM, 1)} ${esc(session.weightUnit)}</strong>
          </div>
          <div class="bento-metric-tile">
            <span class="micro-label">SÄTZE</span>
            <strong class="tabular text-orange">${completedCount}</strong>
          </div>
        </div>

        <div class="form-section-divider">Ausgeführte Sätze (bearbeitbar)</div>
        <div class="session-sets-edit-list">
          ${setsRows}
        </div>

        <div class="form-group">
          <label for="sd-notes">Notiz zur Einheit</label>
          <input id="sd-notes" name="notes" type="text" value="${esc(session.notes)}" placeholder="Keine Notiz" />
        </div>

        ${
          session.seatHeightUsed || session.pinPositionUsed
            ? `<div class="setup-inline-summary">
                 ${session.seatHeightUsed ? `<span>Sitz: <b>${esc(session.seatHeightUsed)}</b></span>` : ''}
                 ${session.pinPositionUsed ? `<span>Pin: <b>${esc(session.pinPositionUsed)}</b></span>` : ''}
               </div>`
            : ''
        }

        ${
          machine
            ? renderProgressionChartCard(
                machine,
                store.sessions,
                store.ui.chartMetric,
                store.ui.chartRange,
                unit
              )
            : ''
        }

        <button type="button" class="btn-danger-outline full-width" data-action="delete-session" data-session-id="${esc(session.id)}">
          ${icon('trash', 16)} Diese Trainingseinheit löschen
        </button>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('check', 18)}
          <span>Änderungen speichern</span>
        </button>
      </div>
    </form>
  `;
}

export function renderManualSessionModal(store) {
  const machines = store.machines
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const first = machines[0];
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return `
    <form id="manual-session-form" class="sheet-form">
      <div class="sheet-header">
        <div>
          <span class="kicker-lime">HISTORIE ERGÄNZEN</span>
          <h2>Training nachtragen</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="form-group">
          <label for="ms-machine">Gerät wählen</label>
          <select id="ms-machine" name="machineId" required>
            ${machines
              .map(
                (m) =>
                  `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.muscleGroup)})</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="ms-date">Datum & Uhrzeit</label>
          <input id="ms-date" name="date" type="datetime-local" value="${nowLocal}" required />
        </div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="ms-weight">Gewicht (${esc(store.settings.preferredUnit)})</label>
            <input id="ms-weight" name="weight" type="text" inputmode="decimal" required value="${first ? formatNumber(first.targetWeight) : '40'}" class="tabular input-accent" />
          </div>
          <div class="form-group">
            <label for="ms-sets">Anzahl Sätze × Wdh.</label>
            <div class="inline-pair-inputs">
              <input name="setsCount" type="number" inputmode="numeric" min="1" max="20" value="${first ? first.targetSets : 3}" class="tabular" aria-label="Anzahl Sätze" />
              <span>×</span>
              <input name="reps" type="number" inputmode="numeric" min="1" max="200" value="${first ? first.targetReps : 10}" class="tabular" aria-label="Wiederholungen" />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="ms-notes">Notiz (optional)</label>
          <input id="ms-notes" name="notes" type="text" placeholder="z.B. Aus altem Trainingsplan übertragen" />
        </div>
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('check', 18)}
          <span>Zum Verlauf hinzufügen</span>
        </button>
      </div>
    </form>
  `;
}
