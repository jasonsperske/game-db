'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const DATA_DIR = path.join(ROOT, 'data');

const COLUMNS = [
  { key: 'guid',           header: 'guid',           width: 36 },
  { key: 'name',           header: 'name',           width: 40 },
  { key: 'publisher',      header: 'publisher',      width: 24 },
  { key: 'released_year',  header: 'released_year',  width: 14 },
  { key: 'released_month', header: 'released_month', width: 14 },
  { key: 'released_day',   header: 'released_day',   width: 14 },
  { key: 'developers',     header: 'developers',     width: 36 }
];

const DEVELOPER_SEPARATOR = ';';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};

const sortObject = (value) => {
  if (Array.isArray(value) || value === null || typeof value !== 'object') {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObject(value[key]);
  }
  return sorted;
};

const padTwo = (n) => String(n).padStart(2, '0');

const sortableFromReleased = ({ year, month, day }) => {
  if (!year) return undefined;
  return `${year}-${padTwo(month || 1)}-${padTwo(day || 1)}`;
};

const collectRegions = () => {
  const platformsIndex = readJson(path.join(CONTENT_DIR, 'platforms', 'index.json'));
  const regions = [];

  for (const companyKey of Object.keys(platformsIndex.companies || {})) {
    const company = readJson(path.join(CONTENT_DIR, 'platforms', companyKey, 'index.json'));
    for (const platformKey of Object.keys(company.platforms || {})) {
      const platform = readJson(
        path.join(CONTENT_DIR, 'platforms', company.guid, platformKey, 'index.json')
      );
      for (const regionKey of Object.keys(platform.regions || {})) {
        regions.push({
          company: company.guid,
          platform: platform.guid,
          region: regionKey
        });
      }
    }
  }
  return regions;
};

const regionJsonPath = ({ company, platform, region }) =>
  path.join(CONTENT_DIR, 'platforms', company, platform, region, 'index.json');

const gameJsonPath = ({ company, platform, region }, guid) =>
  path.join(CONTENT_DIR, 'platforms', company, platform, region, guid, 'index.json');

const regionXlsxPath = ({ company, platform, region }) =>
  path.join(DATA_DIR, 'platforms', company, platform, `${region}.xlsx`);

const walkXlsx = (dir = path.join(DATA_DIR, 'platforms')) => {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkXlsx(full));
    } else if (entry.isFile() && entry.name.endsWith('.xlsx')) {
      found.push(full);
    }
  }
  return found;
};

const xlsxPathToRegion = (xlsxFile) => {
  const rel = path.relative(path.join(DATA_DIR, 'platforms'), xlsxFile);
  const segments = rel.split(path.sep);
  if (segments.length !== 3) {
    throw new Error(`Unexpected xlsx layout: ${xlsxFile} (expected platforms/<co>/<plat>/<region>.xlsx)`);
  }
  return {
    company: segments[0],
    platform: segments[1],
    region: segments[2].replace(/\.xlsx$/, '')
  };
};

module.exports = {
  ROOT,
  CONTENT_DIR,
  DATA_DIR,
  COLUMNS,
  DEVELOPER_SEPARATOR,
  readJson,
  writeJson,
  sortObject,
  sortableFromReleased,
  collectRegions,
  regionJsonPath,
  gameJsonPath,
  regionXlsxPath,
  walkXlsx,
  xlsxPathToRegion
};
