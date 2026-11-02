import {
  createMachine,
  createWorkoutSession,
  createWorkoutSet,
  getCompletedSets,
  getDefaultMachines,
  prepareSessionForMachine,
} from './models.js';
import { convertWeight, roundConvertedWeight } from './weight.js';
import { importMachinesFromCSV, importWorkoutsFromCSV } from './csv.js';

export class GymLogStore {
  constructor(storageEngine = null) {
    this.storage = storageEngine;
    this.listeners = new Set();

    // Persisted domain state
    this.machines = [];
    this.sessions = [];
    this.activeSession = null;
    this.activeMachineId = null;
    this.isWorkoutOpen = false;
    this.restEndTime = null;
    this.restTotalDuration = 90;

    this.settings = {
      preferredUnit: 'kg',
      defaultRestDuration: 90,
      soundEnabled: true,
      keepScreenAwake: true,
      hideInstallBanner: false,
      lastFileBackupAt: null,
      workoutFocusMode: true,
    };

    // Ephemeral UI state
    this.ui = {
      activeTab: 'home', // 'home' | 'machines' | 'history' | 'settings'
      selectedMachineDetailId: null,
      selectedSessionDetailId: null,
      selectedMuscleFilter: 'Alle',
      searchQuery: '',
      onlyFavoritesFilter: false,
      historyMuscleFilter: 'Alle',
      historyMachineFilter: '',
      heatmapDays: 7,
      heatmapSelectedMuscle: null,
      chartMetric: 'maxWeight', // 'maxWeight' | 'oneRM' | 'volume'
      chartRange: 'month', // 'last5' | 'month' | 'threeMonths' | 'all'
    };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(reason = 'update') {
    for (const fn of this.listeners) {
      fn(this, reason);
    }
  }

  toPersistedSnapshot() {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      machines: this.machines,
      sessions: this.sessions,
      activeSession: this.activeSession,
      activeMachineId: this.activeMachineId,
      isWorkoutOpen: this.isWorkoutOpen,
      restEndTime: this.restEndTime,
      restTotalDuration: this.restTotalDuration,
      settings: this.settings,
    };
  }

  hydrateFromSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    if (Array.isArray(snap.machines) && snap.machines.length > 0) {
      this.machines = snap.machines.map((m) => createMachine(m));
    }
    if (Array.isArray(snap.sessions)) {
      this.sessions = snap.sessions
        .map((s) => createWorkoutSession(s))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    if (snap.settings && typeof snap.settings === 'object') {
      this.settings = {
        ...this.settings,
        ...snap.settings,
        preferredUnit: snap.settings.preferredUnit === 'lbs' ? 'lbs' : 'kg',
        defaultRestDuration: Number(snap.settings.defaultRestDuration) || 90,
      };
    }
    if (snap.activeSession) {
      this.activeSession = createWorkoutSession(snap.activeSession);
      this.activeMachineId = snap.activeMachineId || this.activeSession.machineId;
      this.isWorkoutOpen = Boolean(snap.isWorkoutOpen);
    } else {
      this.activeSession = null;
      this.activeMachineId = null;
      this.isWorkoutOpen = false;
    }

    if (snap.restEndTime && Number(snap.restEndTime) > Date.now()) {
      this.restEndTime = Number(snap.restEndTime);
      this.restTotalDuration = Number(snap.restTotalDuration) || this.settings.defaultRestDuration;
    } else {
      this.restEndTime = null;
    }
    return true;
  }

  ensureDefaultsIfEmpty() {
    if (!this.machines.length) {
      this.machines = getDefaultMachines();
      if (this.settings.preferredUnit === 'lbs') {
        this._convertAllMachinesToUnit('lbs');
      }
      this.persist();
    }
  }

  persist() {
    if (this.storage) {
      this.storage.saveState(this.toPersistedSnapshot());
    }
  }

  // --- Computed Getters ---
  get activeMachine() {
    if (!this.activeMachineId) return null;
    return this.machines.find((m) => m.id === this.activeMachineId) || null;
  }

