// guid, display name and the ids of every game credited to each entry.
import { DATA_VERSION, json, site } from '../../../lib/site';

export const GET = () => json({ version: DATA_VERSION, developers: site().developers });
