import {
  getCompletedSets,
  getMachineInstruction,
  getMuscleMeta,
  getSessionMaxWeight,
  hasSetupAdjustments,
  INCREMENT_OPTIONS,
  MACHINE_TYPES,
  MUSCLE_GROUPS,
  TRAINABLE_MUSCLE_GROUPS,
} from '../models.js';
import { dualWeight, formatDateDE, formatNumber } from '../weight.js';
import { evaluateOverload, getPersonalRecord } from '../overload.js';
import { renderProgressionChartCard } from '../chart.js';
import { esc, icon } from '../icons.js';

export function renderMachineCardsInner(store) {
  const unit = store.settings.preferredUnit;
  const list = store.filteredMachines;

  if (!list.length) {
    const q = store.ui.searchQuery.trim();
    return `
      <div class="glass-card empty-state-card">
        <div class="empty-icon-circle">${icon('dumbbell', 32)}</div>
        <h3>${q ? `Keine Treffer für „${esc(q)}“` : 'Keine Geräte in dieser Auswahl'}</h3>
        <p>${
          store.ui.onlyFavoritesFilter
            ? 'Du hast in dieser Kategorie noch keine Favoriten markiert.'
            : 'Lege ein neues Gerät an oder passe den Muskelgruppen-Filter an.'
        }</p>
        <button type="button" class="btn-primary-lime" data-action="open-add-machine">
          ${icon('plus', 18)} Neues Gerät anlegen
        </button>
      </div>
    `;
  }

  return list
    .map((m) => {
      const meta = getMuscleMeta(m.muscleGroup);
      const dual = dualWeight(m.targetWeight, m.weightUnit, unit);
      const setupParts = [];
      if (m.seatHeight) setupParts.push(`Sitz ${m.seatHeight}`);
      if (m.pinPosition) setupParts.push(`Pin ${m.pinPosition}`);
      if (m.attachment) setupParts.push(m.attachment);
      const subtitle = setupParts.length ? setupParts.join(' • ') : m.machineType;
      const isActive = store.activeMachineId === m.id && Boolean(store.activeSession);

      return `
        <article class="machine-card ${isActive ? 'is-active-machine' : ''}">
          <button type="button" class="machine-fav-btn ${m.isFavorite ? 'is-fav' : ''}"
            data-action="toggle-favorite" data-machine-id="${esc(m.id)}"
            aria-label="${m.isFavorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}">
            ${icon(m.isFavorite ? 'starFilled' : 'star', 17)}
          </button>

          <button type="button" class="machine-card-body" data-action="open-machine" data-machine-id="${esc(m.id)}">
            <span class="muscle-icon-box lg" style="--m-color:${meta.color}">
              ${icon(meta.icon, 22)}
            </span>

            <span class="machine-card-info">
              <strong class="machine-card-title">${esc(m.name)}</strong>
              <span class="machine-card-sub">${esc(subtitle)}</span>
            </span>

            <span class="machine-card-metrics tabular">
              <strong class="machine-weight-primary">${esc(dual.primary)}</strong>
              <span class="machine-weight-secondary">${m.targetSets}×${m.targetReps} • ${esc(dual.secondary)}</span>
            </span>
          </button>

          <button type="button" class="machine-quick-play"
            data-action="start-workout" data-machine-id="${esc(m.id)}"
            aria-label="Training für ${esc(m.name)} direkt starten">
            ${icon('play', 15)}
          </button>
        </article>
      `;
    })
    .join('');
}

