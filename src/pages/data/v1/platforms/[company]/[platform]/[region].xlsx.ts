// Same layout `npm run import` reads, so contributors can edit and send it back.
import { buildWorkbook } from '../../../../../../../lib/xlsx.js';
import { site } from '../../../../../../lib/site';

export const getStaticPaths = () =>
  site().regions.map((r) => ({ params: { company: r.company, platform: r.platform, region: r.guid } }));

export const GET = async ({ params }: { params: Record<string, string> }) => {
  const region = site().catalog.regions.find((r) => r.path === `${params.company}/${params.platform}/${params.region}`)!;
  const buffer = await buildWorkbook(region.games.map((g) => g.record)).xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  });
};
