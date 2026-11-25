// Spreadsheet round-trip for one region's games.
// Used by scripts/export-xlsx.js, scripts/import-xlsx.js and the site's
// downloadable /data/v1/.../<region>.xlsx files.

import ExcelJS from 'exceljs';

export const COLUMNS = [
  { key: 'guid', header: 'guid', width: 36 },
  { key: 'name', header: 'name', width: 40 },
  { key: 'publisher', header: 'publisher', width: 24 },
  { key: 'released_year', header: 'released_year', width: 14 },
  { key: 'released_month', header: 'released_month', width: 14 },
  { key: 'released_day', header: 'released_day', width: 14 },
  { key: 'developers', header: 'developers', width: 36 }
];

export const DEVELOPER_SEPARATOR = ';';

export const recordToRow = (record) => ({
  guid: record.guid,
  name: record.name ?? '',
  publisher: record.publisher ?? '',
  released_year: record.released?.year ?? '',
  released_month: record.released?.month ?? '',
  released_day: record.released?.day ?? '',
  developers: (record.developers || []).join(DEVELOPER_SEPARATOR)
});

/** Build a workbook for a list of game records (sorted by guid). */
export const buildWorkbook = (records) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('games');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const record of [...records].sort((a, b) => a.guid.localeCompare(b.guid))) {
    sheet.addRow(recordToRow(record));
  }
  return workbook;
};

const cellString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((t) => t.text).join('').trim();
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result).trim();
  return String(value).trim();
};

const cellInt = (value) => {
  const n = parseInt(cellString(value), 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Read rows back out of a workbook file. Throws on a header mismatch. */
export const readWorkbookRows = async (file) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`No sheets in ${file}`);

  const header = sheet.getRow(1);
  COLUMNS.forEach((col, i) => {
    const got = cellString(header.getCell(i + 1).value);
    if (got !== col.header) {
      throw new Error(`Header mismatch in ${file}: column ${i + 1} expected "${col.header}", got "${got}"`);
    }
  });

  const rows = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const cell = (key) => row.getCell(COLUMNS.findIndex((c) => c.key === key) + 1).value;
    const guid = cellString(cell('guid'));
    if (!guid) return;
    rows.push({
      line: n,
      guid,
      name: cellString(cell('name')),
      publisher: cellString(cell('publisher')),
      released: { year: cellInt(cell('released_year')), month: cellInt(cell('released_month')), day: cellInt(cell('released_day')) },
      developers: cellString(cell('developers')).split(DEVELOPER_SEPARATOR).map((s) => s.trim()).filter(Boolean)
    });
  });
  return rows;
};
