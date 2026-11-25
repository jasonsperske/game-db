// Compact [id, name, platform label] tuples for the home page search box.
// Not part of the versioned data API; use /data/v1/games.json instead.
import { json, site } from '../lib/site';

export const GET = () => {
  const s = site();
  return json(s.games.map((g) => [g.id, g.name, `${s.platformName(g.company, g.platform)} (${g.region})`]));
};
