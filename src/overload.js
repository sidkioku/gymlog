import { getCompletedSets, TRAINABLE_MUSCLE_GROUPS } from './models.js';
import { convertWeight, formatNumber } from './weight.js';

/**
 * Evaluates whether a machine is ready for Progressive Overload based on its most recent completed session.
 */
export function evaluateOverload(machine, sessions) {
  if (!machine || !Array.isArray(sessions)) return null;

  const machineSessions = sessions
    .filter((s) => s.machineId === machine.id && getCompletedSets(s).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastSession = machineSessions[0];
  if (!lastSession) return null;

  const completedSets = getCompletedSets(lastSession);
  if (!completedSets.length) return null;

  // Normalize completed set weights into machine's current unit if units ever differed
  const normalizedSets = completedSets.map((s) => ({
    ...s,
    weightInMachineUnit: convertWeight(s.weight, lastSession.weightUnit || machine.weightUnit, machine.weightUnit),
  }));

  const completedAllSets = normalizedSets.length >= machine.targetSets;
  const metTargetRepsOnAllSets = normalizedSets.every((s) => s.reps >= machine.targetReps);
  const metTargetWeight = normalizedSets.every(
    (s) => s.weightInMachineUnit + 0.01 >= machine.targetWeight
  );

  const isReady = completedAllSets && metTargetRepsOnAllSets && metTargetWeight;
  const increment = machine.weightIncrement > 0 ? machine.weightIncrement : 2.5;

  if (isReady) {
    const newWeight = Math.round((machine.targetWeight + increment) * 100) / 100;
    const percent =
      machine.targetWeight > 0
        ? ((newWeight - machine.targetWeight) / machine.targetWeight) * 100
        : 0;

    return {
      machineId: machine.id,
      machineName: machine.name,
      currentWeight: machine.targetWeight,
      suggestedWeight: newWeight,
      increment,
      weightUnit: machine.weightUnit,
      currentReps: machine.targetReps,
      suggestedReps: machine.targetReps,
      reason: `Alle ${completedSets.length} Sätze mit mind. ${machine.targetReps} Wdh. @ ${formatNumber(machine.targetWeight)} ${machine.weightUnit} gemeistert! Bereit für +${formatNumber(increment)} ${machine.weightUnit}.`,
      percentageIncrease: percent,
      isReadyForIncrease: true,
    };
  }

  const maxRepsAchieved = Math.max(...completedSets.map((s) => s.reps));
  return {
    machineId: machine.id,
    machineName: machine.name,
    currentWeight: machine.targetWeight,
    suggestedWeight: machine.targetWeight,
    increment: 0,
    weightUnit: machine.weightUnit,
    currentReps: maxRepsAchieved,
    suggestedReps: machine.targetReps,
    reason: `Fokus auf saubere ${machine.targetReps} Wdh. in allen ${machine.targetSets} Sätzen vor der nächsten Erhöhung.`,
    percentageIncrease: 0,
    isReadyForIncrease: false,
  };
}

export function evaluateAllOverloads(machines, sessions) {
  if (!Array.isArray(machines) || !Array.isArray(sessions)) return [];
  return machines
    .map((m) => evaluateOverload(m, sessions))
    .filter((rec) => rec && rec.isReadyForIncrease);
}

export function getPersonalRecord(machineId, sessions, targetUnit = 'kg') {
  if (!machineId || !Array.isArray(sessions)) return null;
  let bestWeight = 0;
  let bestReps = 0;
  let bestDate = null;
  let best1RM = 0;

  for (const session of sessions) {
    if (session.machineId !== machineId) continue;
    for (const set of getCompletedSets(session)) {
      const w = convertWeight(set.weight, session.weightUnit || 'kg', targetUnit);
      if (w > bestWeight || (Math.abs(w - bestWeight) < 0.01 && set.reps > bestReps)) {
        bestWeight = Math.round(w * 100) / 100;
        bestReps = set.reps;
        bestDate = session.date;
      }
      const oneRM = w * (1 + set.reps / 30);
      if (oneRM > best1RM) {
        best1RM = Math.round(oneRM * 10) / 10;
      }
    }
  }

  return bestWeight > 0 ? { weight: bestWeight, reps: bestReps, date: bestDate, best1RM, unit: targetUnit } : null;
}

export function computeMuscleHeatmapStats(sessions, machines, days = 7, preferredUnit = 'kg') {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const relevantSessions = (sessions || []).filter(
    (s) => new Date(s.date).getTime() >= cutoffMs
  );

  const machineGroupById = new Map();
  for (const m of machines || []) {
    machineGroupById.set(m.id, m.muscleGroup);
  }

  const heatmapGroups = TRAINABLE_MUSCLE_GROUPS.filter((g) => g.id !== 'Ganzkörper');

  return heatmapGroups.map((mg) => {
    const groupSessions = relevantSessions.filter((s) => {
      const mGroup = machineGroupById.get(s.machineId) || s.muscleGroup;
      return mGroup === mg.id;
    });

    let setsCount = 0;
    let volume = 0;
    let lastTrainedDate = null;

    for (const s of groupSessions) {
      const completed = getCompletedSets(s);
      if (!completed.length) continue;
      setsCount += completed.length;
      for (const set of completed) {
        const w = convertWeight(set.weight, s.weightUnit || 'kg', preferredUnit);
        volume += w * set.reps;
      }
      if (!lastTrainedDate || new Date(s.date).getTime() > new Date(lastTrainedDate).getTime()) {
        lastTrainedDate = s.date;
      }
    }

    let intensityLevel = 0;
    if (setsCount >= 14) intensityLevel = 3;
    else if (setsCount >= 6) intensityLevel = 2;
    else if (setsCount > 0) intensityLevel = 1;

    return {
      muscleGroup: mg.id,
      meta: mg,
      setsCount,
      volume: Math.round(volume),
      lastTrainedDate,
      intensityLevel,
    };
  });
}
