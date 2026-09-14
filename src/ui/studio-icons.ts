/** One stroke weight / viewport across the interface; decorative icons only. */
const paths = {
  plane: '<path d="m3 11 18-7-6 17-4-7-8-3Z"/><path d="m11 14 10-10"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  play: '<path d="m9 5 10 7-10 7Z"/>',
  pilot: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm5 11v7m-4 0h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',
  feather: '<path d="M4 21 17 8M8 16C3 7 12 1 21 3c1 9-5 17-13 13Zm4-4h6"/>',
  collection: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m17.5 13 4.5 4.5-4.5 4.5-4.5-4.5Z"/>',
  board: '<path d="M4 21V11h5v10M9 21V4h6v17m0 0V8h5v13M2 21h20"/>',
  journey: '<path d="M5 4h14v16H5Z"/><path d="M8 4v16m3-11h5m-5 4h3"/>',
  friends: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
} as const;
export function studioIcon(name: keyof typeof paths): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="studio-icon">${paths[name]}</svg>`;
}
