import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, RefreshCw, Share2, CheckCircle2, ChevronDown, ClipboardList, Eye, X, Store, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const CHECKLIST_DATA = [
  {
    group: 'Sales Counter & Points', items: [
      { id: 'cash', icon: '💵', label: 'Cash counter' },
      { id: 'barcode', icon: '🏷️', label: 'Barcode scanner' },
      { id: 'card', icon: '💳', label: 'Card swipe machine + charger & UPI sound box + charger' },
      { id: 'sale1', icon: '🧾', label: 'Sale point 1' },
      { id: 'sale2', icon: '🧾', label: 'Sale point 2' },
      { id: 'sale3', icon: '🧾', label: 'Sale point 3' },
      { id: 'offer', icon: '📢', label: 'Offer board' },
      { id: 'chairs', icon: '🪑', label: 'Chairs & Tables' },
    ]
  },
  {
    group: 'Billing & Systems', items: [
      { id: 'server', icon: '🖥️', label: 'Main server computer' },
      { id: 'billprint', icon: '🖨️', label: 'Billing printer' },
      { id: 'exciseprint', icon: '📠', label: 'Excise printer' },
      { id: 'wifi', icon: '📶', label: 'WiFi / Networking Device' },
      { id: 'mobile', icon: '📱', label: 'Mobile Phone + Charger' },
      { id: 'inverter', icon: '🔋', label: 'Inverter' },
    ]
  },
  {
    group: 'Security & Safety', items: [
      { id: 'cctv', icon: '📹', label: 'CCTV camera / TV / remote' },
      { id: 'alarm', icon: '🚨', label: 'Alarm system (shutter & smoke)' },
      { id: 'fire', icon: '🧯', label: 'Fire cylinder' },
    ]
  },
  {
    group: 'Storage & Refrigeration', items: [
      { id: 'fridge_steel', icon: '❄️', label: 'Fridge / steel unit' },
      { id: 'fridge_bud', icon: '🍺', label: 'Fridge Budweiser' },
      { id: 'fridge_kf', icon: '🍺', label: 'Fridge Kingfisher' },
      { id: 'water_jar', icon: '🚰', label: 'Water Jar' },
      { id: 'cleaning', icon: '🧹', label: 'Cleaning Items (Mop, Bucket & Liquids)' },
    ]
  },
  {
    group: 'Branding & Display', items: [
      { id: 'main_board', icon: '🏙️', label: 'Main Wine Shop Board' },
      { id: 'window_disp', icon: '🖼️', label: 'Window Display' },
      { id: 'disp_stand', icon: '🪜', label: 'Display Stand' },
      { id: 'lighting', icon: '💡', label: 'Lighting (Board, Rack, Counter)' },
    ]
  },
  {
    group: 'Doors, Shutters & Keys', items: [
      { id: 'shutter_door', icon: '🚪', label: 'Shutter & Door' },
      { id: 'shutter_remote', icon: '📻', label: 'Shutter Sensor Remote' },
      { id: 'main_key', icon: '🔑', label: 'Main Shutter & Central Lock Key' },
      { id: 'cash_key', icon: '🔑', label: 'Cash Counter & Drawer Key' },
      { id: 'godown_key', icon: '🔑', label: 'Godown / Store Room Key' },
      { id: 'showcase_key', icon: '🔑', label: 'Showcase / Display Case Key' },
    ]
  },
  {
    group: 'Vehicles & Delivery', items: [
      { id: 'bike_activa', icon: '🛵', label: 'Bike Available (Activa)' },
      { id: 'bike_ev', icon: '⚡', label: 'Bike Available (Electric)' },
      { id: 'ev_charger', icon: '🔌', label: 'Bike Charger (Electric)' },
      { id: 'helmet', icon: '🪖', label: 'Helmet' },
      { id: 'rto_cleared', icon: '📄', label: 'RTO Penalty Cleared' },
    ]
  },
  {
    group: 'Licenses & Legal Docs', items: [
      { id: 'shop_lic', icon: '📜', label: 'Shop License' },
      { id: 'fssai_lic', icon: '🥗', label: 'FSSAI Food License' },
      { id: 'shop_act', icon: '⚖️', label: 'Shop Act' },
      { id: 'shop_map', icon: '🗺️', label: 'Shop Map' },
      { id: 'vat_cert', icon: '📑', label: 'VAT Certificate' },
      { id: 'tp_file', icon: '📂', label: 'TP File (IMFL + CL + MML)' },
      { id: 'excise_reg', icon: '📖', label: 'Excise Register & Printout & Monthly' },
    ]
  },
  {
    group: 'Accounts, Books & Expenses', items: [
      { id: 'attendance_book', icon: '📒', label: 'Attendance Book' },
      { id: 'nokarnama', icon: '🆔', label: 'Nokarnama & ID Proof' },
      { id: 'visit_book', icon: '📗', label: 'Visit Book' },
      { id: 'expense_book', icon: '📘', label: 'Expense Book' },
      { id: 'wholesale_out', icon: '💰', label: 'Wholesale Party Outstanding Amount' },
      { id: 'license_rent', icon: '🏠', label: 'License Rent' },
      { id: 'shop_rent', icon: '🏪', label: 'Shop Rent' },
      { id: 'excise_police', icon: '👮', label: 'Excise & Police monthly' },
      { id: 'opening_cash', icon: '💵', label: 'Opening Cash' },
    ]
  },
];
const TOTAL = CHECKLIST_DATA.reduce((n, g) => n + g.items.length, 0);
const STATUS = {
  ok: { label: 'OK', color: '#1a9e5c', bg: '#e5f7ee', border: '#1a9e5c' },
  bad: { label: 'Not OK', color: '#d64545', bg: '#fceaea', border: '#d64545' },
  miss: { label: 'Missing', color: '#c98a1c', bg: '#fbf1de', border: '#c98a1c' },
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => { if (!iso) return '-'; const [y, m, d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}`; };
const IS = { border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 11px', fontSize: 13.5, background: '#fff', color: '#1e293b', width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

function Ring({ pct }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - pct / 100)).toFixed(1)}
          style={{ transition: 'stroke-dashoffset .35s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{pct}%</div>
    </div>
  );
}

function MultiSegmentPie({ ok, bad, miss, total }) {
  const done = ok + bad + miss;
  const unchecked = Math.max(0, total - done);
  const pct = Math.round((done / total) * 100);
  const r = 32, c = 2 * Math.PI * r; // circumference ~ 201.06

  const slices = [
    { count: ok, color: '#1a9e5c', label: 'OK' },
    { count: bad, color: '#d64545', label: 'Not OK' },
    { count: miss, color: '#c98a1c', label: 'Missing' },
    { count: unchecked, color: '#e2e8f0', label: 'Pending' },
  ];

  let cumulativeOffset = 0;

  return (
    <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
        <span>📋 {done} of {total} checked</span>
        <span style={{ fontSize: 12, color: bad + miss > 0 ? '#d64545' : done === total ? '#1a9e5c' : '#0f4c81' }}>
          {bad + miss > 0 ? `${bad + miss} issue(s)` : done === total ? 'All clear ✓' : `${pct}% done`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            {slices.map((slice, i) => {
              if (slice.count <= 0) return null;
              const strokeDasharray = `${(c * (slice.count / total)).toFixed(2)} ${(c * (1 - slice.count / total)).toFixed(2)}`;
              const strokeDashoffset = (-cumulativeOffset).toFixed(2);
              cumulativeOffset += c * (slice.count / total);

              return (
                <circle
                  key={i}
                  cx="36"
                  cy="36"
                  r={r}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="10"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dasharray .35s ease, stroke-dashoffset .35s ease' }}
                />
              );
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{pct}%</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#64748b', marginTop: 2 }}>Done</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a9e5c', display: 'inline-block' }} />
            <span style={{ color: '#475569', fontWeight: 600 }}>OK: <b>{ok}</b></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d64545', display: 'inline-block' }} />
            <span style={{ color: '#475569', fontWeight: 600 }}>Not OK: <b>{bad}</b></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c98a1c', display: 'inline-block' }} />
            <span style={{ color: '#475569', fontWeight: 600 }}>Missing: <b>{miss}</b></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
            <span style={{ color: '#64748b', fontWeight: 600 }}>Pending: <b>{unchecked}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1/-1' : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</label>
      {children}
    </div>
  );
}

function ChecklistModal({ shops, onClose, onSaved }) {
  const [date, setDate] = useState(todayISO());
  const [visitor, setVisitor] = useState('');
  const [shop, setShop] = useState('');
  const [handover, setHandover] = useState('');
  const [takeover, setTakeover] = useState('');
  const [checks, setChecks] = useState({});
  const [coll, setColl] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}'); if (u.name || u.user_name || u.username) setVisitor(u.name || u.user_name || u.username); } catch (_) { }
  }, []);

  const done = Object.values(checks).filter(Boolean).length;
  const ok = Object.values(checks).filter(v => v === 'ok').length;
  const bad = Object.values(checks).filter(v => v === 'bad').length;
  const miss = Object.values(checks).filter(v => v === 'miss').length;
  const pct = Math.round(done / TOTAL * 100);
  const hero = shop ? (shops.find(s => s.shop_name === shop)?.full_name || shop) : 'Select shop to begin';
  const tog = (id, val) => setChecks(p => ({ ...p, [id]: p[id] === val ? null : val }));

  const report = () => {
    const L = [`🏪 *Shop Visit Report*`, `Shop: ${hero}`, `Date: ${fmtDate(date)}`, `Visitor: ${visitor || '?'}`, `Handover: ${handover || '-'}  |  Takeover: ${takeover || '-'}`, ''];
    CHECKLIST_DATA.forEach(g => {
      L.push(`*${g.group}*`);
      g.items.forEach(it => { const s = checks[it.id]; L.push(`${s === 'ok' ? '✅' : s === 'bad' ? '❌' : s === 'miss' ? '⚠️' : '⬜'} ${it.icon} ${it.label} — ${s ? STATUS[s].label : 'Not checked'}`); });
      L.push('');
    });
    L.push(`Summary: ${done}/${TOTAL} checked, ${bad} not ok, ${miss} missing.`);
    return L.join('\n');
  };

  const share = async () => {
    const t = report();
    try { if (navigator.share) { await navigator.share({ title: 'Shop Visit', text: t }); return; } } catch (_) { }
    try { await navigator.clipboard.writeText(t); toast.success('Copied!'); } catch (_) { toast.error('Cannot copy.'); }
  };

  const save = async () => {
    if (!shop) { toast.error('Select a shop.'); return; }
    if (!visitor) { toast.error('Enter visitor name.'); return; }
    if (done < TOTAL) { toast.error(`${TOTAL - done} item(s) unchecked.`); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('shop_visit').insert([{
        visit_date: date,
        shop_name: shop,
        visitor_name: visitor,
        handover_by: handover || '',
        takeover_by: takeover || '',
        checked_count: done,
        not_ok_count: bad,
        missing_count: miss,
        total_items: TOTAL,
        all_ok: bad + miss === 0,
        checks: checks,
        report_summary: report()
      }]);

      if (error) throw error;
      toast.success('Saved to Supabase ✓');
      onSaved?.();
      onClose();
    } catch (e) { toast.error('Failed to save: ' + e.message); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#eef1f6', width: '100%', maxWidth: 580, maxHeight: '92vh', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 20, background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background .2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
        <div style={{ background: 'linear-gradient(135deg,#0f4c81,#1d7a9c)', color: '#fff', padding: '22px 56px 22px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', right: -40, top: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>🏪 New Shop Visit</p><h1 style={{ margin: '4px 0 0', fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{hero}</h1></div>
            <Ring pct={pct} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>📅 {fmtDate(date)}</span>
            <span style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>👤 {visitor || 'Visitor name'}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>📝 Visit details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Fld label="Visit date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={IS} /></Fld>
              <Fld label="Visitor name"><input type="text" value={visitor} onChange={e => setVisitor(e.target.value)} placeholder="Name" style={IS} /></Fld>
              <Fld label="Shop name" full>
                <select value={shop} onChange={e => setShop(e.target.value)} style={IS}>
                  <option value="">Select shop</option>
                  {shops.map(s => <option key={s.shop_name} value={s.shop_name}>{s.full_name ? `${s.shop_name} — ${s.full_name}` : s.shop_name}</option>)}
                </select>
              </Fld>
              <Fld label="Handover by"><input type="text" value={handover} onChange={e => setHandover(e.target.value)} placeholder="Name" style={IS} /></Fld>
              <Fld label="Takeover by"><input type="text" value={takeover} onChange={e => setTakeover(e.target.value)} placeholder="Name" style={IS} /></Fld>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 4px 12px' }}>Tap status — items turn <b style={{ color: '#1a9e5c' }}>green</b>, <b style={{ color: '#d64545' }}>red</b>, or <b style={{ color: '#c98a1c' }}>amber</b>.</p>
          {CHECKLIST_DATA.map(grp => {
            const dg = grp.items.filter(it => checks[it.id]).length;
            const co = coll[grp.group];
            return (
              <div key={grp.group} style={{ marginBottom: 14 }}>
                <div onClick={() => setColl(p => ({ ...p, [grp.group]: !p[grp.group] }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 10px', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.3 }}>{grp.group}</span>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{dg}/{grp.items.length}</span>
                  </div>
                  <ChevronDown size={16} color="#64748b" style={{ transition: 'transform .2s', transform: co ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                </div>
                {!co && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {grp.items.map(it => {
                      const s = checks[it.id]; const cfg = s ? STATUS[s] : null;
                      return (
                        <div key={it.id} style={{ background: cfg ? cfg.bg : '#fff', border: `1px solid ${cfg ? cfg.border : '#e2e8f0'}`, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s' }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{it.icon}</div>
                          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{it.label}</div>
                          <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                            {['ok', 'bad', 'miss'].map((val, i) => (
                              <button key={val} onClick={() => tog(it.id, val)} style={{ border: 'none', borderRight: i < 2 ? '1.5px solid #e2e8f0' : 'none', background: s === val ? STATUS[val].color : '#fff', color: s === val ? '#fff' : '#64748b', fontSize: 11.5, fontWeight: 700, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                {STATUS[val].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ height: 4 }} />
        </div>
        <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          <MultiSegmentPie ok={ok} bad={bad} miss={miss} total={TOTAL} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={share} style={{ flex: 1, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#334155', borderRadius: 11, padding: 13, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}><Share2 size={15} /> Share report</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#0f4c81,#1d7a9c)', color: '#fff', border: 'none', borderRadius: 11, padding: 13, fontSize: 14.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {saving ? 'Saving…' : 'Save visit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewModal({ visit, onClose }) {
  const rt = visit.report_summary;
  const shopName = visit.shop_name || 'Shop Visit';
  const visitDate = visit.visit_date ? fmtDate(visit.visit_date) : '—';
  const checks = visit.checks || {};

  const allItems = CHECKLIST_DATA.flatMap(g => g.items);

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 18, maxWidth: 620, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>🏪 {shopName}</span>
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10, fontWeight: 600 }}>📅 {visitDate}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><X size={18} /></button>
        </div>
        
        <div style={{ overflowY: 'auto', padding: '18px 20px', flex: 1 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, fontSize: 13, color: '#475569', background: '#f1f5f9', padding: '10px 14px', borderRadius: 10 }}>
            <span>👤 Visitor: <b>{visit.visitor_name || '—'}</b></span>
            {visit.handover_by && <span>Handover: <b>{visit.handover_by}</b></span>}
            {visit.takeover_by && <span>Takeover: <b>{visit.takeover_by}</b></span>}
          </div>

          {/* Stats Summary Badges */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Inspection Summary</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: '#e5f7ee', color: '#1a9e5c', border: '1px solid #1a9e5c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                ✅ {visit.checked_count || 0}/{visit.total_items || TOTAL} Checked
              </span>
              {(visit.not_ok_count || 0) > 0 && (
                <span style={{ background: '#fceaea', color: '#d64545', border: '1px solid #d64545', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                  ❌ {visit.not_ok_count} Not OK
                </span>
              )}
              {(visit.missing_count || 0) > 0 && (
                <span style={{ background: '#fbf1de', color: '#c98a1c', border: '1px solid #c98a1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                  ⚠️ {visit.missing_count} Missing
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: visit.all_ok ? '#1a9e5c' : '#d64545', marginLeft: 'auto' }}>
                Status: {visit.all_ok ? 'All Clear ✓' : `Issues Found (${(visit.not_ok_count || 0) + (visit.missing_count || 0)})`}
              </span>
            </div>
          </div>

          {/* Full Checklist Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>📋 Inspection Checklist Items ({allItems.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              {allItems.map((item) => {
                const valStr = checks[item.id] ? STATUS[checks[item.id]]?.label || checks[item.id] : 'Not checked';
                const lowerVal = valStr.toLowerCase();
                const isOk = lowerVal === 'ok';
                const isBad = lowerVal === 'not ok';
                const isMiss = lowerVal === 'missing';
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: isBad ? '#fceaea' : isMiss ? '#fbf1de' : isOk ? '#f8fafc' : '#ffffff', border: `1px solid ${isBad ? '#f87171' : isMiss ? '#facc15' : '#e2e8f0'}`, borderRadius: 8, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600, color: '#334155', flex: 1, paddingRight: 12 }}>{item.icon} {item.label}</span>
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: 11.5,
                      padding: '2px 8px', 
                      borderRadius: 6, 
                      background: isOk ? '#e5f7ee' : isBad ? '#d64545' : isMiss ? '#c98a1c' : '#f1f5f9', 
                      color: isOk ? '#1a9e5c' : isBad ? '#fff' : isMiss ? '#fff' : '#475569' 
                    }}>
                      {valStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {rt && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Formatted Report</div>
              <pre style={{ margin: 0, fontSize: 12, color: '#334155', background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{rt}</pre>
            </div>
          )}
        </div>
        
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
          {rt && (
            <button onClick={async () => { try { await navigator.clipboard.writeText(rt); toast.success('Copied report!'); } catch (_) { toast.error('Cannot copy.'); } }}
              style={{ flex: 1, background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}><Share2 size={14} /> Copy Report</button>
          )}
          <button onClick={onClose} style={{ flex: 1, background: 'linear-gradient(135deg,#0f4c81,#1d7a9c)', color: '#fff', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ShopVisit() {
  const [shops, setShops] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [search, setSearch] = useState('');
  const [shopFilt, setShopFilt] = useState('ALL');

  useEffect(() => { supabase.from('shop').select('shop_name,full_name').order('shop_name').then(({ data }) => { if (data) setShops(data); }); }, []);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shop_visit')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVisits(data || []);
    } catch (e) { toast.error('Load failed: ' + e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const filt = visits.filter(v => {
    const sh = String(v.shop_name || ''), vi = String(v.visitor_name || ''), dt = String(v.visit_date || '');
    const ms = !search || [sh, vi, dt].some(val => val.toLowerCase().includes(search.toLowerCase()));
    const msh = shopFilt === 'ALL' || sh.toLowerCase().includes(shopFilt.toLowerCase()) || shopFilt === sh;
    return ms && msh;
  });

  const total = visits.length;
  const issues = visits.filter(v => !v.all_ok).length;
  const clear = visits.filter(v => v.all_ok).length;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}><Store size={22} color="#0f4c81" /> Shop Visit Checklist</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Log and track shop handover / takeover inspections</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetch_} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#0f4c81,#1d7a9c)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 12px rgba(15,76,129,0.3)' }}><Plus size={15} /> Create Checklist</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[{ l: 'Total Visits', v: total, i: '📋', c: '#0f4c81' }, { l: 'With Issues', v: issues, i: '⚠️', c: '#c98a1c' }, { l: 'All Clear', v: clear, i: '✅', c: '#1a9e5c' }].map(card => (
          <div key={card.l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{card.i}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: card.c }}>{card.v}</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{card.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...IS, maxWidth: 260, padding: '8px 12px' }} />
        <select value={shopFilt} onChange={e => setShopFilt(e.target.value)} style={{ ...IS, width: 'auto', minWidth: 200, padding: '8px 12px' }}>
          <option value="ALL">All Shops</option>
          {shops.map(s => <option key={s.shop_name} value={s.shop_name}>{s.shop_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 size={32} color="#0f4c81" style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      ) : filt.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
          <ClipboardList size={42} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No visits found</p>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>Click <b>Create Checklist</b> to log your first visit.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 850 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', width: 100 }}>Date</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', minWidth: 160 }}>Shop</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', minWidth: 110 }}>Visitor</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', minWidth: 130 }}>Handover By</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', minWidth: 130 }}>Takeover By</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', width: 90 }}>Checked</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', width: 80 }}>Issues</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', width: 110 }}>Status</th>
                  <th style={{ padding: '12px 14px', width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {filt.map((v) => {
                  const iss = (v.not_ok_count || 0) + (v.missing_count || 0);
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 500 }}>{fmtDate(v.visit_date)}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.shop_name}>{v.shop_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{v.visitor_name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.handover_by}>{v.handover_by || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.takeover_by}>{v.takeover_by || '—'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}><span style={{ background: '#f1f5f9', borderRadius: 6, padding: '3px 9px', fontWeight: 700, color: '#475569', fontSize: 12 }}>{v.checked_count || 0}/{v.total_items || TOTAL}</span></td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>{iss > 0 ? <span style={{ background: '#fceaea', color: '#d64545', borderRadius: 6, padding: '3px 9px', fontWeight: 700, fontSize: 12 }}>{iss}</span> : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{v.all_ok ? <span style={{ background: '#e5f7ee', color: '#1a9e5c', border: '1px solid #1a9e5c', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>All Clear ✓</span> : <span style={{ background: '#fceaea', color: '#d64545', border: '1px solid #d64545', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>{iss > 0 ? `${iss} Issues` : 'Incomplete'}</span>}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><button onClick={() => setViewRow(v)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}><Eye size={12} /> View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showModal && <ChecklistModal shops={shops} onClose={() => setShowModal(false)} onSaved={fetch_} />}
      {viewRow && <ViewModal visit={viewRow} onClose={() => setViewRow(null)} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
