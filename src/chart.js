import { getCompletedSets } from './models.js';
import { convertWeight, formatDateDE, formatNumber, formatShortDayMonthDE } from './weight.js';
import { esc, icon } from './icons.js';

export const CHART_METRICS = [
  { id: 'maxWeight', label: 'Max. Gewicht', color: '#C3F400' },
  { id: 'oneRM', label: '1RM (Epley)', color: '#00DBE9' },
  { id: 'volume', label: 'Volumen', color: '#FF571A' },
];

export const CHART_RANGES = [
  { id: 'last5', label: '5 Einheiten' },
  { id: 'month', label: '30 Tage' },
  { id: 'threeMonths', label: '90 Tage' },
  { id: 'all', label: 'Alle' },
];

export function buildChartDataPoints(machine, sessions, metric = 'maxWeight', timeRange = 'month', preferredUnit = 'kg') {
  const unit = preferredUnit || machine.weightUnit || 'kg';
  const sorted = (sessions || [])
    .filter((s) => s.machineId === machine.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const points = [];
  sorted.forEach((session, idx) => {
    const completed = getCompletedSets(session);
    if (!completed.length) return;

    const sUnit = session.weightUnit || machine.weightUnit || 'kg';
    const convertedSets = completed.map((s) => ({
      ...s,
      w: convertWeight(s.weight, sUnit, unit),
    }));

    const maxW = Math.max(...convertedSets.map((s) => s.w));
    let bestSet = convertedSets[0];
    let bestOneRM = 0;
    for (const s of convertedSets) {
      const orm = s.w * (1 + s.reps / 30);
      if (orm > bestOneRM) {
        bestOneRM = orm;
        bestSet = s;
      }
    }
    const vol = convertedSets.reduce((acc, s) => acc + s.w * s.reps, 0);

    let value = maxW;
    if (metric === 'oneRM') value = bestOneRM;
    else if (metric === 'volume') value = vol;

    points.push({
      id: session.id,
      date: session.date,
      value: Math.round(value * 10) / 10,
      rawWeight: Math.round(maxW * 10) / 10,
      reps: bestSet.reps,
      setsCount: completed.length,
      sessionIndex: idx + 1,
      unit,
    });
  });

  if (timeRange === 'last5') return points.slice(-5);
  if (timeRange === 'month') {
    const cutoff = Date.now() - 30 * 86400 * 1000;
    const filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
    return filtered.length ? filtered : points.slice(-5);
  }
  if (timeRange === 'threeMonths') {
    const cutoff = Date.now() - 90 * 86400 * 1000;
    const filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
    return filtered.length ? filtered : points.slice(-10);
  }
  return points;
}

function buildSmoothPath(coords) {
  if (!coords.length) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length === 2) {
    return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`;
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function renderProgressionChartCard(machine, sessions, metric = 'maxWeight', timeRange = 'month', preferredUnit = 'kg') {
  const metricObj = CHART_METRICS.find((m) => m.id === metric) || CHART_METRICS[0];
  const color = metricObj.color;
  const points = buildChartDataPoints(machine, sessions, metric, timeRange, preferredUnit);
  const unit = preferredUnit || machine.weightUnit || 'kg';
  const unitLabel = metric === 'volume' ? `${unit} Vol.` : unit;

  const metricButtons = CHART_METRICS.map(
    (m) => `
      <button type="button" class="chip-sm ${m.id === metric ? 'is-active' : ''}" data-action="chart-metric" data-metric="${m.id}" style="--chip-accent:${m.color}">
        ${esc(m.label)}
      </button>`
  ).join('');

  const rangeButtons = CHART_RANGES.map(
    (r) => `
      <button type="button" class="range-pill ${r.id === timeRange ? 'is-active' : ''}" data-action="chart-range" data-range="${r.id}">
        ${esc(r.label)}
      </button>`
  ).join('');

  if (points.length < 2) {
    const singleInfo =
      points.length === 1
        ? `<div class="chart-first-entry">
             <span class="mono-badge">1. Einheit erfasst: ${formatNumber(points[0].value)} ${esc(unitLabel)} (${formatDateDE(points[0].date, false)})</span>
           </div>`
        : '';
    return `
      <section class="glass-card chart-card" style="--chart-accent: ${color}">
        <div class="section-kicker-row">
          <span class="section-kicker" style="color:${color}">${icon('chart', 15)} LEISTUNGSKURVE</span>
        </div>
        <div class="chart-controls-stack">
          <div class="chip-scroll-row">${metricButtons}</div>
          <div class="range-pills-row">${rangeButtons}</div>
        </div>
        <div class="chart-empty-box">
          ${icon('chart', 26)}
          <p>Ab 2 Einheiten verfügbar</p>
          ${singleInfo}
        </div>
      </section>
    `;
  }

  const width = 340;
  const height = 175;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const vals = points.map((p) => p.value);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (Math.abs(maxV - minV) < 0.01) {
    minV = Math.max(0, minV - 5);
    maxV = maxV + 5;
  } else {
    const pad = (maxV - minV) * 0.14;
    minV = Math.max(0, minV - pad);
    maxV = maxV + pad;
  }

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (points.length - 1)) * plotW;
    const y = padTop + plotH - ((p.value - minV) / (maxV - minV)) * plotH;
    return { ...p, x, y };
  });

  const linePath = buildSmoothPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const yTicks = [minV, (minV + maxV) / 2, maxV];
  const gridLines = yTicks
    .map((tv) => {
      const y = padTop + plotH - ((tv - minV) / (maxV - minV)) * plotH;
      return `
        <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${width - padRight}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.09)" stroke-dasharray="3 3" stroke-width="1"/>
        <text x="${padLeft - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" fill="#9FA68E" font-size="9.5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${Math.round(tv)}</text>
      `;
    })
    .join('');

  // Pick up to 4 X labels cleanly spaced
  const xLabelIndices = new Set([0, coords.length - 1]);
  if (coords.length >= 4) {
    xLabelIndices.add(Math.floor((coords.length - 1) / 3));
    xLabelIndices.add(Math.floor(((coords.length - 1) * 2) / 3));
  } else if (coords.length === 3) {
    xLabelIndices.add(1);
  }

  const xLabels = Array.from(xLabelIndices)
    .sort((a, b) => a - b)
    .map((idx) => {
      const c = coords[idx];
      return `<text x="${c.x.toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#9FA68E" font-size="9.5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${esc(formatShortDayMonthDE(c.date))}</text>`;
    })
    .join('');

  const circles = coords
    .map(
      (c, idx) => `
      <circle class="chart-dot ${idx === coords.length - 1 ? 'is-latest' : ''}" data-point-idx="${idx}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${idx === coords.length - 1 ? 5 : 3.8}" fill="${color}" stroke="#121316" stroke-width="2"/>`
    )
    .join('');

  const latest = coords[coords.length - 1];
  const first = coords[0];
  const delta = Math.round((latest.value - first.value) * 10) / 10;
  const deltaSign = delta > 0 ? '+' : '';
  const gradId = `chartGrad_${machine.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`;
  const serializedPoints = esc(
    JSON.stringify(
      coords.map((c) => ({
        x: Math.round(c.x * 10) / 10,
        y: Math.round(c.y * 10) / 10,
        dateLabel: formatDateDE(c.date, false),
        valueLabel: formatNumber(c.value, 1),
        unitLabel,
        detailLabel: `${c.setsCount} Sätze • Top: ${formatNumber(c.rawWeight)} ${unit} × ${c.reps}`,
      }))
    )
  );

  return `
    <section class="glass-card chart-card" style="--chart-accent: ${color}" data-interactive-chart="${serializedPoints}">
      <div class="section-kicker-row">
        <span class="section-kicker" style="color:${color}">${icon('chart', 15)} LEISTUNGSKURVE</span>
        <span class="chart-delta-pill ${delta >= 0 ? 'is-pos' : 'is-neg'}">${deltaSign}${formatNumber(delta, 1)} ${esc(unitLabel)}</span>
      </div>

      <div class="chart-controls-stack">
        <div class="chip-scroll-row">${metricButtons}</div>
        <div class="range-pills-row">${rangeButtons}</div>
      </div>

      <div class="chart-tooltip-bar" data-chart-tooltip>
        <div>
          <span class="tooltip-date" data-tooltip-date>${esc(formatDateDE(latest.date, false))} (Aktuell)</span>
          <div class="tooltip-val-row">
            <strong class="tooltip-val" data-tooltip-val>${esc(formatNumber(latest.value, 1))}</strong>
            <span class="tooltip-unit" style="color:${color}">${esc(unitLabel)}</span>
          </div>
        </div>
        <div class="tooltip-meta" data-tooltip-meta>
          ${latest.setsCount} Sätze • Top: ${esc(formatNumber(latest.rawWeight))} ${esc(unit)} × ${latest.reps}
        </div>
      </div>

      <div class="chart-svg-wrap">
        <svg class="progression-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Progressionskurve für ${esc(machine.name)}">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.36"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <path d="${areaPath}" fill="url(#${gradId})"/>
          <path d="${linePath}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <line class="chart-scrub-line" data-scrub-line x1="${latest.x.toFixed(1)}" y1="${padTop}" x2="${latest.x.toFixed(1)}" y2="${padTop + plotH}" stroke="${color}" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="3 3"/>
          ${circles}
          ${xLabels}
        </svg>
      </div>
    </section>
  `;
}

