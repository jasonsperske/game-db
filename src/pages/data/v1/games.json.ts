import { DATA_META, DATA_VERSION, json, site } from '../../../lib/site';

export const GET = () => json({ ...DATA_META, games: site().games });
