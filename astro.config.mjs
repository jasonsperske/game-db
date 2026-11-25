// @ts-check
import { defineConfig } from 'astro/config';
import { loadAliases } from './lib/catalog.js';

// Deploy under a sub-path (e.g. https://example.com/games/) with BASE_URL=/games.
// SITE_URL (e.g. https://example.com) makes generated links in data files absolute.
const base = (process.env.BASE_URL || '/').replace(/\/?$/, '/');

// Old game URLs keep working after a guid is retired in content/_config/aliases.json.
const redirects = Object.fromEntries(
  Object.entries(loadAliases().games).map(([from, to]) => [`/platform/${from}`, `${base}platform/${to}/`])
);

export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  redirects,
  devToolbar: { enabled: false }
});
