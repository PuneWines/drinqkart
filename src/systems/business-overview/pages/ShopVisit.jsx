import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, RefreshCw, Share2, CheckCircle2, ChevronDown, ClipboardList, Eye, X, Store, Loader2, Download, Trash2, Maximize2 } from 'lucide-react';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import SignaturePadModal from '../components/SignaturePadModal';

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

const DB_COLUMN_MAP = {
  cash: 'cash_counter',
  barcode: 'barcode_scanner',
  card: 'card_swipe_machine',
  sale1: 'sale_point_1',
  sale2: 'sale_point_2',
  sale3: 'sale_point_3',
  offer: 'offer_board',
  chairs: 'chairs_tables',
  server: 'main_server_computer',
  billprint: 'billing_printer',
  exciseprint: 'excise_printer',
  wifi: 'wifi_device',
  mobile: 'mobile_phone',
  inverter: 'inverter',
  cctv: 'cctv_camera',
  alarm: 'alarm_system',
  fire: 'fire_cylinder',
  fridge_steel: 'fridge_steel',
  fridge_bud: 'fridge_budweiser',
  fridge_kf: 'fridge_kingfisher',
  water_jar: 'water_jar',
  cleaning: 'cleaning_items',
  main_board: 'main_shop_board',
  window_disp: 'window_display',
  disp_stand: 'display_stand',
  lighting: 'lighting',
  shutter_door: 'shutter_door',
  shutter_remote: 'shutter_sensor_remote',
  main_key: 'main_shutter_key',
  cash_key: 'cash_counter_key',
  godown_key: 'godown_key',
  showcase_key: 'showcase_key',
  bike_activa: 'bike_activa',
  bike_ev: 'bike_electric',
  ev_charger: 'bike_charger',
  helmet: 'helmet',
  rto_cleared: 'rto_penalty_cleared',
  shop_lic: 'shop_license',
  fssai_lic: 'fssai_license',
  shop_act: 'shop_act',
  shop_map: 'shop_map',
  vat_cert: 'vat_certificate',
  tp_file: 'tp_file',
  excise_reg: 'excise_register',
  attendance_book: 'attendance_book',
  nokarnama: 'nokarnama_id_proof',
  visit_book: 'visit_book',
  expense_book: 'expense_book',
  wholesale_out: 'wholesale_outstanding',
  license_rent: 'license_rent',
  shop_rent: 'shop_rent',
  excise_police: 'excise_police_monthly',
  opening_cash: 'opening_cash'
};

const parseVisitChecks = (visit) => {
  if (!visit) return {};
  let res = {};
  if (visit.checks) {
    if (typeof visit.checks === 'string') {
      try {
        res = JSON.parse(visit.checks);
      } catch (_) {
        res = {};
      }
    } else if (typeof visit.checks === 'object') {
      res = { ...visit.checks };
    }
  }

  // Fallback / complement from individual columns
  Object.entries(DB_COLUMN_MAP).forEach(([itemId, colName]) => {
    if (!res[itemId] && visit[colName]) {
      res[itemId] = visit[colName];
    }
  });

  return res;
};

