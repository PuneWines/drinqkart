// Settings.tsx – Admin-only user management
import { useState, useEffect, useCallback } from 'react';
import {
  FaUserCog, FaPlus, FaEdit, FaTrash, FaSave, FaTimes,
  FaEye, FaEyeSlash, FaSearch, FaSync, FaShieldAlt, FaStore,
  FaKey, FaUser,
} from 'react-icons/fa';
import { supabase } from '../supabase';
import { parsePages, parseShops } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  id?: number;
  username: string;
  name: string;
  password: string;
  role: string;
  pages: string[];
  shops: string[] | 'all';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_PAGES = [
  'Dashboard',
  'Petty Cash Form',
  'Cash Tally - Counter 1',
  'Cash Tally - Counter 2',
  'Cash Tally - Counter 3',
  'Reports',
  'Settings',
];

const ROLES = ['Admin', 'User', 'Manager'];

const ALL_SHOPS_SENTINEL = 'all';

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyUser = (): UserRecord => ({
  username: '',
  name: '',
  password: '',
  role: 'User',
  pages: [],
  shops: [],
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Settings() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserRecord>(emptyUser());
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Shop input
  const [shopInput, setShopInput] = useState('');
  const [availableShops, setAvailableShops] = useState<string[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('petty_cash_user')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;

      const mapped: UserRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        username: row.username || '',
        name: row.name || '',
        password: row.password || '',
        role: row.role || 'User',
        pages: parsePages(row.pages),
        shops: parseShops(row.shops),
      }));
      setUsers(mapped);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const { data } = await supabase.from('shop').select('*').order('shop_name', { ascending: true });
      if (data && data.length > 0) {
        setAvailableShops(data.map((r: any) => r.shop_name || r.name || r.shop).filter(Boolean));
      } else {
        const { data: pcData } = await supabase.from('petty_cash_shops').select('*');
        if (pcData && pcData.length > 0) {
          setAvailableShops(pcData.map((r: any) => r.name || r.shop_name).filter(Boolean));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchShops();
  }, [fetchUsers, fetchShops]);

  // ── Open modal ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyUser());
    setShopInput('');
    setShowPwd(false);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditingUser(u);
    setForm({ ...u });
    setShopInput('');
    setShowPwd(false);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormError('');
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const togglePage = (page: string) => {
    setForm(prev => ({
      ...prev,
      pages: prev.pages.includes(page)
        ? prev.pages.filter(p => p !== page)
        : [...prev.pages, page],
    }));
  };

  const isAllShops = form.shops === ALL_SHOPS_SENTINEL;

  const toggleAllShops = () => {
    setForm(prev => ({
      ...prev,
      shops: prev.shops === ALL_SHOPS_SENTINEL ? [] : ALL_SHOPS_SENTINEL,
    }));
  };

  const addShop = (shop: string) => {
    if (!shop.trim()) return;
    if (form.shops === ALL_SHOPS_SENTINEL) return;
    if (!(form.shops as string[]).includes(shop.trim())) {
      setForm(prev => ({
        ...prev,
        shops: [...(prev.shops as string[]), shop.trim()],
      }));
    }
    setShopInput('');
  };

  const removeShop = (shop: string) => {
    if (form.shops === ALL_SHOPS_SENTINEL) return;
    setForm(prev => ({
      ...prev,
      shops: (prev.shops as string[]).filter(s => s !== shop),
    }));
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setFormError('');
    if (!form.username.trim()) return setFormError('Username is required.');
    if (!form.name.trim()) return setFormError('Display name is required.');
    if (!editingUser && !form.password.trim()) return setFormError('Password is required for new users.');

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        username: form.username.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role,
        pages: form.pages,
        shops: form.shops === ALL_SHOPS_SENTINEL ? ['all'] : form.shops,
      };
      if (form.password.trim()) {
        payload.password = form.password.trim();
      }

      if (editingUser?.id) {
        const { error } = await supabase
          .from('petty_cash_user')
          .update(payload)
          .eq('id', editingUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('petty_cash_user')
          .insert([payload]);
        if (error) throw error;
      }

      await fetchUsers();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('petty_cash_user')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || err));
    } finally {
      setDeleting(false);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = users.filter(u =>
    !search.trim() ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':   return 'bg-purple-100 text-purple-700 border border-purple-300';
      case 'manager': return 'bg-blue-100 text-blue-700 border border-blue-300';
      default:        return 'bg-gray-100 text-gray-600 border border-gray-300';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaUserCog className="text-[#2a5298]" /> User Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage user accounts, roles, page access and shop permissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            title="Refresh"
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-sm font-medium"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2a5298] text-white rounded-lg font-semibold hover:bg-[#1e3d70] transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-sm"
          >
            <FaPlus /> Add User
          </button>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {loading ? 'Loading…' : `${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#2a5298] text-white">
              <tr>
                {['#', 'Username', 'Display Name', 'Role', 'Pages', 'Shops', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin" />
                      <span>Loading users…</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    <FaUserCog className="text-4xl text-gray-300 mx-auto mb-2" />
                    <p className="font-medium">No users found</p>
                  </td>
                </tr>
              )}

              {!loading && filtered.map((u, idx) => (
                <tr key={u.id ?? u.username} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>

                  <td className="px-4 py-3 font-mono font-semibold text-[#2a5298] whitespace-nowrap">
                    {u.username}
                  </td>

                  <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">
                    {u.name}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor(u.role)}`}>
                      {u.role}
                    </span>
                  </td>

                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {u.pages.length === 0
                        ? <span className="text-gray-400 text-xs italic">No access</span>
                        : u.pages.slice(0, 3).map(p => (
                          <span key={p} className="inline-flex px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
                            {p.replace('Cash Tally - ', 'CT-')}
                          </span>
                        ))
                      }
                      {u.pages.length > 3 && (
                        <span className="text-xs text-gray-400">+{u.pages.length - 3}</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.shops === 'all'
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">All Shops</span>
                      : (u.shops as string[]).length === 0
                        ? <span className="text-gray-400 text-xs italic">None</span>
                        : <span className="text-xs text-gray-600">{(u.shops as string[]).join(', ')}</span>
                    }
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit"
                        className="p-2 rounded-lg text-[#2a5298] hover:bg-blue-100 transition-colors"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Delete"
                        className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════ Add / Edit Modal ══════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FaUserCog className="text-[#2a5298]" />
                {editingUser ? `Edit — ${editingUser.username}` : 'Add New User'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">

              {/* Error */}
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              {/* ── Basic Info ── */}
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FaUser className="text-[#2a5298]" /> Basic Info
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                      disabled={!!editingUser}
                      placeholder="e.g. john123"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                    />
                    {editingUser && <p className="text-xs text-gray-400 mt-1">Username cannot be changed.</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
                    />
                  </div>
                </div>
              </section>

              {/* ── Password ── */}
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FaKey className="text-[#2a5298]" /> Password
                  {editingUser && <span className="text-xs font-normal text-gray-400 normal-case">(leave blank to keep existing)</span>}
                </h4>
                <div className="relative max-w-sm">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={editingUser ? '••••••••' : 'Enter password'}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </section>

              {/* ── Role ── */}
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FaShieldAlt className="text-[#2a5298]" /> Role
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, role: r }))}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        form.role === r
                          ? 'bg-[#2a5298] text-white border-[#2a5298] shadow-md'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-[#2a5298] hover:text-[#2a5298]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Page Access ── */}
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FaShieldAlt className="text-[#2a5298]" /> Page Access
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PAGES.map(page => (
                    <label
                      key={page}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        form.pages.includes(page)
                          ? 'bg-blue-50 border-[#2a5298]'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.pages.includes(page)}
                        onChange={() => togglePage(page)}
                        className="w-4 h-4 rounded text-[#2a5298] focus:ring-[#2a5298]"
                      />
                      <span className="text-sm text-gray-700 font-medium">{page}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, pages: [...ALL_PAGES] }))}
                    className="text-xs text-[#2a5298] hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, pages: [] }))}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </section>

              {/* ── Shop Access ── */}
              <section>
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FaStore className="text-[#2a5298]" /> Shop Access
                </h4>

                {/* Toggle All Shops */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all mb-3 ${
                  isAllShops ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={isAllShops}
                    onChange={toggleAllShops}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-700">All Shops (no restriction)</span>
                </label>

                {!isAllShops && (
                  <>
                    {/* Quick-pick from shops */}
                    {availableShops.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {availableShops.map(shop => {
                          const selected = (form.shops as string[]).includes(shop);
                          return (
                            <button
                              key={shop}
                              type="button"
                              onClick={() => selected ? removeShop(shop) : addShop(shop)}
                              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                selected
                                  ? 'bg-[#2a5298] text-white border-[#2a5298]'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#2a5298]'
                              }`}
                            >
                              {shop}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Manual add */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shopInput}
                        onChange={e => setShopInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addShop(shopInput); } }}
                        placeholder="Type shop name and press Enter…"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298]"
                      />
                      <button
                        type="button"
                        onClick={() => addShop(shopInput)}
                        className="px-3 py-2 bg-[#2a5298] text-white rounded-lg hover:bg-[#1e3d70] transition-colors text-sm"
                      >
                        <FaPlus />
                      </button>
                    </div>

                    {/* Selected tags */}
                    {(form.shops as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(form.shops as string[]).map(s => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-[#2a5298] rounded-full text-xs font-medium border border-blue-200"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => removeShop(s)}
                              className="hover:text-red-600 transition-colors"
                            >
                              <FaTimes className="text-xs" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2a5298] text-white rounded-lg hover:bg-[#1e3d70] transition-all text-sm font-semibold shadow-md disabled:opacity-60"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <FaSave />
                {saving ? 'Saving…' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Delete Confirm Dialog ══════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <FaTrash className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Delete User</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Delete <span className="font-mono font-semibold text-[#2a5298]">{deleteTarget.username}</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {deleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
