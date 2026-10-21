import test from 'node:test';
import assert from 'node:assert/strict';
import { carouselReading, captionHash } from '../src/lib/carousel-reading.mjs';

test('cleans numbered notes without repeating their heading', () => {
  assert.deepEqual(carouselReading({number:3,text:'02 / THE CATCH: The catch: credits. / Read the terms first.'}), {heading:'The catch',paragraphs:['Credits.','Read the terms first.']});
});
test('preserves URLs and meaningful numbers', () => {
  const result=carouselReading({number:1,text:'3.7% was the annual increase. Visit https://example.com/guide for details.'});
  assert.equal(result.paragraphs.join(' '),'3.7% was the annual increase. Visit https://example.com/guide for details.');
});
test('new source edits take precedence over curated captions', () => {
  const result=carouselReading({number:1,text:'New information from the author.'},'figma-code-layers');
  assert.deepEqual(result.paragraphs,['New information from the author.']);
  assert.equal(captionHash('same'),captionHash('same'));
  assert.notEqual(captionHash('same'),captionHash('changed'));
});