  get filteredMachines() {
    const q = this.ui.searchQuery.trim().toLowerCase();
    return this.machines
      .filter((m) => {
        const matchesCat =
          this.ui.selectedMuscleFilter === 'Alle' ||
          m.muscleGroup === this.ui.selectedMuscleFilter;
        const matchesFav = !this.ui.onlyFavoritesFilter || m.isFavorite;
        const matchesQuery =
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.muscleGroup.toLowerCase().includes(q) ||
          m.notes.toLowerCase().includes(q) ||
          m.seatHeight.toLowerCase().includes(q) ||
          m.pinPosition.toLowerCase().includes(q) ||
          m.attachment.toLowerCase().includes(q);
        return matchesCat && matchesFav && matchesQuery;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.lastUsedDate && b.lastUsedDate) {
          return new Date(b.lastUsedDate).getTime() - new Date(a.lastUsedDate).getTime();
        }
        if (a.lastUsedDate && !b.lastUsedDate) return -1;
        if (!a.lastUsedDate && b.lastUsedDate) return 1;
        return a.name.localeCompare(b.name, 'de');
      });
  }

  get favoriteMachines() {
    return this.machines
      .filter((m) => m.isFavorite)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  get recentMachines() {
    return this.machines
      .filter((m) => Boolean(m.lastUsedDate))
      .sort((a, b) => new Date(b.lastUsedDate).getTime() - new Date(a.lastUsedDate).getTime());
  }

  getHistoryForMachine(machineId) {
    return this.sessions
      .filter((s) => s.machineId === machineId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getPreviousSetPerformance(machineId, setIndex) {
    const lastSession = this.getHistoryForMachine(machineId)[0];
    if (!lastSession || !Array.isArray(lastSession.sets)) return null;
    const prevSet = lastSession.sets[setIndex];
    if (!prevSet) return null;
    return {
      weight: prevSet.weight,
      reps: prevSet.reps,
      unit: lastSession.weightUnit || 'kg',
    };
  }

  getRestRemainingSeconds(nowMs = Date.now()) {
    if (!this.restEndTime) return 0;
    const diff = Math.ceil((this.restEndTime - nowMs) / 1000);
    return Math.max(0, diff);
  }

  isRestTimerRunning(nowMs = Date.now()) {
    return Boolean(this.restEndTime && this.restEndTime > nowMs);
  }

  // --- Settings & Units ---
  _convertAllMachinesToUnit(newUnit) {
    this.machines = this.machines.map((m) => {
      if (m.weightUnit === newUnit) return m;
      const converted = convertWeight(m.targetWeight, m.weightUnit, newUnit);
      return {
        ...m,
        targetWeight: roundConvertedWeight(converted, newUnit),
        weightUnit: newUnit,
        weightIncrement: 2.5,
      };
    });

    if (this.activeSession && this.activeSession.weightUnit !== newUnit) {
      const oldUnit = this.activeSession.weightUnit;
      this.activeSession = {
        ...this.activeSession,
        weightUnit: newUnit,
        sets: this.activeSession.sets.map((s) => ({
          ...s,
          weight: roundConvertedWeight(convertWeight(s.weight, oldUnit, newUnit), newUnit),
        })),
      };
    }
  }

  setPreferredUnit(newUnit) {
    const valid = newUnit === 'lbs' ? 'lbs' : 'kg';
    if (this.settings.preferredUnit === valid) return;
    this.settings.preferredUnit = valid;
    this._convertAllMachinesToUnit(valid);
    this.persist();
    this.notify('unit');
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    this.persist();
    this.notify('settings');
  }

  // --- Machine CRUD ---
  addMachine(rawMachine) {
    const machine = createMachine({
      ...rawMachine,
      weightUnit: rawMachine.weightUnit || this.settings.preferredUnit,
    });
    this.machines.push(machine);
    this.persist();
    this.notify('machines');
    return machine;
  }

  updateMachine(id, updates) {
    const idx = this.machines.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.machines[idx] = createMachine({
      ...this.machines[idx],
      ...updates,
      id,
    });
    this.persist();
    this.notify('machines');
    return this.machines[idx];
  }

  deleteMachine(id) {
    this.machines = this.machines.filter((m) => m.id !== id);
    if (this.ui.selectedMachineDetailId === id) {
      this.ui.selectedMachineDetailId = null;
    }
    this.persist();
    this.notify('machines');
  }

  toggleFavorite(id) {
    const idx = this.machines.findIndex((m) => m.id === id);
    if (idx === -1) return;
    this.machines[idx] = {
      ...this.machines[idx],
      isFavorite: !this.machines[idx].isFavorite,
    };
    this.persist();
    this.notify('machines');
  }

  updateTargetWeight(machineId, newWeight) {
    const idx = this.machines.findIndex((m) => m.id === machineId);
    if (idx === -1) return;
    const clamped = Math.max(0, Math.round(Number(newWeight) * 100) / 100);
    this.machines[idx] = {
      ...this.machines[idx],
      targetWeight: clamped,
    };
    this.persist();
    this.notify('machines');
  }

  applyOverloadRecommendation(rec) {
    if (!rec) return;
    const idx = this.machines.findIndex((m) => m.id === rec.machineId);
    if (idx === -1) return;
    this.machines[idx] = {
      ...this.machines[idx],
      targetWeight: Math.max(0, Math.round(rec.suggestedWeight * 100) / 100),
      targetReps: rec.suggestedReps || this.machines[idx].targetReps,
    };
    this.persist();
    this.notify('overload');
  }

  // --- Active Workout Lifecycle ---
  startWorkout(machineId) {
    const machine = this.machines.find((m) => m.id === machineId);
    if (!machine) return null;

    if (this.activeSession && this.activeMachineId === machineId) {
      this.isWorkoutOpen = true;
      this.persist();
      this.notify('workout');
      return this.activeSession;
    }

    this.activeMachineId = machine.id;
    this.activeSession = prepareSessionForMachine(machine);
    this.isWorkoutOpen = true;
    this.stopRestTimer(false);
    this.persist();
    this.notify('workout');
    return this.activeSession;
  }

  resumeWorkout() {
    if (!this.activeSession) return;
    this.isWorkoutOpen = true;
    this.persist();
    this.notify('workout');
  }

  minimizeWorkout() {
    this.isWorkoutOpen = false;
    this.persist();
    this.notify('workout');
  }

  cancelActiveWorkout() {
    this.activeSession = null;
    this.activeMachineId = null;
    this.isWorkoutOpen = false;
    this.stopRestTimer(false);
    this.persist();
    this.notify('workout');
  }

  toggleSetCompleted(setIndex, forceValue = null) {
    if (!this.activeSession || setIndex < 0 || setIndex >= this.activeSession.sets.length) {
      return null;
    }
    const targetSet = this.activeSession.sets[setIndex];
    const nextCompleted = forceValue !== null ? Boolean(forceValue) : !targetSet.isCompleted;

    const updatedSets = this.activeSession.sets.map((s, idx) =>
      idx === setIndex
        ? {
            ...s,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : null,
          }
        : s
    );

    this.activeSession = {
      ...this.activeSession,
      sets: updatedSets,
    };

    if (nextCompleted) {
      this.startRestTimer(this.settings.defaultRestDuration, false);
    }

    this.persist();
    this.notify('workout-set');
    return nextCompleted;
  }

  updateActiveSet(setIndex, partial) {
    if (!this.activeSession || setIndex < 0 || setIndex >= this.activeSession.sets.length) return;
    const current = this.activeSession.sets[setIndex];
    const nextWeight =
      partial.weight !== undefined
        ? Math.max(0, Math.round(Number(partial.weight) * 100) / 100)
        : current.weight;
    const nextReps =
      partial.reps !== undefined
        ? Math.max(1, Math.min(500, Math.round(Number(partial.reps))))
        : current.reps;

    const updatedSets = this.activeSession.sets.map((s, idx) =>
      idx === setIndex ? { ...s, weight: nextWeight, reps: nextReps } : s
    );
    this.activeSession = { ...this.activeSession, sets: updatedSets };
    this.persist();
    this.notify('workout-set');
  }

  bumpOpenSetsWeight(delta) {
    if (!this.activeSession) return;
    const d = Number(delta) || 0;
    const updatedSets = this.activeSession.sets.map((s) =>
      s.isCompleted
        ? s
        : {
            ...s,
            weight: Math.max(0, Math.round((s.weight + d) * 100) / 100),
          }
    );
    this.activeSession = { ...this.activeSession, sets: updatedSets };
    this.persist();
    this.notify('workout-set');
  }

  addSetToActiveWorkout() {
    if (!this.activeSession) return null;
    const sets = this.activeSession.sets;
    const last = sets[sets.length - 1];
    const machine = this.activeMachine;
    const newSet = createWorkoutSet({
      setNumber: sets.length + 1,
      weight: last ? last.weight : machine?.targetWeight || 40,
      reps: last ? last.reps : machine?.targetReps || 10,
      isCompleted: false,
    });
    this.activeSession = {
      ...this.activeSession,
      sets: [...sets, newSet],
    };
    this.persist();
    this.notify('workout-set');
    return newSet;
  }

  removeLastSetFromActiveWorkout() {
    if (!this.activeSession || this.activeSession.sets.length <= 1) return false;
    this.activeSession = {
      ...this.activeSession,
      sets: this.activeSession.sets.slice(0, -1),
    };
    this.persist();
    this.notify('workout-set');
    return true;
  }

  updateActiveWorkoutMeta(partial) {
    if (!this.activeSession) return;
    this.activeSession = {
      ...this.activeSession,
      ...(partial.notes !== undefined ? { notes: String(partial.notes) } : {}),
      ...(partial.seatHeightUsed !== undefined ? { seatHeightUsed: String(partial.seatHeightUsed).trim() } : {}),
      ...(partial.pinPositionUsed !== undefined ? { pinPositionUsed: String(partial.pinPositionUsed).trim() } : {}),
    };
    this.persist();
    this.notify('workout-meta');
  }

  finishActiveWorkout() {
    if (!this.activeSession) return null;
    const completedSets = getCompletedSets(this.activeSession);
    if (!completedSets.length) return null;

    const nowIso = new Date().toISOString();
    const finalizedSession = createWorkoutSession({
      ...this.activeSession,
      date: nowIso,
    });

    this.sessions = [finalizedSession, ...this.sessions];

    const mIdx = this.machines.findIndex((m) => m.id === finalizedSession.machineId);
    if (mIdx >= 0) {
      const highestWeight = Math.max(...completedSets.map((s) => s.weight));
      const updatedMachine = {
        ...this.machines[mIdx],
        lastUsedDate: nowIso,
      };
      if (highestWeight > 0) {
        updatedMachine.targetWeight = highestWeight;
      }
      if (finalizedSession.seatHeightUsed) {
        updatedMachine.seatHeight = finalizedSession.seatHeightUsed;
      }
      if (finalizedSession.pinPositionUsed) {
        updatedMachine.pinPosition = finalizedSession.pinPositionUsed;
      }
      this.machines[mIdx] = updatedMachine;
    }

    this.activeSession = null;
    this.activeMachineId = null;
    this.isWorkoutOpen = false;
    this.stopRestTimer(false);
    this.persist();
    this.notify('workout-finished');
    return finalizedSession;
  }

  // --- Rest Timer (Wall-Clock Accurate!) ---
  startRestTimer(durationSeconds = null, shouldNotify = true) {
    const dur = Math.max(5, Number(durationSeconds) || this.settings.defaultRestDuration || 90);
    this.restTotalDuration = dur;
    this.restEndTime = Date.now() + dur * 1000;
    if (shouldNotify) {
      this.persist();
      this.notify('timer');
    }
  }

  addRestTime(deltaSeconds) {
    const now = Date.now();
    const currentRem = this.getRestRemainingSeconds(now);
    const nextRem = Math.max(0, currentRem + Number(deltaSeconds));
    if (nextRem <= 0) {
      this.stopRestTimer(true);
      return;
    }
    this.restTotalDuration = Math.max(this.restTotalDuration, nextRem);
    this.restEndTime = now + nextRem * 1000;
    this.persist();
    this.notify('timer');
  }

  stopRestTimer(shouldNotify = true) {
    this.restEndTime = null;
    if (shouldNotify) {
      this.persist();
      this.notify('timer');
    }
  }

  // --- History Management (Edit / Delete / Manual Log) ---
  deleteSession(sessionId) {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.ui.selectedSessionDetailId === sessionId) {
      this.ui.selectedSessionDetailId = null;
    }
    this.persist();
    this.notify('history');
  }

  updateSession(sessionId, updatedSessionRaw) {
    const idx = this.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return null;
    this.sessions[idx] = createWorkoutSession({
      ...this.sessions[idx],
      ...updatedSessionRaw,
      id: sessionId,
    });
    this.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist();
    this.notify('history');
    return this.sessions[idx];
  }

  clearAllSessions() {
    this.sessions = [];
    this.ui.selectedSessionDetailId = null;
    this.persist();
    this.notify('history');
  }

  resetToDefaultMachines() {
    this.machines = getDefaultMachines();
    if (this.settings.preferredUnit === 'lbs') {
      this._convertAllMachinesToUnit('lbs');
    }
    this.persist();
    this.notify('machines');
  }

  // --- Import / Export / Restore ---
  importMachinesCSV(csvText) {
    const imported = importMachinesFromCSV(csvText);
    if (!imported.length) return 0;

    for (const newM of imported) {
      const existingIdx = this.machines.findIndex(
        (m) => m.name.toLowerCase() === newM.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        const cur = this.machines[existingIdx];
        this.machines[existingIdx] = createMachine({
          ...cur,
          targetWeight: newM.targetWeight,
          targetSets: newM.targetSets,
          targetReps: newM.targetReps,
          weightUnit: newM.weightUnit,
          machineType: newM.machineType,
          muscleGroup: newM.muscleGroup,
          seatHeight: newM.seatHeight || cur.seatHeight,
          backrestAngle: newM.backrestAngle || cur.backrestAngle,
          pinPosition: newM.pinPosition || cur.pinPosition,
          attachment: newM.attachment || cur.attachment,
          notes: newM.notes || cur.notes,
          isFavorite: newM.isFavorite || cur.isFavorite,
        });
      } else {
        this.machines.push(newM);
      }
    }

    this.persist();
    this.notify('import');
    return imported.count ?? imported.length;
  }

  importWorkoutsCSV(csvText) {
    const importedSessions = importWorkoutsFromCSV(csvText, this.machines);
    if (!importedSessions.length) return 0;

    const existingIds = new Set(this.sessions.map((s) => s.id));
    let added = 0;
    for (const s of importedSessions) {
      if (!existingIds.has(s.id)) {
        this.sessions.push(s);
        existingIds.add(s.id);
        added++;
      }
    }
    this.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist();
    this.notify('import');
    return added;
  }

  restoreBackup(
    { machines = [], sessions = [], settings = null, isPartialMachinesOnly = false },
    mode = 'merge'
  ) {
    if (mode === 'replace') {
      if (machines.length) {
        this.machines = machines.map((m) => createMachine(m));
      }
      if (!isPartialMachinesOnly) {
        this.sessions = sessions
          .map((s) => {
            const matchedMachine =
              this.machines.find((m) => m.id === s.machineId) ||
              this.machines.find(
                (m) => m.name.toLowerCase() === String(s.machineName || '').toLowerCase()
              );
            return createWorkoutSession({
              ...s,
              machineId: matchedMachine ? matchedMachine.id : s.machineId,
              muscleGroup:
                s.muscleGroup && s.muscleGroup !== 'Alle'
                  ? s.muscleGroup
                  : matchedMachine?.muscleGroup || 'Alle',
            });
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }
      this.persist();
      this.notify('restore');
      return { machinesCount: machines.length, sessionsCount: sessions.length };
    }

    // Merge mode: preserve existing + upsert machines + add non-duplicate sessions
    let mergedMachines = 0;
    const machineIdRemap = new Map();
    for (const incoming of machines) {
      const byIdIdx = this.machines.findIndex((m) => m.id === incoming.id);
      if (byIdIdx >= 0) {
        this.machines[byIdIdx] = createMachine({ ...this.machines[byIdIdx], ...incoming });
        mergedMachines++;
        continue;
      }
      const byNameIdx = this.machines.findIndex(
        (m) => m.name.toLowerCase() === incoming.name.toLowerCase()
      );
      if (byNameIdx >= 0) {
        machineIdRemap.set(incoming.id, this.machines[byNameIdx].id);
        this.machines[byNameIdx] = createMachine({
          ...this.machines[byNameIdx],
          targetWeight: incoming.targetWeight,
          targetSets: incoming.targetSets,
          targetReps: incoming.targetReps,
          seatHeight: incoming.seatHeight || this.machines[byNameIdx].seatHeight,
          backrestAngle: incoming.backrestAngle || this.machines[byNameIdx].backrestAngle,
          pinPosition: incoming.pinPosition || this.machines[byNameIdx].pinPosition,
          attachment: incoming.attachment || this.machines[byNameIdx].attachment,
          notes: incoming.notes || this.machines[byNameIdx].notes,
        });
        mergedMachines++;
      } else {
        this.machines.push(createMachine(incoming));
        mergedMachines++;
      }
    }

    const existingSessionIds = new Set(this.sessions.map((s) => s.id));
    let mergedSessions = 0;
    for (const s of sessions) {
      const remappedMachineId = machineIdRemap.get(s.machineId) || s.machineId;
      // Fallback: match by machineName if machineId doesn't match any current machine
      const finalMachine =
        this.machines.find((m) => m.id === remappedMachineId) ||
        this.machines.find((m) => m.name.toLowerCase() === s.machineName.toLowerCase());
      const normalized = createWorkoutSession({
        ...s,
        machineId: finalMachine ? finalMachine.id : remappedMachineId,
      });
      if (!existingSessionIds.has(normalized.id)) {
        this.sessions.push(normalized);
        existingSessionIds.add(normalized.id);
        mergedSessions++;
      }
    }

    this.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    this.persist();
    this.notify('restore');
    return { machinesCount: mergedMachines, sessionsCount: mergedSessions };
  }
}
