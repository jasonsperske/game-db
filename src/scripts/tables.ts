// Click-to-sort column headers and a text filter for [data-sortable] tables.

const cellValue = (row: HTMLTableRowElement, index: number) => {
  const cell = row.children[index] as HTMLElement | undefined;
  return cell?.dataset.order ?? cell?.textContent?.trim() ?? '';
};

const compare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const initSort = (table: HTMLTableElement) => {
  const tbody = table.tBodies[0];
  const headers = Array.from(table.tHead?.querySelectorAll('th') ?? []);
  if (!tbody) return;

  headers.forEach((th, index) => {
    let direction = index === 0 ? -1 : 1; // first column is already ascending
    if (index === 0) th.setAttribute('aria-sort', 'ascending');
    th.style.cursor = 'pointer';
    th.tabIndex = 0;

    const sort = () => {
      const rows = Array.from(tbody.rows);
      rows.sort((a, b) => direction * compare(cellValue(a, index), cellValue(b, index)));
      tbody.replaceChildren(...rows);
      headers.forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
      direction = -direction;
    };
    th.addEventListener('click', sort);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
    });
  });
};

const initFilter = (input: HTMLInputElement) => {
  const table = document.getElementById(input.dataset.filterFor ?? '') as HTMLTableElement | null;
  const tbody = table?.tBodies[0];
  if (!tbody) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    for (const row of Array.from(tbody.rows)) {
      row.hidden = !!q && !row.textContent?.toLowerCase().includes(q);
    }
  });
};

export const initTables = () => {
  document.querySelectorAll<HTMLTableElement>('table[data-sortable]').forEach(initSort);
  document.querySelectorAll<HTMLInputElement>('input[data-filter-for]').forEach(initFilter);
};
