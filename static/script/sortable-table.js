const compare = (a, b) => {
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return a.localeCompare(b);
};

const sortRows = (tbody, columnIndex, direction) => {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort((rowA, rowB) => {
    const cellA = rowA.children[columnIndex];
    const cellB = rowB.children[columnIndex];
    const a = cellA?.dataset.order ?? cellA?.textContent.trim() ?? '';
    const b = cellB?.dataset.order ?? cellB?.textContent.trim() ?? '';
    return direction * compare(a, b);
  });
  tbody.replaceChildren(...rows);
};

const init = (table) => {
  const headers = table.tHead?.querySelectorAll('th') ?? [];
  const tbody = table.tBodies[0];
  if (!tbody) return;

  headers.forEach((th, index) => {
    th.style.cursor = 'pointer';
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');

    let direction = 1;
    const handle = () => {
      sortRows(tbody, index, direction);
      headers.forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending');
      direction = -direction;
    };
    th.addEventListener('click', handle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handle();
      }
    });
  });
};

document.querySelectorAll('table[data-sortable]').forEach(init);
