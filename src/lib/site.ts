import { flatten, formatReleased, loadCatalog } from '../../lib/catalog.js';

export { formatReleased };

export const REPO_URL = 'https://github.com/jasonsperske/game-db';
export const DATA_VERSION = 'v1';

type Ref = { guid: string; name: string };
export type Game = {
  id: string;
  guid: string;
  name: string;
  company: string;
  platform: string;
  region: string;
  released: { year: number; month?: number; day?: number; sortable: string } | null;
  publisher: Ref | null;
  developers: Ref[];
};

let cached: ReturnType<typeof build> | undefined;

const build = () => {
  const catalog = loadCatalog();
  const flat = flatten(catalog);
  const games = flat.games as Game[];
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const regionPath = (g: Game) => `${g.company}/${g.platform}/${g.region}`;
  return {
    catalog,
    ...flat,
    games,
    gamesById,
    regionPath,
    gamesIn: (path: string) => games.filter((g) => regionPath(g) === path),
    lookup: (ids: string[]) => ids.map((id) => gamesById.get(id)!).filter(Boolean)
  };
};

/** The catalog, loaded once per build. */
export const site = () => (cached ??= build());

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Site-relative URL honoring the configured base path. */
export const url = (path = '') => `${BASE}/${path.replace(/^\//, '')}`;

/** Absolute URL when SITE_URL is configured, otherwise site-relative. */
export const absUrl = (path = '') => {
  const rel = url(path);
  return import.meta.env.SITE ? new URL(rel, import.meta.env.SITE).href : rel;
};

export const gameUrl = (id: string) => url(`platform/${id}/`);
export const dataUrl = (path: string) => url(`data/${DATA_VERSION}/${path}`);

export const json = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** Canonical published shape of a region's games. */
export const regionPayload = (path: string) => {
  const s = site();
  const region = s.regions.find((r) => r.path === path)!;
  return {
    version: DATA_VERSION,
    company: region.company,
    platform: region.platform,
    platformName: s.platformName(region.company, region.platform),
    region: region.guid,
    regionName: region.name,
    games: s.gamesIn(path)
  };
};

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_COLUMNS = [
  'id', 'company', 'platform', 'region', 'guid', 'name',
  'released', 'released_year', 'released_month', 'released_day',
  'publisher', 'publisher_name', 'developers', 'developer_names'
];

export const toCsv = (games: Game[]) => {
  const rows = games.map((g) => [
    g.id, g.company, g.platform, g.region, g.guid, g.name,
    g.released?.sortable, g.released?.year, g.released?.month, g.released?.day,
    g.publisher?.guid, g.publisher?.name,
    g.developers.map((d) => d.guid).join(';'), g.developers.map((d) => d.name).join(';')
  ].map(csvCell).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
};

export const csv = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
