import { DATA_META, DATA_VERSION, json, site } from '../../../../lib/site';

export const getStaticPaths = () =>
  site().games.map((game) => ({ params: { id: game.id }, props: { game } }));

export const GET = ({ props }: { props: { game: unknown } }) =>
  json({ ...DATA_META, game: props.game });
