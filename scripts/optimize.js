// Normalize the catalog and regenerate every derived file from the game records.
//
//   npm run optimize            apply changes
//   npm run optimize -- --check exit 1 if anything would change (no writes)
//
// Steps:
//   1. Apply content/_config/aliases.json: move renamed game folders, rename
//      or merge publisher/developer index entries.
//   2. Rewrite every game record in canonical form (guid = folder name,
//      aliases resolved, release date normalized, keys sorted).
//   3. Rebuild the region/platform/company indexes and the per-publisher
//      platform lists; delete publisher folders no game references.

import fs from 'node:fs';
import path from 'node:path';
import {
  CONTENT_DIR, PLATFORMS_DIR, ROOT,
  buildDerived, loadAliases, loadCatalog, normalizeGame, readJson, resolveAlias, stringify, writeJson
} from '../lib/catalog.js';

const check = process.argv.includes('--check');
const changes = [];
const note = (msg) => changes.push(msg);
const rel = (p) => path.relative(ROOT, p);

const write = (file, data) => {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === stringify(data)) return;
  note(`${prev === null ? 'create' : 'update'} ${rel(file)}`);
  if (!check) writeJson(file, data);
};

const aliases = loadAliases();

// 1a. Move renamed game folders.
for (const [from, to] of Object.entries(aliases.games)) {
  const target = resolveAlias(aliases.games, from);
  const src = path.join(PLATFORMS_DIR, from);
  const dst = path.join(PLATFORMS_DIR, target);
  if (!fs.existsSync(src)) continue;
  if (fs.existsSync(dst)) {
    console.error(`Cannot rename ${from} -> ${to}: target already exists. Merge them by hand.`);
    process.exit(1);
  }
  note(`move content/platforms/${from} -> ${target}`);
  if (!check) fs.renameSync(src, dst);
}

// 1b. Rename / merge index entries.
for (const kind of ['publishers', 'developers']) {
  const file = path.join(CONTENT_DIR, kind, 'index.json');
  const index = readJson(file, {});
  for (const from of Object.keys(aliases[kind])) {
    if (!(from in index)) continue;
    const to = resolveAlias(aliases[kind], from);
    if (!(to in index)) index[to] = index[from];
    delete index[from];
  }
  write(file, index);
}

// 2. Canonical game records. (In --check mode, folder moves above were not
//    applied, so the catalog is read from the current layout.)
const catalog = loadCatalog();
for (const game of catalog.games) {
  if (!game.record) {
    console.error(`Missing or unreadable ${rel(game.file)}`);
    process.exit(1);
  }
  game.record = normalizeGame(game.record, game.dir, aliases);
  write(game.file, game.record);
}
catalog.publishers = readJson(path.join(CONTENT_DIR, 'publishers', 'index.json'), {});

// 3. Derived files.
const { files, staleDirs } = buildDerived(catalog);
for (const [file, data] of files) write(file, data);
for (const dir of staleDirs) {
  const full = path.join(CONTENT_DIR, 'publishers', dir);
  note(`remove ${rel(full)} (no games reference this publisher)`);
  if (!check) fs.rmSync(full, { recursive: true });
}

// Report.
const incomplete = catalog.games.filter((g) => !g.record.publisher && !g.record.developers);
if (changes.length) {
  const shown = changes.length > 40 ? [...changes.slice(0, 40), `... and ${changes.length - 40} more`] : changes;
  console.log(shown.join('\n'));
}
console.log(`\n${check ? 'Would change' : 'Changed'} ${changes.length} file(s); ${catalog.games.length} games scanned.`);
if (incomplete.length) {
  console.log(`${incomplete.length} game(s) have neither a publisher nor developers:`);
  for (const g of incomplete) console.log(`  ${g.id}`);
}
if (check && changes.length) {
  console.log('\nRun `npm run optimize` and commit the result.');
  process.exit(1);
}
