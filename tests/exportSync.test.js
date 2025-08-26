const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function makeRichText(text, opts = {}) {
  const { bold = false, italic = false, link = null } = opts;
  return {
    getText: () => text,
    getRuns: () => [{
      getStartIndex: () => 0,
      getEndIndex: () => text.length,
      getTextStyle: () => ({
        isBold: () => bold,
        isItalic: () => italic,
      }),
      getLinkUrl: () => link,
    }],
  };
}

class Sheet {
  constructor(name, data = []) {
    this.name = name;
    this.data = data;
    this.meta = {};
  }
  getName() { return this.name; }
  getDataRange() { return { getRichTextValues: () => this.data }; }
  getLastRow() { return this.data.length; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      if (a === 'D1') return { setValue: v => { this.meta.D1 = v; } };
      throw new Error('Unsupported range ' + a);
    }
    const row = a, col = b, rows = c || 1, cols = d || 1;
    const self = this;
    return {
      getRichTextValues: () => {
        const out = [];
        for (let r = 0; r < rows; r++) {
          const rowArr = [];
          for (let c = 0; c < cols; c++) {
            rowArr.push(self.data[row - 1 + r]?.[col - 1 + c] || makeRichText(''));
          }
          out.push(rowArr);
        }
        return out;
      },
      setValues: vals => {
        for (let r = 0; r < rows; r++) {
          if (!self.data[row - 1 + r]) self.data[row - 1 + r] = [];
          for (let c = 0; c < cols; c++) {
            self.data[row - 1 + r][col - 1 + c] = vals[r][c];
          }
        }
      },
    };
  }
  clear() { this.data = []; this.meta = {}; }
  clearContents() { this.data = []; }
}

class Spreadsheet {
  constructor(src, exp) {
    this.sheets = { Source: src, Export: exp };
  }
  getSheetByName(n) { return this.sheets[n]; }
  insertSheet(n) { const sh = new Sheet(n); this.sheets[n] = sh; return sh; }
  toast() {}
}

function createEnv(srcData) {
  const src = new Sheet('Source', srcData);
  const exp = new Sheet('Export');
  const ss = new Spreadsheet(src, exp);
  const SpreadsheetApp = { getActive: () => ss, flush: () => {} };
  const sandbox = { SpreadsheetApp, Logger: { log: () => {} }, Utilities: { sleep: () => {} } };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '../apps-script/export.gs'), 'utf8');
  vm.runInContext(code, sandbox);
  return { sandbox, src, exp };
}

test('syncExport rebuilds full sheet', () => {
  const sourceData = [
    [makeRichText('Type'), makeRichText('Value')],
    [makeRichText('Bold', { bold: true }), makeRichText('Italic', { italic: true })],
  ];
  const { sandbox, exp } = createEnv(sourceData);
  sandbox.syncExport({ silent: true });
  assert.deepStrictEqual(exp.data, [
    ['Type', 'Value'],
    ['**Bold**', '*Italic*'],
  ]);
});

test('syncExport updates single row', () => {
  const sourceData = [
    [makeRichText('Type'), makeRichText('Value')],
    [makeRichText('Bold', { bold: true }), makeRichText('Italic', { italic: true })],
  ];
  const { sandbox, src, exp } = createEnv(sourceData);
  sandbox.syncExport({ silent: true });
  src.data[1] = [
    makeRichText('Link', { link: 'https://x.test' }),
    makeRichText('BI', { bold: true, italic: true }),
  ];
  sandbox.syncExport({ silent: true, row: 2 });
  assert.deepStrictEqual(exp.data, [
    ['Type', 'Value'],
    ['[Link](https://x.test)', '***BI***'],
  ]);
});

test('syncExport normalizes first section rows', () => {
  const sourceData = [
    [makeRichText('Type'), makeRichText('Value')],
    [makeRichText('Section Heading'), makeRichText('Head')],
    [makeRichText('Section Description'), makeRichText('Plain')],
    [makeRichText('Section Image'), makeRichText('img')],
    [makeRichText('Section Caption'), makeRichText('cap')],
    [makeRichText('Section Description'), makeRichText('MD', { bold: true })],
  ];
  const { sandbox, exp } = createEnv(sourceData);
  sandbox.syncExport({ silent: true });
  assert.deepStrictEqual(exp.data, [
    ['Type', 'Value'],
    ['Section Heading', 'Head'],
    ['Section Image', 'img'],
    ['Section Caption', 'cap'],
    ['Section Description', '**MD**'],
  ]);
});

