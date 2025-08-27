/** Timeline Export — auto-sync, preserves rich text formatting */
const SOURCE_SHEET = 'Source';
const EXPORT_SHEET = 'Export';
const HEADER = ['Type', 'Value'];

function initializeExport() {
  const { exp } = ensureSheets();
  exp.clear();
  exp.getRange(1, 1, 1, 2).setValues([HEADER]);
  syncExport({ silent: false });
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (!sh || sh.getName() !== SOURCE_SHEET) return;
    if (e.range.getColumn() > 2 || e.range.getLastColumn() > 2) return;

    Utilities.sleep(150); // allow rich text to settle
    // Deterministic: always full rebuild to avoid duplicate/partial states
    syncExport({ silent: true });
  } catch (err) {
    Logger.log('onEdit error: ' + err);
  }
}

function richTextToMarkdown(rich) {
  if (!rich) return '';
  const txt = rich.getText();
  const runs = rich.getRuns();
  let out = '', idx = 0;
  runs.forEach(run => {
    const start = run.getStartIndex();
    const end = run.getEndIndex();
    if (start > idx) out += txt.substring(idx, start);
    let seg = txt.substring(start, end);
    const style = run.getTextStyle();
    if (style.isBold() && style.isItalic()) seg = `***${seg}***`;
    else if (style.isBold()) seg = `**${seg}**`;
    else if (style.isItalic()) seg = `*${seg}*`;
    const link = run.getLinkUrl();
    if (link) seg = `[${seg}](${link})`;
    out += seg;
    idx = end;
  });
  if (idx < txt.length) out += txt.substring(idx);
  return out;
}

function resolveValue(typeRich, valueRich, row, src) {
  const key = norm(typeRich.getText());
  if (key.endsWith('image')) {
    // Preserve visible URL or =IMAGE() result
    const d = src.getRange(row, 2).getDisplayValue();
    return d !== '' ? d : valueRich.getText();
  }
  const md = valueRich ? richTextToMarkdown(valueRich) : '';
  if (md) return md;
  return src.getRange(row, 2).getDisplayValue();
}

function syncExport(opts) {
  const { src, exp } = ensureSheets();
  const last = src.getLastRow();

  exp.clearContents();
  exp.getRange(1, 1, 1, 2).setValues([HEADER]);

  if (last < 1) {
    exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
    SpreadsheetApp.flush();
    if (!(opts && opts.silent)) toast('No data in "Source".');
    return;
  }

  const height = last;
  const richRows = src.getRange(1, 1, height, 2).getRichTextValues();

  // Build normalized keys + resolved values
  const keys = richRows.map(r => norm(r[0].getText()));
  const values = richRows.map((r, i) => resolveValue(r[0], r[1], i + 1, src));

  let data = [];

  // Normalize the FIRST Section to exactly 4 rows in fixed order
  const count = firstSectionCount(src); // number of rows in the first section block
  if (count > 0) {
    const parts = { heading: '', image: '', caption: '', description: '' };
    for (let i = 0; i < count; i++) {
      const k = keys[i], val = values[i];
      if (k === 'section heading') parts.heading = val;
      else if (k === 'section image') parts.image = val;
      else if (k === 'section caption') parts.caption = val;
      else if (k === 'section description') parts.description = val; // last wins
    }
    data.push(['Section Heading', parts.heading]);
    data.push(['Section Image', parts.image]);
    data.push(['Section Caption', parts.caption]);
    data.push(['Section Description', parts.description]);

    // Append remainder AFTER the first section block
    for (let i = count; i < keys.length; i++) {
      data.push([titleCase(keys[i]), values[i]]);
    }
  } else {
    // No leading section; pass through as-is
    for (let i = 0; i < keys.length; i++) {
      data.push([titleCase(keys[i]), values[i]]);
    }
  }

  // Write out
  if (data.length) exp.getRange(2, 1, data.length, 2).setValues(data);
  exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
  SpreadsheetApp.flush();
  if (!(opts && opts.silent)) toast(`Synced ${data.length} row(s) Source → Export`);
}

function firstSectionCount(src) {
  const last = src.getLastRow();
  if (last < 1) return 0;
  const vals = src.getRange(1, 1, last, 1).getDisplayValues().map(r => norm(r[0]));
  if (!vals.length || vals[0] !== 'section heading') return 0;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === 'section heading') return i; // number of rows before next heading
  }
  return vals.length; // runs to end
}

function norm(s) {
  return (s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function titleCase(k) { return k ? k.replace(/\b\w/g, c => c.toUpperCase()) : ''; }

function ensureSheets() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Open the spreadsheet, then Extensions → Apps Script.');
  const src = ss.getSheetByName(SOURCE_SHEET);
  if (!src) throw new Error(`Missing sheet named "${SOURCE_SHEET}". Rename your source tab exactly to "${SOURCE_SHEET}".`);
  let exp = ss.getSheetByName(EXPORT_SHEET);
  if (!exp) exp = ss.insertSheet(EXPORT_SHEET);
  return { ss, src, exp };
}
function toast(msg) { SpreadsheetApp.getActive().toast(msg, 'Timeline Export', 3); }
