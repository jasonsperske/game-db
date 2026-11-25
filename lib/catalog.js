// Shared catalog model used by the maintenance scripts and the Astro site.
//
// Source of truth: the per-game records at
//   content/platforms/<company>/<platform>/<region>/<game>/index.json
// plus the hand-maintained metadata files:
//   content/platforms/<company>/index.json            (company name)
//   content/platforms/<company>/<platform>/index.json (platform name)
//   content/platforms/<c>/<p>/<region>/index.json      (region name)
//   content/publishers/index.json                      (publisher names)
//   content/developers/index.json                      (developer names)
//   content/_config/aliases.json                       (renamed / merged guids)
//
// Everything else (the `games` map in each region index, the `platforms` /
// `regions` maps in parent indexes, and content/publishers/<guid>/index.json)
// is derived by `buildDerived()` and written by `npm run optimize`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// When Astro bundles this module it runs from dist/, so fall back to the
// working directory (astro is always run from the repo root).
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = fs.existsSync(path.join(moduleRoot, 'content', 'platforms')) ? moduleRoot : process.cwd();
export const CONTENT_DIR = path.join(ROOT, 'content');
export const PLATFORMS_DIR = path.join(CONTENT_DIR, 'platforms');
export const ALIASES_FILE = path.join(CONTENT_DIR, '_config', 'aliases.json');

// Guids are used as directory names, URL path segments and join keys, so they
// must be ASCII with no whitespace and none of the characters that need
// percent-encoding in a URL path or are illegal in Windows file names.
export const GUID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~!$&'()+,;=@-]*$/;

// ---------------------------------------------------------------- json io

export const sortObject = (value) => {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== 'object') return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortObject(value[key]);
  return sorted;
};

export const stringify = (data) => JSON.stringify(sortObject(data), null, 2) + '\n';

export const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined && e.code === 'ENOENT') return fallback;
    throw new Error(`Failed to read ${path.relative(ROOT, file)}: ${e.message}`);
  }
};

/** Write JSON in canonical form; returns true when the file changed. */
export const writeJson = (file, data) => {
  const next = stringify(data);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
};

const subdirs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort()
    : [];

// ---------------------------------------------------------------- dates

const pad = (n) => String(n).padStart(2, '0');

export const sortableDate = (released) => {
  if (!released?.year) return undefined;
  return `${released.year}-${pad(released.month || 1)}-${pad(released.day || 1)}`;
};

