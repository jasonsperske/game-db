import { csv, site, toCsv } from '../../../../../../lib/site';

export const getStaticPaths = () =>
  site().regions.map((r) => ({ params: { company: r.company, platform: r.platform, region: r.guid } }));

export const GET = ({ params }: { params: Record<string, string> }) =>
  csv(toCsv(site().gamesIn(`${params.company}/${params.platform}/${params.region}`)));
