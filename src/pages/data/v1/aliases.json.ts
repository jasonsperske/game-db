// Retired ids -> current ids. If you stored an id that later changed, look it up here.
import { DATA_META, DATA_VERSION, json, site } from '../../../lib/site';

export const GET = () => {
  const { games, publishers, developers } = site().catalog.aliases;
  return json({ ...DATA_META, games, publishers, developers });
};
