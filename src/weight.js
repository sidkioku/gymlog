export const KG_TO_LBS = 2.20462262185;
export const LBS_TO_KG = 0.45359237;

export function convertWeight(weight, fromUnit, toUnit) {
  const num = Number(weight) || 0;
  if (fromUnit === toUnit) return num;
  if (fromUnit === 'kg' && toUnit === 'lbs') return num * KG_TO_LBS;
  if (fromUnit === 'lbs' && toUnit === 'kg') return num * LBS_TO_KG;
  return num;
}

export function roundConvertedWeight(weight, targetUnit) {
  if (targetUnit === 'lbs') {
    return Math.round(weight * 2) / 2;
  }
  return Math.round(weight * 10) / 10;
}

/**
 * Formats numbers cleanly without trailing zeros:
 * 50 -> "50", 42.5 -> "42.5", 1.25 -> "1.25", 79.3664 -> "79.4"
 */
export function formatNumber(val, maxDecimals = 2) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  if (Number.isInteger(rounded)) return String(rounded);
  // Check if .25 / .75 exact quarter step; otherwise 1 decimal for converted floats
  const quarterCheck = Math.round(num * 4) / 4;
  if (Math.abs(rounded - quarterCheck) < 0.001) {
    return String(quarterCheck);
  }
  const oneDec = Math.round(num * 10) / 10;
  return Number.isInteger(oneDec) ? String(oneDec) : oneDec.toFixed(1);
}

/**
 * Parses user input supporting both German comma ("42,5") and dot ("42.5").
 * Returns null if invalid or negative.
 */
export function parseDecimalInput(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/\s+/g, '')
    .replace(/kg|lbs|lb/gi, '')
    .replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

/**
 * Returns { primary, primaryValue, primaryUnit, secondary, secondaryValue, secondaryUnit }
 */
export function dualWeight(weight, primaryUnit = 'kg', preferredUnit = null) {
  const activePreferred = preferredUnit || primaryUnit;
  const otherUnit = activePreferred === 'kg' ? 'lbs' : 'kg';

  const preferredVal =
    primaryUnit === activePreferred
      ? Number(weight) || 0
      : convertWeight(weight, primaryUnit, activePreferred);

  const otherVal =
    primaryUnit === otherUnit
      ? Number(weight) || 0
      : convertWeight(weight, primaryUnit, otherUnit);

  const primaryNumber =
    primaryUnit === activePreferred
      ? formatNumber(preferredVal, 2)
      : formatNumber(preferredVal, 1);
  const secondaryNumber =
    primaryUnit === otherUnit
      ? formatNumber(otherVal, 2)
      : formatNumber(otherVal, 1);

  return {
    primary: `${primaryNumber} ${activePreferred}`,
    primaryNumber,
    primaryValue: preferredVal,
    primaryUnit: activePreferred,
    secondary: `${secondaryNumber} ${otherUnit}`,
    secondaryNumber,
    secondaryValue: otherVal,
    secondaryUnit: otherUnit,
  };
}

export function formatRestTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDateDE(isoString, includeTime = true) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const opts = includeTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('de-DE', opts).format(d);
}

export function formatShortDayMonthDE(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(d);
}

export function isSameLocalDay(isoA, isoB = new Date().toISOString()) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
