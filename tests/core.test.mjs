import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMachine,
  createWorkoutSession,
  createWorkoutSet,
  getDefaultMachines,
  getSessionBest1RM,
  getSessionMaxWeight,
  getSessionTotalVolume,
  normalizeDateISO,
  prepareSessionForMachine,
} from '../src/models.js';
import {
  convertWeight,
  dualWeight,
  formatNumber,
  formatRestTime,
  parseDecimalInput,
  roundConvertedWeight,
} from '../src/weight.js';
import {
  computeMuscleHeatmapStats,
  evaluateAllOverloads,
  evaluateOverload,
  getPersonalRecord,
} from '../src/overload.js';
import {
  createFullBackupPayload,
  exportMachinesToCSV,
  exportWorkoutsToCSV,
  importMachinesFromCSV,
  importWorkoutsFromCSV,
  parseBackupJSON,
  SAMPLE_CSV_TEMPLATE,
} from '../src/csv.js';
import { GymLogStore } from '../src/store.js';
import { buildChartDataPoints, renderProgressionChartCard } from '../src/chart.js';

import { renderDashboardView } from '../src/views/dashboard.js';
import {
  renderMachineDetailView,
  renderMachineFormModal,
  renderMachinesListView,
} from '../src/views/machines.js';
import {
  renderActiveWorkoutMiniBar,
  renderActiveWorkoutSheet,
  renderRestFloatingBar,
  renderRestTimerModal,
} from '../src/views/workout.js';
import {
  renderHistoryView,
  renderManualSessionModal,
  renderSessionDetailModal,
} from '../src/views/history.js';
import {
  renderCSVImportModal,
  renderRestoreBackupModal,
  renderSettingsView,
} from '../src/views/settings.js';

test('Default machines contain 18 unique German gym machines without duplicates', () => {
  const defaults = getDefaultMachines();
  assert.equal(defaults.length, 18);
  const names = defaults.map((m) => m.name.toLowerCase());
  assert.equal(new Set(names).size, 18, 'No duplicate machine names');
  const chestPress = defaults.find((m) => m.name === 'Brustpresse');
  assert.ok(chestPress);
  assert.equal(chestPress.targetWeight, 36);
  assert.equal(chestPress.weightIncrement, 2.5);
});

test('Weight conversions, 2.5 & 1.25 formatting, and German comma decimal input', () => {
  assert.equal(parseDecimalInput('42,5'), 42.5);
  assert.equal(parseDecimalInput(' 82,75 kg '), 82.75);
  assert.equal(parseDecimalInput('100.0'), 100);
  assert.equal(parseDecimalInput('-5'), null);
  assert.equal(parseDecimalInput('abc'), null);

  assert.equal(formatNumber(50), '50');
  assert.equal(formatNumber(42.5), '42.5');
  assert.equal(formatNumber(1.25), '1.25');
  assert.equal(formatNumber(13.75), '13.75');

  const lbs = convertWeight(100, 'kg', 'lbs');
  assert.equal(roundConvertedWeight(lbs, 'lbs'), 220.5);
  const backToKg = convertWeight(225, 'lbs', 'kg');
  assert.equal(roundConvertedWeight(backToKg, 'kg'), 102.1);

  const dw = dualWeight(40, 'kg', 'lbs');
  assert.equal(dw.primaryUnit, 'lbs');
  assert.equal(dw.secondary, '40 kg');
  assert.equal(formatRestTime(95), '01:35');
});

test('Apple Swift reference date normalization converts 2026 iOS timestamps accurately', () => {
  // 2026-08-20T12:00:00Z in Unix seconds = 1787227200
  // Subtract Apple epoch 978307200 = 808920000
  const iso = normalizeDateISO(808920000);
  assert.equal(iso, '2026-08-20T12:00:00.000Z');
});

