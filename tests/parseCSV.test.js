const test = require('node:test');
const assert = require('node:assert');
const parseCSV = require('../scripts/parseCSV');

test('handles quoted fields', () => {
  const csv = '"a","b","c"';
  assert.deepStrictEqual(parseCSV(csv), [["a","b","c"]]);
});

test('handles escaped quotes', () => {
  const csv = '"a","b ""c"" d","e"';
  assert.deepStrictEqual(parseCSV(csv), [["a","b \"c\" d","e"]]);
});

test('handles empty rows', () => {
  const csv = 'a,b\n\nc,d';
  assert.deepStrictEqual(parseCSV(csv), [["a","b"],[""],["c","d"]]);
});

test('parses multiline fields', () => {
  const csv = 'a,"b\nc",d';
  assert.deepStrictEqual(parseCSV(csv), [["a","b\nc","d"]]);
});