export function renderMachinesListView(store) {
  const chips = MUSCLE_GROUPS.map((mg) => {
    const selected = store.ui.selectedMuscleFilter === mg.id;
    return `
      <button type="button" class="muscle-filter-chip ${selected ? 'is-selected' : ''}"
        data-action="filter-muscle" data-muscle="${esc(mg.id)}"
        style="--chip-color:${mg.color}">
        ${icon(mg.icon, 15)}
        <span>${esc(mg.label)}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="view-container">
      <header class="page-top-bar">
        <h1 class="page-title">Geräte</h1>
        <button type="button" class="fab-add-btn" data-action="open-add-machine" aria-label="Gerät hinzufügen">
          ${icon('plus', 20)}
          <span>Neu</span>
        </button>
      </header>

      <div class="sticky-filter-bar">
        <div class="search-input-wrap">
          <span class="search-icon">${icon('search', 18)}</span>
          <input
            type="search"
            id="machine-search-input"
            class="glass-search-input"
            placeholder="Gerät suchen…"
            value="${esc(store.ui.searchQuery)}"
            autocomplete="off"
            autocorrect="off"
            enterkeyhint="search"
          />
          <button type="button" id="machine-search-clear" class="search-clear-btn ${store.ui.searchQuery ? '' : 'is-hidden'}" data-action="clear-search" aria-label="Suche leeren">
            ${icon('close', 16)}
          </button>
        </div>

        <div class="chip-scroll-row">
          <button type="button" class="muscle-filter-chip fav-chip ${store.ui.onlyFavoritesFilter ? 'is-selected' : ''}"
            data-action="toggle-fav-filter">
            ${icon('starFilled', 14)}
            <span>Favoriten</span>
          </button>
          ${chips}
        </div>
      </div>

      <div id="machines-list-results" class="machines-list-stack">
        ${renderMachineCardsInner(store)}
      </div>
    </div>
  `;
}

export function renderMachineDetailView(store, machineId) {
  const machine = store.machines.find((m) => m.id === machineId);
  if (!machine) {
    return `
      <div class="view-container">
        <button type="button" class="back-nav-btn" data-action="close-machine-detail">
          ${icon('chevronLeft', 18)} Zurück zu Geräten
        </button>
        <div class="glass-card empty-state-card">
          <p>Gerät wurde nicht gefunden.</p>
        </div>
      </div>
    `;
  }

  const unit = store.settings.preferredUnit;
  const meta = getMuscleMeta(machine.muscleGroup);
  const dualTarget = dualWeight(machine.targetWeight, machine.weightUnit, unit);
  const inc = machine.weightIncrement > 0 ? machine.weightIncrement : 2.5;
  const overload = evaluateOverload(machine, store.sessions);
  const pr = getPersonalRecord(machine.id, store.sessions, machine.weightUnit);
  const machineHistory = store.getHistoryForMachine(machine.id);
  const isCurrentActive = store.activeMachineId === machine.id && Boolean(store.activeSession);

  const overloadBanner =
    overload && overload.isReadyForIncrease
      ? `
      <section class="glass-card overload-detail-banner is-ready">
        <div class="overload-banner-icon">
          ${icon('bolt', 22)}
        </div>
        <div class="overload-banner-copy">
          <span class="micro-kicker">ERHÖHUNG EMPFOHLEN</span>
          <p>${esc(overload.reason)}</p>
        </div>
        <button type="button" class="btn-lime-pill" data-action="apply-overload" data-machine-id="${esc(machine.id)}">
          +${formatNumber(overload.increment)} ${esc(overload.weightUnit)}
        </button>
      </section>
    `
      : '';

  const prDual = pr ? dualWeight(pr.weight, pr.unit, unit) : null;

  const setupPills = [];
  if (machine.seatHeight) {
    setupPills.push({ label: 'Sitzhöhe', value: machine.seatHeight, icon: 'seat' });
  }
  if (machine.backrestAngle) {
    setupPills.push({ label: 'Rückenlehne', value: machine.backrestAngle, icon: 'seat' });
  }
  if (machine.pinPosition) {
    setupPills.push({ label: 'Pin / Rolle', value: machine.pinPosition, icon: 'pin' });
  }
  if (machine.attachment) {
    setupPills.push({ label: 'Aufsatz / Griff', value: machine.attachment, icon: 'link' });
  }

  const historyItems = machineHistory.length
    ? machineHistory
        .slice(0, 8)
        .map((session) => {
          const maxW = getSessionMaxWeight(session);
          const dualMax = dualWeight(maxW, session.weightUnit, unit);
          const setChips = getCompletedSets(session)
            .map(
              (s) =>
                `<span class="mini-set-badge tabular">${formatNumber(s.weight)}×${s.reps}</span>`
            )
            .join('');
          return `
            <button type="button" class="history-mini-card" data-action="open-session-detail" data-session-id="${esc(session.id)}">
              <div class="history-mini-top">
                <span class="history-mini-date">${esc(formatDateDE(session.date))}</span>
                <strong class="history-mini-max tabular">Top: ${esc(dualMax.primary)} (${esc(dualMax.secondary)})</strong>
              </div>
              <div class="history-mini-sets">${setChips || '<span class="muted-sm">Keine abgeschlossenen Sätze</span>'}</div>
              ${session.notes ? `<p class="history-mini-note">„${esc(session.notes)}“</p>` : ''}
            </button>
          `;
        })
        .join('')
    : `<p class="empty-muted-text">Noch keine Einheiten.</p>`;

  return `
    <div class="view-container">
      <div class="detail-nav-header">
        <button type="button" class="back-nav-btn" data-action="close-machine-detail">
          ${icon('chevronLeft', 18)}
          <span>Zurück</span>
        </button>

        <div class="detail-nav-actions">
          <button type="button" class="icon-circle-btn ${machine.isFavorite ? 'is-fav' : ''}"
            data-action="toggle-favorite" data-machine-id="${esc(machine.id)}"
            aria-label="Favorit umschalten">
            ${icon(machine.isFavorite ? 'starFilled' : 'star', 18)}
          </button>
          <button type="button" class="icon-circle-btn"
            data-action="open-edit-machine" data-machine-id="${esc(machine.id)}"
            aria-label="Gerät bearbeiten">
            ${icon('edit', 18)}
          </button>
        </div>
      </div>

      <div class="detail-title-block">
        <span class="muscle-tag-pill" style="--m-color:${meta.color}">
          ${icon(meta.icon, 14)} ${esc(machine.muscleGroup)} • ${esc(machine.machineType)}
        </span>
        <h1 class="detail-machine-title">${esc(machine.name)}</h1>
      </div>

      <!-- 1. INTERAKTIVES ZIELGEWICHT BANNER -->
      <section class="glass-card target-weight-banner">
        <div class="target-banner-top">
          <div>
            <span class="kicker-lime">${esc(getMachineInstruction(machine.machineType).toUpperCase())}</span>
          </div>
          <div class="stepper-pair">
            <button type="button" class="circle-step-btn is-minus"
              data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="${-inc}"
              aria-label="Zielgewicht verringern">
              ${icon('minus', 20)}
            </button>
            <button type="button" class="circle-step-btn is-plus"
              data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="${inc}"
              aria-label="Zielgewicht erhöhen">
              ${icon('plus', 20)}
            </button>
          </div>
        </div>

        <button type="button" class="giant-weight-tap"
          data-action="prompt-target-weight" data-machine-id="${esc(machine.id)}"
          aria-label="Zielgewicht direkt eingeben">
          <span class="giant-weight-primary tabular">
            <strong>${esc(formatNumber(machine.targetWeight))}</strong>
            <em>${esc(machine.weightUnit.toUpperCase())}</em>
          </span>
          <span class="dual-cyan-badge tabular">
            ${icon('swap', 12)} ${esc(dualTarget.secondary)}
          </span>
          <span class="edit-hint-icon">${icon('edit', 16)}</span>
        </button>

        <div class="quick-delta-row tabular">
          <button type="button" class="delta-pill neg" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="-10">-10</button>
          <button type="button" class="delta-pill neg" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="-5">-5</button>
          <button type="button" class="delta-pill neg" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="${-inc}">-${formatNumber(inc)}</button>
          <button type="button" class="delta-pill pos" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="${inc}">+${formatNumber(inc)}</button>
          <button type="button" class="delta-pill pos" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="5">+5</button>
          <button type="button" class="delta-pill pos" data-action="adjust-target-weight" data-machine-id="${esc(machine.id)}" data-delta="10">+10</button>
        </div>
      </section>

      ${overloadBanner}

      <!-- 2. START / FORTSETZEN CTA -->
      <button type="button" class="btn-cta-workout" data-action="start-workout" data-machine-id="${esc(machine.id)}">
        ${icon(isCurrentActive ? 'chevronUp' : 'play', 20)}
        <span>${isCurrentActive ? 'Laufendes Training fortsetzen' : 'Heutiges Training starten'}</span>
      </button>

      <!-- 3. ZIELPLAN & PERSÖNLICHER REKORD -->
      <div class="bento-two-col">
        <div class="glass-card stat-mini-card">
          <div class="stat-mini-head" style="color:#00DBE9">${icon('target', 16)} <span>ZIELPLAN</span></div>
          <strong class="stat-mini-val tabular">${machine.targetSets} × ${machine.targetReps} Wdh.</strong>
          <span class="stat-mini-sub tabular">${esc(dualTarget.primary)} (${esc(dualTarget.secondary)})</span>
        </div>

        <div class="glass-card stat-mini-card">
          <div class="stat-mini-head" style="color:#C3F400">${icon('trophy', 16)} <span>REKORD (PR)</span></div>
          ${
            pr && prDual
              ? `<strong class="stat-mini-val tabular">${esc(prDual.primary)}</strong>
                 <span class="stat-mini-sub tabular">${pr.reps} Wdh. • 1RM ~${formatNumber(pr.best1RM, 1)} ${esc(pr.unit)}</span>`
              : `<strong class="stat-mini-val">--</strong>
                 <span class="stat-mini-sub">Noch kein Rekord</span>`
          }
        </div>
      </div>

      <!-- 4. INTERAKTIVE PROGRESSIONSKURVE -->
      ${renderProgressionChartCard(
        machine,
        store.sessions,
        store.ui.chartMetric,
        store.ui.chartRange,
        unit
      )}

      <!-- 5. ERGONOMIE & SETUP -->
      <section class="glass-card setup-card">
        <div class="section-header-inline">
          <h2 class="section-title">${icon('seat', 18)} Geräteeinstellungen</h2>
          <button type="button" class="text-action-btn" data-action="open-edit-machine" data-machine-id="${esc(machine.id)}">
            Bearbeiten
          </button>
        </div>
        ${
          hasSetupAdjustments(machine)
            ? `<div class="setup-pills-grid">
                 ${setupPills
                   .map(
                     (p) => `
                   <div class="setup-pill-box">
                     <span class="setup-pill-icon">${icon(p.icon, 15)}</span>
                     <div>
                       <span class="micro-label">${esc(p.label)}</span>
                       <strong>${esc(p.value)}</strong>
                     </div>
                   </div>`
                   )
                   .join('')}
               </div>`
            : `<p class="empty-muted-text">Keine Einstellungen hinterlegt.</p>`
        }
        ${
          machine.notes
            ? `<div class="machine-notes-box">
                 ${icon('note', 15)}
                 <p>${esc(machine.notes)}</p>
               </div>`
            : ''
        }
      </section>

      <!-- 6. VERLAUF DIESES GERÄTS -->
      <section class="dashboard-section">
        <div class="section-header-inline">
          <h2 class="section-title">Letzte Trainingseinheiten</h2>
          <span class="count-pill">${machineHistory.length} protokolliert</span>
        </div>
        <div class="card-stack">
          ${historyItems}
        </div>
      </section>
    </div>
  `;
}

export function renderMachineFormModal(machine = null, preferredUnit = 'kg') {
  const isEdit = Boolean(machine);
  const m = machine || {
    id: '',
    name: '',
    muscleGroup: 'Brust',
    machineType: 'Steckgewichte / Block',
    targetWeight: preferredUnit === 'lbs' ? 100 : 50,
    targetSets: 3,
    targetReps: 10,
    weightUnit: preferredUnit,
    weightIncrement: 2.5,
    seatHeight: '',
    backrestAngle: '',
    pinPosition: '',
    attachment: '',
    notes: '',
    isFavorite: false,
  };

  return `
    <form id="machine-form" class="sheet-form" data-machine-id="${esc(m.id)}">
      <div class="sheet-header">
        <div>
          <span class="kicker-lime">${isEdit ? 'GERÄT BEARBEITEN' : 'NEUES GERÄT'}</span>
          <h2>${isEdit ? esc(m.name) : 'Gerät hinzufügen'}</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Schließen">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="sheet-scroll-body">
        <div class="form-group">
          <label for="mf-name">Gerätename *</label>
          <input id="mf-name" name="name" type="text" required placeholder="z.B. Brustpresse, Latzug" value="${esc(m.name)}" autocomplete="off" />
        </div>

        <div class="form-group">
          <label>Muskelgruppe</label>
          <div class="radio-chips-wrap">
            ${TRAINABLE_MUSCLE_GROUPS.map(
              (g) => `
              <label class="radio-chip" style="--chip-color:${g.color}">
                <input type="radio" name="muscleGroup" value="${esc(g.id)}" ${m.muscleGroup === g.id ? 'checked' : ''} />
                <span>${icon(g.icon, 14)} ${esc(g.label)}</span>
              </label>`
            ).join('')}
          </div>
        </div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="mf-type">Gerätetyp</label>
            <select id="mf-type" name="machineType">
              ${MACHINE_TYPES.map(
                (t) =>
                  `<option value="${esc(t.id)}" ${m.machineType === t.id ? 'selected' : ''}>${esc(t.id)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Schnellstart</label>
            <label class="toggle-box-label">
              <input type="checkbox" name="isFavorite" ${m.isFavorite ? 'checked' : ''} />
              <span>${icon('starFilled', 15)} Als Favorit</span>
            </label>
          </div>
        </div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="mf-weight">Zielgewicht</label>
            <input id="mf-weight" name="targetWeight" type="text" inputmode="decimal" required value="${esc(formatNumber(m.targetWeight))}" class="tabular input-accent" />
          </div>

          <div class="form-group">
            <label for="mf-unit">Einheit</label>
            <select id="mf-unit" name="weightUnit">
              <option value="kg" ${m.weightUnit === 'kg' ? 'selected' : ''}>KG (Kilogramm)</option>
              <option value="lbs" ${m.weightUnit === 'lbs' ? 'selected' : ''}>LBS (Pfund)</option>
            </select>
          </div>
        </div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="mf-sets">Zielsätze</label>
            <input id="mf-sets" name="targetSets" type="number" inputmode="numeric" min="1" max="25" value="${m.targetSets}" class="tabular" />
          </div>
          <div class="form-group">
            <label for="mf-reps">Ziel-Wiederholungen</label>
            <input id="mf-reps" name="targetReps" type="number" inputmode="numeric" min="1" max="200" value="${m.targetReps}" class="tabular" />
          </div>
        </div>

        <div class="form-group">
          <label>Schrittweite (+/- Buttons)</label>
          <div class="radio-chips-wrap">
            ${INCREMENT_OPTIONS.map(
              (incVal) => `
              <label class="radio-chip">
                <input type="radio" name="weightIncrement" value="${incVal}" ${Number(m.weightIncrement) === incVal ? 'checked' : ''} />
                <span class="tabular">${incVal}</span>
              </label>`
            ).join('')}
          </div>
        </div>

        <div class="form-section-divider">Ergonomie & Sitzpositionen</div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="mf-seat">Sitzhöhe</label>
            <input id="mf-seat" name="seatHeight" type="text" placeholder="z.B. Sitz 4" value="${esc(m.seatHeight)}" />
          </div>
          <div class="form-group">
            <label for="mf-back">Rückenlehne</label>
            <input id="mf-back" name="backrestAngle" type="text" placeholder="z.B. Stufe 2" value="${esc(m.backrestAngle)}" />
          </div>
        </div>

        <div class="form-row-two">
          <div class="form-group">
            <label for="mf-pin">Pin / Rolle</label>
            <input id="mf-pin" name="pinPosition" type="text" placeholder="z.B. Oben, Pin 3" value="${esc(m.pinPosition)}" />
          </div>
          <div class="form-group">
            <label for="mf-attach">Griff / Aufsatz</label>
            <input id="mf-attach" name="attachment" type="text" placeholder="z.B. V-Griff, Seil" value="${esc(m.attachment)}" />
          </div>
        </div>

        <div class="form-group">
          <label for="mf-notes">Technik-Tipps & Notizen</label>
          <textarea id="mf-notes" name="notes" rows="3" placeholder="z.B. Zielbereich 8-12 Wdh., Schulterblätter zusammen">${esc(m.notes)}</textarea>
        </div>

        ${
          isEdit
            ? `<button type="button" class="btn-danger-outline full-width" data-action="delete-machine" data-machine-id="${esc(m.id)}">
                 ${icon('trash', 16)} Gerät löschen (Verlauf bleibt erhalten)
               </button>`
            : ''
        }
      </div>

      <div class="sheet-footer">
        <button type="submit" class="btn-cta-workout">
          ${icon('check', 18)}
          <span>${isEdit ? 'Änderungen speichern' : 'Gerät speichern'}</span>
        </button>
      </div>
    </form>
  `;
}
