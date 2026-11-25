// Write data/platforms/<company>/<platform>/<region>.xlsx from the JSON catalog.
// These are working copies for spreadsheet editing; they are not committed.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadCatalog } from '../lib/catalog.js';
import { buildWorkbook } from '../lib/xlsx.js';

const catalog = loadCatalog();
let total = 0;
for (const region of catalog.regions) {
  const records = region.games.map((g) => g.record).filter(Boolean);
  const file = path.join(ROOT, 'data', 'platforms', region.company, region.platform, `${region.guid}.xlsx`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await buildWorkbook(records).xlsx.writeFile(file);
  console.log(`wrote ${path.relative(ROOT, file)} (${records.length} games)`);
  total += records.length;
}
console.log(`\nExported ${catalog.regions.length} region(s), ${total} games. Edit them, then run \`npm run import\`.`);
