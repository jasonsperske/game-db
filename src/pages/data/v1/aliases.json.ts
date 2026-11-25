// Retired ids -> current ids. If you stored an id that later changed, look it up here.
import { DATA_VERSION, json, site } from '../../../lib/site';

export const GET = () => {
  const { games, publishers, developers } = site().catalog.aliases;
  return json({ version: DATA_VERSION, games, publishers, developers });
};
