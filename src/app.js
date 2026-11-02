import { StorageEngine, shareOrDownloadFile } from './storage.js';
import { GymLogStore } from './store.js';
import {
  playRestFinishedChime,
  triggerHaptic,
  unlockAudio,
  WakeLockController,
} from './audio.js';
import { formatNumber, formatRestTime, parseDecimalInput } from './weight.js';
import { evaluateOverload } from './overload.js';
import {
  createFullBackupPayload,
  exportMachinesToCSV,
  exportWorkoutsToCSV,
  importMachinesFromCSV,
  importWorkoutsFromCSV,
  parseBackupJSON,
} from './csv.js';
import { createWorkoutSession, createWorkoutSet } from './models.js';
import { bindProgressionCharts } from './chart.js';
import { esc, icon } from './icons.js';

import { renderDashboardView } from './views/dashboard.js';
import {
  renderMachineCardsInner,
  renderMachineDetailView,
  renderMachineFormModal,
  renderMachinesListView,
} from './views/machines.js';
import {
  renderActiveWorkoutMiniBar,
  renderActiveWorkoutSheet,
  renderRestFloatingBar,
  renderRestTimerModal,
} from './views/workout.js';
import {
  renderHistoryView,
  renderManualSessionModal,
  renderSessionDetailModal,
} from './views/history.js';
import {
  renderCSVImportModal,
  renderRestoreBackupModal,
  renderSettingsView,
  SAMPLE_CSV_TEMPLATE,
} from './views/settings.js';

const storage = new StorageEngine();
const store = new GymLogStore(storage);
const wakeLock = new WakeLockController();

// Expose for debugging/automated testing if needed
window.__GYMLOG_STORE__ = store;

const mainEl = document.getElementById('app-main');
const miniBarSlot = document.getElementById('mini-workout-slot');
const workoutOverlaySlot = document.getElementById('workout-overlay-slot');
const bottomNavEl = document.getElementById('bottom-tab-bar');
const modalDialog = document.getElementById('app-modal');
const promptDialog = document.getElementById('app-prompt-modal');
const toastContainer = document.getElementById('toast-container');

let activeModalType = null; // 'rest' | 'machine-form' | 'session-detail' | 'manual-session' | 'restore' | 'csv'

