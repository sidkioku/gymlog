export const MUSCLE_GROUPS = [
  { id: 'Alle', label: 'Alle', color: '#C3F400', icon: 'grid' },
  { id: 'Brust', label: 'Brust', color: '#C3F400', icon: 'chest' },
  { id: 'Rücken', label: 'Rücken', color: '#00DBE9', icon: 'back' },
  { id: 'Beine', label: 'Beine', color: '#FF571A', icon: 'legs' },
  { id: 'Schultern', label: 'Schultern', color: '#BF7AFF', icon: 'shoulders' },
  { id: 'Arme', label: 'Arme', color: '#FF6EA7', icon: 'arms' },
  { id: 'Bauch', label: 'Bauch', color: '#FFDB58', icon: 'core' },
  { id: 'Ganzkörper', label: 'Ganzkörper', color: '#7DF4FF', icon: 'fullbody' },
];

export const TRAINABLE_MUSCLE_GROUPS = MUSCLE_GROUPS.filter((g) => g.id !== 'Alle');

export const MACHINE_TYPES = [
  { id: 'Steckgewichte / Block', instruction: 'Steckgewicht einstellen' },
  { id: 'Hantelscheiben', instruction: 'Scheiben aufladen' },
  { id: 'Kabelzug', instruction: 'Kabelzug-Gewicht' },
  { id: 'Multipresse', instruction: 'Stange + Scheiben' },
  { id: 'Eigengewicht / Assist', instruction: 'Gegengewicht / Assist' },
];

export const WEIGHT_UNITS = ['kg', 'lbs'];
export const REST_PRESETS = [45, 60, 90, 120, 180];
export const INCREMENT_OPTIONS = [1.25, 2.5, 5.0, 10.0];

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getMuscleMeta(muscleGroup) {
  return MUSCLE_GROUPS.find((m) => m.id === muscleGroup) || MUSCLE_GROUPS[0];
}

export function getMachineInstruction(machineType) {
  const found = MACHINE_TYPES.find((t) => t.id === machineType);
  return found ? found.instruction : 'Gewicht einstellen';
}

export function normalizeDateISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Support Apple/Swift reference date (seconds since 2001-01-01) if < 1e11 and > 5e8, or Unix ms/s
    // Note: Swift JSONEncoder default DateEncodingStrategy is .deferredToDate (timeIntervalSinceReferenceDate: 2001-01-01T00:00:00Z = 978307200s Unix)
    if (val > 500_000_000 && val < 1_500_000_000) {
      // Ambiguous range: ~2017-2048 in Apple ref date vs ~1985-2017 in Unix seconds.
      // GymLog iOS app was used in 2026: 2026 in Apple ref date is ~790_000_000!
      const appleEpochOffsetMs = 978307200 * 1000;
      return new Date(val * 1000 + appleEpochOffsetMs).toISOString();
    }
    if (val >= 1_500_000_000 && val < 10_000_000_000) {
      return new Date(val * 1000).toISOString();
    }
    return new Date(val).toISOString();
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function createMachine(raw = {}) {
  const validGroups = new Set(MUSCLE_GROUPS.map((g) => g.id));
  const validTypes = new Set(MACHINE_TYPES.map((t) => t.id));
  const muscleGroup = validGroups.has(raw.muscleGroup) ? raw.muscleGroup : 'Brust';
  const machineType = validTypes.has(raw.machineType) ? raw.machineType : 'Steckgewichte / Block';
  const weightUnit = raw.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const targetWeight = Math.max(0, Number.isFinite(Number(raw.targetWeight)) ? Number(raw.targetWeight) : 40);
  const targetSets = Math.max(1, Math.min(30, Math.round(Number(raw.targetSets) || 3)));
  const targetReps = Math.max(1, Math.min(200, Math.round(Number(raw.targetReps) || 10)));
  const inc = Number(raw.weightIncrement);
  const weightIncrement = Number.isFinite(inc) && inc > 0 ? inc : 2.5;

  return {
    id: raw.id ? String(raw.id) : generateId(),
    name: String(raw.name || 'Unbenanntes Gerät').trim() || 'Unbenanntes Gerät',
    muscleGroup,
    machineType,
    targetWeight: Math.round(targetWeight * 100) / 100,
    targetSets,
    targetReps,
    weightUnit,
    weightIncrement,
    seatHeight: String(raw.seatHeight ?? '').trim(),
    backrestAngle: String(raw.backrestAngle ?? '').trim(),
    pinPosition: String(raw.pinPosition ?? '').trim(),
    attachment: String(raw.attachment ?? '').trim(),
    notes: String(raw.notes ?? '').trim(),
    isFavorite: Boolean(raw.isFavorite),
    lastUsedDate: raw.lastUsedDate ? normalizeDateISO(raw.lastUsedDate) : null,
    createdAt: raw.createdAt ? normalizeDateISO(raw.createdAt) : new Date().toISOString(),
  };
}

