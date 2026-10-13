import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import '../styles/GiftStock.css';

const ALL = 'ALL STORES';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLLS = ['items', 'pairs', 'ins', 'outs'];
const TABS = ['dashboard', 'stock-in', 'stock-out', 'current-stock', 'item-master', 'trader-master'];

const TABLE_MAP = {
  items: 'gift_stock_items',
  pairs: 'gift_stock_trader_pairs',
  ins: 'gift_stock_ins',
  outs: 'gift_stock_outs'
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtD(s) {
  const p = (s || '').split('-');
  return p.length === 3 ? (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] : '—';
}

function num(n) {
  return new Intl.NumberFormat('en-IN').format(n);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function cmp(a, b) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

function lc(s) {
  return String(s || '').trim().toLowerCase();
}

function lsGet(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
}

function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

function fromDb(c, r) {
  if (!r) return r;
  if (c === 'ins' || c === 'outs') {
    return {
      id: r.id,
      date: r.date,
      store: r.store,
      trader: r.trader,
      company: r.company,
      itemId: r.item_id || r.itemId,
      itemName: r.item_name || r.itemName,
      qty: Number(r.qty) || 0,
      customer: r.customer,
      contact: r.contact,
      proofImage: r.proof_image || r.proofImage || null,
      ts: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  }
  return {
    ...r,
    ts: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  };
}

function toDb(c, r) {
  if (c === 'ins') {
    return {
      id: r.id,
      date: r.date,
      store: r.store,
      trader: r.trader,
      company: r.company,
      item_id: r.itemId,
      item_name: r.itemName,
      qty: r.qty
    };
  }
  if (c === 'outs') {
    return {
      id: r.id,
      date: r.date,
      store: r.store,
      item_id: r.itemId,
      item_name: r.itemName,
      qty: r.qty,
      customer: r.customer,
      contact: r.contact,
      proof_image: r.proofImage || r.proof_image || null
    };
  }
  if (c === 'items') {
    return {
      id: r.id,
      name: r.name,
      store: r.store
    };
  }
  if (c === 'pairs') {
    return {
      id: r.id,
      trader: r.trader,
      company: r.company
    };
  }
  return r;
}

async function compressImage(file, maxDimension = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else resolve(file);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (err) {
      resolve(file);
    }
  });
}

async function uploadProofImage(file) {
  if (!file) return null;
  const compressed = await compressImage(file, 1200, 0.82);
  const cleanName = (file.name || 'proof.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `stock_outs/${Date.now()}_${cleanName}`;

  // 1. Try uploading to 'task-proofs' bucket
  try {
    const { error: err1 } = await supabase.storage.from('task-proofs').upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (!err1) {
      const { data } = supabase.storage.from('task-proofs').getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (e) {
    console.warn('Storage task-proofs upload failed, trying gift-stock...', e);
  }

  // 2. Try uploading to 'gift-stock' bucket
  try {
    const { error: err2 } = await supabase.storage.from('gift-stock').upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (!err2) {
      const { data } = supabase.storage.from('gift-stock').getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (e) {
    console.warn('Storage gift-stock upload failed, falling back to base64...', e);
  }

  // 3. Fallback: convert compressed image to base64 Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(compressed);
  });
}


export default function GiftStockDashboard({ defaultTab = 'dashboard' }) {
  const { tab: routeTab } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const showTabRef = useRef(null);
  const activeTabParam = routeTab || defaultTab || 'dashboard';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function $(s, r) {
      return (r || container).querySelector(s);
    }
    function $$(s, r) {
      return Array.prototype.slice.call((r || container).querySelectorAll(s));
    }

    let STORES = [];
    const S = { items: [], pairs: [], ins: [], outs: [] };
    const loaded = { items: false, pairs: false, ins: false, outs: false };
    const ro = false;
    let currentTab = activeTabParam;
    let selTrader = null;
    let csView = 'detail';

    // Fetch dynamic shops exclusively from Supabase
    async function loadDynamicShops() {
      try {
        const { data, error } = await supabase
          .from('shop')
          .select('shop_name')
          .order('shop_name', { ascending: true });
        if (!error && Array.isArray(data)) {
          STORES = data.map((s) => s.shop_name).filter(Boolean);
          refreshForms();
          refreshCsFilters();
          renderDash();
        }
      } catch (err) {
        console.warn('[GiftStock] Error fetching shops from Supabase:', err);
      }
    }
    loadDynamicShops();

    // Database store connected directly to Supabase
    const dbStore = {
      sub: function (c, cb) {
        const tbl = TABLE_MAP[c];
        
        // Initial fetch
        supabase
          .from(tbl)
          .select('*')
          .then(({ data, error }) => {
            if (error) {
              console.warn(`[GiftStock] Note on ${tbl}:`, error.message);
              // Fallback to local storage if table is not yet created
              let fallbackData = [];
              try {
                fallbackData = JSON.parse(localStorage.getItem('gsd:' + c) || '[]');
              } catch (e) {}
              cb(fallbackData);
              return;
            }
            const mapped = (data || []).map((r) => fromDb(c, r));
            lsSet('gsd:' + c, JSON.stringify(mapped));
            cb(mapped);
          });

        // Real-time subscription to postgres changes
        const channel = supabase
          .channel(`gift_stock_realtime_${c}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: tbl }, () => {
            supabase
              .from(tbl)
              .select('*')
              .then(({ data, error }) => {
                if (!error && data) {
                  const mapped = data.map((r) => fromDb(c, r));
                  lsSet('gsd:' + c, JSON.stringify(mapped));
                  cb(mapped);
                }
              });
          })
          .subscribe();

        return channel;
      },
      put: async function (c, id, data) {
        const tbl = TABLE_MAP[c];
        const row = Object.assign({ id: id }, data);
        
        // Update local memory & cache immediately for instant UI response
        const idx = S[c].findIndex((r) => r.id === id);
        if (idx < 0) S[c].push(row);
        else S[c][idx] = row;
        lsSet('gsd:' + c, JSON.stringify(S[c]));
        schedule();

        // Write directly to Supabase table
        const payload = toDb(c, row);
        const { error } = await supabase.from(tbl).upsert(payload, { onConflict: 'id' });
        if (error) {
          console.warn(`[GiftStock] Supabase upsert error on ${tbl}:`, error.message);
        }
        return true;
      },
      del: async function (c, id) {
        const tbl = TABLE_MAP[c];
        
        // Update local memory immediately
        S[c] = S[c].filter((r) => r.id !== id);
        lsSet('gsd:' + c, JSON.stringify(S[c]));
        schedule();

        // Delete from Supabase table
        const { error } = await supabase.from(tbl).delete().eq('id', id);
        if (error) {
          console.warn(`[GiftStock] Supabase delete error on ${tbl}:`, error.message);
        }
        return true;
      }
    };

    const store = dbStore;

    function toast(msg) {
      const t = $('#toast');
      if (!t) return;
      t.textContent = msg;
      t.hidden = false;
      clearTimeout(toast._t);
      toast._t = setTimeout(function () {
        t.hidden = true;
      }, 2600);
    }

    function save(promise, okMsg) {
      return Promise.resolve(promise)
        .then(function () {
          if (okMsg) toast(okMsg);
          return true;
        })
        .catch(function () {
          toast('Could not save. Try again.');
          return false;
        });
    }

    function itemMap() {
      const m = {};
      S.items.forEach(function (i) {
        m[i.id] = i;
      });
      return m;
    }

    function itemName(id, snap) {
      const m = itemMap();
      return m[id] ? m[id].name : snap || '(deleted item)';
    }

    function itemsForStore(st) {
      return S.items
        .filter(function (i) {
          return !st || i.store === ALL || i.store === st;
        })
        .sort(function (a, b) {
          return cmp(a.name, b.name);
        });
    }

    function traders() {
      const s = {};
      S.pairs.forEach(function (p) {
        s[p.trader] = 1;
      });
      return Object.keys(s).sort(cmp);
    }

    function companiesOf(t) {
      const s = {};
      S.pairs.forEach(function (p) {
        if (p.trader === t) s[p.company] = 1;
      });
      return Object.keys(s).sort(cmp);
    }

    function available(st, id) {
      let a = 0;
      S.ins.forEach(function (r) {
        if (r.store === st && r.itemId === id) a += r.qty;
      });
      S.outs.forEach(function (r) {
        if (r.store === st && r.itemId === id) a -= r.qty;
      });
      return a;
    }

    function computeStock() {
      const groups = {};
      S.ins.forEach(function (r) {
        const k = r.store + '|' + r.itemId;
        (groups[k] = groups[k] || { store: r.store, itemId: r.itemId, snap: r.itemName, ins: [], out: 0 }).ins.push(r);
      });
      S.outs.forEach(function (r) {
        const k = r.store + '|' + r.itemId;
        (groups[k] = groups[k] || { store: r.store, itemId: r.itemId, snap: r.itemName, ins: [], out: 0 }).out += r.qty;
      });
      const rows = [];
      const totals = [];
      Object.keys(groups).forEach(function (k) {
        const g = groups[k];
        let left = g.out;
        let sumIn = 0;
        const name = itemName(g.itemId, g.snap);
        g.ins.sort(function (a, b) {
          return a.date > b.date ? 1 : a.date < b.date ? -1 : (a.ts || 0) - (b.ts || 0);
        });
        g.ins.forEach(function (r) {
          const used = Math.min(r.qty, left);
          left -= used;
          sumIn += r.qty;
          rows.push({
            store: g.store,
            itemId: g.itemId,
            item: name,
            trader: r.trader,
            company: r.company,
            inQty: r.qty,
            outQty: used,
            cur: r.qty - used
          });
        });
        if (left > 0) {
          rows.push({
            store: g.store,
            itemId: g.itemId,
            item: name,
            trader: 'Unmatched sales',
            company: '—',
            inQty: 0,
            outQty: left,
            cur: -left
          });
        }
        totals.push({
          store: g.store,
          itemId: g.itemId,
          item: name,
          inQty: sumIn,
          outQty: g.out,
          cur: sumIn - g.out
        });
      });
      return { rows: rows, totals: totals };
    }

    function fill(sel, opts, placeholder) {
      if (!sel) return;
      const prev = sel.value;
      let h = '<option value="">' + esc(placeholder) + '</option>';
      opts.forEach(function (o) {
        const v = typeof o === 'string' ? o : o.v;
        const t = typeof o === 'string' ? o : o.t;
        h += '<option value="' + esc(v) + '">' + esc(t) + '</option>';
      });
      sel.innerHTML = h;
      const ok = opts.some(function (o) {
        return (typeof o === 'string' ? o : o.v) === prev;
      });
      sel.value = ok ? prev : '';
    }

    function storeOpts() {
      return STORES.slice();
    }

    function emptyBox(title, sub) {
      return '<div class="empty"><b>' + esc(title) + '</b>' + esc(sub || '') + '</div>';
    }

    function loadingBox() {
      return '<div class="empty">Loading…</div>';
    }

    function ready() {
      return COLLS.every(function (c) {
        return loaded[c];
      });
    }

    function updateOutHint() {
      const outStore = $('#out-store');
      const outItem = $('#out-item');
      const outQty = $('#out-qty');
      const h = $('#out-hint');
      if (!h) return;
      const st = outStore ? outStore.value : '';
      const id = outItem ? outItem.value : '';
      if (!st || !id) {
        h.className = 'hint';
        h.textContent = !S.items.length && ready() ? 'Create gift items in ITEM MASTER first.' : '';
        return;
      }
      const a = available(st, id);
      const q = parseInt(outQty ? outQty.value : '0', 10);
      if (q > a) {
        h.className = 'hint bad';
        h.innerHTML = 'Only <b>' + num(a) + '</b> in stock at ' + esc(st) + '.';
      } else {
        h.className = 'hint';
        h.innerHTML = 'Available at ' + esc(st) + ': <b>' + num(a) + '</b>';
      }
    }

    function refreshForms() {
      const inStore = $('#in-store');
      const inTrader = $('#in-trader');
      const inCompany = $('#in-company');
      const inItem = $('#in-item');
      const outStore = $('#out-store');
      const outItem = $('#out-item');
      const inHint = $('#in-hint');

      if (inStore) fill(inStore, storeOpts(), 'Choose store');
      if (inTrader) fill(inTrader, traders(), traders().length ? 'Choose trader' : 'No traders yet');
      const tr = inTrader ? inTrader.value : '';
      const cos = tr ? companiesOf(tr) : [];
      if (inCompany) {
        fill(inCompany, cos, tr ? 'Choose company' : 'Choose trader first');
        inCompany.disabled = !tr;
      }
      const s1 = inStore ? inStore.value : '';
      if (inItem) {
        fill(
          inItem,
          itemsForStore(s1).map(function (i) {
            return { v: i.id, t: i.name };
          }),
          s1 ? (itemsForStore(s1).length ? 'Choose item' : 'No items for this store') : 'Choose store first'
        );
        inItem.disabled = !s1;
      }
      if (outStore) fill(outStore, storeOpts(), 'Choose store');
      const s2 = outStore ? outStore.value : '';
      if (outItem) {
        fill(
          outItem,
          itemsForStore(s2).map(function (i) {
            return { v: i.id, t: i.name };
          }),
          s2 ? (itemsForStore(s2).length ? 'Choose item' : 'No items for this store') : 'Choose store first'
        );
        outItem.disabled = !s2;
      }
      if (inHint) {
        inHint.innerHTML =
          !traders().length && ready()
            ? 'Add a trader in <b>TRADER MASTER</b> first.'
            : !S.items.length && ready()
            ? 'Create gift items in <b>ITEM MASTER</b> first.'
            : '';
      }
      updateOutHint();
    }

    function renderIn() {
      const inSearch = $('#in-search');
      const q = lc(inSearch ? inSearch.value : '');
      const box = $('#in-list');
      if (!box) return;
      if (!ready()) {
        box.innerHTML = loadingBox();
        return;
      }
      let rows = S.ins.slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0);
      });
      if (q) {
        rows = rows.filter(function (r) {
          return lc([itemName(r.itemId, r.itemName), r.trader, r.company, r.store].join(' ')).indexOf(q) >= 0;
        });
      }
      if (!rows.length) {
        box.innerHTML = emptyBox(S.ins.length ? 'No matching entries' : 'No stock in yet', 'Entries you add above appear here.');
        return;
      }
      let h = '<table><thead><tr><th>Date</th><th>Store</th><th>Trader</th><th>Company</th><th>Item</th><th class="r">Qty</th><th></th></tr></thead><tbody>';
      rows.slice(0, 200).forEach(function (r) {
        h +=
          '<tr><td class="mono">' +
          fmtD(r.date) +
          '</td><td>' +
          esc(r.store) +
          '</td><td>' +
          esc(r.trader) +
          '</td><td>' +
          esc(r.company) +
          '</td><td>' +
          esc(itemName(r.itemId, r.itemName)) +
          '</td><td class="r num q-in">+' +
          num(r.qty) +
          '</td><td class="act"><button class="btn sm ghost danger write" data-act="del-in" data-id="' +
          esc(r.id) +
          '">Delete</button></td></tr>';
      });
      box.innerHTML =
        h +
        '</tbody></table>' +
        (rows.length > 200 ? '<div class="empty">Showing the latest 200 of ' + rows.length + '. Use search to narrow down.</div>' : '');
    }

    function renderOut() {
      const outSearch = $('#out-search');
      const q = lc(outSearch ? outSearch.value : '');
      const box = $('#out-list');
      if (!box) return;
      if (!ready()) {
        box.innerHTML = loadingBox();
        return;
      }
      let rows = S.outs.slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.ts || 0) - (a.ts || 0);
      });
      if (q) {
        rows = rows.filter(function (r) {
          return lc([itemName(r.itemId, r.itemName), r.customer, r.contact, r.store].join(' ')).indexOf(q) >= 0;
        });
      }
      if (!rows.length) {
        box.innerHTML = emptyBox(S.outs.length ? 'No matching entries' : 'No sales yet', 'Entries you add above appear here.');
        return;
      }
      let h = '<table><thead><tr><th>Date</th><th>Store</th><th>Item</th><th class="r">Qty</th><th>Customer</th><th>Contact</th><th>Proof</th><th></th></tr></thead><tbody>';
      rows.slice(0, 200).forEach(function (r) {
        const proofHtml = r.proofImage
          ? '<button type="button" class="btn sm ghost" data-act="view-proof" data-img="' +
            esc(r.proofImage) +
            '" title="Click to view full image" style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;color:#2563eb;cursor:pointer;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;">' +
            '<img src="' +
            esc(r.proofImage) +
            '" alt="Proof" style="width:24px;height:24px;object-fit:cover;border-radius:3px;" />' +
            '<span style="font-size:12px;font-weight:600;">View</span></button>'
          : '<span style="color:#94a3b8;font-size:13px;">—</span>';
        h +=
          '<tr><td class="mono">' +
          fmtD(r.date) +
          '</td><td>' +
          esc(r.store) +
          '</td><td>' +
          esc(itemName(r.itemId, r.itemName)) +
          '</td><td class="r num q-out">−' +
          num(r.qty) +
          '</td><td>' +
          esc(r.customer) +
          '</td><td class="mono">' +
          esc(r.contact) +
          '</td><td>' +
          proofHtml +
          '</td><td class="act"><button class="btn sm ghost danger write" data-act="del-out" data-id="' +
          esc(r.id) +
          '">Delete</button></td></tr>';
      });
      box.innerHTML =
        h +
        '</tbody></table>' +
        (rows.length > 200 ? '<div class="empty">Showing the latest 200 of ' + rows.length + '. Use search to narrow down.</div>' : '');
    }

    function renderCurrent() {
      const box = $('#cs-list');
      if (!box) return;
      if (!ready()) {
        box.innerHTML = loadingBox();
        return;
      }
      const csStore = $('#cs-store');
      const csTrader = $('#cs-trader');
      const csCompany = $('#cs-company');
      const csSearch = $('#cs-search');
      const csHide0 = $('#cs-hide0');

      const st = csStore ? csStore.value : '';
      const tr = csTrader ? csTrader.value : '';
      const co = csCompany ? csCompany.value : '';
      const q = lc(csSearch ? csSearch.value : '');
      const hide0 = csHide0 ? csHide0.checked : true;

      const data = computeStock();
      let h = '';
      let tot = 0;

      if (csView === 'detail') {
        const rows = data.rows
          .filter(function (r) {
            return (!st || r.store === st) && (!tr || r.trader === tr) && (!co || r.company === co) && (!q || lc(r.item).indexOf(q) >= 0) && (!hide0 || r.cur !== 0);
          })
          .sort(function (a, b) {
            return cmp(a.store, b.store) || cmp(a.item, b.item) || cmp(a.trader, b.trader) || cmp(a.company, b.company);
          });
        if (!rows.length) {
          box.innerHTML = emptyBox(S.ins.length ? 'Nothing matches these filters' : 'No stock yet', 'Add stock in to see current stock here.');
          return;
        }
        h = '<table><thead><tr><th>Store</th><th>Item</th><th>Trader</th><th>Company</th><th class="r">In</th><th class="r">Out</th><th class="r">Current</th></tr></thead><tbody>';
        let ti = 0;
        let to = 0;
        rows.forEach(function (r) {
          tot += r.cur;
          ti += r.inQty;
          to += r.outQty;
          h +=
            '<tr><td>' +
            esc(r.store) +
            '</td><td>' +
            esc(r.item) +
            '</td><td>' +
            esc(r.trader) +
            '</td><td>' +
            esc(r.company) +
            '</td><td class="r num">' +
            num(r.inQty) +
            '</td><td class="r num">' +
            num(r.outQty) +
            '</td><td class="r num ' +
            (r.cur < 0 ? 'q-crit' : '') +
            '"><b>' +
            num(r.cur) +
            '</b></td></tr>';
        });
        h += '</tbody><tfoot><tr><td colspan="4">Total</td><td class="r num">' + num(ti) + '</td><td class="r num">' + num(to) + '</td><td class="r num">' + num(tot) + '</td></tr></tfoot></table>';
      } else {
        let rows2 = data.totals
          .filter(function (r) {
            return (!st || r.store === st) && (!q || lc(r.item).indexOf(q) >= 0) && (!hide0 || r.cur !== 0);
          })
          .sort(function (a, b) {
            return cmp(a.store, b.store) || cmp(a.item, b.item);
          });
        if (tr || co) {
          rows2 = rows2.filter(function (r) {
            return data.rows.some(function (x) {
              return x.store === r.store && x.itemId === r.itemId && (!tr || x.trader === tr) && (!co || x.company === co);
            });
          });
        }
        if (!rows2.length) {
          box.innerHTML = emptyBox(S.ins.length ? 'Nothing matches these filters' : 'No stock yet', 'Add stock in to see current stock here.');
          return;
        }
        h = '<table><thead><tr><th>Store</th><th>Item</th><th class="r">In</th><th class="r">Out</th><th class="r">Current</th></tr></thead><tbody>';
        let ti2 = 0;
        let to2 = 0;
        rows2.forEach(function (r) {
          tot += r.cur;
          ti2 += r.inQty;
          to2 += r.outQty;
          h +=
            '<tr><td>' +
            esc(r.store) +
            '</td><td>' +
            esc(r.item) +
            '</td><td class="r num">' +
            num(r.inQty) +
            '</td><td class="r num">' +
            num(r.outQty) +
            '</td><td class="r num ' +
            (r.cur < 0 ? 'q-crit' : '') +
            '"><b>' +
            num(r.cur) +
            '</b></td></tr>';
        });
        h += '</tbody><tfoot><tr><td colspan="2">Total</td><td class="r num">' + num(ti2) + '</td><td class="r num">' + num(to2) + '</td><td class="r num">' + num(tot) + '</td></tr></tfoot></table>';
      }
      box.innerHTML = h;
    }

    function refreshCsFilters() {
      const csStore = $('#cs-store');
      const csTrader = $('#cs-trader');
      const csCompany = $('#cs-company');
      if (csStore) fill(csStore, storeOpts(), 'All stores');
      const data = computeStock().rows;
      const ts = {};
      const cs = {};
      data.forEach(function (r) {
        ts[r.trader] = 1;
      });
      if (csTrader) fill(csTrader, Object.keys(ts).sort(cmp), 'All traders');
      const t2 = csTrader ? csTrader.value : '';
      data.forEach(function (r) {
        if (!t2 || r.trader === t2) cs[r.company] = 1;
      });
      if (csCompany) fill(csCompany, Object.keys(cs).sort(cmp), 'All companies');
    }

    function renderItems() {
      const itemSearch = $('#item-search');
      const q = lc(itemSearch ? itemSearch.value : '');
      const box = $('#item-list');
      const countEl = $('#item-count');
      if (!box) return;
      if (!ready()) {
        box.innerHTML = loadingBox();
        return;
      }
      let rows = S.items.slice().sort(function (a, b) {
        return cmp(a.name, b.name) || cmp(a.store, b.store);
      });
      if (q) {
        rows = rows.filter(function (r) {
          return lc(r.name).indexOf(q) >= 0;
        });
      }
      if (countEl) {
        countEl.textContent = S.items.length ? (q ? rows.length + ' of ' + S.items.length + ' items' : S.items.length + ' items') : '';
      }
      if (!rows.length) {
        box.innerHTML = emptyBox(S.items.length ? 'No item matches "' + (itemSearch ? itemSearch.value.trim() : '') + '"' : 'No gift items yet', 'Press ADD GIFT ITEM to create your first one.');
        return;
      }
      let h = '<table><thead><tr><th>Item name</th><th>Store</th><th></th></tr></thead><tbody>';
      rows.forEach(function (r) {
        h +=
          '<tr><td><b>' +
          esc(r.name) +
          '</b></td><td>' +
          (r.store === ALL ? '<span class="pill neutral">ALL STORES</span>' : esc(r.store)) +
          '</td><td class="act"><button class="btn sm write" data-act="edit-item" data-id="' +
          esc(r.id) +
          '">Edit</button><button class="btn sm danger write" data-act="del-item" data-id="' +
          esc(r.id) +
          '">Delete</button></td></tr>';
      });
      box.innerHTML = h + '</tbody></table>';
    }

    function renderTraders() {
      const traderSearch = $('#trader-search');
      const q = lc(traderSearch ? traderSearch.value : '');
      const list = $('#trader-list');
      const det = $('#trader-detail');
      if (!list || !det) return;
      if (!ready()) {
        list.innerHTML = loadingBox();
        det.innerHTML = '';
        return;
      }
      const all = traders();
      const shown = all.filter(function (t) {
        return !q || lc(t).indexOf(q) >= 0 || companiesOf(t).some(function (c) {
          return lc(c).indexOf(q) >= 0;
        });
      });
      if (!selTrader || all.indexOf(selTrader) < 0) selTrader = shown[0] || all[0] || null;
      if (!all.length) {
        list.innerHTML = emptyBox('No traders yet', 'Press ADD TRADER to add one with a company.');
        det.innerHTML = emptyBox('Nothing selected', 'Traders and their companies show here.');
        return;
      }
      if (!shown.length) {
        list.innerHTML = emptyBox('No match', 'Try a different name.');
      } else {
        list.innerHTML = shown
          .map(function (t) {
            return (
              '<button type="button" class="trow" data-act="pick-trader" data-t="' +
              esc(t) +
              '" aria-current="' +
              (t === selTrader) +
              '"><span>' +
              esc(t) +
              '</span><span class="ct">' +
              companiesOf(t).length +
              '</span></button>'
            );
          })
          .join('');
      }
      if (!selTrader) {
        det.innerHTML = emptyBox('Select a trader', '');
        return;
      }
      const ps = S.pairs
        .filter(function (p) {
          return p.trader === selTrader;
        })
        .sort(function (a, b) {
          return cmp(a.company, b.company);
        });
      let h =
        '<div class="card-head"><div><h3>' +
        esc(selTrader) +
        '</h3><span class="hint">' +
        ps.length +
        ' compan' +
        (ps.length === 1 ? 'y' : 'ies') +
        '</span></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm write" data-act="add-company">Add company</button><button class="btn sm write" data-act="rename-trader">Rename trader</button><button class="btn sm danger write" data-act="del-trader">Delete trader</button></div></div>';
      h += '<div class="tbl-wrap"><table><thead><tr><th>Company</th><th></th></tr></thead><tbody>';
      ps.forEach(function (p) {
        h +=
          '<tr><td>' +
          esc(p.company) +
          '</td><td class="act"><button class="btn sm write" data-act="edit-pair" data-id="' +
          esc(p.id) +
          '">Edit</button><button class="btn sm danger write" data-act="del-pair" data-id="' +
          esc(p.id) +
          '">Delete</button></td></tr>';
      });
      det.innerHTML = h + '</tbody></table></div>';
    }

    function renderDash() {
      const kpis = $('#kpis');
      const storeBars = $('#store-bars');
      const movePlot = $('#move-plot');
      const moveX = $('#move-x');
      const moveMax = $('#move-max');
      const lowList = $('#low-list');
      const recentList = $('#recent-list');
      const lowTh = $('#low-th');

      if (!kpis || !ready()) {
        if (kpis) kpis.innerHTML = '';
        return;
      }
      const d = computeStock();
      const low = Math.max(0, parseInt(lowTh ? lowTh.value : '5', 10) || 0);
      let units = 0;
      let live = 0;
      let lowN = 0;
      let outN = 0;
      d.totals.forEach(function (t) {
        if (t.cur > 0) {
          units += t.cur;
          live++;
        }
        if (t.cur <= 0 && t.inQty > 0) outN++;
        else if (t.cur > 0 && t.cur <= low) lowN++;
      });
      const cut = new Date();
      cut.setDate(cut.getDate() - 30);
      const cs = cut.getFullYear() + '-' + String(cut.getMonth() + 1).padStart(2, '0') + '-' + String(cut.getDate()).padStart(2, '0');
      let in30 = 0;
      let out30 = 0;
      S.ins.forEach(function (r) {
        if (r.date >= cs) in30 += r.qty;
      });
      S.outs.forEach(function (r) {
        if (r.date >= cs) out30 += r.qty;
      });
      kpis.innerHTML =
        '<div class="card kpi"><small>Units in stock</small><strong>' +
        num(units) +
        '</strong><em>' +
        live +
        ' item lines across stores</em></div>' +
        '<div class="card kpi"><small>Received, 30 days</small><strong class="q-in">' +
        num(in30) +
        '</strong><em>units stock in</em></div>' +
        '<div class="card kpi"><small>Sold, 30 days</small><strong class="q-out">' +
        num(out30) +
        '</strong><em>units stock out</em></div>' +
        '<div class="card kpi"><small>Needs attention</small><strong class="' +
        (outN ? 'q-crit' : '') +
        '">' +
        (lowN + outN) +
        '</strong><em>' +
        outN +
        ' sold out · ' +
        lowN +
        ' running low</em></div>';

      const per = {};
      STORES.forEach(function (s) {
        per[s] = 0;
      });
      d.totals.forEach(function (t) {
        if (t.cur > 0) per[t.store] = (per[t.store] || 0) + t.cur;
      });
      const mx = Math.max.apply(
        null,
        Object.keys(per)
          .map(function (k) {
            return per[k];
          })
          .concat([1])
      );
      if (storeBars) {
        storeBars.innerHTML = STORES.map(function (s) {
          return (
            '<div class="bar-row"><span class="nm" title="' +
            esc(s) +
            '">' +
            esc(s) +
            '</span><div class="track"><div class="fill" style="width:' +
            (per[s] / mx) * 100 +
            '%"></div></div><span class="num r">' +
            num(per[s]) +
            '</span></div>'
          );
        }).join('');
      }

      const days = [];
      const ins = {};
      const outs = {};
      for (let i = 13; i >= 0; i--) {
        const x = new Date();
        x.setDate(x.getDate() - i);
        const k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
        days.push({ k: k, d: x.getDate() });
        ins[k] = 0;
        outs[k] = 0;
      }
      S.ins.forEach(function (r) {
        if (r.date in ins) ins[r.date] += r.qty;
      });
      S.outs.forEach(function (r) {
        if (r.date in outs) outs[r.date] += r.qty;
      });
      const m = Math.max.apply(
        null,
        days
          .map(function (x) {
            return Math.max(ins[x.k], outs[x.k]);
          })
          .concat([1])
      );
      if (movePlot) {
        movePlot.innerHTML = days
          .map(function (x) {
            return (
              '<div class="move-col" title="' +
              fmtD(x.k) +
              ': ' +
              ins[x.k] +
              ' in, ' +
              outs[x.k] +
              ' out"><i class="a" style="height:' +
              (ins[x.k] / m) * 100 +
              '%"></i><i class="b" style="height:' +
              (outs[x.k] / m) * 100 +
              '%"></i></div>'
            );
          })
          .join('');
      }
      if (moveX) {
        moveX.innerHTML = days
          .map(function (x) {
            return '<span>' + x.d + '</span>';
          })
          .join('');
      }
      if (moveMax) moveMax.textContent = 'peak ' + num(m) + ' units/day';

      const watch = d.totals
        .filter(function (t) {
          return (t.cur <= 0 && t.inQty > 0) || (t.cur > 0 && t.cur <= low);
        })
        .sort(function (a, b) {
          return a.cur - b.cur || cmp(a.item, b.item);
        });
      if (lowList) {
        lowList.innerHTML = watch.length
          ? '<table><thead><tr><th>Store</th><th>Item</th><th class="r">Left</th></tr></thead><tbody>' +
            watch
              .slice(0, 12)
              .map(function (t) {
                return (
                  '<tr><td>' +
                  esc(t.store) +
                  '</td><td>' +
                  esc(t.item) +
                  '</td><td class="r"><span class="pill ' +
                  (t.cur <= 0 ? 'crit' : 'warn') +
                  ' num">' +
                  (t.cur <= 0 ? 'Sold out' : num(t.cur)) +
                  '</span></td></tr>'
                );
              })
              .join('') +
            '</tbody></table>'
          : emptyBox(S.ins.length ? 'Nothing is running low' : 'No stock recorded yet', 'Items at or below ' + low + ' units show here.');
      }

      const ev = S.ins
        .map(function (r) {
          return { k: 'in', date: r.date, ts: r.ts || 0, store: r.store, item: itemName(r.itemId, r.itemName), qty: r.qty, who: r.trader };
        })
        .concat(
          S.outs.map(function (r) {
            return { k: 'out', date: r.date, ts: r.ts || 0, store: r.store, item: itemName(r.itemId, r.itemName), qty: r.qty, who: r.customer };
          })
        )
        .sort(function (a, b) {
          return a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts;
        })
        .slice(0, 8);
      if (recentList) {
        recentList.innerHTML = ev.length
          ? '<table><thead><tr><th>Date</th><th>Item</th><th>Store</th><th class="r">Qty</th></tr></thead><tbody>' +
            ev
              .map(function (e) {
                return (
                  '<tr><td class="mono">' +
                  fmtD(e.date) +
                  '</td><td>' +
                  esc(e.item) +
                  '<div class="hint">' +
                  (e.k === 'in' ? 'from ' : 'to ') +
                  esc(e.who) +
                  '</div></td><td>' +
                  esc(e.store) +
                  '</td><td class="r num ' +
                  (e.k === 'in' ? 'q-in' : 'q-out') +
                  '">' +
                  (e.k === 'in' ? '+' : '−') +
                  num(e.qty) +
                  '</td></tr>'
                );
              })
              .join('') +
            '</tbody></table>'
          : emptyBox('No activity yet', 'Stock in and stock out entries show here.');
      }
    }

    let raf = 0;
    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        renderAll();
      });
    }

    function renderAll() {
      refreshForms();
      refreshCsFilters();
      renderDash();
      renderIn();
      renderOut();
      renderCurrent();
      renderItems();
      renderTraders();
    }

    function closeModal() {
      const m = $('#modal');
      if (m) {
        m.hidden = true;
        m.innerHTML = '';
      }
    }

    function openModal(cfg) {
      const m = $('#modal');
      if (!m) return;
      let h = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(cfg.title) + '"><h3>' + esc(cfg.title) + '</h3><form id="m-form" autocomplete="off">';
      cfg.fields.forEach(function (f) {
        h += '<label>' + esc(f.label);
        if (f.type === 'select') {
          h +=
            '<select id="mf-' +
            f.id +
            '">' +
            f.options
              .map(function (o) {
                return '<option value="' + esc(o) + '"' + (o === f.value ? ' selected' : '') + '>' + esc(o) + '</option>';
              })
              .join('') +
            '</select>';
        } else if (f.type === 'static') {
          h += '<input id="mf-' + f.id + '" value="' + esc(f.value) + '" disabled>';
        } else {
          h +=
            '<input id="mf-' +
            f.id +
            '" type="text" maxlength="120" value="' +
            esc(f.value || '') +
            '"' +
            (f.list ? ' list="ml-' + f.id + '"' : '') +
            ' required>' +
            (f.list
              ? '<datalist id="ml-' +
                f.id +
                '">' +
                f.list
                  .map(function (o) {
                    return '<option value="' + esc(o) + '">';
                  })
                  .join('') +
                '</datalist>'
              : '');
        }
        h += '</label>';
      });
      h +=
        '<div class="err" id="m-err" role="alert"></div><div class="row"><button type="button" class="btn" data-act="close-modal">Cancel</button><button type="submit" class="btn primary">' +
        esc(cfg.submit) +
        '</button></div></form></div>';
      m.innerHTML = h;
      m.hidden = false;
      const first = $('#m-form input:not([disabled]),#m-form select');
      if (first) first.focus();
      const mForm = $('#m-form');
      if (mForm) {
        mForm.addEventListener('submit', function (e) {
          e.preventDefault();
          const vals = {};
          cfg.fields.forEach(function (f) {
            const el = $('#mf-' + f.id);
            vals[f.id] = el ? el.value.trim() : '';
          });
          const r = cfg.onSubmit(vals);
          if (typeof r === 'string') {
            const errEl = $('#m-err');
            if (errEl) errEl.textContent = r;
            return;
          }
          closeModal();
        });
      }
    }

    function needWrite() {
      if (ro) {
        toast('View only. You cannot change data.');
        return false;
      }
      return true;
    }

    function armed(btn, fn) {
      if (btn.hasAttribute('data-armed')) {
        fn();
        return;
      }
      btn.setAttribute('data-armed', '1');
      btn._o = btn.textContent;
      btn.textContent = 'Confirm?';
      setTimeout(function () {
        if (btn.isConnected && btn.hasAttribute('data-armed')) {
          btn.removeAttribute('data-armed');
          btn.textContent = btn._o;
        }
      }, 3000);
    }

    function openItemModal(item) {
      const editing = !!item;
      openModal({
        title: editing ? 'Edit gift item' : 'Add gift item',
        submit: editing ? 'Save changes' : 'Create',
        fields: [
          { id: 'name', label: 'Item name', value: editing ? item.name : '' },
          { id: 'store', label: 'Store', type: 'select', options: [ALL].concat(STORES), value: editing ? item.store : ALL }
        ],
        onSubmit: function (v) {
          if (!v.name) return 'Enter an item name.';
          const dup = S.items.some(function (i) {
            return lc(i.name) === lc(v.name) && i.store === v.store && (!editing || i.id !== item.id);
          });
          if (dup) return 'This item already exists for ' + v.store + '.';
          const id = editing ? item.id : 'i_' + uid();
          save(store.put('items', id, { name: v.name, store: v.store, ts: editing ? item.ts || Date.now() : Date.now() }), editing ? 'Item updated' : 'Item created');
        }
      });
    }

    function openPairModal(opts) {
      openModal({ title: opts.title, submit: opts.submit, fields: opts.fields, onSubmit: opts.onSubmit });
    }

    function pairExists(t, c, exceptId) {
      return S.pairs.some(function (p) {
        return lc(p.trader) === lc(t) && lc(p.company) === lc(c) && p.id !== exceptId;
      });
    }

    function canonicalTrader(name) {
      const t = traders().filter(function (x) {
        return lc(x) === lc(name);
      })[0];
      return t || name;
    }

    function showTab(t, updateRoute = true) {
      if (TABS.indexOf(t) < 0) t = 'dashboard';
      currentTab = t;
      TABS.forEach(function (x) {
        const sec = $('#v-' + x);
        if (sec) sec.hidden = x !== t;
      });
      if (updateRoute) {
        navigate('/systems/business-overview/gift-stock/' + t);
      }
    }

    showTabRef.current = showTab;

    // Click handler for delegated actions inside container
    function handleClick(e) {
      const modal = $('#modal');
      if (e.target === modal) {
        closeModal();
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.getAttribute('data-act');
      const id = b.getAttribute('data-id');
      if (act === 'close-modal') {
        closeModal();
        return;
      }
      if (act === 'pick-trader') {
        selTrader = b.getAttribute('data-t');
        renderTraders();
        return;
      }
      if (act === 'view-proof') {
        const src = b.getAttribute('data-img');
        const m = $('#modal');
        if (m && src) {
          m.innerHTML =
            '<div class="sheet" style="max-width:550px;width:95%;padding:20px;text-align:center;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">' +
            '<h3 style="margin:0;font-size:16px;">Stock Out Proof Image</h3>' +
            '<button type="button" class="btn sm" data-act="close-modal">✕ Close</button>' +
            '</div>' +
            '<div style="max-height:65vh;overflow:auto;display:flex;justify-content:center;align-items:center;background:#0f172a;border-radius:8px;padding:8px;">' +
            '<img src="' +
            esc(src) +
            '" style="max-width:100%;max-height:60vh;object-fit:contain;border-radius:4px;" alt="Stock Out Proof" />' +
            '</div>' +
            '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">' +
            '<a href="' +
            esc(src) +
            '" target="_blank" rel="noopener noreferrer" class="btn sm primary" style="text-decoration:none;">Open in New Tab</a>' +
            '<button type="button" class="btn sm" data-act="close-modal">Close</button>' +
            '</div>' +
            '</div>';
          m.hidden = false;
        }
        return;
      }
      if (!needWrite()) return;
      if (act === 'del-in') {
        armed(b, function () {
          save(store.del('ins', id), 'Entry deleted');
        });
      } else if (act === 'del-out') {
        armed(b, function () {
          save(store.del('outs', id), 'Entry deleted');
        });
      } else if (act === 'edit-item') {
        const it = S.items.filter(function (x) {
          return x.id === id;
        })[0];
        if (it) openItemModal(it);
      } else if (act === 'del-item') {
        armed(b, function () {
          save(store.del('items', id), 'Item deleted');
        });
      } else if (act === 'edit-pair') {
        const p = S.pairs.filter(function (x) {
          return x.id === id;
        })[0];
        if (!p) return;
        openPairModal({
          title: 'Edit company',
          submit: 'Save changes',
          fields: [
            { id: 't', label: 'Trader name', value: p.trader, list: traders() },
            { id: 'c', label: 'Company name', value: p.company }
          ],
          onSubmit: function (v) {
            if (!v.t || !v.c) return 'Enter both trader and company.';
            if (pairExists(v.t, v.c, p.id)) return 'That trader and company pair already exists.';
            const t = canonicalTrader(v.t);
            selTrader = t;
            save(store.put('pairs', p.id, { trader: t, company: v.c, ts: p.ts || Date.now() }), 'Saved');
          }
        });
      } else if (act === 'del-pair') {
        armed(b, function () {
          save(store.del('pairs', id), 'Company removed');
        });
      } else if (act === 'add-company') {
        openPairModal({
          title: 'Add company',
          submit: 'Add',
          fields: [
            { id: 't', label: 'Trader name', type: 'static', value: selTrader },
            { id: 'c', label: 'Company name', value: '' }
          ],
          onSubmit: function (v) {
            if (!v.c) return 'Enter a company name.';
            if (pairExists(selTrader, v.c)) return 'This company is already listed for ' + selTrader + '.';
            save(store.put('pairs', 'p_' + uid(), { trader: selTrader, company: v.c, ts: Date.now() }), 'Company added');
          }
        });
      } else if (act === 'rename-trader') {
        const old = selTrader;
        openPairModal({
          title: 'Rename trader',
          submit: 'Save',
          fields: [{ id: 't', label: 'Trader name', value: old }],
          onSubmit: function (v) {
            if (!v.t) return 'Enter a trader name.';
            const nw = canonicalTrader(v.t);
            const mine = S.pairs.filter(function (p) {
              return p.trader === old;
            });
            if (
              lc(nw) !== lc(old) &&
              traders().some(function (x) {
                return lc(x) === lc(nw);
              })
            ) {
              return 'A trader with this name already exists.';
            }
            selTrader = nw;
            let chain = Promise.resolve();
            mine.forEach(function (p) {
              chain = chain.then(function () {
                return store.put('pairs', p.id, { trader: nw, company: p.company, ts: p.ts || Date.now() });
              });
            });
            save(chain, 'Trader renamed');
          }
        });
      } else if (act === 'del-trader') {
        armed(b, function () {
          const mine = S.pairs.filter(function (p) {
            return p.trader === selTrader;
          });
          let chain = Promise.resolve();
          mine.forEach(function (p) {
            chain = chain.then(function () {
              return store.del('pairs', p.id);
            });
          });
          save(chain, 'Trader deleted');
        });
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        const m = $('#modal');
        if (m && !m.hidden) closeModal();
      }
    }

    container.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    // Add item & trader button handlers
    const addItemBtn = $('#add-item');
    if (addItemBtn) {
      addItemBtn.addEventListener('click', function () {
        if (needWrite()) openItemModal(null);
      });
    }

    const addTraderBtn = $('#add-trader');
    if (addTraderBtn) {
      addTraderBtn.addEventListener('click', function () {
        if (!needWrite()) return;
        openPairModal({
          title: 'Add trader',
          submit: 'Create',
          fields: [
            { id: 't', label: 'Trader name', value: '', list: traders() },
            { id: 'c', label: 'Company name', value: '' }
          ],
          onSubmit: function (v) {
            if (!v.t || !v.c) return 'Enter both trader and company.';
            const t = canonicalTrader(v.t);
            if (pairExists(t, v.c)) return 'That trader and company pair already exists.';
            selTrader = t;
            save(store.put('pairs', 'p_' + uid(), { trader: t, company: v.c, ts: Date.now() }), 'Trader added');
          }
        });
      });
    }

    // Form inputs and change handlers
    const inStore = $('#in-store');
    if (inStore) inStore.addEventListener('change', refreshForms);
    const inTrader = $('#in-trader');
    if (inTrader) inTrader.addEventListener('change', refreshForms);
    const outStore = $('#out-store');
    if (outStore) outStore.addEventListener('change', refreshForms);
    const outItem = $('#out-item');
    if (outItem) outItem.addEventListener('change', updateOutHint);
    const outQty = $('#out-qty');
    if (outQty) outQty.addEventListener('input', updateOutHint);

    const fIn = $('#f-in');
    if (fIn) {
      fIn.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!needWrite()) return;
        const qInput = $('#in-qty');
        const q = Number(qInput ? qInput.value : '');
        const id = $('#in-item') ? $('#in-item').value : '';
        if (!Number.isInteger(q) || q < 1) {
          toast('Qty must be a whole number, 1 or more.');
          return;
        }
        const it = itemMap()[id];
        if (!it) {
          toast('Choose an item.');
          return;
        }
        const inDate = $('#in-date') ? $('#in-date').value : '';
        const inStoreVal = $('#in-store') ? $('#in-store').value : '';
        const inTraderVal = $('#in-trader') ? $('#in-trader').value : '';
        const inCompanyVal = $('#in-company') ? $('#in-company').value : '';
        const rec = {
          date: inDate || today(),
          store: inStoreVal,
          trader: inTraderVal,
          company: inCompanyVal,
          itemId: id,
          itemName: it.name,
          qty: q,
          ts: Date.now()
        };
        save(store.put('ins', 'in_' + uid(), rec), 'Stock in added').then(function (ok) {
          if (ok && qInput) {
            qInput.value = '';
            qInput.focus();
          }
        });
      });
    }

    const outProof = $('#out-proof');
    const outProofPreview = $('#out-proof-preview');
    const outProofThumb = $('#out-proof-thumb');
    const outProofName = $('#out-proof-name');
    const outProofClear = $('#out-proof-clear');

    if (outProof) {
      outProof.addEventListener('change', function () {
        const file = outProof.files && outProof.files[0];
        if (file) {
          if (outProofThumb) outProofThumb.src = URL.createObjectURL(file);
          if (outProofName) outProofName.textContent = file.name;
          if (outProofPreview) outProofPreview.style.display = 'inline-flex';
        } else {
          if (outProofPreview) outProofPreview.style.display = 'none';
        }
      });
    }

    if (outProofClear) {
      outProofClear.addEventListener('click', function () {
        if (outProof) outProof.value = '';
        if (outProofPreview) outProofPreview.style.display = 'none';
      });
    }

    const fOut = $('#f-out');
    if (fOut) {
      fOut.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!needWrite()) return;
        const outQtyEl = $('#out-qty');
        const outCustomerEl = $('#out-customer');
        const outContactEl = $('#out-contact');
        const outDateEl = $('#out-date');
        const outProofEl = $('#out-proof');
        const submitBtn = fOut.querySelector('button[type="submit"]');

        const q = Number(outQtyEl ? outQtyEl.value : '');
        const id = $('#out-item') ? $('#out-item').value : '';
        const st = $('#out-store') ? $('#out-store').value : '';
        if (!Number.isInteger(q) || q < 1) {
          toast('Qty must be a whole number, 1 or more.');
          return;
        }
        const it = itemMap()[id];
        if (!it) {
          toast('Choose an item.');
          return;
        }
        const a = available(st, id);
        if (q > a) {
          toast('Only ' + num(a) + ' in stock at ' + st + '.');
          return;
        }
        const phone = outContactEl ? outContactEl.value.trim() : '';
        if (!/^[+]?[0-9 -]{10,15}$/.test(phone)) {
          toast('Enter a valid contact number.');
          return;
        }

        let proofUrl = null;
        const file = outProofEl && outProofEl.files && outProofEl.files[0] ? outProofEl.files[0] : null;
        if (file) {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading proof...';
          }
          try {
            proofUrl = await uploadProofImage(file);
          } catch (err) {
            console.error('Failed to upload proof image:', err);
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Add stock out';
            }
          }
        }

        const rec = {
          date: (outDateEl ? outDateEl.value : '') || today(),
          store: st,
          itemId: id,
          itemName: it.name,
          qty: q,
          customer: outCustomerEl ? outCustomerEl.value.trim() : '',
          contact: phone,
          proofImage: proofUrl,
          ts: Date.now()
        };
        save(store.put('outs', 'out_' + uid(), rec), 'Stock out added').then(function (ok) {
          if (ok) {
            if (outQtyEl) outQtyEl.value = '';
            if (outCustomerEl) outCustomerEl.value = '';
            if (outContactEl) outContactEl.value = '';
            if (outProofEl) outProofEl.value = '';
            const previewWrap = $('#out-proof-preview');
            if (previewWrap) previewWrap.style.display = 'none';
            updateOutHint();
          }
        });
      });
    }

    const inSearch = $('#in-search');
    if (inSearch) inSearch.addEventListener('input', renderIn);
    const outSearch = $('#out-search');
    if (outSearch) outSearch.addEventListener('input', renderOut);
    const itemSearch = $('#item-search');
    if (itemSearch) itemSearch.addEventListener('input', renderItems);
    const traderSearch = $('#trader-search');
    if (traderSearch) traderSearch.addEventListener('input', renderTraders);

    ['cs-store', 'cs-company', 'cs-search', 'cs-hide0'].forEach(function (i) {
      const el = $('#' + i);
      if (el) el.addEventListener('input', renderCurrent);
    });

    const csTrader = $('#cs-trader');
    if (csTrader) {
      csTrader.addEventListener('change', function () {
        refreshCsFilters();
        renderCurrent();
      });
    }

    const csVDetail = $('#cs-v-detail');
    const csVItem = $('#cs-v-item');
    if (csVDetail && csVItem) {
      csVDetail.addEventListener('click', function () {
        csView = 'detail';
        csVDetail.setAttribute('aria-pressed', 'true');
        csVItem.setAttribute('aria-pressed', 'false');
        renderCurrent();
      });
      csVItem.addEventListener('click', function () {
        csView = 'item';
        csVItem.setAttribute('aria-pressed', 'true');
        csVDetail.setAttribute('aria-pressed', 'false');
        renderCurrent();
      });
    }

    const lowTh = $('#low-th');
    if (lowTh) {
      lowTh.value = lsGet('gsd:low', '5');
      lowTh.addEventListener('input', function () {
        lsSet('gsd:low', lowTh.value);
        renderDash();
      });
    }

    // Boot initial dates and tabs
    const inDate = $('#in-date');
    if (inDate) inDate.value = today();
    const outDate = $('#out-date');
    if (outDate) outDate.value = today();

    showTab(activeTabParam, false);
    renderAll();

    // Subscribe to database collections
    const channels = COLLS.map(function (c) {
      return store.sub(c, function (rows) {
        S[c] = rows;
        loaded[c] = true;
        schedule();
      });
    });

    return () => {
      container.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      channels.forEach((ch) => {
        if (ch && typeof ch.unsubscribe === 'function') {
          ch.unsubscribe();
        }
      });
    };
  }, []);

  // Sync tab if URL route parameter changes externally (e.g., clicked from Drinqkart sidebar dropdown)
  useEffect(() => {
    if (showTabRef.current && activeTabParam) {
      showTabRef.current(activeTabParam, false);
    }
  }, [activeTabParam]);

  return (
    <div className="gift-stock-dashboard-container" ref={containerRef}>
      <div className="app">
        <main>
          <div className="banner" id="ro-banner" hidden>
            You can view this page but not change stock. Ask the owner for edit access.
          </div>

          {/* DASHBOARD */}
          <section className="view" id="v-dashboard" role="tabpanel">
            <div className="page-head">
              <div>
                <h2>Dashboard</h2>
                <p>What is on the shelves right now, across all stores.</p>
              </div>
            </div>
            <div className="stack">
              <div className="kpis" id="kpis"></div>
              <div className="dash-grid">
                <div className="card">
                  <div className="card-head">
                    <h3>Units in stock by store</h3>
                  </div>
                  <div className="bars" id="store-bars"></div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <h3>Last 14 days</h3>
                  </div>
                  <div className="move">
                    <div className="move-plot" id="move-plot"></div>
                    <div className="move-x" id="move-x"></div>
                  </div>
                  <div className="legend">
                    <span className="a">Stock in</span>
                    <span className="b">Stock out</span>
                    <span id="move-max" className="mono" style={{ marginLeft: 'auto' }}></span>
                  </div>
                </div>
              </div>
              <div className="dash-grid">
                <div className="card">
                  <div className="card-head">
                    <h3>Running low</h3>
                    <label className="th-inline" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, flexDirection: 'row' }}>
                      at or below <input type="number" id="low-th" min="0" step="1" defaultValue="5" aria-label="Low stock level" /> units
                    </label>
                  </div>
                  <div className="tbl-wrap" id="low-list"></div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <h3>Recent activity</h3>
                  </div>
                  <div className="tbl-wrap" id="recent-list"></div>
                </div>
              </div>
            </div>
          </section>

          {/* STOCK IN */}
          <section className="view" id="v-stock-in" role="tabpanel" hidden>
            <div className="page-head">
              <div>
                <h2>Stock In</h2>
                <p>Record gifts received from a trader into a store.</p>
              </div>
            </div>
            <div className="stack">
              <form className="card form-grid" id="f-in" autoComplete="off">
                <label>
                  Date
                  <input type="date" id="in-date" required />
                </label>
                <label>
                  Store
                  <select id="in-store" required></select>
                </label>
                <label>
                  Trader name
                  <select id="in-trader" required></select>
                </label>
                <label>
                  Company name
                  <select id="in-company" required></select>
                </label>
                <label>
                  Item name
                  <select id="in-item" required></select>
                </label>
                <label>
                  Qty
                  <input type="number" id="in-qty" min="1" step="1" inputMode="numeric" placeholder="0" required />
                </label>
                <div className="form-actions">
                  <button className="btn in write" type="submit">
                    Add stock in
                  </button>
                  <span className="hint" id="in-hint"></span>
                </div>
              </form>
              <div className="card">
                <div className="card-head">
                  <h3>Stock in entries</h3>
                  <div className="search">
                    <input type="search" id="in-search" placeholder="Search item, trader, company or store" aria-label="Search stock in entries" />
                  </div>
                </div>
                <div className="tbl-wrap" id="in-list"></div>
              </div>
            </div>
          </section>

          {/* STOCK OUT */}
          <section className="view" id="v-stock-out" role="tabpanel" hidden>
            <div className="page-head">
              <div>
                <h2>Stock Out</h2>
                <p>Record a sale to a customer. The store tells us which shelf to reduce.</p>
              </div>
            </div>
            <div className="stack">
              <form className="card form-grid" id="f-out" autoComplete="off">
                <label>
                  Date
                  <input type="date" id="out-date" required />
                </label>
                <label>
                  Store
                  <select id="out-store" required></select>
                </label>
                <label>
                  Item name
                  <select id="out-item" required></select>
                </label>
                <label>
                  Qty
                  <input type="number" id="out-qty" min="1" step="1" inputMode="numeric" placeholder="0" required />
                </label>
                <label>
                  Customer name
                  <input type="text" id="out-customer" required maxLength={80} />
                </label>
                <label>
                  Contact no
                  <input type="tel" id="out-contact" inputMode="tel" maxLength={15} placeholder="10 digit mobile" required />
                </label>
                <label>
                  Proof image (Single Image)
                  <input type="file" id="out-proof" accept="image/*" />
                  <div id="out-proof-preview" style={{ display: 'none', marginTop: '6px', alignItems: 'center', gap: '8px' }}>
                    <img id="out-proof-thumb" src="" alt="Proof Preview" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <span id="out-proof-name" style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}></span>
                    <button type="button" id="out-proof-clear" className="btn sm ghost danger" style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                  </div>
                </label>
                <div className="form-actions">
                  <button className="btn out write" type="submit">
                    Add stock out
                  </button>
                  <span className="hint" id="out-hint"></span>
                </div>
              </form>
              <div className="card">
                <div className="card-head">
                  <h3>Stock out entries</h3>
                  <div className="search">
                    <input type="search" id="out-search" placeholder="Search item, customer, contact or store" aria-label="Search stock out entries" />
                  </div>
                </div>
                <div className="tbl-wrap" id="out-list"></div>
              </div>
            </div>
          </section>

          {/* CURRENT STOCK */}
          <section className="view" id="v-current-stock" role="tabpanel" hidden>
            <div className="page-head">
              <div>
                <h2>Current Stock</h2>
                <p>Stock in minus stock out, by store, item, trader and company. Sales are counted against the oldest stock in first.</p>
              </div>
            </div>
            <div className="card">
              <div className="filters">
                <label>
                  Store
                  <select id="cs-store"></select>
                </label>
                <label>
                  Trader
                  <select id="cs-trader"></select>
                </label>
                <label>
                  Company
                  <select id="cs-company"></select>
                </label>
                <label>
                  Item
                  <input type="search" id="cs-search" placeholder="Search item" />
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="seg" role="group" aria-label="View">
                    <button type="button" id="cs-v-detail" aria-pressed="true">
                      By trader
                    </button>
                    <button type="button" id="cs-v-item" aria-pressed="false">
                      By item
                    </button>
                  </div>
                  <label className="chk">
                    <input type="checkbox" id="cs-hide0" defaultChecked />
                    Hide zero stock
                  </label>
                </div>
              </div>
              <div className="tbl-wrap" id="cs-list"></div>
            </div>
          </section>

          {/* ITEM MASTER */}
          <section className="view" id="v-item-master" role="tabpanel" hidden>
            <div className="page-head">
              <div>
                <h2>Item Master</h2>
                <p>Every gift item you can stock. Create items here, then pick them in Stock In and Stock Out.</p>
              </div>
              <button className="btn primary write" id="add-item" type="button">
                ADD GIFT ITEM
              </button>
            </div>
            <div className="card">
              <div className="tools">
                <div className="search">
                  <input type="search" id="item-search" placeholder="Search by item name" aria-label="Search items" />
                </div>
                <span className="hint" id="item-count"></span>
              </div>
              <div className="tbl-wrap" id="item-list"></div>
            </div>
          </section>

          {/* TRADER MASTER */}
          <section className="view" id="v-trader-master" role="tabpanel" hidden>
            <div className="page-head">
              <div>
                <h2>Trader Master</h2>
                <p>Each trader and the companies they supply. Stock In uses this to filter the company list.</p>
              </div>
              <button className="btn primary write" id="add-trader" type="button">
                ADD TRADER
              </button>
            </div>
            <div className="tm">
              <div className="card">
                <div className="tools">
                  <div className="search" style={{ maxWidth: 'none' }}>
                    <input type="search" id="trader-search" placeholder="Search trader or company" aria-label="Search traders" />
                  </div>
                </div>
                <div className="tlist" id="trader-list"></div>
              </div>
              <div className="card" id="trader-detail"></div>
            </div>
          </section>
        </main>
      </div>

      <div id="modal" hidden></div>
      <div id="toast" hidden></div>
    </div>
  );
}
