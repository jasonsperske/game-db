import { csv, site, toCsv } from '../../../lib/site';

export const GET = () => csv(toCsv(site().games));
