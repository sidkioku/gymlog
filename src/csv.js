import {
  createMachine,
  createWorkoutSession,
  createWorkoutSet,
  MACHINE_TYPES,
} from './models.js';
import { parseDecimalInput } from './weight.js';

export const SAMPLE_CSV_TEMPLATE = `Gerätename,Muskelgruppe,Gerätetyp,Zielgewicht,Einheit,Zielsätze,Ziel-Wdh,Sitzhöhe,Rückenlehne,Pin-Position,Aufsatz,Notizen
Brustpresse,Brust,Steckgewichte / Block,36,kg,3,12,Sitz 4,Flach,Pin 3,,Zielbereich: 8-12 Wdh.
Latziehen,Rücken,Kabelzug,42.5,kg,3,12,Polster 3,,Obere Rolle,Breite Stange,Zur oberen Brust ziehen
Beinpresse,Beine,Hantelscheiben,130,kg,2,10,Lehne 2,,,45-Grad-Schlitten,Füße schulterbreit
Shoulder Press,Schultern,Steckgewichte / Block,23,kg,3,8,Sitz 5,,,Neutraler Griff,Zielbereich: 6-8 Wdh.
Leg Curl,Beine,Steckgewichte / Block,57.5,kg,2,12,Sitz 2,Lehne 3,Oberschenkel 1,,Langsame Negativbewegung
Arm Curl einseitig,Arme,Steckgewichte / Block,12.5,kg,2,12,Sitz 3,,,,Zielbereich: 8-12 Wdh.`;

function escapeCSV(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function detectCSVDelimiter(line) {
  let inQuote = false;
  let tabs = 0;
  let semis = 0;
  let commas = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (!inQuote) {
      if (ch === '\t') tabs++;
      else if (ch === ';') semis++;
      else if (ch === ',') commas++;
    }
  }

  if (tabs > semis && tabs > commas) return '\t';
  if (semis > commas) return ';';
  return ',';
}

export function parseCSVRow(line, explicitDelimiter = null) {
  const delimiter = explicitDelimiter || detectCSVDelimiter(line);

  const result = [];
  let current = '';
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (insideQuote && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (ch === delimiter && !insideQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result.map((col) => col.replace(/^"|"$/g, '').trim());
}

function matchMuscleGroup(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('brust') || s.includes('chest') || s.includes('pec')) return 'Brust';
  if (s.includes('rück') || s.includes('rueck') || s.includes('back') || s.includes('lat')) return 'Rücken';
  if (s.includes('bein') || s.includes('leg') || s.includes('wade') || s.includes('quad')) return 'Beine';
  if (s.includes('schulter') || s.includes('shoulder') || s.includes('delt')) return 'Schultern';
  if (s.includes('arm') || s.includes('bizeps') || s.includes('trizeps') || s.includes('curl')) return 'Arme';
  if (s.includes('bauch') || s.includes('core') || s.includes('abs') || s.includes('torso')) return 'Bauch';
  if (s.includes('ganz') || s.includes('full')) return 'Ganzkörper';
  return 'Brust';
}

function matchMachineType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const exact = MACHINE_TYPES.find((t) => t.id.toLowerCase() === s);
  if (exact) return exact.id;
  if (s.includes('kabel') || s.includes('cable')) return 'Kabelzug';
  if (s.includes('scheibe') || s.includes('plate')) return 'Hantelscheiben';
  if (s.includes('multi') || s.includes('smith')) return 'Multipresse';
  if (s.includes('eigen') || s.includes('assist') || s.includes('body')) return 'Eigengewicht / Assist';
  return 'Steckgewichte / Block';
}

