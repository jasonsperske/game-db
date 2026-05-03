'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const {
  COLUMNS,
  DEVELOPER_SEPARATOR,
  readJson,
  writeJson,
  sortObject,
  sortableFromReleased,
  regionJsonPath,
  gameJsonPath,
  walkXlsx,
  xlsxPathToRegion
} = require('./lib');

const EXPECTED_HEADERS = COLUMNS.map((c) => c.header);

const cellString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result).trim();
  return String(value).trim();
};

const cellNumber = (value) => {
  const str = cellString(value);
  if (!str) return undefined;
  const n = Number(str);
  return Number.isFinite(n) ? n : undefined;
};

const readWorkbook = async (xlsxFile) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxFile);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`No sheets in ${xlsxFile}`);

  const headerRow = sheet.getRow(1);
  const headers = EXPECTED_HEADERS.map((_, idx) => cellString(headerRow.getCell(idx + 1).value));
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        `Header mismatch in ${xlsxFile}: column ${i + 1} expected "${EXPECTED_HEADERS[i]}", got "${headers[i]}"`
      );
    }
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (key) => {
      const idx = COLUMNS.findIndex((c) => c.key === key) + 1;
      return row.getCell(idx).value;
    };
    const guid = cellString(get('guid'));
    if (!guid) return;
    rows.push({
      guid,
      name: cellString(get('name')),
      publisher: cellString(get('publisher')),
      released_year: cellNumber(get('released_year')),
      released_month: cellNumber(get('released_month')),
      released_day: cellNumber(get('released_day')),
      developers: cellString(get('developers'))
    });
  });
  return rows;
};

const buildCommonFields = (row) => {
  const fields = { name: row.name };
  if (row.publisher) fields.publisher = row.publisher;

  const released = {};
  if (row.released_year !== undefined) released.year = row.released_year;
  if (row.released_month !== undefined) released.month = row.released_month;
  if (row.released_day !== undefined) released.day = row.released_day;
  const sortable = sortableFromReleased(released);
  if (sortable) released.sortable = sortable;
  if (Object.keys(released).length) fields.released = released;

  const developers = row.developers
    ? row.developers.split(DEVELOPER_SEPARATOR).map((s) => s.trim()).filter(Boolean)
    : [];
  if (developers.length) fields.developers = developers;

  return fields;
};

const buildGameEntry = (row) => buildCommonFields(row);

const buildGameRecord = (row) => ({ guid: row.guid, ...buildCommonFields(row) });

const importRegion = async (xlsxFile) => {
  const region = xlsxPathToRegion(xlsxFile);
  const rows = await readWorkbook(xlsxFile);

  const jsonFile = regionJsonPath(region);
  const existing = fs.existsSync(jsonFile) ? readJson(jsonFile) : {};

  const games = {};
  for (const row of rows) {
    games[row.guid] = buildGameEntry(row);
    writeJson(gameJsonPath(region, row.guid), sortObject(buildGameRecord(row)));
  }

  const merged = {
    ...existing,
    guid: existing.guid ?? region.region,
    name: existing.name ?? region.region,
    games
  };

  writeJson(jsonFile, sortObject(merged));
  console.log(`wrote ${path.relative(process.cwd(), jsonFile)} (${rows.length} games + per-game files)`);
  return rows.length;
};

const main = async () => {
  const files = walkXlsx();
  if (!files.length) {
    console.error('No xlsx files found under data/platforms — run `npm run export` first.');
    process.exit(1);
  }
  let total = 0;
  for (const file of files) {
    total += await importRegion(file);
  }
  console.log('');
  console.log(`Imported ${files.length} xlsx file(s), ${total} games total.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
