// Manifest: what files exist, how many records, and when it was built.
import { DATA_VERSION, absUrl, json, site } from '../../../lib/site';

export const GET = () => {
  const s = site();
  const file = (p: string) => absUrl(`data/${DATA_VERSION}/${p}`);
  return json({
    version: DATA_VERSION,
    generatedAt: new Date().toISOString(),
    counts: {
      games: s.games.length,
      regions: s.regions.length,
      publishers: s.publishers.length,
      developers: s.developers.length
    },
    files: {
      games: file('games.json'),
      gamesCsv: file('games.csv'),
      platforms: file('platforms.json'),
      publishers: file('publishers.json'),
      developers: file('developers.json'),
      aliases: file('aliases.json'),
      schema: { game: file('schema/game.schema.json') }
    },
    regions: s.regions.map((r) => ({
      ...r,
      json: file(`platforms/${r.path}.json`),
      csv: file(`platforms/${r.path}.csv`),
      xlsx: file(`platforms/${r.path}.xlsx`)
    })),
    gameUrlTemplate: file('games/{id}.json')
  });
};
