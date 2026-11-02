import { getCompletedSets, getMuscleMeta } from '../models.js';
import {
  convertWeight,
  dualWeight,
  formatDateDE,
  formatNumber,
  formatRestTime,
  isSameLocalDay,
} from '../weight.js';
import { computeMuscleHeatmapStats, evaluateAllOverloads } from '../overload.js';
import { esc, icon } from '../icons.js';

function getGreetingDE() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function renderActivityRing({ progress, color, iconName, title, value }) {
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  const r = 21;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);
  return `
    <div class="ring-stat">
      <div class="ring-svg-box" style="--ring-color:${color}">
        <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
          <circle cx="27" cy="27" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5"/>
          <circle cx="27" cy="27" r="${r}" fill="none" stroke="${color}" stroke-width="5.5"
            stroke-linecap="round"
            stroke-dasharray="${c.toFixed(2)}"
            stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 27 27)"/>
        </svg>
        <span class="ring-center-icon" style="color:${color}">${icon(iconName, 16)}</span>
      </div>
      <strong class="ring-value tabular">${esc(value)}</strong>
      <span class="ring-label">${esc(title)}</span>
    </div>
  `;
}

export function renderMuscleHeatmapCard(store) {
  const days = store.ui.heatmapDays || 7;
  const unit = store.settings.preferredUnit;
  const stats = computeMuscleHeatmapStats(store.sessions, store.machines, days, unit);
  const selectedGroup = store.ui.heatmapSelectedMuscle;
  const selectedStat = stats.find((s) => s.muscleGroup === selectedGroup) || null;

  const colorForLevel = (lvl) => {
    if (lvl === 1) return '#00DBE9';
    if (lvl === 2) return '#C3F400';
    if (lvl === 3) return '#FF571A';
    return '#8E9379';
  };

  const tiles = stats
    .map((st) => {
      const col = colorForLevel(st.intensityLevel);
      const isSel = selectedGroup === st.muscleGroup;
      const dots = [1, 2, 3]
        .map(
          (d) =>
            `<span class="heat-dot ${d <= st.intensityLevel ? 'is-lit' : ''}" style="--dot-color:${col}"></span>`
        )
        .join('');
      return `
        <button type="button" class="heatmap-tile ${isSel ? 'is-selected' : ''} level-${st.intensityLevel}"
          data-action="select-heatmap-muscle" data-muscle="${esc(st.muscleGroup)}"
          style="--tile-accent:${col}">
          <div class="heatmap-tile-top">
            <span class="heatmap-icon" style="color:${col}">${icon(st.meta.icon, 16)}</span>
            <span class="heat-dots">${dots}</span>
          </div>
          <div class="heatmap-tile-name">${esc(st.muscleGroup)}</div>
          <div class="heatmap-tile-sets">
            <strong class="tabular ${st.setsCount > 0 ? '' : 'is-zero'}">${st.setsCount}</strong>
            <span>Sätze</span>
          </div>
        </button>
      `;
    })
    .join('');

  const detailHtml = selectedStat
    ? `
      <div class="heatmap-detail-box">
        <div class="heatmap-detail-icon" style="--det-color:${colorForLevel(selectedStat.intensityLevel)}">
          ${icon(selectedStat.meta.icon, 20)}
        </div>
        <div class="heatmap-detail-text">
          <strong>${esc(selectedStat.muscleGroup)}</strong>
          <span>${selectedStat.setsCount} Sätze • ${selectedStat.volume.toLocaleString('de-DE')} ${esc(unit)} Volumen (${days} Tage)${
            selectedStat.lastTrainedDate
              ? ` • Zuletzt: ${formatDateDE(selectedStat.lastTrainedDate, false)}`
              : ''
          }</span>
        </div>
        <button type="button" class="pill-btn-ghost" data-action="jump-muscle-machines" data-muscle="${esc(selectedStat.muscleGroup)}">
          Geräte
        </button>
      </div>
    `
    : '';

  return `
    <section class="glass-card heatmap-card">
      <div class="section-header-inline">
        <span class="section-kicker" style="color:#FF571A">${icon('flame', 15)} MUSKEL-HEATMAP</span>
        <div class="segmented-mini" role="group" aria-label="Zeitraum Muskel-Heatmap">
          <button type="button" class="seg-btn ${days === 7 ? 'is-active' : ''}" data-action="set-heatmap-days" data-days="7">7 Tage</button>
          <button type="button" class="seg-btn ${days === 30 ? 'is-active' : ''}" data-action="set-heatmap-days" data-days="30">30 Tage</button>
        </div>
      </div>
      <div class="heatmap-grid">
        ${tiles}
      </div>
      ${detailHtml}
    </section>
  `;
}

