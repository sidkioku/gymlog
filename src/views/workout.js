import { getCompletedSets, getMuscleMeta, hasSetupAdjustments, REST_PRESETS } from '../models.js';
import { dualWeight, formatNumber, formatRestTime } from '../weight.js';
import { esc, icon } from '../icons.js';

export function renderActiveWorkoutMiniBar(store) {
  if (!store.activeSession || store.isWorkoutOpen) return '';
  const session = store.activeSession;
  const machine = store.activeMachine;
  const unit = store.settings.preferredUnit;
  const completed = getCompletedSets(session).length;
  const total = session.sets.length;
  const currentSet = Math.min(completed + 1, Math.max(1, total));
  const targetW = machine ? machine.targetWeight : session.sets[0]?.weight || 0;
  const wUnit = machine ? machine.weightUnit : session.weightUnit;
  const dual = dualWeight(targetW, wUnit, unit);

  const resting = store.isRestTimerRunning();
  const rem = store.getRestRemainingSeconds();

  return `
    <div class="mini-workout-bar-wrap">
      <button type="button" class="mini-workout-bar" data-action="resume-workout">
        <span class="mini-bar-icon ${resting ? 'is-resting' : ''}">
          ${icon(resting ? 'timer' : 'dumbbell', 19)}
        </span>
        <span class="mini-bar-info">
          <strong>${esc(session.machineName)}</strong>
          <span class="tabular">
            ${completed >= total ? `Alle ${total} Sätze fertig` : `Satz ${currentSet}/${total}`} • <em class="text-cyan">${esc(dual.primary)}</em>
          </span>
        </span>
        ${
          resting
            ? `<span class="mini-bar-timer tabular" data-live-rest-badge>
                 <strong>${formatRestTime(rem)}</strong>
                 <small>Pause</small>
               </span>`
            : `<span class="mini-bar-resume">
                 <span>Öffnen</span>
                 ${icon('chevronUp', 14)}
               </span>`
        }
      </button>
    </div>
  `;
}

export function renderRestFloatingBar(store) {
  if (!store.isRestTimerRunning()) return '';
  const rem = store.getRestRemainingSeconds();
  const total = Math.max(1, store.restTotalDuration || store.settings.defaultRestDuration || 90);
  const pct = Math.min(100, Math.max(0, (rem / total) * 100));

  return `
    <div class="rest-floating-bar" data-rest-floating>
      <div class="rest-floating-progress" data-rest-progress-fill style="width:${pct.toFixed(1)}%"></div>
      <button type="button" class="rest-floating-main" data-action="open-rest-modal" aria-label="Pausentimer vergrößern">
        <span class="rest-float-icon">${icon('timer', 18)}</span>
        <span class="rest-float-copy">
          <small>PAUSENTIMER</small>
          <strong class="tabular" data-rest-countdown>${formatRestTime(rem)}</strong>
        </span>
      </button>
      <div class="rest-floating-btns">
        <button type="button" class="rest-chip-btn tabular" data-action="add-rest-time" data-seconds="-15">-15s</button>
        <button type="button" class="rest-chip-btn is-lime tabular" data-action="add-rest-time" data-seconds="30">+30s</button>
        <button type="button" class="rest-skip-btn" data-action="stop-rest-timer" aria-label="Pause beenden">
          ${icon('close', 17)}
        </button>
      </div>
    </div>
  `;
}