test('Progressive Overload & Personal Record calculations', () => {
  const machine = createMachine({
    id: 'm-bench',
    name: 'Brustpresse',
    muscleGroup: 'Brust',
    targetWeight: 50,
    targetSets: 3,
    targetReps: 10,
    weightUnit: 'kg',
    weightIncrement: 2.5,
  });

  // Case 1: Only 2 of 3 sets met target reps -> NOT ready
  const partialSession = createWorkoutSession({
    machineId: 'm-bench',
    machineName: 'Brustpresse',
    muscleGroup: 'Brust',
    date: '2026-10-01T10:00:00.000Z',
    weightUnit: 'kg',
    sets: [
      { setNumber: 1, weight: 50, reps: 10, isCompleted: true },
      { setNumber: 2, weight: 50, reps: 10, isCompleted: true },
      { setNumber: 3, weight: 50, reps: 8, isCompleted: true },
    ],
  });

  const recNotReady = evaluateOverload(machine, [partialSession]);
  assert.equal(recNotReady.isReadyForIncrease, false);
  assert.equal(evaluateAllOverloads([machine], [partialSession]).length, 0);

  // Case 2: Newer session meets all 3 sets x 10+ reps @ 50 kg -> READY for +2.5 kg
  const successSession = createWorkoutSession({
    machineId: 'm-bench',
    machineName: 'Brustpresse',
    muscleGroup: 'Brust',
    date: '2026-10-05T10:00:00.000Z',
    weightUnit: 'kg',
    sets: [
      { setNumber: 1, weight: 50, reps: 12, isCompleted: true },
      { setNumber: 2, weight: 50, reps: 11, isCompleted: true },
      { setNumber: 3, weight: 50, reps: 10, isCompleted: true },
    ],
  });

  const recReady = evaluateOverload(machine, [partialSession, successSession]);
  assert.equal(recReady.isReadyForIncrease, true);
  assert.equal(recReady.suggestedWeight, 52.5);

  const pr = getPersonalRecord('m-bench', [partialSession, successSession], 'kg');
  assert.equal(pr.weight, 50);
  assert.equal(pr.reps, 12);
  // Epley 1RM: 50 * (1 + 12/30) = 70
  assert.equal(pr.best1RM, 70);

  const heatmap = computeMuscleHeatmapStats(
    [
      createWorkoutSession({
        machineId: 'm-bench',
        muscleGroup: 'Brust',
        date: new Date().toISOString(),
        weightUnit: 'kg',
        sets: [
          { setNumber: 1, weight: 50, reps: 10, isCompleted: true },
          { setNumber: 2, weight: 50, reps: 10, isCompleted: true },
          { setNumber: 3, weight: 50, reps: 10, isCompleted: true },
          { setNumber: 4, weight: 50, reps: 10, isCompleted: true },
          { setNumber: 5, weight: 50, reps: 10, isCompleted: true },
          { setNumber: 6, weight: 50, reps: 10, isCompleted: true },
        ],
      }),
    ],
    [machine],
    7,
    'kg'
  );
  const chestHeat = heatmap.find((h) => h.muscleGroup === 'Brust');
  assert.equal(chestHeat.setsCount, 6);
  assert.equal(chestHeat.intensityLevel, 2);
  assert.equal(chestHeat.volume, 3000);
});

