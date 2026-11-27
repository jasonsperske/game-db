// Apply edits from data/platforms/<company>/<platform>/<region>.xlsx back to
// the JSON game records.
//
// The sheet owns the name / publisher / released / developers fields: an empty
// cell clears that field. Any other fields on a record are preserved, except
// that renaming a game resets its sort_name (optimize fills it in). New guids
// create new game folders. Games missing from the sheet are reported, never
// deleted. Run `npm run optimize && npm run validate` afterwards.

import fs from 'node:fs';
import path from 'node:path';
import {
  GUID_PATTERN, PLATFORMS_DIR, ROOT,
  loadAliases, normalizeGame, readJson, resolveAlias, writeJson
} from '../lib/catalog.js';
import { readWorkbookRows } from '../lib/xlsx.js';

const DATA_DIR = path.join(ROOT, 'data', 'platforms');

const walk = (dir) =>
  !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.xlsx') && !e.name.startsWith('~$') ? [full] : [];
  });

const files = walk(DATA_DIR);
if (!files.length) {
  console.error('No xlsx files under data/platforms. Run `npm run export` first.');
  process.exit(1);
}

const aliases = loadAliases();
let created = 0, updated = 0, problems = 0;

for (const file of files) {
  const segments = path.relative(DATA_DIR, file).split(path.sep);
  if (segments.length !== 3) {
    console.error(`skip ${path.relative(ROOT, file)}: expected data/platforms/<company>/<platform>/<region>.xlsx`);
    problems++;
    continue;
  }
  const regionPath = [segments[0], segments[1], segments[2].replace(/\.xlsx$/, '')].join('/');
  if (!fs.existsSync(path.join(PLATFORMS_DIR, regionPath))) {
    console.error(`skip ${path.relative(ROOT, file)}: content/platforms/${regionPath} does not exist`);
    problems++;
    continue;
  }

  const rows = await readWorkbookRows(file);
  const seen = new Set();

  for (const row of rows) {
    const id = resolveAlias(aliases.games, `${regionPath}/${row.guid}`);
    const guid = id.split('/').pop();
    if (!GUID_PATTERN.test(guid)) {
      console.error(`  ${path.relative(ROOT, file)}:${row.line} invalid guid "${row.guid}" (ASCII letters, digits and ._~!$&'()+,;=@- only)`);
      problems++;
      continue;
    }
    if (seen.has(guid)) {
      console.error(`  ${path.relative(ROOT, file)}:${row.line} duplicate guid "${guid}"`);
      problems++;
      continue;
    }
    seen.add(guid);

    const recordFile = path.join(PLATFORMS_DIR, id, 'index.json');
    const existing = readJson(recordFile, null);
    const { name, publisher, released, developers, ...rest } = existing || {};
    // A renamed game gets its sort_name worked out again from the new name.
    if (row.name && row.name !== name) delete rest.sort_name;
    const next = normalizeGame(
      { ...rest, name: row.name || name || guid, publisher: row.publisher, released: row.released, developers: row.developers },
      guid,
      aliases
    );
    if (writeJson(recordFile, next)) existing ? updated++ : created++;
  }

  const missing = fs.readdirSync(path.join(PLATFORMS_DIR, regionPath), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !seen.has(e.name))
    .map((e) => e.name);
  if (missing.length) {
    console.log(`  ${regionPath}: ${missing.length} game(s) are not in the sheet and were left untouched: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''}`);
  }
  console.log(`read ${path.relative(ROOT, file)} (${rows.length} rows)`);
}

console.log(`\n${created} created, ${updated} updated, ${problems} problem(s).`);
console.log('Next: npm run optimize && npm run validate');
if (problems) process.exit(1);
