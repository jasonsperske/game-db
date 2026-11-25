// Home page type-ahead over /search-index.json (generated at build time).

type Entry = [id: string, name: string, platform: string];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const MAX_PER_GROUP = 8;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const highlight = (text: string, query: string) => {
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escapeHtml(text).replace(new RegExp(`(${escapeHtml(pattern)})`, 'gi'), '<mark>$1</mark>');
};

export const initSearch = async () => {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const menu = document.getElementById('search-menu');
  if (!input || !menu) return;

  let entries: Entry[] = [];
  try {
    entries = await (await fetch(`${BASE}/search-index.json`)).json();
  } catch (e) {
    console.error('Search index failed to load', e);
    return;
  }

  let active = -1;
  const items = () => Array.from(menu.querySelectorAll<HTMLAnchorElement>('.search-item'));
  const setActive = (i: number) => {
    const list = items();
    active = Math.max(-1, Math.min(i, list.length - 1));
    list.forEach((el, n) => el.setAttribute('aria-selected', String(n === active)));
    list[active]?.scrollIntoView({ block: 'nearest' });
  };

  const render = () => {
    const query = input.value.trim();
    active = -1;
    if (!query) {
      menu.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    const q = query.toLowerCase();
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!e[1].toLowerCase().includes(q)) continue;
      const list = groups.get(e[2]) ?? [];
      if (list.length < MAX_PER_GROUP) list.push(e);
      groups.set(e[2], list);
    }
    menu.innerHTML = [...groups].map(([platform, hits]) =>
      `<div class="search-group">${escapeHtml(platform)}</div>` +
      hits.map(([id, name]) =>
        `<a class="search-item" role="option" href="${escapeHtml(`${BASE}/platform/${id}/`)}">${highlight(name, query)}</a>`
      ).join('')
    ).join('') || '<div class="search-group">No matches</div>';
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(() => { menu.hidden = true; }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      const target = items()[active === -1 ? 0 : active];
      if (target) { e.preventDefault(); window.location.href = target.href; }
    } else if (e.key === 'Escape') { menu.hidden = true; }
  });
};
