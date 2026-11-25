// Publishes the JSON Schemas in /schema so consumers can validate what they download.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../../../lib/catalog.js';

const DIR = path.join(ROOT, 'schema');

export const getStaticPaths = () =>
  fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ params: { name: f.replace(/\.json$/, '') } }));

export const GET = ({ params }: { params: Record<string, string> }) =>
  new Response(fs.readFileSync(path.join(DIR, `${params.name}.json`)), {
    headers: { 'Content-Type': 'application/schema+json' }
  });