export function hasSetupAdjustments(machine) {
  return Boolean(
    machine.seatHeight ||
      machine.backrestAngle ||
      machine.pinPosition ||
      machine.attachment
  );
}

export function createWorkoutSet(raw = {}, fallbackIndex = 1) {
  const weight = Math.max(0, Number.isFinite(Number(raw.weight)) ? Number(raw.weight) : 0);
  const reps = Math.max(1, Math.round(Number(raw.reps) || 1));
  const isCompleted = Boolean(raw.isCompleted);
  return {
    id: raw.id ? String(raw.id) : generateId(),
    setNumber: Math.max(1, Math.round(Number(raw.setNumber) || fallbackIndex)),
    weight: Math.round(weight * 100) / 100,
    reps,
    isCompleted,
    rpe: raw.rpe != null && Number.isFinite(Number(raw.rpe)) ? Number(raw.rpe) : null,
    completedAt: isCompleted ? normalizeDateISO(raw.completedAt || new Date().toISOString()) : null,
  };
}

export function createWorkoutSession(raw = {}) {
  const sets = Array.isArray(raw.sets)
    ? raw.sets.map((s, idx) => createWorkoutSet(s, idx + 1))
    : [];
  const validGroups = new Set(MUSCLE_GROUPS.map((g) => g.id));
  return {
    id: raw.id ? String(raw.id) : generateId(),
    machineId: String(raw.machineId || ''),
    machineName: String(raw.machineName || 'Gerät').trim(),
    muscleGroup: validGroups.has(raw.muscleGroup) ? raw.muscleGroup : 'Alle',
    date: normalizeDateISO(raw.date || new Date().toISOString()),
    sets,
    weightUnit: raw.weightUnit === 'lbs' ? 'lbs' : 'kg',
    seatHeightUsed: String(raw.seatHeightUsed ?? '').trim(),
    backrestAngleUsed: String(raw.backrestAngleUsed ?? '').trim(),
    pinPositionUsed: String(raw.pinPositionUsed ?? '').trim(),
    attachmentUsed: String(raw.attachmentUsed ?? '').trim(),
    notes: String(raw.notes ?? '').trim(),
  };
}

export function prepareSessionForMachine(machine) {
  const count = Math.max(1, machine.targetSets || 3);
  const sets = [];
  for (let i = 1; i <= count; i++) {
    sets.push(
      createWorkoutSet({
        setNumber: i,
        weight: machine.targetWeight,
        reps: machine.targetReps,
        isCompleted: false,
      })
    );
  }
  return createWorkoutSession({
    machineId: machine.id,
    machineName: machine.name,
    muscleGroup: machine.muscleGroup,
    date: new Date().toISOString(),
    sets,
    weightUnit: machine.weightUnit,
    seatHeightUsed: machine.seatHeight,
    backrestAngleUsed: machine.backrestAngle,
    pinPositionUsed: machine.pinPosition,
    attachmentUsed: machine.attachment,
    notes: '',
  });
}

export function getCompletedSets(session) {
  if (!session || !Array.isArray(session.sets)) return [];
  return session.sets.filter((s) => s.isCompleted);
}

export function getSessionTotalVolume(session) {
  return getCompletedSets(session).reduce((acc, s) => acc + s.weight * s.reps, 0);
}