// --- Toast Notifications ---
function showToast(message, variant = 'lime') {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast-item is-${variant}`;
  el.innerHTML = `
    <span class="toast-dot"></span>
    <span class="toast-msg">${esc(message)}</span>
  `;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 260);
  }, 3100);
}

// --- Custom Sleek Dialogs (No ugly native alert/prompt/confirm!) ---
function openSheetModal(html, type = 'generic') {
  activeModalType = type;
  modalDialog.innerHTML = html;
  if (!modalDialog.open) {
    modalDialog.showModal();
  }
  bindProgressionCharts(modalDialog);
}

function closeSheetModal() {
  activeModalType = null;
  if (modalDialog.open) {
    modalDialog.close();
  }
  modalDialog.innerHTML = '';
}

function openNumberPrompt({ title, subtitle, initialValue, unitLabel = '', isInteger = false, onSave }) {
  promptDialog.innerHTML = `
    <form id="number-prompt-form" class="prompt-card">
      <span class="kicker-lime">${esc(title.toUpperCase())}</span>
      <p class="prompt-sub">${esc(subtitle)}</p>
      <div class="prompt-input-row">
        <input
          id="prompt-num-input"
          type="text"
          inputmode="${isInteger ? 'numeric' : 'decimal'}"
          enterkeyhint="done"
          value="${esc(String(initialValue))}"
          class="tabular"
          autocomplete="off"
        />
        ${unitLabel ? `<span class="prompt-unit">${esc(unitLabel)}</span>` : ''}
      </div>
      <div class="prompt-actions">
        <button type="button" class="btn-ghost-cancel" data-prompt-cancel>Abbrechen</button>
        <button type="submit" class="btn-lime-confirm">Speichern</button>
      </div>
    </form>
  `;
  if (!promptDialog.open) {
    promptDialog.showModal();
  }
  const inp = promptDialog.querySelector('#prompt-num-input');
  if (inp) {
    requestAnimationFrame(() => {
      inp.focus();
      inp.select();
    });
  }
  promptDialog.querySelector('[data-prompt-cancel]')?.addEventListener('click', () => {
    promptDialog.close();
  });
  promptDialog.querySelector('#number-prompt-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = parseDecimalInput(inp?.value);
    if (val !== null) {
      onSave(isInteger ? Math.max(1, Math.round(val)) : val);
      triggerHaptic('medium');
    }
    promptDialog.close();
  });
}

function openConfirmDialog({ title, message, confirmLabel = 'Bestätigen', danger = true, onConfirm }) {
  promptDialog.innerHTML = `
    <div class="prompt-card">
      <span class="kicker-lime" style="${danger ? 'color:#FF6E6E' : ''}">${esc(title.toUpperCase())}</span>
      <p class="prompt-message">${esc(message)}</p>
      <div class="prompt-actions">
        <button type="button" class="btn-ghost-cancel" data-confirm-no>Abbrechen</button>
        <button type="button" class="${danger ? 'btn-danger-solid' : 'btn-lime-confirm'}" data-confirm-yes>
          ${esc(confirmLabel)}
        </button>
      </div>
    </div>
  `;
  if (!promptDialog.open) {
    promptDialog.showModal();
  }
  promptDialog.querySelector('[data-confirm-no]')?.addEventListener('click', () => {
    promptDialog.close();
  });
  promptDialog.querySelector('[data-confirm-yes]')?.addEventListener('click', () => {
    promptDialog.close();
    onConfirm();
  });
}

// Light dismiss when tapping backdrop of dialogs
[modalDialog, promptDialog].forEach((dlg) => {
  dlg?.addEventListener('click', (e) => {
    if (e.target === dlg) {
      dlg.close();
      if (dlg === modalDialog) activeModalType = null;
    }
  });
});

// --- Rendering ---
function renderBottomNav() {
  if (!bottomNavEl) return;
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'machines', label: 'Geräte', icon: 'dumbbell' },
    { id: 'history', label: 'Fortschritt', icon: 'chart' },
    { id: 'settings', label: 'Einstellungen', icon: 'settings' },
  ];
  bottomNavEl.innerHTML = tabs
    .map((t) => {
      const isActive = store.ui.activeTab === t.id;
      return `
        <button type="button" class="tab-nav-btn ${isActive ? 'is-active' : ''}"
          data-action="switch-tab" data-tab="${t.id}" aria-current="${isActive ? 'page' : 'false'}">
          <span class="tab-icon-wrap">${icon(t.icon, 21)}</span>
          <span class="tab-label">${t.label}</span>
        </button>
      `;
    })
    .join('');
}

function renderMainContent() {
  if (!mainEl) return;

  if (store.ui.selectedMachineDetailId) {
    mainEl.innerHTML = renderMachineDetailView(store, store.ui.selectedMachineDetailId);
  } else {
    switch (store.ui.activeTab) {
      case 'machines':
        mainEl.innerHTML = renderMachinesListView(store);
        break;
      case 'history':
        mainEl.innerHTML = renderHistoryView(store);
        break;
      case 'settings':
        mainEl.innerHTML = renderSettingsView(store);
        break;
      case 'home':
      default:
        mainEl.innerHTML = renderDashboardView(store);
        break;
    }
  }

  bindProgressionCharts(mainEl);
  bindDynamicInputs();
}

function renderOverlays() {
  if (miniBarSlot) {
    miniBarSlot.innerHTML = renderActiveWorkoutMiniBar(store);
  }
  if (workoutOverlaySlot) {
    const wasOpen = workoutOverlaySlot.classList.contains('is-open');
    const shouldOpen = Boolean(store.activeSession && store.isWorkoutOpen);
    workoutOverlaySlot.classList.toggle('is-open', shouldOpen);
    document.body.classList.toggle('workout-sheet-open', shouldOpen);

    if (shouldOpen) {
      const scrollEl = workoutOverlaySlot.querySelector('.workout-sheet-scroll');
      const prevScroll = wasOpen && scrollEl ? scrollEl.scrollTop : 0;
      workoutOverlaySlot.innerHTML = renderActiveWorkoutSheet(store);
      const nextScrollEl = workoutOverlaySlot.querySelector('.workout-sheet-scroll');
      if (wasOpen && nextScrollEl) {
        nextScrollEl.scrollTop = prevScroll;
      }
      bindWorkoutInputs();
    } else {
      workoutOverlaySlot.innerHTML = '';
    }
  }

  // Sync Screen Wake Lock with active workout state
  const shouldKeepAwake = Boolean(
    store.activeSession && store.isWorkoutOpen && store.settings.keepScreenAwake
  );
  wakeLock.setDesired(shouldKeepAwake);
}

function renderAll(reason = 'full') {
  if (reason === 'workout-meta') {
    // Keep cursor focus intact inside active workout text inputs
    return;
  }
  if (reason === 'timer') {
    updateLiveTimerDOM();
    if (workoutOverlaySlot && store.isWorkoutOpen) {
      const slot = document.getElementById('workout-rest-slot');
      if (slot) slot.innerHTML = renderRestFloatingBar(store);
    }
    if (miniBarSlot && !store.isWorkoutOpen) {
      miniBarSlot.innerHTML = renderActiveWorkoutMiniBar(store);
    }
    if (activeModalType === 'rest' && modalDialog.open) {
      modalDialog.innerHTML = renderRestTimerModal(store);
    }
    return;
  }

  renderBottomNav();
  renderMainContent();
  renderOverlays();

  if (activeModalType === 'rest' && modalDialog.open) {
    modalDialog.innerHTML = renderRestTimerModal(store);
  }
}

function bindDynamicInputs() {
  const searchInput = document.getElementById('machine-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.ui.searchQuery = e.target.value;
      const resultsEl = document.getElementById('machines-list-results');
      const clearBtn = document.getElementById('machine-search-clear');
      if (resultsEl) resultsEl.innerHTML = renderMachineCardsInner(store);
      if (clearBtn) clearBtn.classList.toggle('is-hidden', !store.ui.searchQuery);
    });
  }

  const historySelect = document.getElementById('history-machine-select');
  if (historySelect) {
    historySelect.addEventListener('change', (e) => {
      store.ui.historyMachineFilter = e.target.value;
      renderMainContent();
    });
  }
}

function bindWorkoutInputs() {
  workoutOverlaySlot?.querySelectorAll('[data-workout-meta]').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const key = inp.getAttribute('data-workout-meta');
      if (key) {
        store.updateActiveWorkoutMeta({ [key]: e.target.value });
      }
    });
  });
}

// --- Wall-Clock Rest Timer Ticker ---
function updateLiveTimerDOM() {
  if (!store.restEndTime) return;
  const now = Date.now();
  const rem = store.getRestRemainingSeconds(now);

  if (rem <= 0) {
    store.stopRestTimer(true);
    if (store.settings.soundEnabled) {
      playRestFinishedChime();
    } else {
      triggerHaptic('success');
    }
    showToast('Pause beendet – bereit für den nächsten Satz!', 'lime');
    if (activeModalType === 'rest') {
      closeSheetModal();
    }
    renderAll('full');
    return;
  }

  const formatted = formatRestTime(rem);
  const total = Math.max(1, store.restTotalDuration || store.settings.defaultRestDuration || 90);
  const pct = Math.min(100, Math.max(0, (rem / total) * 100));

  document.querySelectorAll('[data-rest-countdown]').forEach((el) => {
    el.textContent = formatted;
  });
  document.querySelectorAll('[data-rest-progress-fill]').forEach((el) => {
    el.style.width = `${pct.toFixed(1)}%`;
  });
  document.querySelectorAll('[data-live-rest-badge] strong').forEach((el) => {
    el.textContent = formatted;
  });
  document.querySelectorAll('[data-rest-modal-digits]').forEach((el) => {
    el.textContent = formatted;
  });
  const modalRing = document.querySelector('[data-rest-modal-ring]');
  if (modalRing) {
    const r = 88;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - rem / total);
    modalRing.setAttribute('stroke-dashoffset', offset.toFixed(2));
  }
}

setInterval(() => {
  if (store.restEndTime) {
    updateLiveTimerDOM();
  }
}, 500);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.restEndTime) {
    updateLiveTimerDOM();
  }
});

// --- Backup & Export Helpers ---
async function triggerFullJSONBackup() {
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `gymlog-backup-${datePart}.json`;
  const content = createFullBackupPayload({
    machines: store.machines,
    sessions: store.sessions,
    settings: store.settings,
  });

  const res = await shareOrDownloadFile({
    filename,
    content,
    mimeType: 'application/json',
    title: `GymLog Backup (${datePart})`,
  });

  if (res.ok) {
    store.updateSettings({ lastFileBackupAt: new Date().toISOString() });
    showToast('Komplett-Backup bereit zum Sichern!', 'lime');
  }
}

async function triggerMachinesCSVExport() {
  const datePart = new Date().toISOString().slice(0, 10);
  const content = exportMachinesToCSV(store.machines, true);
  const res = await shareOrDownloadFile({
    filename: `gymlog-geraete-${datePart}.csv`,
    content,
    mimeType: 'text/csv;charset=utf-8',
    title: 'GymLog Geräte CSV',
  });
  if (res.ok) showToast(`${store.machines.length} Geräte als CSV exportiert!`, 'cyan');
}

async function triggerWorkoutsCSVExport() {
  const datePart = new Date().toISOString().slice(0, 10);
  const content = exportWorkoutsToCSV(store.sessions, true);
  const res = await shareOrDownloadFile({
    filename: `gymlog-verlauf-${datePart}.csv`,
    content,
    mimeType: 'text/csv;charset=utf-8',
    title: 'GymLog Trainingsverlauf CSV',
  });
  if (res.ok) showToast(`${store.sessions.length} Einheiten als CSV exportiert!`, 'cyan');
}

// --- Modal FormBindings ---
function bindMachineFormEvents() {
  const form = modalDialog.querySelector('#machine-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const id = form.getAttribute('data-machine-id') || '';
    const parsedWeight = parseDecimalInput(fd.get('targetWeight')) ?? 40;

    const payload = {
      name: String(fd.get('name') || '').trim(),
      muscleGroup: String(fd.get('muscleGroup') || 'Brust'),
      machineType: String(fd.get('machineType') || 'Steckgewichte / Block'),
      targetWeight: parsedWeight,
      weightUnit: String(fd.get('weightUnit') || store.settings.preferredUnit),
      targetSets: parseInt(fd.get('targetSets'), 10) || 3,
      targetReps: parseInt(fd.get('targetReps'), 10) || 10,
      weightIncrement: parseFloat(fd.get('weightIncrement')) || 2.5,
      seatHeight: String(fd.get('seatHeight') || '').trim(),
      backrestAngle: String(fd.get('backrestAngle') || '').trim(),
      pinPosition: String(fd.get('pinPosition') || '').trim(),
      attachment: String(fd.get('attachment') || '').trim(),
      notes: String(fd.get('notes') || '').trim(),
      isFavorite: fd.get('isFavorite') === 'on',
    };

    if (!payload.name) return;

    if (id) {
      store.updateMachine(id, payload);
      showToast(`„${payload.name}“ aktualisiert`, 'lime');
    } else {
      const created = store.addMachine(payload);
      store.ui.selectedMachineDetailId = created.id;
      showToast(`„${created.name}“ hinzugefügt`, 'lime');
    }
    triggerHaptic('success');
    closeSheetModal();
    renderAll();
  });
}

function bindSessionDetailFormEvents() {
  const form = modalDialog.querySelector('#session-detail-form');
  if (!form) return;
  const sessionId = form.getAttribute('data-session-id');
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const updatedSets = session.sets.map((s, idx) => {
      const w = parseDecimalInput(fd.get(`set_weight_${idx}`));
      const r = parseInt(fd.get(`set_reps_${idx}`), 10);
      const done = fd.get(`set_done_${idx}`) === 'on';
      return {
        ...s,
        weight: w !== null ? w : s.weight,
        reps: Number.isFinite(r) && r > 0 ? r : s.reps,
        isCompleted: done,
        completedAt: done ? s.completedAt || session.date : null,
      };
    });
    store.updateSession(sessionId, {
      sets: updatedSets,
      notes: String(fd.get('notes') || '').trim(),
    });
    triggerHaptic('success');
    closeSheetModal();
    showToast('Trainingseinheit aktualisiert', 'lime');
  });
}

function bindManualSessionFormEvents() {
  const form = modalDialog.querySelector('#manual-session-form');
  if (!form) return;

  const machineSelect = form.querySelector('#ms-machine');
  const weightInput = form.querySelector('#ms-weight');
  const setsInput = form.querySelector('[name="setsCount"]');
  const repsInput = form.querySelector('[name="reps"]');

  machineSelect?.addEventListener('change', () => {
    const m = store.machines.find((x) => x.id === machineSelect.value);
    if (m) {
      if (weightInput) weightInput.value = formatNumber(m.targetWeight);
      if (setsInput) setsInput.value = String(m.targetSets);
      if (repsInput) repsInput.value = String(m.targetReps);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const machine = store.machines.find((x) => x.id === fd.get('machineId'));
    if (!machine) return;

    const weight = parseDecimalInput(fd.get('weight')) ?? machine.targetWeight;
    const setsCount = Math.max(1, Math.min(25, parseInt(fd.get('setsCount'), 10) || 3));
    const reps = Math.max(1, Math.min(200, parseInt(fd.get('reps'), 10) || 10));
    const dateVal = fd.get('date') ? new Date(String(fd.get('date'))).toISOString() : new Date().toISOString();

    const sets = [];
    for (let i = 1; i <= setsCount; i++) {
      sets.push(
        createWorkoutSet({
          setNumber: i,
          weight,
          reps,
          isCompleted: true,
          completedAt: dateVal,
        })
      );
    }

    const newSession = createWorkoutSession({
      machineId: machine.id,
      machineName: machine.name,
      muscleGroup: machine.muscleGroup,
      date: dateVal,
      sets,
      weightUnit: store.settings.preferredUnit,
      seatHeightUsed: machine.seatHeight,
      pinPositionUsed: machine.pinPosition,
      notes: String(fd.get('notes') || '').trim(),
    });

    store.sessions = [newSession, ...store.sessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    store.persist();
    store.notify('history');
    triggerHaptic('success');
    closeSheetModal();
    showToast(`Training für „${machine.name}“ nachgetragen!`, 'lime');
  });
}

function bindRestoreModalEvents() {
  const form = modalDialog.querySelector('#restore-backup-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('#restore-file-input');
    const file = fileInput?.files?.[0];
    if (!file) return;

    const fd = new FormData(form);
    const mode = String(fd.get('restoreMode') || 'merge');

    try {
      const text = await file.text();
      const parsed = parseBackupJSON(text);
      const res = store.restoreBackup(parsed, mode);
      triggerHaptic('success');
      closeSheetModal();
      showToast(
        `Backup geladen: ${res.machinesCount} Geräte, ${res.sessionsCount} Trainings!`,
        'lime'
      );
    } catch (err) {
      showToast('Datei konnte nicht gelesen werden (ungültiges JSON).', 'danger');
    }
  });
}

function bindCSVModalEvents() {
  const form = modalDialog.querySelector('#csv-import-form');
  if (!form) return;
  const textarea = form.querySelector('#csv-textarea');
  const filePicker = form.querySelector('#csv-file-picker');
  const previewBox = form.querySelector('#csv-live-preview');

  const updatePreview = () => {
    const text = textarea?.value?.trim() || '';
    const mode = form.querySelector('input[name="csvType"]:checked')?.value || 'machines';
    if (!text) {
      previewBox?.classList.add('is-hidden');
      return;
    }

    if (mode === 'machines') {
      const list = importMachinesFromCSV(text);
      previewBox.classList.remove('is-hidden');
      previewBox.innerHTML = list.length
        ? `<strong>Vorschau: ${list.length} Geräte erkannt</strong>
           <ul>${list
             .slice(0, 4)
             .map(
               (m) =>
                 `<li>${esc(m.name)} (${esc(m.muscleGroup)}) – ${formatNumber(m.targetWeight)} ${esc(m.weightUnit)} [${m.targetSets}×${m.targetReps}]</li>`
             )
             .join('')}</ul>`
        : `<span>Keine gültigen Gerätezeilen erkannt.</span>`;
    } else {
      const sessions = importWorkoutsFromCSV(text, store.machines);
      previewBox.classList.remove('is-hidden');
      previewBox.innerHTML = sessions.length
        ? `<strong>Vorschau: ${sessions.length} Trainingseinheiten erkannt</strong>`
        : `<span>Keine gültigen Trainingszeilen erkannt (Spalten Datum & Gerätename benötigt).</span>`;
    }
  };

  textarea?.addEventListener('input', updatePreview);
  form.querySelectorAll('input[name="csvType"]').forEach((r) =>
    r.addEventListener('change', updatePreview)
  );

  filePicker?.addEventListener('change', async () => {
    const file = filePicker.files?.[0];
    if (!file || !textarea) return;
    textarea.value = await file.text();
    updatePreview();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textarea?.value?.trim() || '';
    if (!text) return;
    const mode = form.querySelector('input[name="csvType"]:checked')?.value || 'machines';
    if (mode === 'machines') {
      const count = store.importMachinesCSV(text);
      if (count > 0) {
        triggerHaptic('success');
        closeSheetModal();
        showToast(`${count} Geräte erfolgreich importiert!`, 'lime');
      } else {
        showToast('Keine Geräte erkannt. Prüfe das CSV-Format.', 'danger');
      }
    } else {
      const count = store.importWorkoutsCSV(text);
      triggerHaptic('success');
      closeSheetModal();
      showToast(`${count} neue Trainingseinheiten importiert!`, 'lime');
    }
  });
}

// --- Action Dispatcher (Delegated Click Handling) ---
function handleAction(action, btn, event) {
  unlockAudio();

  switch (action) {
    case 'switch-tab': {
      const tab = btn.getAttribute('data-tab') || 'home';
      store.ui.activeTab = tab;
      store.ui.selectedMachineDetailId = null;
      triggerHaptic('light');
      window.scrollTo({ top: 0, behavior: 'instant' });
      renderAll();
      break;
    }

    case 'toggle-unit': {
      const next = store.settings.preferredUnit === 'kg' ? 'lbs' : 'kg';
      store.setPreferredUnit(next);
      triggerHaptic('medium');
      showToast(`Einheit auf ${next.toUpperCase()} umgestellt (2.5 Schritte)`, 'cyan');
      break;
    }

    case 'set-unit': {
      const u = btn.getAttribute('data-unit');
      if (u) {
        store.setPreferredUnit(u);
        triggerHaptic('medium');
        showToast(`Einheit auf ${u.toUpperCase()} umgestellt`, 'cyan');
      }
      break;
    }

    case 'dismiss-install-banner': {
      store.updateSettings({ hideInstallBanner: true });
      break;
    }

    case 'set-heatmap-days': {
      store.ui.heatmapDays = parseInt(btn.getAttribute('data-days'), 10) || 7;
      triggerHaptic('light');
      renderMainContent();
      break;
    }

    case 'select-heatmap-muscle': {
      const m = btn.getAttribute('data-muscle');
      store.ui.heatmapSelectedMuscle = store.ui.heatmapSelectedMuscle === m ? null : m;
      triggerHaptic('light');
      renderMainContent();
      break;
    }

    case 'jump-muscle-machines': {
      const m = btn.getAttribute('data-muscle') || 'Alle';
      store.ui.selectedMuscleFilter = m;
      store.ui.activeTab = 'machines';
      store.ui.selectedMachineDetailId = null;
      triggerHaptic('light');
      renderAll();
      break;
    }

    case 'filter-muscle': {
      store.ui.selectedMuscleFilter = btn.getAttribute('data-muscle') || 'Alle';
      triggerHaptic('light');
      renderMainContent();
      break;
    }

    case 'toggle-fav-filter': {
      store.ui.onlyFavoritesFilter = !store.ui.onlyFavoritesFilter;
      triggerHaptic('light');
      renderMainContent();
      break;
    }

    case 'clear-search': {
      store.ui.searchQuery = '';
      renderMainContent();
      document.getElementById('machine-search-input')?.focus();
      break;
    }

    case 'toggle-favorite': {
      event.stopPropagation();
      const id = btn.getAttribute('data-machine-id');
      if (id) {
        store.toggleFavorite(id);
        triggerHaptic('light');
      }
      break;
    }

    case 'open-machine': {
      const id = btn.getAttribute('data-machine-id');
      if (id) {
        store.ui.selectedMachineDetailId = id;
        history.pushState({ view: 'machine', id }, '');
        triggerHaptic('light');
        window.scrollTo({ top: 0, behavior: 'instant' });
        renderAll();
      }
      break;
    }

    case 'close-machine-detail': {
      store.ui.selectedMachineDetailId = null;
      triggerHaptic('light');
      renderAll();
      break;
    }

    case 'open-add-machine': {
      openSheetModal(renderMachineFormModal(null, store.settings.preferredUnit), 'machine-form');
      bindMachineFormEvents();
      break;
    }

    case 'open-edit-machine': {
      const id = btn.getAttribute('data-machine-id');
      const m = store.machines.find((x) => x.id === id);
      if (m) {
        openSheetModal(renderMachineFormModal(m, store.settings.preferredUnit), 'machine-form');
        bindMachineFormEvents();
      }
      break;
    }

    case 'delete-machine': {
      const id = btn.getAttribute('data-machine-id');
      const m = store.machines.find((x) => x.id === id);
      if (!m) return;
      openConfirmDialog({
        title: 'Gerät löschen?',
        message: `Möchtest du „${m.name}“ wirklich löschen? Dein bisheriger Trainingsverlauf bleibt erhalten.`,
        confirmLabel: 'Gerät löschen',
        danger: true,
        onConfirm: () => {
          store.deleteMachine(id);
          closeSheetModal();
          showToast(`„${m.name}“ gelöscht`, 'cyan');
        },
      });
      break;
    }

    case 'adjust-target-weight': {
      const id = btn.getAttribute('data-machine-id');
      const delta = parseFloat(btn.getAttribute('data-delta') || '0');
      const m = store.machines.find((x) => x.id === id);
      if (m) {
        store.updateTargetWeight(id, Math.max(0, m.targetWeight + delta));
        triggerHaptic('light');
      }
      break;
    }

    case 'prompt-target-weight': {
      const id = btn.getAttribute('data-machine-id');
      const m = store.machines.find((x) => x.id === id);
      if (!m) return;
      openNumberPrompt({
        title: 'Zielgewicht einstellen',
        subtitle: `Genaues Zielgewicht für „${m.name}“ eingeben:`,
        initialValue: formatNumber(m.targetWeight),
        unitLabel: m.weightUnit.toUpperCase(),
        isInteger: false,
        onSave: (val) => {
          store.updateTargetWeight(m.id, val);
          showToast(`Zielgewicht: ${formatNumber(val)} ${m.weightUnit}`, 'lime');
        },
      });
      break;
    }

    case 'apply-overload': {
      const id = btn.getAttribute('data-machine-id');
      const m = store.machines.find((x) => x.id === id);
      if (!m) return;
      const rec = evaluateOverload(m, store.sessions);
      if (rec && rec.isReadyForIncrease) {
        store.applyOverloadRecommendation(rec);
        triggerHaptic('success');
        showToast(
          `Neues Ziel für ${m.name}: ${formatNumber(rec.suggestedWeight)} ${rec.weightUnit}!`,
          'lime'
        );
      }
      break;
    }

    case 'chart-metric': {
      store.ui.chartMetric = btn.getAttribute('data-metric') || 'maxWeight';
      triggerHaptic('light');
      if (activeModalType === 'session-detail' && modalDialog.open) {
        const sid = modalDialog.querySelector('#session-detail-form')?.getAttribute('data-session-id');
        if (sid) {
          openSheetModal(renderSessionDetailModal(store, sid), 'session-detail');
          bindSessionDetailFormEvents();
        }
      } else {
        renderMainContent();
      }
      break;
    }

    case 'chart-range': {
      store.ui.chartRange = btn.getAttribute('data-range') || 'month';
      triggerHaptic('light');
      if (activeModalType === 'session-detail' && modalDialog.open) {
        const sid = modalDialog.querySelector('#session-detail-form')?.getAttribute('data-session-id');
        if (sid) {
          openSheetModal(renderSessionDetailModal(store, sid), 'session-detail');
          bindSessionDetailFormEvents();
        }
      } else {
        renderMainContent();
      }
      break;
    }

    // --- Workout Actions ---
    case 'start-workout': {
      event.stopPropagation();
      const id = btn.getAttribute('data-machine-id');
      if (!id) return;

      if (store.activeSession && store.activeMachineId !== id) {
        const targetM = store.machines.find((m) => m.id === id);
        openConfirmDialog({
          title: 'Aktives Training wechseln?',
          message: `Aktuell läuft noch „${store.activeSession.machineName}“. Möchtest du es verwerfen und „${targetM?.name || 'Neues Gerät'}“ starten?`,
          confirmLabel: 'Wechseln',
          danger: true,
          onConfirm: () => {
            store.startWorkout(id);
            history.pushState({ view: 'workout' }, '');
            triggerHaptic('medium');
          },
        });
        return;
      }

      store.startWorkout(id);
      history.pushState({ view: 'workout' }, '');
      triggerHaptic('medium');
      break;
    }

    case 'resume-workout': {
      store.resumeWorkout();
      history.pushState({ view: 'workout' }, '');
      triggerHaptic('light');
      break;
    }

    case 'minimize-workout': {
      store.minimizeWorkout();
      triggerHaptic('light');
      break;
    }

    case 'confirm-cancel-workout': {
      openConfirmDialog({
        title: 'Training abbrechen?',
        message: 'Möchtest du das aktuelle Training wirklich ohne Speichern verwerfen?',
        confirmLabel: 'Verwerfen',
        danger: true,
        onConfirm: () => {
          store.cancelActiveWorkout();
          showToast('Training verworfen', 'cyan');
        },
      });
      break;
    }

    case 'toggle-focus-mode': {
      store.updateSettings({ workoutFocusMode: !store.settings.workoutFocusMode });
      break;
    }

    case 'toggle-set-complete': {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const nowDone = store.toggleSetCompleted(idx);
      triggerHaptic(nowDone ? 'success' : 'light');
      break;
    }

    case 'step-set-weight': {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const delta = parseFloat(btn.getAttribute('data-delta') || '0');
      const cur = store.activeSession?.sets?.[idx];
      if (cur) {
        store.updateActiveSet(idx, { weight: Math.max(0, cur.weight + delta) });
        triggerHaptic('light');
      }
      break;
    }

    case 'step-set-reps': {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
      const cur = store.activeSession?.sets?.[idx];
      if (cur) {
        store.updateActiveSet(idx, { reps: Math.max(1, cur.reps + delta) });
        triggerHaptic('light');
      }
      break;
    }

    case 'prompt-set-weight': {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const cur = store.activeSession?.sets?.[idx];
      if (!cur) return;
      openNumberPrompt({
        title: `Satz ${cur.setNumber} – Gewicht`,
        subtitle: 'Genaues Gewicht für diesen Satz eingeben:',
        initialValue: formatNumber(cur.weight),
        unitLabel: (store.activeSession?.weightUnit || 'kg').toUpperCase(),
        isInteger: false,
        onSave: (val) => store.updateActiveSet(idx, { weight: val }),
      });
      break;
    }

    case 'prompt-set-reps': {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const cur = store.activeSession?.sets?.[idx];
      if (!cur) return;
      openNumberPrompt({
        title: `Satz ${cur.setNumber} – Wiederholungen`,
        subtitle: 'Anzahl der Wiederholungen eingeben:',
        initialValue: cur.reps,
        unitLabel: 'Wdh.',
        isInteger: true,
        onSave: (val) => store.updateActiveSet(idx, { reps: val }),
      });
      break;
    }

    case 'add-workout-set': {
      store.addSetToActiveWorkout();
      triggerHaptic('light');
      break;
    }

    case 'remove-workout-set': {
      store.removeLastSetFromActiveWorkout();
      triggerHaptic('light');
      break;
    }

    case 'bump-open-sets': {
      const delta = parseFloat(btn.getAttribute('data-delta') || '0');
      store.bumpOpenSetsWeight(delta);
      triggerHaptic('light');
      break;
    }

    case 'finish-workout': {
      const saved = store.finishActiveWorkout();
      if (saved) {
        triggerHaptic('success');
        const machine = store.machines.find((m) => m.id === saved.machineId);
        const overload = machine ? evaluateOverload(machine, store.sessions) : null;
        if (overload && overload.isReadyForIncrease) {
          showToast(
            `Stark! Gespeichert & bereit für +${formatNumber(overload.increment)} ${overload.weightUnit} beim nächsten Mal! 🏆`,
            'lime'
          );
        } else {
          showToast(`Training für „${saved.machineName}“ im Verlauf gespeichert!`, 'lime');
        }
      }
      break;
    }

    // --- Rest Timer Actions ---
    case 'open-rest-modal': {
      if (!store.isRestTimerRunning()) {
        store.startRestTimer(store.settings.defaultRestDuration, true);
      }
      openSheetModal(renderRestTimerModal(store), 'rest');
      break;
    }

    case 'add-rest-time': {
      const sec = parseInt(btn.getAttribute('data-seconds') || '0', 10);
      store.addRestTime(sec);
      triggerHaptic('light');
      break;
    }

    case 'start-custom-rest': {
      const sec = parseInt(btn.getAttribute('data-seconds') || '90', 10);
      store.startRestTimer(sec, true);
      triggerHaptic('medium');
      break;
    }

    case 'stop-rest-timer': {
      store.stopRestTimer(true);
      triggerHaptic('light');
      renderAll();
      break;
    }

    case 'stop-rest-and-close': {
      store.stopRestTimer(true);
      closeSheetModal();
      triggerHaptic('light');
      renderAll();
      break;
    }

    // --- History Actions ---
    case 'filter-history-muscle': {
      store.ui.historyMuscleFilter = btn.getAttribute('data-muscle') || 'Alle';
      triggerHaptic('light');
      renderMainContent();
      break;
    }

    case 'open-session-detail': {
      const sid = btn.getAttribute('data-session-id');
      if (sid) {
        openSheetModal(renderSessionDetailModal(store, sid), 'session-detail');
        bindSessionDetailFormEvents();
      }
      break;
    }

    case 'delete-session': {
      const sid = btn.getAttribute('data-session-id');
      if (!sid) return;
      openConfirmDialog({
        title: 'Einheit löschen?',
        message: 'Möchtest du dieses Trainingsprotokoll wirklich dauerhaft löschen?',
        confirmLabel: 'Löschen',
        danger: true,
        onConfirm: () => {
          store.deleteSession(sid);
          closeSheetModal();
          showToast('Trainingseinheit gelöscht', 'cyan');
        },
      });
      break;
    }

    case 'open-manual-session': {
      openSheetModal(renderManualSessionModal(store), 'manual-session');
      bindManualSessionFormEvents();
      break;
    }

    // --- Settings & Backup Actions ---
    case 'set-default-rest': {
      const sec = parseInt(btn.getAttribute('data-seconds') || '90', 10);
      store.updateSettings({ defaultRestDuration: sec });
      triggerHaptic('light');
      showToast(`Standard-Pause: ${sec} Sekunden`, 'lime');
      break;
    }

    case 'toggle-sound': {
      store.updateSettings({ soundEnabled: !store.settings.soundEnabled });
      triggerHaptic('light');
      break;
    }

    case 'test-chime': {
      playRestFinishedChime();
      showToast('Signalton abgespielt', 'lime');
      break;
    }

    case 'toggle-wakelock': {
      store.updateSettings({ keepScreenAwake: !store.settings.keepScreenAwake });
      triggerHaptic('light');
      break;
    }

    case 'quick-json-backup': {
      triggerFullJSONBackup();
      break;
    }

    case 'open-restore-modal': {
      openSheetModal(renderRestoreBackupModal(), 'restore');
      bindRestoreModalEvents();
      break;
    }

    case 'open-csv-modal': {
      openSheetModal(renderCSVImportModal(), 'csv');
      bindCSVModalEvents();
      break;
    }

    case 'load-sample-csv': {
      const ta = modalDialog.querySelector('#csv-textarea');
      if (ta) {
        ta.value = SAMPLE_CSV_TEMPLATE;
        ta.dispatchEvent(new Event('input'));
      }
      break;
    }

    case 'export-machines-csv': {
      triggerMachinesCSVExport();
      break;
    }

    case 'export-workouts-csv': {
      triggerWorkoutsCSVExport();
      break;
    }

    case 'reset-default-machines': {
      openConfirmDialog({
        title: 'Standard-Geräte laden?',
        message: 'Dadurch wird deine Geräteliste auf die Standard-Geräte zurückgesetzt. Dein Trainingsverlauf bleibt erhalten.',
        confirmLabel: 'Zurücksetzen',
        danger: true,
        onConfirm: () => {
          store.resetToDefaultMachines();
          showToast('Standard-Geräte wiederhergestellt', 'cyan');
        },
      });
      break;
    }

    case 'clear-all-history': {
      openConfirmDialog({
        title: 'Alle Protokolle löschen?',
        message: 'Möchtest du wirklich deinen gesamten Trainingsverlauf löschen? Tipp: Sichere vorher ein JSON-Backup!',
        confirmLabel: 'Alles löschen',
        danger: true,
        onConfirm: () => {
          store.clearAllSessions();
          showToast('Trainingsverlauf geleert', 'cyan');
        },
      });
      break;
    }

    case 'close-dialog': {
      closeSheetModal();
      break;
    }

    default:
      break;
  }
}

let didHoldRepeat = false;

document.addEventListener('click', (e) => {
  if (didHoldRepeat) {
    didHoldRepeat = false;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action) {
    handleAction(action, btn, e);
  }
});

// Press-and-hold rapid stepping for +/- buttons in gym!
let holdTimeout = null;
let holdInterval = null;
const REPEATABLE_ACTIONS = new Set([
  'step-set-weight',
  'step-set-reps',
  'adjust-target-weight',
]);

function clearHoldTimers() {
  if (holdTimeout) clearTimeout(holdTimeout);
  if (holdInterval) clearInterval(holdInterval);
  holdTimeout = null;
  holdInterval = null;
}

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (!REPEATABLE_ACTIONS.has(action)) return;

  didHoldRepeat = false;
  clearHoldTimers();
  holdTimeout = setTimeout(() => {
    didHoldRepeat = true;
    holdInterval = setInterval(() => {
      // Re-query matching button if DOM re-rendered!
      let liveBtn = btn;
      if (!document.body.contains(btn)) {
        const idx = btn.getAttribute('data-index');
        const delta = btn.getAttribute('data-delta');
        const mId = btn.getAttribute('data-machine-id');
        if (idx !== null) {
          liveBtn = document.querySelector(
            `[data-action="${action}"][data-index="${idx}"][data-delta="${delta}"]`
          );
        } else if (mId) {
          liveBtn = document.querySelector(
            `[data-action="${action}"][data-machine-id="${mId}"][data-delta="${delta}"]`
          );
        }
      }
      if (!liveBtn) {
        clearHoldTimers();
        return;
      }
      handleAction(action, liveBtn, e);
    }, 125);
  }, 420);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
  document.addEventListener(evt, clearHoldTimers);
});

// Handle iPhone swipe-back / browser history navigation cleanly
window.addEventListener('popstate', () => {
  if (store.isWorkoutOpen) {
    store.minimizeWorkout();
    return;
  }
  if (store.ui.selectedMachineDetailId) {
    store.ui.selectedMachineDetailId = null;
    renderAll();
  }
});

// --- Subscribe & Boot ---
store.subscribe((_s, reason) => {
  renderAll(reason);
});

async function bootstrap() {
  // 1. Instant 0ms synchronous render from localStorage if available
  const syncSnap = storage.loadSyncSnapshot();
  if (syncSnap) {
    store.hydrateFromSnapshot(syncSnap);
  }
  store.ensureDefaultsIfEmpty();
  renderAll('boot');

  // 2. Async reconciliation with IndexedDB + Persistent Storage + optional local server sync
  const latest = await storage.initAndLoadLatest();
  if (latest) {
    store.hydrateFromSnapshot(latest);
  } else {
    await storage.saveState(store.toPersistedSnapshot());
  }
  store.ensureDefaultsIfEmpty();
  renderAll('hydrated');

  // 3. Register Offline Service Worker for Gym Usage
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

bootstrap();