test('Store full workout flow: 2.5 lbs steps, manual target weight save, set #2 check, bump open sets, add extra set, finish', () => {
  const savedSnapshots = [];
  const mockStorage = {
    status: { persisted: true, indexedDBAvailable: true, localStorageAvailable: true },
    saveState(snap) {
      savedSnapshots.push(snap);
    },
  };

  const store = new GymLogStore(mockStorage);
  store.ensureDefaultsIfEmpty();
  assert.equal(store.machines.length, 18);

  // Switch to LBS -> all machines convert & use 2.5 lbs increment!
  store.setPreferredUnit('lbs');
  const chest = store.machines.find((m) => m.name === 'Brustpresse');
  assert.equal(chest.weightUnit, 'lbs');
  assert.equal(chest.weightIncrement, 2.5);

  // Manual target weight adjustment must persist immediately (fixing old iOS bug #3 & #4)
  store.updateTargetWeight(chest.id, 132.5);
  assert.equal(store.machines.find((m) => m.id === chest.id).targetWeight, 132.5);
  assert.equal(
    savedSnapshots.at(-1).machines.find((m) => m.id === chest.id).targetWeight,
    132.5
  );

  // Start workout (3 sets @ 132.5 lbs)
  store.startWorkout(chest.id);
  assert.equal(store.activeSession.sets.length, 3);
  assert.equal(store.activeSession.sets[0].weight, 132.5);

  // Complete Set 1 and Set 2 (verifying Set 2 stays completed in store & triggers rest timer!)
  store.toggleSetCompleted(0);
  store.toggleSetCompleted(1);
  assert.equal(store.activeSession.sets[0].isCompleted, true);
  assert.equal(store.activeSession.sets[1].isCompleted, true);
  assert.equal(store.activeSession.sets[2].isCompleted, false);
  assert.equal(store.isRestTimerRunning(), true);

  // Bump open sets by +2.5 lbs -> Completed sets 1 & 2 MUST stay 132.5, open set 3 becomes 135!
  store.bumpOpenSetsWeight(2.5);
  assert.equal(store.activeSession.sets[0].weight, 132.5);
  assert.equal(store.activeSession.sets[1].weight, 132.5);
  assert.equal(store.activeSession.sets[2].weight, 135);

  // Complete Set 3, then decide to add a 4th bonus set (fixing old iOS bug #2)
  store.toggleSetCompleted(2);
  const bonus = store.addSetToActiveWorkout();
  assert.equal(store.activeSession.sets.length, 4);
  assert.equal(bonus.setNumber, 4);
  assert.equal(bonus.weight, 135);
  store.toggleSetCompleted(3);

  // Finish workout -> saves session to history & updates machine targetWeight to 135
  const finished = store.finishActiveWorkout();
  assert.ok(finished);
  assert.equal(store.activeSession, null);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.machines.find((m) => m.id === chest.id).targetWeight, 135);
  assert.equal(getSessionTotalVolume(finished), 132.5 * 12 * 2 + 135 * 12 * 2);
  assert.equal(getSessionMaxWeight(finished), 135);
  assert.ok(getSessionBest1RM(finished) > 135);
});

test('CSV Import/Export (UTF-8 BOM, German semicolons) & Legacy iOS JSON Restore', () => {
  const store = new GymLogStore();
  store.ensureDefaultsIfEmpty();

  // Sample CSV template import
  const sampleMachines = importMachinesFromCSV(SAMPLE_CSV_TEMPLATE);
  assert.equal(sampleMachines.length, 6);

  // Semicolon-separated Excel DE CSV with both quoted and unquoted German comma decimals
  const germanExcelCSV = [
    'Gerätename;Muskelgruppe;Gerätetyp;Zielgewicht;Einheit;Zielsätze;Ziel-Wdh;Sitzhöhe;Notizen',
    'Hackenschmidt;Beine;Hantelscheiben;"92,5";kg;3;10;Stufe 2;"Tief beugen, Knie stabil"',
    'Wadenheben stehend;Beine;Steckgewichte / Block;67,5;kg;4;15;Stufe 4;Volle Dehnung',
  ].join('\n');
  const parsedDE = importMachinesFromCSV(germanExcelCSV);
  assert.equal(parsedDE.length, 2);
  assert.equal(parsedDE[0].name, 'Hackenschmidt');
  assert.equal(parsedDE[0].targetWeight, 92.5);
  assert.equal(parsedDE[0].notes, 'Tief beugen, Knie stabil');
  assert.equal(parsedDE[1].name, 'Wadenheben stehend');
  assert.equal(parsedDE[1].targetWeight, 67.5);

  // Export & re-import workouts CSV roundtrip
  const chest = store.machines.find((m) => m.name === 'Brustpresse');
  const session = prepareSessionForMachine(chest);
  session.sets[0].isCompleted = true;
  session.sets[1].isCompleted = true;
  store.sessions = [session];

  const csvOut = exportWorkoutsToCSV(store.sessions, true);
  assert.equal(csvOut.charCodeAt(0), 0xfeff, 'Includes UTF-8 BOM for Excel');
  const reimported = importWorkoutsFromCSV(csvOut, store.machines);
  assert.equal(reimported.length, 1);
  assert.equal(reimported[0].sets.length, chest.targetSets);

  const machinesCsv = exportMachinesToCSV(store.machines, true);
  assert.equal(machinesCsv.charCodeAt(0), 0xfeff);

  // Full Backup JSON roundtrip
  const backupJson = createFullBackupPayload({
    machines: store.machines,
    sessions: store.sessions,
    settings: store.settings,
  });
  const parsedFull = parseBackupJSON(backupJson);
  assert.equal(parsedFull.machines.length, 18);
  assert.equal(parsedFull.sessions.length, 1);

  // Legacy iOS sessions-only JSON array (with old random machineId + Apple epoch timestamp)
  const legacySessionsJson = JSON.stringify([
    {
      id: 'legacy-sess-1',
      machineId: 'OLD-IOS-UUID-999',
      machineName: 'Brustpresse',
      muscleGroup: 'Brust',
      date: 808920000,
      weightUnit: 'kg',
      sets: [
        { id: 's1', setNumber: 1, weight: 40, reps: 12, isCompleted: true },
        { id: 's2', setNumber: 2, weight: 40, reps: 12, isCompleted: true },
      ],
    },
  ]);
  const parsedLegacy = parseBackupJSON(legacySessionsJson);
  const freshStore = new GymLogStore();
  freshStore.ensureDefaultsIfEmpty();
  freshStore.restoreBackup(parsedLegacy, 'replace');

  const freshChest = freshStore.machines.find((m) => m.name === 'Brustpresse');
  assert.equal(freshStore.sessions.length, 1);
  assert.equal(
    freshStore.sessions[0].machineId,
    freshChest.id,
    'Remaps legacy iOS session machineId to matching WebApp machine by name'
  );
});

