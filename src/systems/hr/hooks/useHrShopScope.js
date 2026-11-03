import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUserAssignedShops, isApexAdmin } from '../../../utils/permissionUtils';

const norm = (s) => String(s || '').trim().toLowerCase();

/** The shop an employee record belongs to. */
export const getEmployeeShop = (emp) => {
  const details = emp?.HR_SYSTEM_employee_data || emp?.details || {};
  return String(emp?.joining_company_name || details.joining_company_name || '').trim();
};

/**
 * Shop-based access control for HR pages.
 * - Superadmin (apex) or a user with "all" access: unrestricted (allowedSet === null).
 * - Everyone else: only their assigned shops (users.shop_name + users.user_access).
 *   A scoped user with no shops sees nothing.
 * Source of truth is the users table; the localStorage cache can be stale.
 */
export default function useHrShopScope() {
  const [dbShops, setDbShops] = useState(null);
  const [shopRows, setShopRows] = useState([]);

  // Shop master: employees may store either the Shop Name or the Full Name; always normalise to Shop Name
  useEffect(() => {
    let alive = true;
    supabase.from('shop').select('shop_name, full_name').then(({ data }) => {
      if (alive && data) setShopRows(data);
    });
    return () => { alive = false; };
  }, []);

  const resolveShopName = useCallback((value) => {
    const v = norm(value);
    if (!v) return '';
    const byName = shopRows.find(r => norm(r.shop_name) === v);
    if (byName) return byName.shop_name.trim();
    const byFull = shopRows.find(r => norm(r.full_name) === v);
    if (byFull) return byFull.shop_name.trim();
    // Legacy / free-text values (e.g. "BALAJI WINES", "FRIENDS WINE", "THE LIQUOR STORY - VISHAL"):
    // accept only an unambiguous partial match against the shop name or full name
    const partial = shopRows.filter(r => {
      const n = norm(r.shop_name), f = norm(r.full_name);
      return (n.length >= 3 && v.includes(n)) ||
        (f && (f.includes(v) || (f.length >= 3 && v.includes(f))));
    });
    if (partial.length === 1) return partial[0].shop_name.trim();
    return String(value).trim();
  }, [shopRows]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = getUserAssignedShops(null, { strict: true });
      try {
        const id = localStorage.getItem('user-id') || '';
        const name = localStorage.getItem('user-name') || '';
        if (!id && !name) {
          if (alive) setDbShops(cached);
          return;
        }
        let q = supabase.from('users').select('shop_name, user_access');
        q = id ? q.eq('id', id) : q.eq('user_name', name);
        const { data } = await q.maybeSingle();
        if (!alive) return;
        if (data) {
          const list = [data.shop_name, data.user_access]
            .flatMap((v) => String(v || '').split(','))
            .map((s) => s.trim())
            .filter(Boolean);
          setDbShops([...new Set([...list, ...cached])]);
        } else {
          setDbShops(cached);
        }
      } catch {
        if (alive) setDbShops(cached);
      }
    })();
    return () => { alive = false; };
  }, []);

  const shopNames = useMemo(
    () => shopRows.map(r => (r.shop_name || '').trim()).filter(Boolean).sort(),
    [shopRows]
  );

  // null => unrestricted
  const allowedSet = useMemo(() => {
    if (isApexAdmin()) return null;
    const source = dbShops ?? getUserAssignedShops(null, { strict: true });
    const set = new Set(source.map(s => norm(resolveShopName(s))));
    if (set.has('all')) return null;
    return set;
  }, [dbShops, resolveShopName]);

  const isShopAllowed = useCallback(
    (shopName) => allowedSet === null || allowedSet.has(norm(resolveShopName(shopName))),
    [allowedSet, resolveShopName]
  );

  return { allowedSet, isShopAllowed, resolveShopName, shopNames, isScoped: allowedSet !== null, ready: dbShops !== null };
}