/** Canonical released object: integer year/month/day + derived sortable. */
export const normalizeReleased = (released) => {
  if (!released || typeof released !== 'object') return undefined;
  const out = {};
  for (const key of ['year', 'month', 'day']) {
    const n = parseInt(released[key], 10);
    if (Number.isFinite(n)) out[key] = n;
  }
  if (!out.year) return undefined;
  out.sortable = sortableDate(out);
  return out;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const formatReleased = (released) => {
  if (!released?.year) return 'Unknown';
  const { year, month, day } = released;
  if (month && day) return `${MONTHS[month - 1]} ${ordinal(day)} ${year}`;
  if (month) return `${MONTHS[month - 1]} ${year}`;
  return String(year);
};

// ---------------------------------------------------------------- aliases

export const loadAliases = () => {
  const a = readJson(ALIASES_FILE, {});
  return { games: a.games || {}, publishers: a.publishers || {}, developers: a.developers || {} };
};

/** Follow alias chains (A -> B -> C) to the final guid. */
export const resolveAlias = (map, guid) => {
  const seen = new Set();
  let current = guid;
  while (map[current] !== undefined) {
    if (seen.has(current)) throw new Error(`Alias cycle at ${current}`);
    seen.add(current);
    current = map[current];
  }
  return current;
};

// ---------------------------------------------------------------- loading

export const gameId = (regionPath, guid) => `${regionPath}/${guid}`;

/**
 * Read the source-of-truth parts of the catalog.
 * Returns plain objects; nothing is written.
 */
export const loadCatalog = () => {
  const rootIndex = readJson(path.join(PLATFORMS_DIR, 'index.json'), {});
  const companies = [];
  const games = [];

  for (const companyGuid of subdirs(PLATFORMS_DIR)) {
    const companyDir = path.join(PLATFORMS_DIR, companyGuid);
    const companyIndex = readJson(path.join(companyDir, 'index.json'), {});
    const company = {
      guid: companyGuid,
      name: companyIndex.name || rootIndex.companies?.[companyGuid]?.name || companyGuid,
      index: companyIndex,
      platforms: []
    };
    companies.push(company);

    for (const platformGuid of subdirs(companyDir)) {
      const platformDir = path.join(companyDir, platformGuid);
      const platformIndex = readJson(path.join(platformDir, 'index.json'), {});
      const platform = {
        guid: platformGuid,
        name: platformIndex.name || companyIndex.platforms?.[platformGuid]?.name || platformGuid,
        company: companyGuid,
        index: platformIndex,
        regions: []
      };
      company.platforms.push(platform);

      for (const regionGuid of subdirs(platformDir)) {
        const regionDir = path.join(platformDir, regionGuid);
        const regionIndex = readJson(path.join(regionDir, 'index.json'), {});
        const regionPath = `${companyGuid}/${platformGuid}/${regionGuid}`;
        const region = {
          guid: regionGuid,
          name: regionIndex.name || platformIndex.regions?.[regionGuid]?.name || regionGuid,
          company: companyGuid,
          platform: platformGuid,
          path: regionPath,
          index: regionIndex,
          games: []
        };
        platform.regions.push(region);

        for (const dirName of subdirs(regionDir)) {
          const file = path.join(regionDir, dirName, 'index.json');
          const record = readJson(file, null);
          const game = {
            id: gameId(regionPath, dirName),
            dir: dirName,
            file,
            region: region,
            record
          };
          region.games.push(game);
          games.push(game);
        }
      }
    }
  }

  return {
    rootIndex,
    companies,
    regions: companies.flatMap((c) => c.platforms.flatMap((p) => p.regions)),
    games,
    publishers: readJson(path.join(CONTENT_DIR, 'publishers', 'index.json'), {}),
    developers: readJson(path.join(CONTENT_DIR, 'developers', 'index.json'), {}),
    publisherDirs: subdirs(path.join(CONTENT_DIR, 'publishers')),
    aliases: loadAliases()
  };
};

// ---------------------------------------------------------------- normalizing

/** Canonical form of a game record (aliases applied, dates normalized). */
export const normalizeGame = (record, guid, aliases) => {
  const out = { ...record, guid };
  if (typeof out.name === 'string') out.name = out.name.trim();

  const publisher = typeof out.publisher === 'string' ? out.publisher.trim() : '';
  if (publisher) out.publisher = resolveAlias(aliases.publishers, publisher);
  else delete out.publisher;

  const developers = [...new Set(
    (Array.isArray(out.developers) ? out.developers : [])
      .map((d) => String(d).trim())
      .filter(Boolean)
      .map((d) => resolveAlias(aliases.developers, d))
  )];
  if (developers.length) out.developers = developers;
  else delete out.developers;

  const released = normalizeReleased(out.released);
  if (released) out.released = released;
  else delete out.released;

  return out;
};

/** Region-map entry: the game record minus its guid (the map key). */
const mapEntry = ({ guid, ...rest }) => rest;

/**
 * Compute every derived file from the source records.
 * Returns { files: Map<absPath, data>, staleDirs: string[] (publisher dirs to remove) }.
 * Assumes game records are already normalized (run optimize first).
 */
export const buildDerived = (catalog) => {
  const files = new Map();
  const rel = (...p) => path.join(PLATFORMS_DIR, ...p, 'index.json');

  const rootCompanies = {};
  const publisherPlatforms = {};

  for (const company of catalog.companies) {
    rootCompanies[company.guid] = { name: company.name };
    const platforms = {};
    for (const platform of company.platforms) {
      platforms[platform.guid] = { name: platform.name };
      const regions = {};
      for (const region of platform.regions) {
        regions[region.guid] = { name: region.name };
        const games = {};
        for (const game of region.games) {
          if (!game.record) continue;
          games[game.dir] = mapEntry(game.record);
          if (game.record.publisher) {
            (publisherPlatforms[game.record.publisher] ||= new Set()).add(region.path);
          }
        }
        const { games: _g, ...regionMeta } = region.index;
        files.set(rel(company.guid, platform.guid, region.guid), {
          ...regionMeta, guid: region.guid, name: region.name, games
        });
      }
      const { regions: _r, ...platformMeta } = platform.index;
      files.set(rel(company.guid, platform.guid), {
        ...platformMeta, guid: platform.guid, name: platform.name, regions
      });
    }
    const { platforms: _p, ...companyMeta } = company.index;
    files.set(rel(company.guid), { ...companyMeta, guid: company.guid, name: company.name, platforms });
  }
  files.set(path.join(PLATFORMS_DIR, 'index.json'), { ...catalog.rootIndex, companies: rootCompanies });

  for (const [guid, regions] of Object.entries(publisherPlatforms)) {
    files.set(path.join(CONTENT_DIR, 'publishers', guid, 'index.json'), { platforms: [...regions].sort() });
  }
  const staleDirs = catalog.publisherDirs.filter((d) => !publisherPlatforms[d]);

  return { files, staleDirs };
};

// ---------------------------------------------------------------- views

/**
 * Flattened, denormalized view of the catalog for the site and the
 * published data files. Expects a clean (validated) catalog.
 */
export const flatten = (catalog) => {
  const publisherName = (g) => catalog.publishers[g]?.name ?? g;
  const developerName = (g) => catalog.developers[g]?.name ?? g;

  const games = catalog.games
    .filter((g) => g.record)
    .map(({ id, region, record }) => ({
      id,
      guid: record.guid,
      name: record.name,
      company: region.company,
      platform: region.platform,
      region: region.guid,
      released: record.released ?? null,
      publisher: record.publisher
        ? { guid: record.publisher, name: publisherName(record.publisher) }
        : null,
      developers: (record.developers || []).map((d) => ({ guid: d, name: developerName(d) }))
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const regions = catalog.regions.map((r) => ({
    path: r.path,
    company: r.company,
    platform: r.platform,
    guid: r.guid,
    name: r.name,
    gameCount: r.games.length
  }));

  const platforms = catalog.companies.map((c) => ({
    guid: c.guid,
    name: c.name,
    platforms: c.platforms.map((p) => ({
      guid: p.guid,
      name: p.name,
      regions: p.regions.map((r) => ({ guid: r.guid, name: r.name, gameCount: r.games.length }))
    }))
  }));

  const byPublisher = {};
  const byDeveloper = {};
  for (const g of games) {
    if (g.publisher) (byPublisher[g.publisher.guid] ||= []).push(g.id);
    for (const d of g.developers) (byDeveloper[d.guid] ||= []).push(g.id);
  }
  const people = (index, by) =>
    Object.keys(by)
      .sort()
      .map((guid) => ({ guid, name: index[guid]?.name ?? guid, games: by[guid] }));

  return {
    games,
    regions,
    platforms,
    publishers: people(catalog.publishers, byPublisher),
    developers: people(catalog.developers, byDeveloper),
    platformName: (company, platform) =>
      catalog.companies.find((c) => c.guid === company)?.platforms.find((p) => p.guid === platform)?.name ?? platform
  };
};
