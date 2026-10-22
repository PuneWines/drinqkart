import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Store,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// 53 Default Initial Checklist Items matching ShopVisit
export const DEFAULT_CHECKLIST_DATA = [
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

// Flatten default items with default sort_order
const INITIAL_FLAT_ITEMS = DEFAULT_CHECKLIST_DATA.flatMap((grp, gIdx) =>
  grp.items.map((item, iIdx) => ({
    id: item.id,
    group_name: grp.group,
    label: item.label,
    icon: item.icon,
    sort_order: gIdx * 100 + iIdx + 1,
    is_active: true,
  }))
);

// Curated Emojis by Category for Easy One-Click Selection
const EMOJI_PALETTES = [
  {
    category: 'Money & Sales',
    emojis: ['💵', '💰', '💳', '🏷️', '🧾', '🪙', '📈', '🛒', '🛍️', '📦'],
  },
  {
    category: 'Tech & Hardware',
    emojis: ['🖥️', '💻', '📱', '🖨️', '📠', '📶', '🔌', '🔋', '📷', '📹', '📻', '💡'],
  },
  {
    category: 'Keys & Security',
    emojis: ['🔑', '🗝️', '🚪', '🚨', '🧯', '🔒', '🔓', '🪖', '👮', '🛡️', '⚠️'],
  },
  {
    category: 'Storage & Items',
    emojis: ['❄️', '🍺', '🍷', '🍾', '🚰', '🧹', '🧴', '🪣', '🪑', '🪜', '🖼️', '🏙️'],
  },
  {
    category: 'Docs & Legal',
    emojis: ['📜', '📄', '📑', '📂', '📁', '📖', '📒', '📗', '📘', '📕', '⚖️', '🗺️', '🆔', '✍️'],
  },
  {
    category: 'Vehicles & Store',
    emojis: ['🏪', '🏢', '🛵', '⚡', '🚲', '🚚', '🚗', '📢', '🎯', '⭐'],
  },
];

// Smart icon suggestion based on label keywords
export function suggestIconForLabel(label = '') {
  const l = label.toLowerCase().trim();
  if (!l) return '📋';
  if (l.includes('cash') || l.includes('rupee') || l.includes('money') || l.includes('amount') || l.includes('coin')) return '💵';
  if (l.includes('card') || l.includes('swipe') || l.includes('upi') || l.includes('sound box') || l.includes('pos')) return '💳';
  if (l.includes('scanner') || l.includes('barcode') || l.includes('tag')) return '🏷️';
  if (l.includes('sale') || l.includes('counter point') || l.includes('receipt') || l.includes('bill')) return '🧾';
  if (l.includes('server') || l.includes('computer') || l.includes('pc') || l.includes('screen') || l.includes('monitor')) return '🖥️';
  if (l.includes('print') || l.includes('billing printer') || l.includes('excise printer')) return '🖨️';
  if (l.includes('wifi') || l.includes('network') || l.includes('router') || l.includes('internet')) return '📶';
  if (l.includes('mobile') || l.includes('phone') || l.includes('cell')) return '📱';
  if (l.includes('inverter') || l.includes('battery') || l.includes('ups') || l.includes('power')) return '🔋';
  if (l.includes('charger') || l.includes('plug') || l.includes('socket')) return '🔌';
  if (l.includes('cctv') || l.includes('camera') || l.includes('video') || l.includes('remote') || l.includes('tv')) return '📹';
  if (l.includes('alarm') || l.includes('sensor') || l.includes('smoke') || l.includes('siren')) return '🚨';
  if (l.includes('fire') || l.includes('cylinder') || l.includes('extinguisher')) return '🧯';
  if (l.includes('fridge') || l.includes('cooler') || l.includes('chiller') || l.includes('ice') || l.includes('ac')) return '❄️';
  if (l.includes('beer') || l.includes('budweiser') || l.includes('kingfisher') || l.includes('alcohol') || l.includes('wine')) return '🍺';
  if (l.includes('water') || l.includes('jar') || l.includes('dispenser') || l.includes('aquaguard')) return '🚰';
  if (l.includes('clean') || l.includes('mop') || l.includes('bucket') || l.includes('broom') || l.includes('liquid')) return '🧹';
  if (l.includes('board') || l.includes('wine shop board') || l.includes('hoarding') || l.includes('signboard')) return '🏙️';
  if (l.includes('window') || l.includes('glass') || l.includes('display')) return '🖼️';
  if (l.includes('stand') || l.includes('rack') || l.includes('shelf')) return '🪜';
  if (l.includes('light') || l.includes('lighting') || l.includes('bulb') || l.includes('tube')) return '💡';
  if (l.includes('shutter') || l.includes('door') || l.includes('gate') || l.includes('entrance')) return '🚪';
  if (l.includes('remote') || l.includes('shutter remote')) return '📻';
  if (l.includes('key') || l.includes('lock') || l.includes('padlock') || l.includes('drawer key')) return '🔑';
  if (l.includes('bike') || l.includes('activa') || l.includes('scooter') || l.includes('vehicle')) return '🛵';
  if (l.includes('electric') || l.includes('ev') || l.includes('charge')) return '⚡';
  if (l.includes('helmet') || l.includes('safety cap')) return '🪖';
  if (l.includes('rto') || l.includes('penalty') || l.includes('challan') || l.includes('fine')) return '📄';
  if (l.includes('license') || l.includes('fssai') || l.includes('permit') || l.includes('food')) return '📜';
  if (l.includes('act') || l.includes('court') || l.includes('legal') || l.includes('law')) return '⚖️';
  if (l.includes('map') || l.includes('blueprint') || l.includes('layout')) return '🗺️';
  if (l.includes('vat') || l.includes('gst') || l.includes('certificate')) return '📑';
  if (l.includes('tp') || l.includes('file') || l.includes('imfl') || l.includes('folder')) return '📂';
  if (l.includes('register') || l.includes('excise reg') || l.includes('book') || l.includes('record')) return '📖';
  if (l.includes('attendance') || l.includes('punch') || l.includes('roll')) return '📒';
  if (l.includes('nokarnama') || l.includes('id proof') || l.includes('aadhar') || l.includes('pan')) return '🆔';
  if (l.includes('visit') || l.includes('inspection')) return '📗';
  if (l.includes('expense') || l.includes('voucher') || l.includes('petty')) return '📘';
  if (l.includes('rent') || l.includes('lease') || l.includes('owner') || l.includes('shop rent')) return '🏪';
  if (l.includes('police') || l.includes('security guard') || l.includes('patrol')) return '👮';
  if (l.includes('offer') || l.includes('discount') || l.includes('scheme') || l.includes('promo')) return '📢';
  if (l.includes('chair') || l.includes('table') || l.includes('desk') || l.includes('stool')) return '🪑';
  return '📋';
}

const STORAGE_KEY = 'drinqkart_shop_visit_checklist_items_v1';

export default function ShopVisitSettings({ readOnly = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [alert, setAlert] = useState(null);

  // Form State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formGroup, setFormGroup] = useState('');
  const [formCustomGroup, setFormCustomGroup] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('📋');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formId, setFormId] = useState('');
  const [autoIconEnabled, setAutoIconEnabled] = useState(true);

  useEffect(() => {
    fetchChecklistItems();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchChecklistItems = async () => {
    setLoading(true);
    try {
      // 1. Try fetching from Supabase table
      const { data, error } = await supabase
        .from('shop_visit_checklist_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        setItems(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        // Fallback to localStorage or seed defaults
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          try {
            setItems(JSON.parse(local));
          } catch (_) {
            setItems(INITIAL_FLAT_ITEMS);
          }
        } else {
          setItems(INITIAL_FLAT_ITEMS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_FLAT_ITEMS));
        }
      }
    } catch (err) {
      console.warn('Failed to load from Supabase, using local defaults:', err);
      const local = localStorage.getItem(STORAGE_KEY);
      setItems(local ? JSON.parse(local) : INITIAL_FLAT_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  // Sync to local storage & Supabase
  const persistItems = async (updatedItems) => {
    setItems(updatedItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));

    try {
      // Attempt upsert to Supabase if table exists
      await supabase.from('shop_visit_checklist_items').upsert(updatedItems);
    } catch (err) {
      console.warn('Supabase sync skipped (table may not exist yet):', err);
    }
  };

  // Unique groups currently in the system
  const existingGroups = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.group_name) set.add(it.group_name.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Handle label change with smart auto-icon suggestion
  const handleLabelChange = (newLabel) => {
    setFormLabel(newLabel);
    if (!editingItem) {
      // Generate unique ID slug from label
      const slug = newLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
      setFormId(slug || 'custom_item');
    }
    if (autoIconEnabled) {
      const suggested = suggestIconForLabel(newLabel);
      setFormIcon(suggested);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormGroup(existingGroups[0] || 'Sales Counter & Points');
    setFormCustomGroup('');
    setFormLabel('');
    setFormIcon('📋');
    setFormId('');
    setFormIsActive(true);
    setAutoIconEnabled(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormGroup(item.group_name);
    setFormCustomGroup('');
    setFormLabel(item.label);
    setFormIcon(item.icon);
    setFormId(item.id);
    setFormIsActive(item.is_active !== false);
    setAutoIconEnabled(false);
    setIsModalOpen(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    const finalGroup = (formGroup === '__NEW__' ? formCustomGroup : formGroup).trim();
    const finalLabel = formLabel.trim();
    const finalId = formId.trim() || `item_${Date.now()}`;
    const finalIcon = formIcon.trim() || '📋';

    if (!finalGroup) {
      showAlert('error', 'Please select or enter a Category / Group name.');
      return;
    }
    if (!finalLabel) {
      showAlert('error', 'Please enter a checklist item label.');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        // Update existing item
        const updated = items.map((it) =>
          it.id === editingItem.id
            ? {
                ...it,
                group_name: finalGroup,
                label: finalLabel,
                icon: finalIcon,
                is_active: formIsActive,
                updated_at: new Date().toISOString(),
              }
            : it
        );
        await persistItems(updated);
        showAlert('success', `Checklist option "${finalLabel}" updated successfully.`);
      } else {
        // Check for duplicate ID
        if (items.some((it) => it.id === finalId)) {
          showAlert('error', `An item with ID "${finalId}" already exists. Please pick a different ID.`);
          setSaving(false);
          return;
        }

        const maxSort = items.reduce((m, it) => Math.max(m, it.sort_order || 0), 0);
        const newItem = {
          id: finalId,
          group_name: finalGroup,
          label: finalLabel,
          icon: finalIcon,
          sort_order: maxSort + 1,
          is_active: formIsActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updated = [...items, newItem];
        await persistItems(updated);
        showAlert('success', `New option "${finalLabel}" created with icon ${finalIcon}!`);
      }

      setIsModalOpen(false);
    } catch (err) {
      showAlert('error', 'Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.label}"?`)) return;

    try {
      const updated = items.filter((it) => it.id !== item.id);
      await persistItems(updated);
      try {
        await supabase.from('shop_visit_checklist_items').delete().eq('id', item.id);
      } catch (_) {}
      showAlert('success', `Item "${item.label}" deleted.`);
    } catch (err) {
      showAlert('error', 'Failed to delete: ' + err.message);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      const updated = items.map((it) =>
        it.id === item.id ? { ...it, is_active: !it.is_active } : it
      );
      await persistItems(updated);
      showAlert('success', `Item status set to ${!item.is_active ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      showAlert('error', 'Failed to update status.');
    }
  };

  const handleMoveOrder = async (item, direction) => {
    const listInGroup = items.filter((it) => it.group_name === item.group_name);
    const idx = listInGroup.findIndex((it) => it.id === item.id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === listInGroup.length - 1) return;

    const swapTarget = listInGroup[direction === 'up' ? idx - 1 : idx + 1];
    const itemSort = item.sort_order;
    const targetSort = swapTarget.sort_order;

    const updated = items.map((it) => {
      if (it.id === item.id) return { ...it, sort_order: targetSort };
      if (it.id === swapTarget.id) return { ...it, sort_order: itemSort };
      return it;
    });

    updated.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    await persistItems(updated);
  };

  const handleResetToDefaults = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset all checklist items back to the original 53 defaults? Any custom added options will be overwritten.'
      )
    )
      return;

    try {
      await persistItems(INITIAL_FLAT_ITEMS);
      showAlert('success', 'Restored 53 default shop visit checklist items.');
    } catch (err) {
      showAlert('error', 'Failed to reset: ' + err.message);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchGroup = selectedGroup === 'ALL' || it.group_name === selectedGroup;
      const matchSearch =
        !searchTerm ||
        it.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchGroup && matchSearch;
    });
  }, [items, selectedGroup, searchTerm]);

  // Grouped Filtered Items
  const groupedView = useMemo(() => {
    const map = {};
    filteredItems.forEach((it) => {
      if (!map[it.group_name]) map[it.group_name] = [];
      map[it.group_name].push(it);
    });
    return map;
  }, [filteredItems]);

  const totalCount = items.length;
  const activeCount = items.filter((it) => it.is_active !== false).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen text-slate-900 font-sans">
      {/* Toast Alert */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header Banner - Drinqkart Master Setting Styling */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#C9A84C]/15 text-[#8C6D23] rounded-xl border border-[#C9A84C]/30 text-lg">
              🏪
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-serif text-slate-900 tracking-tight">
              Shop Visit Checklist Master
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Configure, add, edit, or remove the inspection items checked during shop visits.
          </p>
        </div>

        {/* Stats Badges & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Layers size={14} className="text-[#C9A84C]" />
            <span>{existingGroups.length} Categories</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 rounded-lg text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>{activeCount} / {totalCount} Active Items</span>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-[#C9A84C] hover:bg-[#b0913b] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Checklist Option</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search checklist options by name, category, or ID..."
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none transition-all"
          />
        </div>

        {/* Category Pill / Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Category:</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 outline-none focus:border-[#C9A84C] cursor-pointer"
          >
            <option value="ALL">All Categories ({totalCount})</option>
            {existingGroups.map((grp) => {
              const count = items.filter((it) => it.group_name === grp).length;
              return (
                <option key={grp} value={grp}>
                  {grp} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Checklist Content by Category */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="animate-spin mx-auto mb-2 text-[#C9A84C]" size={28} />
          <p className="text-sm font-medium">Loading shop visit checklist options...</p>
        </div>
      ) : Object.keys(groupedView).length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-base font-bold text-slate-700">No checklist items found</p>
          <p className="text-xs text-slate-400 mt-1">
            Try adjusting your search query or category filter.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedView).map(([groupName, groupItems]) => (
            <div
              key={groupName}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Category Header */}
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C9A84C]" />
                  <h2 className="text-sm font-bold font-serif text-slate-800 uppercase tracking-wide">
                    {groupName}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">({groupItems.length} items)</span>
                </div>
              </div>

              {/* Items Table / List */}
              <div className="divide-y divide-slate-100">
                {groupItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                      item.is_active === false ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Icon */}
                      <span className="text-2xl flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 shadow-2xs">
                        {item.icon || '📋'}
                      </span>

                      {/* Label & Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {item.label}
                          </span>
                          {item.is_active === false && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>ID: {item.id}</span>
                          <span>•</span>
                          <span>Order: #{item.sort_order || idx + 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!readOnly && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Move Up / Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(item, 'up')}
                          disabled={idx === 0}
                          title="Move Up"
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                        >
                          <MoveUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(item, 'down')}
                          disabled={idx === groupItems.length - 1}
                          title="Move Down"
                          className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                        >
                          <MoveDown size={15} />
                        </button>

                        {/* Active / Disable toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          title={item.is_active === false ? 'Enable Item' : 'Disable Item'}
                          className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                            item.is_active === false
                              ? 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                              : 'text-emerald-600 hover:text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {item.is_active === false ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit Item"
                          className="p-1.5 text-[#8C6D23] hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg cursor-pointer transition-all"
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          title="Delete Item"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{formIcon || '📋'}</span>
                <h3 className="text-base font-bold font-serif text-slate-900">
                  {editingItem ? 'Edit Checklist Option' : 'New Shop Visit Checklist Option'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Category / Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Category / Group <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 outline-none focus:border-[#C9A84C]"
                >
                  {existingGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                  <option value="__NEW__">+ Create New Category...</option>
                </select>

                {formGroup === '__NEW__' && (
                  <input
                    type="text"
                    required
                    value={formCustomGroup}
                    onChange={(e) => setFormCustomGroup(e.target.value)}
                    placeholder="Enter new category name (e.g. Electrical & Generator)..."
                    className="w-full mt-2 text-xs md:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 outline-none focus:border-[#C9A84C]"
                  />
                )}
              </div>

              {/* Item Label */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Checklist Item Name <span className="text-rose-500">*</span>
                  </label>
                  <label className="text-[11px] text-[#8C6D23] font-medium flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoIconEnabled}
                      onChange={(e) => setAutoIconEnabled(e.target.checked)}
                      className="rounded text-[#C9A84C]"
                    />
                    <span>Auto-suggest icon from name</span>
                  </label>
                </div>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Inverter Battery Water, CCTV Backup Screen..."
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Icon Selector / Smart Picker */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={14} className="text-[#C9A84C]" />
                    <span>Relevant Icon / Emoji</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      {formIcon || '📋'}
                    </span>
                    <input
                      type="text"
                      maxLength={4}
                      value={formIcon}
                      onChange={(e) => {
                        setFormIcon(e.target.value);
                        setAutoIconEnabled(false);
                      }}
                      className="w-14 text-center font-emoji text-lg border border-slate-300 rounded-lg py-1 bg-white"
                      title="Type or paste any emoji"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click any icon below or type in the box. As you type the name above, smart detection will automatically match relevant symbols!
                </p>

                {/* Emoji Palette Grid */}
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {EMOJI_PALETTES.map((pal) => (
                    <div key={pal.category}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {pal.category}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {pal.emojis.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              setFormIcon(em);
                              setAutoIconEnabled(false);
                            }}
                            className={`w-7 h-7 text-base rounded-md flex items-center justify-center transition-all ${
                              formIcon === em
                                ? 'bg-[#C9A84C] text-slate-950 scale-110 shadow-xs'
                                : 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unique Key / ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Database Unique Key / ID
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingItem}
                  value={formId}
                  onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. inverter_battery"
                  className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 disabled:opacity-70 text-slate-700 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Identifies this check item in visit reports and saved data records.
                </span>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-[#C9A84C] focus:ring-[#C9A84C] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="formIsActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Item is active (shown in shop visit check list)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#C9A84C] hover:bg-[#b0913b] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Option'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
