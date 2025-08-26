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
    if (e.range.getColumn() > 2) return;
    Utilities.sleep(150);
    syncExport({ silent: true, row: e.range.getRow() });
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

function syncExport(opts) {
  const { src, exp } = ensureSheets();
  const row = opts && opts.row;
  if (row) {
    const rich = src.getRange(row, 1, 1, 2).getRichTextValues()[0];
    const data = [richTextToMarkdown(rich[0]), richTextToMarkdown(rich[1])];
    exp.getRange(1, 1, 1, 2).setValues([HEADER]);
    exp.getRange(row, 1, 1, 2).setValues(row === 1 ? [HEADER] : [data]);
    exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
    SpreadsheetApp.flush();
    if (!(opts && opts.silent)) toast('Synced 1 row Source → Export');
    return;
  }
  const richRows = src.getDataRange().getRichTextValues();
  if (!richRows.length) {
    if (!(opts && opts.silent)) toast('No data in "Source".');
    return;
  }
  const textRows = richRows.map(r => [richTextToMarkdown(r[0]), richTextToMarkdown(r[1])]);
  const [h, ...rows] = textRows;
  const isHeader =
    String(h[0]).trim().toLowerCase() === 'type' &&
    String(h[1]).trim().toLowerCase() === 'value';
  const data = (isHeader ? rows : textRows)
    .filter(([a, b]) => (a.trim() + b.trim()) !== '');

  exp.clearContents();
  exp.getRange(1, 1, 1, 2).setValues([HEADER]);
  if (data.length) exp.getRange(2, 1, data.length, 2).setValues(data);
  exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
  SpreadsheetApp.flush();
  if (!(opts && opts.silent)) toast(`Synced ${data.length} row(s) Source → Export`);
}

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
