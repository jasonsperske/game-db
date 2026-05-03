const baseUrl = document.querySelector('meta[name="base-url"]')?.content ?? '';

const REGIONS = [
  { name: 'NES',     path: 'Nintendo/NES/us' },
  { name: 'SNES',    path: 'Nintendo/SNES/us' },
  { name: 'Genesis', path: 'SEGA/Genesis/us' },
  { name: 'TG16',    path: 'NEC/TG16/us' }
];

const SOURCES = REGIONS.map(({ name, path }) => ({
  name,
  url: `${baseUrl}/content/platforms/${path}/index.json`,
  route: `${baseUrl}/platform/${path}`
}));

const MAX_PER_GROUP = 8;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const highlight = (text, query) => {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
};

const loadSource = async ({ name, url, route }) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  const data = await response.json();
  const games = Object.entries(data.games || {}).map(([guid, game]) => ({
    guid, route: `${route}/${guid}`, name: game.name
  }));
  return { name, games };
};

const matches = (game, query) =>
  game.name && game.name.toLowerCase().includes(query);

const render = (menu, sources, query) => {
  if (!query) {
    menu.hidden = true;
    menu.replaceChildren();
    return;
  }
  const lowered = query.toLowerCase();
  const html = sources
    .map((source) => {
      const hits = source.games.filter((g) => matches(g, lowered)).slice(0, MAX_PER_GROUP);
      if (!hits.length) return '';
      const items = hits
        .map((hit) =>
          `<a class="game-search-item" role="option" href="${escapeHtml(hit.route)}">
            ${highlight(hit.name, query)}
          </a>`
        ).join('');
      return `<div class="game-search-group-header">${escapeHtml(source.name)}</div>${items}`;
    }).join('');

  menu.innerHTML = html;
  menu.hidden = !html;
};

const init = async () => {
  const input = document.getElementById('GameSearchInput');
  const menu = document.getElementById('GameSearchMenu');
  if (!input || !menu) return;

  const sources = (await Promise.allSettled(SOURCES.map(loadSource)))
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  input.addEventListener('input', () => render(menu, sources, input.value.trim()));
  input.addEventListener('focus', () => render(menu, sources, input.value.trim()));
  input.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; }, 150));
};

init().catch((err) => console.error('Search init failed:', err));
