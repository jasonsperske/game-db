'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const {
  COLUMNS,
  DEVELOPER_SEPARATOR,
  collectRegions,
  readJson,
  regionJsonPath,
  gameJsonPath,
  regionXlsxPath
} = require('./lib');

const buildRow = (guid, game) => ({
  guid,
  name: game.name ?? '',
  publisher: game.publisher ?? '',
  released_year: game.released?.year ?? '',
  released_month: game.released?.month ?? '',
  released_day: game.released?.day ?? '',
  developers: Array.isArray(game.developers) ? game.developers.join(DEVELOPER_SEPARATOR) : ''
});

const writeWorkbook = async (outputFile, rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('games');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow(row);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  await workbook.xlsx.writeFile(outputFile);
};

const mergedGameData = (region, guid, mapEntry) => {
  const recordPath = gameJsonPath(region, guid);
  if (!fs.existsSync(recordPath)) return mapEntry;
  const record = readJson(recordPath);
  return { ...mapEntry, ...record };
};

const exportRegion = async (region) => {
  const jsonFile = regionJsonPath(region);
  if (!fs.existsSync(jsonFile)) {
    console.warn(`skip ${region.company}/${region.platform}/${region.region} (no index.json)`);
    return 0;
  }
  const data = readJson(jsonFile);
  const games = data.games || {};
  const rows = Object.keys(games)
    .sort()
    .map((guid) => buildRow(guid, mergedGameData(region, guid, games[guid])));

  const outputFile = regionXlsxPath(region);
  await writeWorkbook(outputFile, rows);
  console.log(`wrote ${path.relative(process.cwd(), outputFile)} (${rows.length} games)`);
  return rows.length;
};

const main = async () => {
  const regions = collectRegions();
  let total = 0;
  for (const region of regions) {
    total += await exportRegion(region);
  }
  console.log('');
  console.log(`Exported ${regions.length} region(s), ${total} games total.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