const generateReportSummaryText = (visit, checks = {}) => {
  const shop = visit?.shop_name || 'Shop Visit';
  const vDate = visit?.visit_date ? fmtDate(visit.visit_date) : '-';
  const visitor = visit?.visitor_name || '-';
  const handover = visit?.handover_by || '-';
  const takeover = visit?.takeover_by || '-';
  const remark = visit?.remark || checks?.remark || '';
  const m1 = visit?.manager1_name || checks?.manager1_name || '';
  const m2 = visit?.manager2_name || checks?.manager2_name || '';

  const L = [
    `🏪 *Shop Visit Report*`,
    `Shop: ${shop}`,
    `Date: ${vDate}`,
    `Visitor: ${visitor}`,
    `Handover: ${handover}  |  Takeover: ${takeover}`,
    ''
  ];

  if (remark) {
    L.push(`*Remark:* ${remark}`);
    L.push('');
  }
  if (m1 || m2) {
    L.push(`*Managers:* M1: ${m1 || '-'} | M2: ${m2 || '-'}`);
    L.push('');
  }

  let done = 0, bad = 0, miss = 0;
  CHECKLIST_DATA.forEach(g => {
    L.push(`*${g.group}*`);
    g.items.forEach(it => {
      const s = checks[it.id];
      if (s) done++;
      if (s === 'bad') bad++;
      if (s === 'miss') miss++;
      L.push(`${s === 'ok' ? '✅' : s === 'bad' ? '❌' : s === 'miss' ? '⚠️' : '⬜'} ${it.icon} ${it.label} — ${s ? STATUS[s].label : 'Not checked'}`);
    });
    L.push('');
  });

  L.push(`Summary: ${done}/${TOTAL} checked, ${bad} not ok, ${miss} missing.`);
  return L.join('\n');
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

function SignatureField({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);
  const [showModalPad, setShowModalPad] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  }, [value]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const start = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  };

  const move = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const end = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    onChange('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hasDrawn && (
            <button
              type="button"
              onClick={clear}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '1px 4px'
              }}
              title="Clear signature"
            >
              <Trash2 size={11} /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowModalPad(true)}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 6,
              padding: '1px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 3
            }}
            title="Open large signature pad"
          >
            <Maximize2 size={10} /> Full Pad
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 120,
          background: '#ffffff',
          borderRadius: 10,
          border: hasDrawn ? '1.5px solid #94a3b8' : '1.5px dashed #cbd5e1',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none'
          }}
        />
        {!hasDrawn && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 500,
              gap: 4
            }}
          >
            ✍️ Sign here
          </div>
        )}
      </div>

      {showModalPad && (
        <SignaturePadModal
          isOpen={showModalPad}
          onClose={() => setShowModalPad(false)}
          onSave={(dataUrl) => {
            onChange(dataUrl);
            setShowModalPad(false);
          }}
        />
      )}
    </div>
  );
}