test('All views & SVG Progression Charts render cleanly and escape XSS payloads', () => {
  const store = new GymLogStore();
  store.ensureDefaultsIfEmpty();

  const xssMachine = store.addMachine({
    name: '<script>alert("xss")</script> Rudern',
    muscleGroup: 'Rücken',
    targetWeight: 55,
    notes: '<img src=x onerror=alert(1)>',
  });

  // Add 2 sessions so interactive SVG progression chart renders full curve
  store.sessions = [
    createWorkoutSession({
      id: 'sess-1',
      machineId: xssMachine.id,
      machineName: xssMachine.name,
      muscleGroup: 'Rücken',
      date: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
      weightUnit: 'kg',
      sets: [{ setNumber: 1, weight: 50, reps: 10, isCompleted: true }],
    }),
    createWorkoutSession({
      id: 'sess-2',
      machineId: xssMachine.id,
      machineName: xssMachine.name,
      muscleGroup: 'Rücken',
      date: new Date().toISOString(),
      weightUnit: 'kg',
      sets: [{ setNumber: 1, weight: 55, reps: 10, isCompleted: true }],
    }),
  ];

  const points = buildChartDataPoints(xssMachine, store.sessions, 'maxWeight', 'all', 'kg');
  assert.equal(points.length, 2);

  const chartHtml = renderProgressionChartCard(xssMachine, store.sessions, 'maxWeight', 'all', 'kg');
  assert.ok(chartHtml.includes('<svg class="progression-svg"'));
  assert.ok(!chartHtml.includes('<script>alert'));

  store.startWorkout(xssMachine.id);
  store.startRestTimer(90, false);

  const detailHtml = renderMachineDetailView(store, xssMachine.id);
  const editModalHtml = renderMachineFormModal(xssMachine, 'kg');
  const sessionDetailHtml = renderSessionDetailModal(store, store.sessions[0].id);

  assert.ok(detailHtml.includes('LEISTUNGSKURVE'));
  assert.ok(detailHtml.includes('ZIELPLAN'));
  assert.ok(editModalHtml.includes('GERÄT BEARBEITEN'));
  assert.ok(sessionDetailHtml.includes('Ausgeführte Sätze'));

  const htmlOutputs = [
    renderDashboardView(store),
    renderMachinesListView(store),
    detailHtml,
    editModalHtml,
    renderActiveWorkoutSheet(store),
    (() => {
      store.isWorkoutOpen = false;
      const mini = renderActiveWorkoutMiniBar(store);
      store.isWorkoutOpen = true;
      return mini;
    })(),
    renderRestFloatingBar(store),
    renderRestTimerModal(store),
    renderHistoryView(store),
    sessionDetailHtml,
    renderManualSessionModal(store),
    renderSettingsView(store),
    renderRestoreBackupModal(),
    renderCSVImportModal(),
  ];

  for (const html of htmlOutputs) {
    assert.equal(typeof html, 'string');
    assert.ok(html.length > 40);
    assert.ok(!html.includes('<script>alert("xss")</script>'), 'Must escape script tags');
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'Must escape raw HTML tags');
  }
});
