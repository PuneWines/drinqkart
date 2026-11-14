/**
 * Clickable table header cell. Click to sort ascending, click again for descending.
 * `sort` is { key, dir }, `onSort(key)` toggles it.
 */
export default function SortableTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  const alignRight = className.includes('text-right');
  const alignCenter = className.includes('text-center');
  const arrow = !active ? '↕' : sort.dir === 'asc' ? '▲' : '▼';

  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label}`}
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-indigo-600 transition-colors ${
          active ? 'text-indigo-600' : ''
        } ${alignRight ? 'justify-end w-full' : alignCenter ? 'justify-center w-full' : ''}`}
      >
        <span>{label}</span>
        <span className={`text-[10px] leading-none ${active ? '' : 'opacity-40'}`}>{arrow}</span>
      </button>
    </th>
  );
}
