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
    syncExport({ row: e.range.getRow(), silent: true });
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
  const row = opts && opts.row;
  const { src, exp } = ensureSheets();

  // Single-row update (onEdit)
  if (row) {
    if (row === 1) return; // skip header row
    const rich = src.getRange(row, 1, 1, 2).getRichTextValues()[0];
    const values = [richTextToMarkdown(rich[0]), richTextToMarkdown(rich[1])];
    exp.getRange(row, 1, 1, 2).setValues([values]);
    exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
    SpreadsheetApp.flush();
    if (!(opts && opts.silent)) toast('Synced 1 row Source → Export');
    return;
  }

  const last = src.getLastRow();
  exp.clearContents();
  exp.getRange(1, 1, 1, 2).setValues([HEADER]);

  if (last <= 1) {
    exp.getRange('D1').setValue('Last sync: ' + new Date().toLocaleString());
    SpreadsheetApp.flush();
    if (!(opts && opts.silent)) toast('No data in "Source".');
    return;
  }

  const richRows = src.getRange(2, 1, last - 1, 2).getRichTextValues();
  let data = richRows.map(r => [richTextToMarkdown(r[0]), richTextToMarkdown(r[1])]);

  // Normalize the very first section so it includes Heading → Image → Caption → Description
  // and drop any duplicated plain-text "Section Description" rows.
  if (data.length && data[0][0].toLowerCase() === 'section heading') {
    const nextHeading = data.findIndex((r, i) => i > 0 && r[0].toLowerCase() === 'section heading');
    const firstSectionEnd = nextHeading === -1 ? data.length : nextHeading;
    const firstSection = data.slice(0, firstSectionEnd);
    const rest = data.slice(firstSectionEnd);

    const parts = { heading: null, image: null, caption: null, description: null };
    firstSection.forEach(r => {
      const k = r[0].toLowerCase();
      if (k === 'section heading') parts.heading = r;
      else if (k === 'section image' && !parts.image) parts.image = r;
      else if (k === 'section caption' && !parts.caption) parts.caption = r;
      else if (k === 'section description') parts.description = r; // keep last seen
    });

    const fixedFirst = [];
    if (parts.heading) fixedFirst.push(parts.heading);
    if (parts.image) fixedFirst.push(parts.image);
    if (parts.caption) fixedFirst.push(parts.caption);
    if (parts.description) fixedFirst.push(parts.description);
    data = fixedFirst.concat(rest);
  }

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