export function renderDashboardView(store) {
  const unit = store.settings.preferredUnit;
  const todaySessions = store.sessions.filter((s) => isSameLocalDay(s.date));

  let totalSetsToday = todaySessions.reduce((acc, s) => acc + getCompletedSets(s).length, 0);
  let totalVolumeToday = todaySessions.reduce((acc, s) => {
    const sVol = getCompletedSets(s).reduce(
      (sum, set) => sum + convertWeight(set.weight, s.weightUnit || 'kg', unit) * set.reps,
      0
    );
    return acc + sVol;
  }, 0);

  if (store.activeSession) {
    const activeDone = getCompletedSets(store.activeSession);
    totalSetsToday += activeDone.length;
    totalVolumeToday += activeDone.reduce(
      (sum, set) =>
        sum + convertWeight(set.weight, store.activeSession.weightUnit || 'kg', unit) * set.reps,
      0
    );
  }

  const estimatedMinutes = totalSetsToday > 0 ? Math.max(15, totalSetsToday * 3) : 0;
  const targetMinutes = 60;
  const targetVolume = unit === 'lbs' ? 11000 : 5000;

  // Active workout banner if running
  let activeHeroHtml = '';
  if (store.activeSession) {
    const completedCount = getCompletedSets(store.activeSession).length;
    const totalCount = store.activeSession.sets.length;
    const resting = store.isRestTimerRunning();
    const remSec = store.getRestRemainingSeconds();
    activeHeroHtml = `
      <button type="button" class="active-workout-hero" data-action="resume-workout">
        <div class="active-hero-pulse">${icon(resting ? 'timer' : 'play', 20)}</div>
        <div class="active-hero-info">
          <span class="kicker-lime">AKTIVES TRAINING</span>
          <strong>${esc(store.activeSession.machineName)}</strong>
          <span>${completedCount}/${totalCount} Sätze${
            resting ? ` • Pause ${formatRestTime(remSec)}` : ''
          }</span>
        </div>
        <span class="active-hero-arrow">${icon('chevronRight', 20)}</span>
      </button>
    `;
  }

  // Overload Recommendations
  const recommendations = evaluateAllOverloads(store.machines, store.sessions);
  const overloadHtml = recommendations.length
    ? `
      <section class="dashboard-section">
        <div class="section-header-inline">
          <span class="section-kicker" style="color:#C3F400">${icon('bolt', 15)} ERHÖHUNG BEREIT</span>
          <span class="count-pill">${recommendations.length}</span>
        </div>
        <div class="overload-carousel">
          ${recommendations
            .map((rec) => {
              const dual = dualWeight(rec.suggestedWeight, rec.weightUnit, unit);
              return `
                <article class="overload-card">
                  <div class="overload-card-top">
                    <button type="button" class="link-title-btn" data-action="open-machine" data-machine-id="${esc(rec.machineId)}">
                      ${esc(rec.machineName)}
                    </button>
                    <span class="overload-badge">+${formatNumber(rec.increment)} ${esc(rec.weightUnit)}</span>
                  </div>
                  <p class="overload-reason">${esc(rec.reason)}</p>
                  <div class="overload-card-bottom">
                    <div>
                      <span class="micro-label">NEUES ZIEL</span>
                      <strong class="overload-target tabular">${esc(dual.primary)} × ${rec.suggestedReps}</strong>
                    </div>
                    <button type="button" class="btn-lime-pill" data-action="apply-overload" data-machine-id="${esc(rec.machineId)}">
                      Übernehmen
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `
    : '';

  // Favorites section
  const favorites = store.favoriteMachines;
  const favoritesHtml = favorites.length
    ? `<div class="card-stack">
        ${favorites
          .map((m) => {
            const meta = getMuscleMeta(m.muscleGroup);
            const dual = dualWeight(m.targetWeight, m.weightUnit, unit);
            const setupHint = [
              m.seatHeight ? `Sitz ${m.seatHeight}` : '',
              m.pinPosition ? `Pin ${m.pinPosition}` : '',
            ]
              .filter(Boolean)
              .join(' • ');
            return `
              <div class="fav-machine-row">
                <button type="button" class="fav-machine-main" data-action="open-machine" data-machine-id="${esc(m.id)}">
                  <span class="muscle-icon-box" style="--m-color:${meta.color}">
                    ${icon(meta.icon, 20)}
                  </span>
                  <span class="fav-machine-text">
                    <strong>${esc(m.name)}</strong>
                    <span class="fav-machine-sub tabular">
                      <em class="text-lime">${esc(dual.primary)}</em> • ${m.targetSets}×${m.targetReps}${
                        setupHint ? ` • ${esc(setupHint)}` : ''
                      }
                    </span>
                  </span>
                </button>
                <button type="button" class="btn-start-chip" data-action="start-workout" data-machine-id="${esc(m.id)}" aria-label="${esc(m.name)} starten">
                  ${icon('play', 13)} <span>Start</span>
                </button>
              </div>
            `;
          })
          .join('')}
      </div>`
    : `<div class="empty-inline-card">
         <p>Keine Favoriten ausgewählt.</p>
         <button type="button" class="btn-secondary-sm" data-action="switch-tab" data-tab="machines">Geräte öffnen</button>
       </div>`;

  // Recent machines quick row (if any trained yet)
  const recents = store.recentMachines.slice(0, 5);
  const recentsHtml = recents.length
    ? `
      <section class="dashboard-section">
        <div class="section-header-inline">
          <h2 class="section-title">Zuletzt trainiert</h2>
          <button type="button" class="text-action-btn" data-action="switch-tab" data-tab="history">Verlauf →</button>
        </div>
        <div class="recent-pills-scroll">
          ${recents
            .map((m) => {
              const dual = dualWeight(m.targetWeight, m.weightUnit, unit);
              return `
                <button type="button" class="recent-machine-chip" data-action="open-machine" data-machine-id="${esc(m.id)}">
                  <strong>${esc(m.name)}</strong>
                  <span class="tabular">${esc(dual.primary)} • ${formatDateDE(m.lastUsedDate, false)}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </section>
    `
    : '';

  return `
    <div class="view-container">
      <section class="glass-card hero-dashboard-card">
        <div class="hero-top-row">
          <div>
            <span class="kicker-lime">${esc(getGreetingDE().toUpperCase())}</span>
            <h1 class="page-title">GymLog</h1>
          </div>
          <div class="hero-actions">
            <button type="button" class="unit-toggle-pill" data-action="toggle-unit" aria-label="Gewichtseinheit wechseln">
              ${icon('swap', 14)}
              <span class="tabular">${esc(unit.toUpperCase())}</span>
            </button>
          </div>
        </div>

        <div class="rings-grid">
          ${renderActivityRing({
            progress: estimatedMinutes / targetMinutes,
            color: '#C3F400',
            iconName: 'clock',
            title: 'Zeit',
            value: `${estimatedMinutes}m`,
          })}
          ${renderActivityRing({
            progress: totalVolumeToday / targetVolume,
            color: '#00DBE9',
            iconName: 'dumbbell',
            title: 'Volumen',
            value: `${Math.round(totalVolumeToday)} ${unit}`,
          })}
          ${renderActivityRing({
            progress: totalSetsToday / 20,
            color: '#FF571A',
            iconName: 'flame',
            title: 'Sätze',
            value: String(totalSetsToday),
          })}
        </div>
      </section>

      ${activeHeroHtml}
      ${overloadHtml}

      <section class="dashboard-section">
        <div class="section-header-inline">
          <h2 class="section-title">Favoriten</h2>
          <button type="button" class="text-action-btn" data-action="switch-tab" data-tab="machines">Alle (${store.machines.length})</button>
        </div>
        ${favoritesHtml}
      </section>

      ${recentsHtml}
      ${renderMuscleHeatmapCard(store)}
    </div>
  `;
}