export function exportMachinesToCSV(machines, includeBOM = true) {
  const header =
    'Gerätename,Muskelgruppe,Gerätetyp,Zielgewicht,Einheit,Zielsätze,Ziel-Wdh,Schrittweite,Sitzhöhe,Rückenlehne,Pin-Position,Aufsatz,Favorit,Notizen';
  const rows = (machines || []).map((m) =>
    [
      escapeCSV(m.name),
      escapeCSV(m.muscleGroup),
      escapeCSV(m.machineType),
      String(m.targetWeight),
      escapeCSV(m.weightUnit),
      String(m.targetSets),
      String(m.targetReps),
      String(m.weightIncrement || 2.5),
      escapeCSV(m.seatHeight),
      escapeCSV(m.backrestAngle),
      escapeCSV(m.pinPosition),
      escapeCSV(m.attachment),
      m.isFavorite ? 'JA' : 'NEIN',
      escapeCSV(m.notes),
    ].join(',')
  );
  const content = [header, ...rows].join('\n') + '\n';
  return includeBOM ? '\uFEFF' + content : content;
}

export function exportWorkoutsToCSV(sessions, includeBOM = true) {
  const header =
    'SessionID,Datum,GerätID,Gerätename,Muskelgruppe,Satznummer,Gewicht,Einheit,Wdh,Abgeschlossen,Sitzhöhe,Pin-Position,Notizen';
  const rows = [];
  for (const s of sessions || []) {
    for (const set of s.sets || []) {
      rows.push(
        [
          escapeCSV(s.id),
          escapeCSV(s.date),
          escapeCSV(s.machineId),
          escapeCSV(s.machineName),
          escapeCSV(s.muscleGroup),
          String(set.setNumber),
          String(set.weight),
          escapeCSV(s.weightUnit),
          String(set.reps),
          set.isCompleted ? 'JA' : 'NEIN',
          escapeCSV(s.seatHeightUsed),
          escapeCSV(s.pinPositionUsed),
          escapeCSV(s.notes),
        ].join(',')
      );
    }
  }
  const content = [header, ...rows].join('\n') + '\n';
  return includeBOM ? '\uFEFF' + content : content;
}

