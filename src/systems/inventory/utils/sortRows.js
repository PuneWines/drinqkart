const isEmpty = (v) => v === null || v === undefined || v === '';

/**
 * Compare two values for sorting. Numbers sort numerically, everything else
 * (including ISO dates like 2026-11-13 and ISO timestamps) sorts as text, which
 * is chronological for those formats.
 */
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Return a sorted copy of rows. Empty values always go last, in either direction.
 * `tieBreaker` (optional) is a [key, dir] pair used when the main key is equal,
 * so the order stays stable and predictable.
 */
export function sortRows(rows, key, dir = 'desc', tieBreaker = null) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((x, y) => {
    const xe = isEmpty(x[key]);
    const ye = isEmpty(y[key]);
    if (xe !== ye) return xe ? 1 : -1;

    const main = xe ? 0 : compareValues(x[key], y[key]) * sign;
    if (main !== 0) return main;

    if (tieBreaker) {
      const [tKey, tDir] = tieBreaker;
      if (isEmpty(x[tKey]) || isEmpty(y[tKey])) return 0;
      return compareValues(x[tKey], y[tKey]) * (tDir === 'asc' ? 1 : -1);
    }
    return 0;
  });
}