function ChecklistModal({ shops, onClose, onSaved }) {
  const [date, setDate] = useState(todayISO());
  const [visitor, setVisitor] = useState('');
  const [shop, setShop] = useState('');
  const [handover, setHandover] = useState('');
  const [takeover, setTakeover] = useState('');
  const [remark, setRemark] = useState('');
  const [manager1Name, setManager1Name] = useState('');
  const [manager1Sig, setManager1Sig] = useState('');
  const [manager2Name, setManager2Name] = useState('');
  const [manager2Sig, setManager2Sig] = useState('');
  const [checks, setChecks] = useState({});
  const [coll, setColl] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}'); if (u.name || u.user_name || u.username) setVisitor(u.name || u.user_name || u.username); } catch (_) { }
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
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
    if (remark) {
      L.push(`*Remark:* ${remark}`);
      L.push('');
    }
    if (manager1Name || manager2Name) {
      L.push(`*Managers:* M1: ${manager1Name || '-'} | M2: ${manager2Name || '-'}`);
      L.push('');
    }
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
      const payload = {
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
        checks: {
          ...checks,
          remark: remark || '',
          manager1_name: manager1Name || '',
          manager1_signature: manager1Sig || '',
          manager2_name: manager2Name || '',
          manager2_signature: manager2Sig || '',
        },
        report_summary: report(),
        remark: remark || '',
        manager1_name: manager1Name || '',
        manager1_signature: manager1Sig || '',
        manager2_name: manager2Name || '',
        manager2_signature: manager2Sig || '',
      };

      // Map each checklist item to its corresponding database column
      Object.entries(DB_COLUMN_MAP).forEach(([itemId, colName]) => {
        payload[colName] = checks[itemId] || null;
      });

      let { error } = await supabase.from('shop_visit').insert([payload]);

      // If top-level columns don't exist in Supabase schema cache, retry without top-level extras (they are preserved in checks JSON)
      if (error && (error.message?.includes('schema cache') || error.message?.includes('column') || error.code === 'PGRST204')) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.remark;
        delete fallbackPayload.manager1_name;
        delete fallbackPayload.manager1_signature;
        delete fallbackPayload.manager2_name;
        delete fallbackPayload.manager2_signature;
        const res = await supabase.from('shop_visit').insert([fallbackPayload]);
        error = res.error;
      }

      if (error) throw error;
      toast.success('Saved to Supabase ✓');
      onSaved?.();
      onClose();
    } catch (e) { toast.error('Failed to save: ' + e.message); } finally { setSaving(false); }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.65)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overscrollBehavior: 'contain' }}
    >
      <div style={{ background: '#eef1f6', width: '100%', maxWidth: 720, maxHeight: '92vh', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
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
        <div className="modal-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
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

          {/* Remark Field Card (Below Checklist Items) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>💬 Remarks & Notes</p>
            <Fld label="Remark" full>
              <textarea
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Enter remarks or visit observations…"
                rows={3}
                style={{ ...IS, resize: 'vertical' }}
              />
            </Fld>
          </div>

          {/* Manager Details Section Card (Below Remark) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>👥 Manager Details & Signatures</p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
              {/* Left section — Manager 1 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f4c81', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Manager 1
                </div>
                <Fld label="Manager 1 Name">
                  <input
                    type="text"
                    value={manager1Name}
                    onChange={e => setManager1Name(e.target.value)}
                    placeholder="Enter Manager 1 name"
                    style={IS}
                  />
                </Fld>
                <SignatureField
                  label="Manager 1 Signature"
                  value={manager1Sig}
                  onChange={setManager1Sig}
                />
              </div>

              {/* Vertical Divider */}
              <div style={{ width: 1, background: '#e2e8f0', alignSelf: 'stretch', margin: '0 2px' }} />

              {/* Right section — Manager 2 */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f4c81', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Manager 2
                </div>
                <Fld label="Manager 2 Name">
                  <input
                    type="text"
                    value={manager2Name}
                    onChange={e => setManager2Name(e.target.value)}
                    placeholder="Enter Manager 2 name"
                    style={IS}
                  />
                </Fld>
                <SignatureField
                  label="Manager 2 Signature"
                  value={manager2Sig}
                  onChange={setManager2Sig}
                />
              </div>
            </div>
          </div>
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
  const scrollRef = useRef(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'issues' | 'ok'
  const [copied, setCopied] = useState(false);

  const rt = visit.report_summary;
  const shopName = visit.shop_name || 'Shop Visit';
  const visitDate = visit.visit_date ? fmtDate(visit.visit_date) : '—';
  const checks = parseVisitChecks(visit);
  const remark = visit.remark || checks?.remark || '';
  const manager1Name = visit.manager1_name || checks?.manager1_name || '';
  const manager1Sig = visit.manager1_signature || checks?.manager1_signature || '';
  const manager2Name = visit.manager2_name || checks?.manager2_name || '';
  const manager2Sig = visit.manager2_signature || checks?.manager2_signature || '';

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  const handleCopy = async () => {
    try {
      const textToCopy = rt || generateReportSummaryText(visit, checks);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Report copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      toast.error('Failed to copy');
    }
  };

  // Group items by category from CHECKLIST_DATA
  const groupedData = CHECKLIST_DATA.map(group => {
    const items = group.items.map(it => {
      const statusKey = checks ? checks[it.id] : null;
      const statusObj = statusKey ? STATUS[statusKey] : null;
      return {
        ...it,
        statusKey,
        statusLabel: statusObj?.label || 'Not checked',
        statusColor: statusObj?.color || '#94a3b8',
        statusBg: statusObj?.bg || '#f1f5f9',
        statusBorder: statusObj?.border || '#cbd5e1'
      };
    });
    const okCount = items.filter(i => i.statusKey === 'ok').length;
    const badCount = items.filter(i => i.statusKey === 'bad').length;
    const missCount = items.filter(i => i.statusKey === 'miss').length;
    return {
      group: group.group,
      items,
      okCount,
      badCount,
      missCount,
      issueCount: badCount + missCount
    };
  });

  const totalBad = groupedData.reduce((acc, g) => acc + g.badCount, 0);
  const totalMiss = groupedData.reduce((acc, g) => acc + g.missCount, 0);
  const totalOk = groupedData.reduce((acc, g) => acc + g.okCount, 0);
  const totalChecked = totalOk + totalBad + totalMiss;
  const issueCount = totalBad + totalMiss;
  const isAllClear = issueCount === 0 && totalChecked > 0;

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const downloadPDF = () => {
    try {
      toast.loading('Generating PDF…', { id: 'pdf-toast' });
      const printableDiv = document.createElement('div');
      printableDiv.style.padding = '20px';
      printableDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      printableDiv.style.color = '#1e293b';
      printableDiv.style.background = '#ffffff';
      printableDiv.style.width = '750px';

      let html = `
        <div style="border-bottom: 2px solid #0f4c81; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #0f4c81; letter-spacing: -0.5px;">DRINQKART ENTERPRISE</div>
            <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px;">Shop Visit Inspection Report — <u>${shopName}</u></div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #475569;">
            Visit Date: <b style="color: #0f172a;">${visitDate}</b>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Visitor</div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px;">${visit.visitor_name || '—'}</div>
          </div>
          <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Handover By</div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px;">${visit.handover_by || '—'}</div>
          </div>
          <div style="flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc;">
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Takeover By</div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px;">${visit.takeover_by || '—'}</div>
          </div>
        </div>

        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 14px; margin-bottom: 16px; font-size: 12px; font-weight: 700; display: flex; justify-content: space-between;">
          <div>Inspection Summary: <b>${totalChecked}/${TOTAL}</b> Checked</div>
          <div>
            <span style="color: #1a9e5c;">${totalOk} OK</span> &nbsp;|&nbsp; 
            <span style="color: #d64545;">${totalBad} Not OK</span> &nbsp;|&nbsp; 
            <span style="color: #c98a1c;">${totalMiss} Missing</span>
          </div>
        </div>
      `;

      groupedData.forEach(g => {
        html += `
          <div style="margin-bottom: 12px; page-break-inside: avoid;">
            <div style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>${g.group}</span>
              <span style="font-size: 10.5px; font-weight: 700;">
                ${g.okCount > 0 ? `<span style="color:#166534;">${g.okCount} OK</span> ` : ''}
                ${g.badCount > 0 ? `<span style="color:#991b1b;">${g.badCount} Bad</span> ` : ''}
                ${g.missCount > 0 ? `<span style="color:#92400e;">${g.missCount} Miss</span>` : ''}
              </span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
        `;
        for (let i = 0; i < g.items.length; i += 2) {
          const it1 = g.items[i];
          const it2 = g.items[i + 1];
          const st1 = it1.statusKey === 'ok' ? '<span style="color:#166534;font-weight:700;">✅ OK</span>' : it1.statusKey === 'bad' ? '<span style="color:#b91c1c;font-weight:700;">❌ Not OK</span>' : it1.statusKey === 'miss' ? '<span style="color:#b45309;font-weight:700;">⚠️ Missing</span>' : '⬜ Not checked';
          const st2 = it2 ? (it2.statusKey === 'ok' ? '<span style="color:#166534;font-weight:700;">✅ OK</span>' : it2.statusKey === 'bad' ? '<span style="color:#b91c1c;font-weight:700;">❌ Not OK</span>' : it2.statusKey === 'miss' ? '<span style="color:#b45309;font-weight:700;">⚠️ Missing</span>' : '⬜ Not checked') : '';

          html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3px 6px; width: 36%; font-weight: 600; color: #334155;">${it1.icon} ${it1.label}</td>
              <td style="padding: 3px 6px; width: 14%;">${st1}</td>
              <td style="padding: 3px 6px; width: 36%; font-weight: 600; color: #334155;">${it2 ? `${it2.icon} ${it2.label}` : ''}</td>
              <td style="padding: 3px 6px; width: 14%;">${st2}</td>
            </tr>
          `;
        }
        html += `</table></div>`;
      });

      if (remark) {
        html += `
          <div style="margin-top: 14px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; page-break-inside: avoid;">
            <div style="font-size: 11px; font-weight: 800; color: #0f4c81; text-transform: uppercase;">Remark</div>
            <div style="font-size: 12px; margin-top: 4px; color: #1e293b; white-space: pre-wrap;">${remark}</div>
          </div>
        `;
      }

      if (manager1Name || manager1Sig || manager2Name || manager2Sig) {
        html += `
          <div style="margin-top: 16px; border-top: 1.5px solid #cbd5e1; padding-top: 10px; display: flex; gap: 20px; page-break-inside: avoid;">
            <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #fff;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Manager 1</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">${manager1Name || '—'}</div>
              ${manager1Sig ? `<img src="${manager1Sig}" style="max-height: 45px; max-width: 100%; margin-top: 6px; object-fit: contain; border: 1px solid #f1f5f9;" />` : '<div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 6px;">No signature recorded</div>'}
            </div>
            <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #fff;">
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Manager 2</div>
              <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">${manager2Name || '—'}</div>
              ${manager2Sig ? `<img src="${manager2Sig}" style="max-height: 45px; max-width: 100%; margin-top: 6px; object-fit: contain; border: 1px solid #f1f5f9;" />` : '<div style="font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 6px;">No signature recorded</div>'}
            </div>
          </div>
        `;
      }

      printableDiv.innerHTML = html;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Shop_Visit_${shopName}_${visitDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(printableDiv).save().then(() => {
        toast.success('PDF Downloaded!', { id: 'pdf-toast' });
      }).catch(err => {
        toast.error('PDF export failed: ' + (err?.message || 'Error generating PDF'), { id: 'pdf-toast' });
      });
    } catch (e) {
      toast.error('PDF export failed: ' + e.message, { id: 'pdf-toast' });
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,20,40,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overscrollBehavior: 'contain'
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          maxWidth: 880,
          width: '100%',
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
        }}
      >
        {/* Header Modal Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1.5px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={20} color="#0f4c81" />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{shopName}</span>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                📅 Inspection Report &bull; {visitDate}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>

        {/* SINGLE UNIFIED SCROLLABLE CONTAINER */}
        <div
          className="modal-scrollbar"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#f8fafc'
          }}
        >
          {/* SINGLE UNIFIED REPORT CARD */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            {/* 1. Visitor, Handover By, Takeover By Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Visitor</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>{visit.visitor_name || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Handover By</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>{visit.handover_by || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Takeover By</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>{visit.takeover_by || '—'}</div>
              </div>
            </div>

            {/* 2. Top Metrics Summary Badges */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: '#e5f7ee', color: '#1a9e5c', border: '1px solid #1a9e5c', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 700 }}>
                  ✅ {totalChecked}/{TOTAL} Checked
                </span>
                {totalBad > 0 && (
                  <span style={{ background: '#fceaea', color: '#d64545', border: '1px solid #d64545', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 700 }}>
                    ❌ {totalBad} Not OK
                  </span>
                )}
                {totalMiss > 0 && (
                  <span style={{ background: '#fbf1de', color: '#c98a1c', border: '1px solid #c98a1c', borderRadius: 8, padding: '4px 10px', fontSize: 12.5, fontWeight: 700 }}>
                    ⚠️ {totalMiss} Missing
                  </span>
                )}
              </div>

              <span style={{ fontSize: 13, fontWeight: 800, color: isAllClear ? '#1a9e5c' : '#d64545' }}>
                {isAllClear ? '✅ All Clear' : `⚠️ ${issueCount} Issue(s) Found`}
              </span>
            </div>

            {/* 3. Quick Filter Tabs & Checked Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    border: filter === 'all' ? '1px solid #0f4c81' : '1px solid #cbd5e1',
                    background: filter === 'all' ? '#0f4c81' : '#fff',
                    color: filter === 'all' ? '#fff' : '#475569',
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  All Items ({TOTAL})
                </button>
                <button
                  onClick={() => setFilter('issues')}
                  style={{
                    border: '1px solid #fca5a5',
                    background: filter === 'issues' ? '#d64545' : '#fff',
                    color: filter === 'issues' ? '#fff' : '#d64545',
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ Issues Only ({issueCount})
                </button>
                <button
                  onClick={() => setFilter('ok')}
                  style={{
                    border: '1px solid #86efac',
                    background: filter === 'ok' ? '#1a9e5c' : '#fff',
                    color: filter === 'ok' ? '#fff' : '#1a9e5c',
                    padding: '5px 14px',
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ✅ Clear Only ({totalOk})
                </button>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b' }}>
                Checked: <span style={{ color: '#0f172a' }}>{totalChecked}/{TOTAL}</span>
              </div>
            </div>

            {/* 4. Grouped Checklist Display */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {groupedData.every(g => g.items.filter(it => {
                if (filter === 'issues') return it.statusKey === 'bad' || it.statusKey === 'miss';
                if (filter === 'ok') return it.statusKey === 'ok';
                return true;
              }).length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>✨</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    {filter === 'issues' ? 'No issues found in this visit!' : filter === 'ok' ? 'No clear items found.' : 'No checklist items.'}
                  </div>
                </div>
              ) : (
                groupedData.map(g => {
                  const filteredItems = g.items.filter(it => {
                    if (filter === 'issues') return it.statusKey === 'bad' || it.statusKey === 'miss';
                    if (filter === 'ok') return it.statusKey === 'ok';
                    return true;
                  });

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={g.group} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b' }}>
                          {g.group}
                        </span>
                        <div style={{ display: 'flex', gap: 6, fontSize: 11, fontWeight: 700 }}>
                          {g.okCount > 0 && <span style={{ background: '#e5f7ee', color: '#1a9e5c', padding: '2px 8px', borderRadius: 12 }}>{g.okCount} OK</span>}
                          {g.badCount > 0 && <span style={{ background: '#fceaea', color: '#d64545', padding: '2px 8px', borderRadius: 12 }}>{g.badCount} Not OK</span>}
                          {g.missCount > 0 && <span style={{ background: '#fbf1de', color: '#c98a1c', padding: '2px 8px', borderRadius: 12 }}>{g.missCount} Missing</span>}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>
                        {filteredItems.map(it => {
                          const iconStatus = it.statusKey === 'ok' ? '✅' : it.statusKey === 'bad' ? '❌' : it.statusKey === 'miss' ? '⚠️' : '⬜';
                          return (
                            <div
                              key={it.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                background: it.statusBg,
                                border: `1px solid ${it.statusBorder}`,
                                borderRadius: 9,
                                fontSize: 12.5
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', paddingRight: 6 }}>
                                <span style={{ fontSize: 13 }}>{iconStatus}</span>
                                <span style={{ fontSize: 13 }}>{it.icon}</span>
                                <span style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {it.label}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: it.statusKey ? '#fff' : '#64748b',
                                  background: it.statusColor,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {it.statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 5. Summary & Copy Report Footer */}
            <div style={{ background: '#0f172a', color: '#fff', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                Summary: <b style={{ color: '#38bdf8' }}>{totalChecked}/{TOTAL}</b> checked | <b style={{ color: '#f87171' }}>{totalBad} Not OK</b> | <b style={{ color: '#fbbf24' }}>{totalMiss} Missing</b>
              </div>
              <button
                onClick={handleCopy}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Share2 size={13} /> {copied ? 'Copied!' : 'Copy Report'}
              </button>
            </div>

            {/* 6. Remark Section */}
            {remark && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f4c81', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  📝 Remark
                </div>
                <div style={{ fontSize: 13.5, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                  {remark}
                </div>
              </div>
            )}

            {/* 7. Manager Verification & Signatures */}
            {(manager1Name || manager1Sig || manager2Name || manager2Sig) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f4c81', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  👥 Manager Verification & Signatures
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Manager 1
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                      {manager1Name || '—'}
                    </div>
                    {manager1Sig ? (
                      <div style={{ marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <img src={manager1Sig} alt="Manager 1 Signature" style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '14px 0', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
                        No signature recorded
                      </div>
                    )}
                  </div>

                  <div style={{ width: 1, background: '#e2e8f0', alignSelf: 'stretch', margin: '0 2px' }} />

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Manager 2
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                      {manager2Name || '—'}
                    </div>
                    {manager2Sig ? (
                      <div style={{ marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <img src={manager2Sig} alt="Manager 2 Signature" style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    ) : (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '14px 0', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, textAlign: 'center' }}>
                        No signature recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={downloadPDF}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
            }}
          >
            <Download size={15} /> Download PDF
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg,#0f4c81,#1d7a9c)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Close
          </button>
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
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .modal-scrollbar {
          overflow-y: auto !important;
          scrollbar-width: thin !important;
          scrollbar-color: #0f4c81 #e2e8f0 !important;
          scroll-behavior: smooth;
        }
        .modal-scrollbar::-webkit-scrollbar {
          width: 10px !important;
          height: 10px !important;
          display: block !important;
        }
        .modal-scrollbar::-webkit-scrollbar-track {
          background: #e2e8f0 !important;
          border-radius: 8px !important;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb {
          background: #0f4c81 !important;
          border-radius: 8px !important;
          border: 2px solid #e2e8f0 !important;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #093155 !important;
        }
      `}</style>
    </div>
  );
}