export function importMachinesFromCSV(text) {
  const cleanText = String(text || '').replace(/^\uFEFF/, '');
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLower = lines[0].toLowerCase();
  const hasHeader =
    firstLower.includes('gerät') ||
    firstLower.includes('geraet') ||
    firstLower.includes('machine') ||
    firstLower.includes('gewicht') ||
    firstLower.includes('weight') ||
    firstLower.includes('muskel') ||
    firstLower.includes('name');

  const map = {};
  if (hasHeader) {
    const cols = parseCSVRow(lines[0]);
    cols.forEach((col, idx) => {
      const c = col.toLowerCase();
      if (c.includes('name')) map.name = idx;
      else if (c.includes('muskel') || c.includes('muscle')) map.muscleGroup = idx;
      else if (c.includes('typ') || c.includes('type')) map.machineType = idx;
      else if (c.includes('gewicht') || c.includes('weight')) map.targetWeight = idx;
      else if (c.includes('einheit') || c.includes('unit')) map.weightUnit = idx;
      else if (c.includes('sätze') || c.includes('saetze') || c.includes('sets')) map.targetSets = idx;
      else if (c.includes('wdh') || c.includes('reps')) map.targetReps = idx;
      else if (c.includes('schritt') || c.includes('increment')) map.weightIncrement = idx;
      else if (c.includes('sitz') || c.includes('seat')) map.seatHeight = idx;
      else if (c.includes('lehne') || c.includes('rücken') || c.includes('backrest')) map.backrestAngle = idx;
      else if (c.includes('pin') || c.includes('rolle')) map.pinPosition = idx;
      else if (c.includes('aufsatz') || c.includes('griff') || c.includes('attach')) map.attachment = idx;
      else if (c.includes('favorit') || c.includes('fav')) map.isFavorite = idx;
      else if (c.includes('notiz') || c.includes('note')) map.notes = idx;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const parsed = [];

  for (const line of dataLines) {
    const cols = parseCSVRow(line);
    if (!cols.length) continue;

    const nameIdx = map.name ?? 0;
    const name = (cols[nameIdx] || '').trim();
    if (!name) continue;

    const mgRaw = cols[map.muscleGroup ?? 1] || '';
    const typeRaw = cols[map.machineType ?? 2] || '';
    const weightRaw = cols[map.targetWeight ?? 3];
    const unitRaw = (cols[map.weightUnit ?? 4] || '').toLowerCase();
    const setsRaw = cols[map.targetSets ?? 5];
    const repsRaw = cols[map.targetReps ?? 6];

    // Note: Legacy 12-column CSV had seatHeight at index 7, whereas 14-column CSV has weightIncrement at 7
    const hasIncrementCol = map.weightIncrement !== undefined;
    const incVal = hasIncrementCol ? parseDecimalInput(cols[map.weightIncrement]) : 2.5;

    const seatIdx = map.seatHeight ?? (hasIncrementCol ? 8 : 7);
    const backIdx = map.backrestAngle ?? (hasIncrementCol ? 9 : 8);
    const pinIdx = map.pinPosition ?? (hasIncrementCol ? 10 : 9);
    const attachIdx = map.attachment ?? (hasIncrementCol ? 11 : 10);
    const notesIdx = map.notes ?? (hasIncrementCol ? 13 : 11);

    const parsedWeight = parseDecimalInput(weightRaw);
    const favCol = map.isFavorite !== undefined ? (cols[map.isFavorite] || '').toLowerCase() : '';

    parsed.push(
      createMachine({
        name,
        muscleGroup: mgRaw ? matchMuscleGroup(mgRaw) : matchMuscleGroup(name),
        machineType: matchMachineType(typeRaw),
        targetWeight: parsedWeight !== null ? parsedWeight : 40,
        weightUnit: unitRaw.includes('lb') ? 'lbs' : 'kg',
        targetSets: parseInt(setsRaw, 10) || 3,
        targetReps: parseInt(repsRaw, 10) || 10,
        weightIncrement: incVal && incVal > 0 ? incVal : 2.5,
        seatHeight: cols[seatIdx] || '',
        backrestAngle: cols[backIdx] || '',
        pinPosition: cols[pinIdx] || '',
        attachment: cols[attachIdx] || '',
        isFavorite: favCol === 'ja' || favCol === 'true' || favCol === '1',
        notes: cols[notesIdx] || '',
      })
    );
  }

  return parsed;
}

/**
 * Imports workout sessions from CSV (supports both the new 13-col format and legacy iOS 9-col format!).
 */
export function importWorkoutsFromCSV(text, existingMachines = []) {
  const cleanText = String(text || '').replace(/^\uFEFF/, '');
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headerCols = parseCSVRow(lines[0]).map((c) => c.toLowerCase());
  const idx = {
    sessionId: headerCols.findIndex((c) => c.includes('sessionid')),
    date: headerCols.findIndex((c) => c.includes('datum') || c.includes('date')),
    machineId: headerCols.findIndex((c) => c.includes('gerätid') || c.includes('machineid')),
    machineName: headerCols.findIndex((c) => c.includes('gerätename') || c.includes('name')),
    muscleGroup: headerCols.findIndex((c) => c.includes('muskel') || c.includes('muscle')),
    setNumber: headerCols.findIndex((c) => c.includes('satz') || c.includes('set')),
    weight: headerCols.findIndex((c) => c.includes('gewicht') || c.includes('weight')),
    unit: headerCols.findIndex((c) => c.includes('einheit') || c.includes('unit')),
    reps: headerCols.findIndex((c) => c.includes('wdh') || c.includes('reps')),
    completed: headerCols.findIndex((c) => c.includes('abgeschlossen') || c.includes('completed')),
    seatHeight: headerCols.findIndex((c) => c.includes('sitz')),
    pinPosition: headerCols.findIndex((c) => c.includes('pin')),
    notes: headerCols.findIndex((c) => c.includes('notiz') || c.includes('note')),
  };

  if (idx.date === -1 || idx.machineName === -1) return [];

  const machineByName = new Map(
    existingMachines.map((m) => [m.name.toLowerCase(), m])
  );

  const grouped = new Map();
  for (const line of lines.slice(1)) {
    const cols = parseCSVRow(line);
    if (!cols.length) continue;
    const dateStr = cols[idx.date] || new Date().toISOString();
    const machineName = cols[idx.machineName] || 'Gerät';
    const explicitSessionId = idx.sessionId >= 0 ? cols[idx.sessionId] : '';
    const groupKey = explicitSessionId || `${dateStr}__${machineName}`;

    if (!grouped.has(groupKey)) {
      const matchedMachine = machineByName.get(machineName.toLowerCase());
      const mId =
        (idx.machineId >= 0 && cols[idx.machineId]) ||
        (matchedMachine ? matchedMachine.id : '');
      const mg =
        idx.muscleGroup >= 0 && cols[idx.muscleGroup]
          ? matchMuscleGroup(cols[idx.muscleGroup])
          : matchedMachine?.muscleGroup || 'Alle';

      grouped.set(groupKey, {
        id: explicitSessionId || undefined,
        machineId: mId,
        machineName,
        muscleGroup: mg,
        date: dateStr,
        weightUnit:
          idx.unit >= 0 && (cols[idx.unit] || '').toLowerCase().includes('lb')
            ? 'lbs'
            : 'kg',
        seatHeightUsed: idx.seatHeight >= 0 ? cols[idx.seatHeight] || '' : '',
        pinPositionUsed: idx.pinPosition >= 0 ? cols[idx.pinPosition] || '' : '',
        notes: idx.notes >= 0 ? cols[idx.notes] || '' : '',
        sets: [],
      });
    }

    const sessionObj = grouped.get(groupKey);
    const completedStr = idx.completed >= 0 ? (cols[idx.completed] || '').toLowerCase() : 'ja';
    const isCompleted =
      completedStr === 'ja' || completedStr === 'true' || completedStr === 'yes' || completedStr === '1';

    sessionObj.sets.push(
      createWorkoutSet(
        {
          setNumber: idx.setNumber >= 0 ? parseInt(cols[idx.setNumber], 10) : sessionObj.sets.length + 1,
          weight: idx.weight >= 0 ? parseDecimalInput(cols[idx.weight]) ?? 0 : 0,
          reps: idx.reps >= 0 ? parseInt(cols[idx.reps], 10) || 10 : 10,
          isCompleted,
          completedAt: dateStr,
        },
        sessionObj.sets.length + 1
      )
    );
  }

  return Array.from(grouped.values()).map((s) => createWorkoutSession(s));
}

export function createFullBackupPayload({ machines, sessions, settings }) {
  return JSON.stringify(
    {
      app: 'GymLog WebApp',
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: settings || {},
      machines: machines || [],
      sessions: sessions || [],
    },
    null,
    2
  );
}

/**
 * Parses a JSON backup file.
 * Supports:
 * 1) Full GymLog WebApp Backup object { version, machines, sessions, settings }
 * 2) Legacy iOS gymlog_machines_de.json array of ExerciseMachine
 * 3) Legacy iOS gymlog_sessions_de.json array of WorkoutSession
 */
export function parseBackupJSON(jsonText) {
  const raw = JSON.parse(String(jsonText || '').trim());

  if (Array.isArray(raw)) {
    if (!raw.length) return { machines: [], sessions: [], settings: null, isPartialMachinesOnly: false, isPartialSessionsOnly: false };
    const sample = raw[0];
    if ('sets' in sample || 'machineName' in sample) {
      return {
        machines: [],
        sessions: raw.map((s) => createWorkoutSession(s)),
        settings: null,
        isPartialSessionsOnly: true,
      };
    }
    return {
      machines: raw.map((m) => createMachine(m)),
      sessions: [],
      settings: null,
      isPartialMachinesOnly: true,
    };
  }

  if (raw && typeof raw === 'object') {
    const machines = Array.isArray(raw.machines) ? raw.machines.map((m) => createMachine(m)) : [];
    const sessions = Array.isArray(raw.sessions)
      ? raw.sessions.map((s) => createWorkoutSession(s))
      : [];
    const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : null;
    return { machines, sessions, settings };
  }

  throw new Error('Ungültiges Backup-Format');
}
