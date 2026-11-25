import { json, regionPayload, site } from '../../../../../../lib/site';

export const getStaticPaths = () =>
  site().regions.map((r) => ({ params: { company: r.company, platform: r.platform, region: r.guid } }));

export const GET = ({ params }: { params: Record<string, string> }) =>
  json(regionPayload(`${params.company}/${params.platform}/${params.region}`));