export function renderRestTimerModal(store) {
  const rem = store.getRestRemainingSeconds();
  const total = Math.max(1, store.restTotalDuration || store.settings.defaultRestDuration || 90);
  const progress = Math.min(1, Math.max(0, rem / total));
  const r = 88;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return `
    <div class="sheet-form rest-modal-wrap">
      <div class="sheet-header">
        <div>
          <span class="kicker-lime">SATZPAUSE</span>
          <h2>Pausentimer</h2>
        </div>
        <button type="button" class="icon-circle-btn" data-action="close-dialog" aria-label="Minimieren">
          ${icon('close', 18)}
        </button>
      </div>

      <div class="rest-circle-stage">
        <div class="rest-ring-box">
          <svg width="210" height="210" viewBox="0 0 210 210">
            <circle cx="105" cy="105" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"/>
            <circle data-rest-modal-ring cx="105" cy="105" r="${r}" fill="none" stroke="#C3F400" stroke-width="12"
              stroke-linecap="round"
              stroke-dasharray="${c.toFixed(2)}"
              stroke-dashoffset="${offset.toFixed(2)}"
              transform="rotate(-90 105 105)"/>
          </svg>
          <div class="rest-ring-center">
            <span class="micro-kicker">VERBLEIBEND</span>
            <strong class="rest-big-digits tabular" data-rest-modal-digits>${formatRestTime(rem)}</strong>
          </div>
        </div>

        <div class="rest-adjust-row tabular">
          <button type="button" class="rest-adj-btn" data-action="add-rest-time" data-seconds="-15">-15s</button>
          <button type="button" class="rest-adj-btn is-lime" data-action="add-rest-time" data-seconds="30">+30s</button>
          <button type="button" class="rest-adj-btn is-lime" data-action="add-rest-time" data-seconds="60">+60s</button>
        </div>

        <div class="rest-presets-block">
          <span class="micro-label">NEU STARTEN MIT:</span>
          <div class="rest-presets-row tabular">
            ${REST_PRESETS.map(
              (sec) => `
              <button type="button" class="preset-sec-pill ${store.settings.defaultRestDuration === sec ? 'is-default' : ''}"
                data-action="start-custom-rest" data-seconds="${sec}">
                ${sec}s
              </button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="sheet-footer">
        <button type="button" class="btn-cta-workout" data-action="stop-rest-and-close">
          ${icon('check', 18)}
          <span>Pause beenden & weiter</span>
        </button>
      </div>
    </div>
  `;
}

export function renderActiveWorkoutSheet(store) {
  if (!store.activeSession || !store.isWorkoutOpen) return '';
  const session = store.activeSession;
  const machine = store.activeMachine;
  const unit = store.settings.preferredUnit;
  const inc = machine?.weightIncrement > 0 ? machine.weightIncrement : 2.5;
  const meta = getMuscleMeta(session.muscleGroup);

  const completedSets = getCompletedSets(session);
  const completedCount = completedSets.length;
  const totalCount = session.sets.length;
  const allSetsDone = completedCount === totalCount && totalCount > 0;

  // Next open set index for Focus Hero Card
  const nextSetIndex = session.sets.findIndex((s) => !s.isCompleted);
  const focusSet = nextSetIndex >= 0 ? session.sets[nextSetIndex] : null;

  let focusCardHtml = '';
  if (store.settings.workoutFocusMode) {
    if (allSetsDone) {
      focusCardHtml = `
        <section class="glass-card workout-focus-card is-complete">
          <div class="focus-complete-head">
            <span class="focus-check-badge">${icon('check', 22)}</span>
            <div>
              <span class="kicker-lime">ALLE ${totalCount} SÄTZE ERLEDIGT</span>
              <h3>Starkes Set! Weiter oder abschließen?</h3>
            </div>
          </div>
          <div class="focus-complete-actions">
            <button type="button" class="btn-secondary-lime" data-action="add-workout-set">
              ${icon('plus', 17)} Weiterer Satz
            </button>
            <button type="button" class="btn-cta-workout compact" data-action="finish-workout">
              ${icon('check', 18)} Abschließen
            </button>
          </div>
        </section>
      `;
    } else if (focusSet) {
      const fDual = dualWeight(focusSet.weight, session.weightUnit, unit);
      const prevPerf = store.getPreviousSetPerformance(session.machineId, nextSetIndex);
      focusCardHtml = `
        <section class="glass-card workout-focus-card">
          <div class="focus-top-row">
            <span class="kicker-lime">AKTUELLER SATZ ${focusSet.setNumber} VON ${totalCount}</span>
            ${
              prevPerf
                ? `<span class="prev-perf-pill tabular">Letztes Mal: ${formatNumber(prevPerf.weight)} ${esc(prevPerf.unit)} × ${prevPerf.reps}</span>`
                : ''
            }
          </div>

          <div class="focus-controls-grid">
            <div class="focus-stepper-box">
              <span class="micro-label">GEWICHT (${esc(fDual.secondary)})</span>
              <div class="focus-stepper-row">
                <button type="button" class="big-step-btn" data-action="step-set-weight" data-index="${nextSetIndex}" data-delta="${-inc}" aria-label="Gewicht minus">
                  ${icon('minus', 18)}
                </button>
                <button type="button" class="focus-val-tap tabular" data-action="prompt-set-weight" data-index="${nextSetIndex}">
                  <strong>${esc(formatNumber(focusSet.weight))}</strong>
                  <small>${esc(session.weightUnit)}</small>
                </button>
                <button type="button" class="big-step-btn" data-action="step-set-weight" data-index="${nextSetIndex}" data-delta="${inc}" aria-label="Gewicht plus">
                  ${icon('plus', 18)}
                </button>
              </div>
            </div>

            <div class="focus-stepper-box">
              <span class="micro-label">WIEDERHOLUNGEN</span>
              <div class="focus-stepper-row">
                <button type="button" class="big-step-btn" data-action="step-set-reps" data-index="${nextSetIndex}" data-delta="-1" aria-label="Wdh minus">
                  ${icon('minus', 18)}
                </button>
                <button type="button" class="focus-val-tap tabular" data-action="prompt-set-reps" data-index="${nextSetIndex}">
                  <strong>${focusSet.reps}</strong>
                  <small>Wdh</small>
                </button>
                <button type="button" class="big-step-btn" data-action="step-set-reps" data-index="${nextSetIndex}" data-delta="1" aria-label="Wdh plus">
                  ${icon('plus', 18)}
                </button>
              </div>
            </div>
          </div>

          <button type="button" class="btn-complete-current-set" data-action="toggle-set-complete" data-index="${nextSetIndex}">
            ${icon('check', 20)}
            <span>Satz ${focusSet.setNumber} abschließen</span>
          </button>
        </section>
      `;
    }
  }

  // Setup info strip
  const setupTags = [];
  if (session.seatHeightUsed) setupTags.push(`Sitz: ${session.seatHeightUsed}`);
  if (machine?.backrestAngle) setupTags.push(`Lehne: ${machine.backrestAngle}`);
  if (session.pinPositionUsed) setupTags.push(`Pin: ${session.pinPositionUsed}`);
  if (machine?.attachment) setupTags.push(`Griff: ${machine.attachment}`);

  const setRowsHtml = session.sets
    .map((set, idx) => {
      const sDual = dualWeight(set.weight, session.weightUnit, unit);
      const prev = store.getPreviousSetPerformance(session.machineId, idx);
      return `
        <div class="set-row-card ${set.isCompleted ? 'is-completed' : ''}">
          <div class="set-row-num tabular">${set.setNumber}</div>

          <div class="set-row-controls">
            <div class="set-ctrl-group">
              <span class="set-micro-head">
                GEWICHT <em class="text-cyan tabular">(${esc(sDual.secondary)})</em>
              </span>
              <div class="set-mini-stepper">
                <button type="button" class="row-step-btn" data-action="step-set-weight" data-index="${idx}" data-delta="${-inc}" aria-label="Satz ${set.setNumber} Gewicht minus">
                  ${icon('minus', 14)}
                </button>
                <button type="button" class="row-val-btn tabular" data-action="prompt-set-weight" data-index="${idx}">
                  ${esc(sDual.primary)}
                </button>
                <button type="button" class="row-step-btn" data-action="step-set-weight" data-index="${idx}" data-delta="${inc}" aria-label="Satz ${set.setNumber} Gewicht plus">
                  ${icon('plus', 14)}
                </button>
              </div>
            </div>

            <div class="set-ctrl-group reps-group">
              <span class="set-micro-head">
                WDH ${prev ? `<small class="tabular">• Vorher ${formatNumber(prev.weight)}×${prev.reps}</small>` : ''}
              </span>
              <div class="set-mini-stepper">
                <button type="button" class="row-step-btn" data-action="step-set-reps" data-index="${idx}" data-delta="-1" aria-label="Satz ${set.setNumber} Wdh minus">
                  ${icon('minus', 14)}
                </button>
                <button type="button" class="row-val-btn reps tabular" data-action="prompt-set-reps" data-index="${idx}">
                  ${set.reps}
                </button>
                <button type="button" class="row-step-btn" data-action="step-set-reps" data-index="${idx}" data-delta="1" aria-label="Satz ${set.setNumber} Wdh plus">
                  ${icon('plus', 14)}
                </button>
              </div>
            </div>
          </div>

          <button type="button" class="set-check-btn ${set.isCompleted ? 'is-checked' : ''}"
            data-action="toggle-set-complete" data-index="${idx}"
            aria-label="Satz ${set.setNumber} ${set.isCompleted ? 'als offen markieren' : 'abschließen'}">
            ${icon('check', 19)}
          </button>
        </div>
      `;
    })
    .join('');

  return `
    <div class="workout-fullscreen-sheet" role="dialog" aria-modal="true" aria-label="Aktives Training ${esc(session.machineName)}">
      <header class="workout-sheet-topbar">
        <button type="button" class="topbar-pill-btn" data-action="minimize-workout">
          ${icon('chevronDown', 16)}
          <span>Minimieren</span>
        </button>

        <div class="workout-topbar-center">
          <span class="live-dot"></span>
          <strong>${esc(session.machineName)}</strong>
        </div>

        <div class="workout-topbar-right">
          <button type="button" class="icon-circle-btn sm" data-action="open-rest-modal" aria-label="Pausentimer öffnen">
            ${icon('timer', 17)}
          </button>
          <button type="button" class="topbar-cancel-btn" data-action="confirm-cancel-workout">
            Abbrechen
          </button>
        </div>
      </header>

      <div class="workout-sheet-scroll">
        <!-- Setup & Ziel-Info -->
        <div class="workout-meta-strip">
          <span class="muscle-tag-pill" style="--m-color:${meta.color}">
            ${icon(meta.icon, 13)} ${esc(session.muscleGroup)}
          </span>
          ${setupTags.map((t) => `<span class="setup-tag-chip">${esc(t)}</span>`).join('')}
          ${
            machine && hasSetupAdjustments(machine) === false && machine.notes
              ? `<span class="setup-tag-chip">${esc(machine.notes)}</span>`
              : ''
          }
          <button type="button" class="focus-toggle-chip ${store.settings.workoutFocusMode ? 'is-on' : ''}"
            data-action="toggle-focus-mode">
            Fokus-Karte ${store.settings.workoutFocusMode ? 'An' : 'Aus'}
          </button>
        </div>

        ${focusCardHtml}

        <!-- Alle Übungssätze -->
        <section class="workout-sets-section">
          <div class="section-header-inline">
            <h2 class="section-title">Übungssätze</h2>
            <span class="sets-counter-pill tabular ${allSetsDone ? 'is-done' : ''}">
              ${completedCount}/${totalCount} abgeschlossen
            </span>
          </div>

          <div class="sets-list-stack">
            ${setRowsHtml}
          </div>

          <div class="add-remove-sets-row">
            <button type="button" class="btn-add-set" data-action="add-workout-set">
              ${icon('plus', 16)} Satz hinzufügen
            </button>
            ${
              totalCount > 1
                ? `<button type="button" class="btn-remove-set" data-action="remove-workout-set">
                     ${icon('trash', 15)} Entfernen
                   </button>`
                : ''
            }
          </div>
        </section>

        <!-- Schnelle Anpassung aller offenen Sätze -->
        <section class="glass-card bump-sets-card">
          <span class="micro-label">OFFENE SÄTZE GEMEINSAM ANPASSEN (${esc(session.weightUnit.toUpperCase())})</span>
          <div class="bump-buttons-row tabular">
            <button type="button" class="bump-btn neg" data-action="bump-open-sets" data-delta="-5">-5</button>
            <button type="button" class="bump-btn neg" data-action="bump-open-sets" data-delta="-2.5">-2.5</button>
            <button type="button" class="bump-btn" data-action="bump-open-sets" data-delta="1.25">+1.25</button>
            <button type="button" class="bump-btn" data-action="bump-open-sets" data-delta="2.5">+2.5</button>
            <button type="button" class="bump-btn" data-action="bump-open-sets" data-delta="5">+5.0</button>
            <button type="button" class="bump-btn" data-action="bump-open-sets" data-delta="10">+10</button>
          </div>
        </section>

        <!-- Sitz / Pin & Workout-Notiz -->
        <section class="glass-card workout-notes-card">
          <div class="form-row-two compact-gap">
            <div class="form-group">
              <label for="wo-seat-input">Sitzhöhe (optional)</label>
              <input id="wo-seat-input" type="text" placeholder="z.B. Sitz 4" value="${esc(session.seatHeightUsed)}" data-workout-meta="seatHeightUsed" />
            </div>
            <div class="form-group">
              <label for="wo-pin-input">Pin / Rolle (optional)</label>
              <input id="wo-pin-input" type="text" placeholder="z.B. Pin 3" value="${esc(session.pinPositionUsed)}" data-workout-meta="pinPositionUsed" />
            </div>
          </div>
          <div class="form-group" style="margin-top:10px">
            <label for="wo-notes-input">Notiz zu diesem Training</label>
            <input id="wo-notes-input" type="text" placeholder="z.B. Lief stark, nächstes Mal +2.5" value="${esc(session.notes)}" data-workout-meta="notes" />
          </div>
        </section>

        <!-- Haupt-Abschlussbutton -->
        <button type="button" class="btn-cta-workout finish-btn ${completedCount === 0 ? 'is-disabled' : ''}"
          data-action="finish-workout" ${completedCount === 0 ? 'disabled' : ''}>
          ${icon('check', 20)}
          <span>Übung abschließen & speichern</span>
        </button>
      </div>

      <div id="workout-rest-slot">
        ${renderRestFloatingBar(store)}
      </div>
    </div>
  `;
}
