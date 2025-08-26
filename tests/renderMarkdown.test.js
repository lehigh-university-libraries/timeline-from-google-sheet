const test = require('node:test');
const assert = require('node:assert');
const { renderMarkdown } = require('../scripts/markdown.js');

test('renders bold, italic and links', () => {
  const input = 'This is **bold**, *italic*, and a [link](https://example.com).';
  const html = renderMarkdown(input);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">link<\/a>/);
});
