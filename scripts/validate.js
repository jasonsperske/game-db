// Validate the catalog. Exits 1 on any error; warnings are informational.
//
//   npm run validate                summary of warnings
//   npm run validate -- --verbose   list every warning

import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  CONTENT_DIR, GUID_PATTERN, ROOT,
  buildDerived, defaultSortName, loadCatalog, normalizeGame, readJson, stringify
} from '../lib/catalog.js';

const verbose = process.argv.includes('--verbose');
const errors = [];
const warnings = {};
const error = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (kind, item) => (warnings[kind] ||= []).push(item);
const rel = (p) => path.relative(ROOT, p);

const schema = (name) => readJson(path.join(ROOT, 'schema', name));
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(schema('game-record.schema.json'));
const validateRecord = ajv.getSchema('game-record.schema.json');
const validateNameIndex = ajv.compile(schema('name-index.schema.json'));

const catalog = loadCatalog();
const { aliases } = catalog;

// --- name indexes
for (const kind of ['publishers', 'developers']) {
  if (!validateNameIndex(catalog[kind])) {
    for (const e of validateNameIndex.errors) error(`content/${kind}/index.json`, `${e.instancePath || '/'} ${e.message}`);
  }
  for (const key of Object.keys(catalog[kind])) {
    if (key in aliases[kind]) error(`content/${kind}/index.json`, `"${key}" is a retired alias of "${aliases[kind][key]}"`);
  }
}

// --- folder names
for (const region of catalog.regions) {
  for (const seg of [region.company, region.platform, region.guid]) {
    if (!GUID_PATTERN.test(seg)) error(`content/platforms/${region.path}`, `folder "${seg}" is not a valid guid`);
  }
}

// --- game records
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const usedPublishers = new Set();
const usedDevelopers = new Set();

for (const game of catalog.games) {
  const where = rel(game.file);
  const r = game.record;
  if (!r) { error(where, 'missing or unreadable'); continue; }

  if (aliases.games[game.id]) error(where, `retired guid; should be ${aliases.games[game.id]} (run optimize)`);
  if (!validateRecord(r)) {
    for (const e of validateRecord.errors) error(where, `${e.instancePath || '/'} ${e.message}`);
  }
  if (r.guid !== game.dir) error(where, `guid "${r.guid}" does not match folder "${game.dir}"`);

  const rel_ = r.released;
  if (rel_?.year && rel_.month && rel_.day && rel_.day > daysIn(rel_.year, rel_.month)) {
    error(where, `released ${rel_.year}-${rel_.month}-${rel_.day} is not a real date`);
  }

  if (r.publisher) {
    usedPublishers.add(r.publisher);
    if (r.publisher in aliases.publishers) error(where, `publisher "${r.publisher}" is retired; use "${aliases.publishers[r.publisher]}"`);
    else if (!catalog.publishers[r.publisher]) error(where, `publisher "${r.publisher}" is not in content/publishers/index.json`);
  } else warn('no publisher', game.id);

  for (const d of r.developers || []) {
    usedDevelopers.add(d);
    if (d in aliases.developers) error(where, `developer "${d}" is retired; use "${aliases.developers[d]}"`);
    else if (!catalog.developers[d]) error(where, `developer "${d}" is not in content/developers/index.json`);
  }
  // A sort_name other than the default (or the name itself) is either a
  // deliberate choice or left over from a rename; list it for review.
  if (r.sort_name && r.name && r.sort_name !== r.name && r.sort_name !== defaultSortName(r.name)) {
    warn('custom sort_name', `${game.id}: "${r.sort_name}" for "${r.name}"`);
  }
  if (!r.developers) warn('no developers', game.id);
  if (!r.released) warn('no release date', game.id);
  else if (!r.released.month) warn('release year only', game.id);

  if (stringify(normalizeGame(r, game.dir, aliases)) !== fs.readFileSync(game.file, 'utf8')) {
    error(where, 'not in canonical form (run optimize)');
  }
}

// --- duplicate names within a region
for (const region of catalog.regions) {
  const seen = {};
  for (const g of region.games) {
    const key = g.record?.name?.toLowerCase();
    if (!key) continue;
    if (seen[key]) warn('duplicate name in region', `${seen[key]} / ${g.id}`);
    else seen[key] = g.id;
  }
}

// --- unused index entries
for (const k of Object.keys(catalog.publishers)) if (!usedPublishers.has(k)) warn('unused publisher entry', k);
for (const k of Object.keys(catalog.developers)) if (!usedDevelopers.has(k)) warn('unused developer entry', k);

// --- derived files in sync
const { files, staleDirs } = buildDerived(catalog);
let outOfSync = 0;
for (const [file, data] of files) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current !== stringify(data)) {
    outOfSync++;
    if (outOfSync <= 10) error(rel(file), 'derived file is out of date (run optimize)');
  }
}
if (outOfSync > 10) error('content', `${outOfSync - 10} more derived files are out of date (run optimize)`);
for (const d of staleDirs) error(`content/publishers/${d}`, 'no game references this publisher (run optimize)');

// --- report
const total = catalog.games.length;
console.log(`${total} games in ${catalog.regions.length} regions, ${usedPublishers.size} publishers, ${usedDevelopers.size} developers.`);
const kinds = Object.keys(warnings).sort();
if (kinds.length) {
  console.log('\nWarnings:');
  for (const kind of kinds) {
    const list = warnings[kind];
    console.log(`  ${String(list.length).padStart(5)}  ${kind}`);
    if (verbose) for (const item of list) console.log(`           ${item}`);
  }
  if (!verbose) console.log('  (use --verbose to list them)');
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 200)) console.log(`  ${e}`);
  if (errors.length > 200) console.log(`  ... and ${errors.length - 200} more`);
  process.exit(1);
}
console.log('\nOK');
