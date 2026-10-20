import { readFile } from 'node:fs/promises';

const url = process.env.CAROUSEL_PUBLISH_URL;
const secret = process.env.CAROUSEL_PUBLISH_SECRET;
const file = process.argv[2];
if (!url || !secret || !file) {
  console.error('Set CAROUSEL_PUBLISH_URL and CAROUSEL_PUBLISH_SECRET, then pass a carousel JSON file.');
  process.exit(1);
}
const payload = await readFile(file);
const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  body: payload,
});
const text = await response.text();
let data = {};
try { data = JSON.parse(text); } catch { data = {}; }
if (!response.ok) {
  console.error(data.error || `Publish failed with status ${response.status}.`);
  process.exit(1);
}
console.log(`Published ${data.slug} (${data.slideCount} slides).`);