export function getSessionMaxWeight(session) {
  const completed = getCompletedSets(session);
  if (!completed.length) return 0;
  return Math.max(...completed.map((s) => s.weight));
}

export function getSessionBest1RM(session) {
  const completed = getCompletedSets(session);
  if (!completed.length) return 0;
  return Math.max(...completed.map((s) => s.weight * (1 + s.reps / 30)));
}

export function getDefaultMachines() {
  const defaults = [
    {
      name: 'Brustpresse',
      muscleGroup: 'Brust',
      machineType: 'Steckgewichte / Block',
      targetWeight: 36.0,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
      isFavorite: true,
    },
    {
      name: 'Latziehen',
      muscleGroup: 'Rücken',
      machineType: 'Kabelzug',
      targetWeight: 42.5,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
      isFavorite: true,
    },
    {
      name: 'Beinpresse',
      muscleGroup: 'Beine',
      machineType: 'Hantelscheiben',
      targetWeight: 130.0,
      targetSets: 2,
      targetReps: 10,
      weightUnit: 'kg',
      weightIncrement: 5.0,
      notes: 'Zielbereich: 8-10 Wdh.',
      isFavorite: true,
    },
    {
      name: 'Shoulder Press',
      muscleGroup: 'Schultern',
      machineType: 'Steckgewichte / Block',
      targetWeight: 23.0,
      targetSets: 3,
      targetReps: 8,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 6-8 Wdh.',
      isFavorite: true,
    },
    {
      name: 'Pectoral Machine',
      muscleGroup: 'Brust',
      machineType: 'Steckgewichte / Block',
      targetWeight: 25.0,
      targetSets: 2,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Chest Incline',
      muscleGroup: 'Brust',
      machineType: 'Steckgewichte / Block',
      targetWeight: 25.0,
      targetSets: 3,
      targetReps: 10,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-10 Wdh.',
    },
    {
      name: 'Low Row',
      muscleGroup: 'Rücken',
      machineType: 'Steckgewichte / Block',
      targetWeight: 45.0,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Einseitig Low Row',
      muscleGroup: 'Rücken',
      machineType: 'Steckgewichte / Block',
      targetWeight: 35.0,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Upper Back',
      muscleGroup: 'Rücken',
      machineType: 'Steckgewichte / Block',
      targetWeight: 35.0,
      targetSets: 2,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Lower Back',
      muscleGroup: 'Rücken',
      machineType: 'Steckgewichte / Block',
      targetWeight: 68.0,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Leg Extension',
      muscleGroup: 'Beine',
      machineType: 'Steckgewichte / Block',
      targetWeight: 50.0,
      targetSets: 2,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Leg Curl',
      muscleGroup: 'Beine',
      machineType: 'Steckgewichte / Block',
      targetWeight: 57.5,
      targetSets: 2,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Wadenheben',
      muscleGroup: 'Beine',
      machineType: 'Steckgewichte / Block',
      targetWeight: 45.0,
      targetSets: 4,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Delts Machine',
      muscleGroup: 'Schultern',
      machineType: 'Steckgewichte / Block',
      targetWeight: 25.5,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 10-12 Wdh.',
    },
    {
      name: 'Arm Curl einseitig',
      muscleGroup: 'Arme',
      machineType: 'Steckgewichte / Block',
      targetWeight: 12.5,
      targetSets: 2,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 1.25,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Arm Extension',
      muscleGroup: 'Arme',
      machineType: 'Steckgewichte / Block',
      targetWeight: 45.0,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Abdominal Crunch',
      muscleGroup: 'Bauch',
      machineType: 'Steckgewichte / Block',
      targetWeight: 42.1,
      targetSets: 3,
      targetReps: 12,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 8-12 Wdh.',
    },
    {
      name: 'Rotary Torso',
      muscleGroup: 'Bauch',
      machineType: 'Steckgewichte / Block',
      targetWeight: 35.0,
      targetSets: 3,
      targetReps: 8,
      weightUnit: 'kg',
      weightIncrement: 2.5,
      notes: 'Zielbereich: 6-8 Wdh.',
    },
  ];

  return defaults.map((m) => createMachine(m));
}
