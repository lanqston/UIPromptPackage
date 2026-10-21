import edits from '../data/carousel-reading.json' with { type: 'json' };

export function captionHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

const sentenceCase = text => {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/^\w/, c => c.toUpperCase()).replace(/\b(ai|mfa|fcc|sec|ftc|bls|ui|ux|it)\b/gi, word => word.toUpperCase());
};
const paragraphsFrom = text => text.split(/\n\s*\n|\s+\/\s+/).flatMap(block => {
  const sentences = block.trim().split(/(?<=[.!?])\s+(?=[A-Z“"'])/);
  const paragraphs = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > 320) { paragraphs.push(current); current = ''; }
    current += (current ? ' ' : '') + sentence;
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}).filter(Boolean);

// Formats only the text supplied by the server. It never requests locked slides.
export function carouselReading(slide, slug = '') {
  const raw = String(slide.text || '').trim();
  const edit = edits[slug]?.[Number(slide.number) - 1];
  // A publisher edit takes precedence over an older editorial revision.
  if (edit?.sourceHash === captionHash(raw)) return { heading: edit.heading, paragraphs: [...edit.paragraphs] };
  let text = raw.replace(/^\s*0\d{1,2}\s*(?:\/\s*|\s+)/, '').replace(/^\s*\d{1,3}\s+\/\s+/, '').replace(/\s+[—–]\s+/g, ', ');
  let heading = '';
  const label = /^([^\n:]{2,65}):\s+/.exec(text);
  if (label && !/https?$/i.test(label[1]) && !/[.!?]/.test(label[1])) {
    heading = sentenceCase(label[1]);
    text = text.slice(label[0].length);
    const repeated = text.slice(0, heading.length).toLowerCase() === heading.toLowerCase();
    if (repeated && /^\s*[:.]\s*/.test(text.slice(heading.length))) text = text.slice(heading.length).replace(/^\s*[:.]\s*/, '');
  }
  const paragraphs = paragraphsFrom(text).map(p => p.replace(/^[a-z]/, c => c.toUpperCase()));
  return { heading, paragraphs };
}
