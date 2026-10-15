const strokes = {
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M8 3.5v4M16 3.5v4M4 10.5h16M8 14h2M14 14h2M8 17h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M7 17 17 7M7 7h10v10"/>',
  book: '<path d="M4 4.5h6a3 3 0 0 1 3 3v13a4 4 0 0 0-4-2H4zM13 7.5a3 3 0 0 1 3-3h4v14h-3a4 4 0 0 0-4 2"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
  chart: '<path d="M4 4v16h16M8 15l4-5 4 2 4-6M16 6h4v4"/>',
  tool: '<path d="m14 5 5 5M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15z"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  save: '<path d="M6.5 4.5h11v15l-5.5-3.7-5.5 3.7z"/>',
  like: '<path d="M20.3 8.2c0 4.1-8.3 9.5-8.3 9.5S3.7 12.3 3.7 8.2a4.2 4.2 0 0 1 8.3-1 4.2 4.2 0 0 1 8.3 1Z"/>',
  comment: '<path d="M5.5 5.3h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6"/>'
};
export function cardIconMarkup(name) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${strokes[name] || ''}</svg>`;
}
