const strokes = {
  save: '<path d="M6.5 4.5h11v15l-5.5-3.7-5.5 3.7z"/>',
  like: '<path d="M20.3 8.2c0 4.1-8.3 9.5-8.3 9.5S3.7 12.3 3.7 8.2a4.2 4.2 0 0 1 8.3-1 4.2 4.2 0 0 1 8.3 1Z"/>',
  comment: '<path d="M5.5 5.3h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/>',
  share: '<path d="M14.2 5.2h5v5M19.2 5.2l-8.1 8.1"/><path d="M18.3 13.2v4.2a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V7.6a2 2 0 0 1 2-2h4.1"/>'
};
export function cardIconMarkup(name) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${strokes[name] || ''}</svg>`;
}