export function bindProgressionCharts(container) {
  if (!container) return;
  const charts = container.querySelectorAll('[data-interactive-chart]');
  charts.forEach((card) => {
    let points = [];
    try {
      points = JSON.parse(card.getAttribute('data-interactive-chart') || '[]');
    } catch {
      return;
    }
    if (!points.length) return;

    const svg = card.querySelector('.progression-svg');
    const dateEl = card.querySelector('[data-tooltip-date]');
    const valEl = card.querySelector('[data-tooltip-val]');
    const metaEl = card.querySelector('[data-tooltip-meta]');
    const scrubLine = card.querySelector('[data-scrub-line]');
    const dots = card.querySelectorAll('.chart-dot');
    if (!svg || !dateEl || !valEl || !metaEl) return;

    const selectPoint = (clientX) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const viewX = ((clientX - rect.left) / rect.width) * 340;
      let bestIdx = 0;
      let bestDist = Infinity;
      points.forEach((pt, idx) => {
        const d = Math.abs(pt.x - viewX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });

      const chosen = points[bestIdx];
      dateEl.textContent = chosen.dateLabel;
      valEl.textContent = chosen.valueLabel;
      metaEl.textContent = chosen.detailLabel;
      if (scrubLine) {
        scrubLine.setAttribute('x1', String(chosen.x));
        scrubLine.setAttribute('x2', String(chosen.x));
      }
      dots.forEach((dot, idx) => {
        dot.setAttribute('r', idx === bestIdx ? '6.2' : '3.8');
      });
    };

    svg.addEventListener('pointerdown', (e) => {
      selectPoint(e.clientX);
    });
    svg.addEventListener('pointermove', (e) => {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        selectPoint(e.clientX);
      }
    });
  });
}
