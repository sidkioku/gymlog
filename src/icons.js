export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PATHS = {
  home: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  dumbbell:
    '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 8.5v7M20.5 8.5v7M6.5 12h11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  chest:
    '<path d="M4 9c2-3 5-3.5 8-1.5 3-2 6-1.5 8 1.5v3.5c0 3-3.5 5.5-8 5.5s-8-2.5-8-5.5V9Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M12 7.5V18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  back:
    '<path d="M5 6l7 3 7-3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M12 9v11M8.5 12l3.5 2 3.5-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  legs:
    '<path d="M8.5 3.5v7.5l-2 9.5M15.5 3.5v7.5l2 9.5M8.5 11h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  shoulders:
    '<path d="M4 15c0-5 3.5-8.5 8-8.5s8 3.5 8 8.5M8 15c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"/>',
  arms:
    '<path d="M6 15.5c0-3.5 2.5-6 5.5-6 .8 0 1.6.2 2.3.5L15 5.5l3.5 1-1.5 6.5c1 1.1 1.5 2.5 1.5 4 0 2.2-1.8 3.5-4.5 3.5H9.5C7.4 20.5 6 18.4 6 15.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
  core:
    '<rect x="7" y="4" width="10" height="16" rx="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 4v16M7.5 9.5h9M7.5 14.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  fullbody:
    '<circle cx="12" cy="5" r="2.2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5.5 9.5h13M12 7.5v6.5m0 0l-3.5 6.5m3.5-6.5l3.5 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  chart:
    '<path d="M4 19.5h16M5.5 15.5l4.2-4.2 3.2 2.8 5.6-6.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="18.5" cy="7.5" r="2" fill="currentColor"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  play: '<path d="M7.5 5.2l11 6.8-11 6.8V5.2Z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  check:
    '<path d="M5 12.5l4.5 4.5L19.5 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  close:
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  search:
    '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16 16l4.2 4.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  star:
    '<path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" fill="none"/>',
  starFilled:
    '<path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5Z" fill="currentColor"/>',
  timer:
    '<circle cx="12" cy="13" r="7.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9.5 3h5M12 9v4.2l2.8 1.8M18.5 6.5l1.5-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  clock:
    '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  flame:
    '<path d="M12.5 3c.5 3.5-2.5 5-2.5 8 0 1.7 1.2 3 2.8 3 1.8 0 2.7-1.5 2.7-3.3 2.2 1.5 3.5 3.8 3.5 6.3a7 7 0 1 1-14 0c0-4.2 3.2-7.4 7.5-14Z" fill="currentColor"/>',
  bolt:
    '<path d="M13 2.5L4.5 13.5h6.2L9.8 21.5 19.5 10h-6.3L13 2.5Z" fill="currentColor"/>',
  trophy:
    '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 1h3v3a3 3 0 0 1-3-3Zm16 0h-3v3a3 3 0 0 0 3-3ZM12 14v4m-4 2h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  target:
    '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  edit:
    '<path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/>',
  trash:
    '<path d="M4.5 7h15M9.5 7V4.5h5V7m-7.5 0l.8 12.5h8.4L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronRight:
    '<path d="M9 5.5l6.5 6.5L9 18.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronLeft:
    '<path d="M15 5.5L8.5 12 15 18.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronDown:
    '<path d="M6 9.5l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronUp:
    '<path d="M6 14.5l6-6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  swap:
    '<path d="M7 7h11m0 0l-3-3m3 3l-3 3M17 17H6m0 0l3-3m-3 3l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  share:
    '<path d="M12 3.5v11m0-11L8 7.5m4-4l4 4M5 13.5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  download:
    '<path d="M12 4v11m0 0l-4-4m4 4l4-4M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  upload:
    '<path d="M12 15V4m0 0L8 8m4-4l4 4M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  shield:
    '<path d="M12 3l7.5 3.2v5.3c0 4.8-3.1 8.2-7.5 9.8-4.4-1.6-7.5-5-7.5-9.8V6.2L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/><path d="M8.8 12.2l2.2 2.2 4.4-4.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  seat:
    '<path d="M7 5v9h9l1.5 5M7 14l-1.5 5M5.5 11h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  pin:
    '<circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 12v8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  link:
    '<path d="M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 0 1 5.6 5.6l-1.2 1.2M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 0 1-5.6-5.6l1.2-1.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  note:
    '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  iphone:
    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10.5 5.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  reset:
    '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  sun:
    '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  volume:
    '<path d="M5 9.5h3.5L13 5.5v13l-4.5-4H5v-5Zm11-.8a4.5 4.5 0 0 1 0 6.6m2.5-9.1a8 8 0 0 1 0 11.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
};

export function icon(name, size = 20, className = '') {
  const body = PATHS[name] || PATHS.dumbbell;
  const cls = className ? ` class="${esc(className)}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
