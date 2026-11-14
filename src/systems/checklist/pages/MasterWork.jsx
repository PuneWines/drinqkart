import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Edit,
  Save,
  X,
  Loader2,
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Camera,
  Clock,
  Building2,
  Tag,
  Activity,
  RotateCcw,
  Sparkles,
  PauseCircle,
  ChevronDown,
  RefreshCw,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import { useMagicToast } from "../context/MagicToastContext";
import { getPagePermission, isUserSuperadmin } from "../../../utils/permissionUtils";
import { fetchMasterWorks, updateMasterWork } from "../redux/slice/masterWorkSlice";

const PAGE_SIZE = 50;

const STATUS_CONFIG = {
  GENERATED: {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    dot: "bg-indigo-500",
    label: "Generated",
  },
  LOCKED: {
    bg: "bg-slate-100 text-slate-700 border-slate-200/80",
    dot: "bg-slate-500",
    label: "Locked",
  },
  ACTIVE: {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
    label: "Active",
  },
  AVAILABLE: {
    bg: "bg-amber-50 text-amber-800 border-amber-200/80",
    dot: "bg-amber-500",
    label: "Available",
  },
  UNASSIGNED: {
    bg: "bg-slate-100 text-slate-500 border-slate-200/70",
    dot: "bg-slate-400",
    label: "Unassigned",
  },
};

export default function MasterWork() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showToast } = useMagicToast();
  const perm = getPagePermission(null, "checklist", "Master Work");
  const isSuper = isUserSuperadmin();
  const canView = perm.canView || isSuper;
  const canModify = perm.canModify || isSuper;

  const { items, loading, shops } = useSelector((s) => s.masterWork);

  const [search, setSearch] = useState("");
  const [shopId, setShopId] = useState("All");
  const [department, setDepartment] = useState("All");
  const [active, setActive] = useState("All");
  const [status, setStatus] = useState("All");
  const [proofFilter, setProofFilter] = useState("All");
  const [sortBy, setSortBy] = useState("task_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canView) {
      showToast("Access Denied: You do not have permission to access Master Work.", "error");
      navigate("/dashboard");
    }
  }, [canView, navigate, showToast]);

  // Load master works once
  useEffect(() => {
    if (canView) dispatch(fetchMasterWorks());
  }, [canView, dispatch]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await dispatch(fetchMasterWorks());
    setIsRefreshing(false);
    showToast("Master work tasks refreshed", "success");
  };

  const departments = useMemo(
    () => [...new Set(items.map((t) => (t.department || "").trim()).filter(Boolean))].sort(),
    [items]
  );

  // Quick stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let proofCount = 0;
    let inFlightCount = 0;
    for (let i = 0; i < total; i++) {
      const t = items[i];
      if (t.is_active !== false) activeCount++;
      else inactiveCount++;
      if (t.proof_required) proofCount++;
      if (t.status === "GENERATED" || t.status === "ACTIVE" || t.status === "LOCKED") inFlightCount++;
    }
    return { total, activeCount, inactiveCount, proofCount, inFlightCount };
  }, [items]);

  // Filtered and sorted tasks
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = items.filter((t) => {
      const matchSearch =
        !term ||
        (t.task_name || "").toLowerCase().includes(term) ||
        String(t.id).includes(term) ||
        (t.shop_name || "").toLowerCase().includes(term) ||
        (t.department || "").toLowerCase().includes(term);

      const matchShop = shopId === "All" || String(t.shop_id) === String(shopId);
      const matchDept = department === "All" || (t.department || "").trim() === department;
      const matchActive =
        active === "All" || (active === "Active" ? t.is_active !== false : t.is_active === false);
      const matchStatus = status === "All" || t.status === status;
      const matchProof =
        proofFilter === "All" ||
        (proofFilter === "Yes" ? Boolean(t.proof_required) : !t.proof_required);

      return matchSearch && matchShop && matchDept && matchActive && matchStatus && matchProof;
    });

    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, search, shopId, department, active, status, proofFilter, sortBy, sortOrder]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [search, shopId, department, active, status, proofFilter]);

  const rows = filtered.slice(0, visible);
  const total = filtered.length;
  const hasMore = visible < total;

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    shopId !== "All" ||
    department !== "All" ||
    active !== "All" ||
    status !== "All" ||
    proofFilter !== "All";

  const resetFilters = () => {
    setSearch("");
    setShopId("All");
    setDepartment("All");
    setActive("All");
    setStatus("All");
    setProofFilter("All");
  };

  const openEdit = useCallback((task) => {
    setEditing({
      id: task.id,
      task_name: task.task_name || "",
      department: task.department || "",
      shop_id: task.shop_id || "",
      estimated_minutes: task.estimated_minutes ?? 0,
      proof_required: !!task.proof_required,
      is_active: task.is_active !== false,
    });
  }, []);

  const setField = (k, v) => setEditing((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!canModify) return;
    setSaving(true);
    const res = await dispatch(updateMasterWork(editing));
    setSaving(false);
    if (updateMasterWork.fulfilled.match(res)) {
      showToast(`Master work task updated (${res.payload.synced || 0} pending task(s) synced)`, "success");
      setEditing(null);
    } else {
      showToast(res.payload || "Failed to update master work task", "error");
    }
  };

  if (!canView) return null;

  return (
    <AdminLayout>
      <div className="space-y-5 pb-10">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-purple-500/20 shrink-0 mt-0.5">
              <SlidersHorizontal size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Master Work Directory</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 font-mono">
                  <Sparkles size={11} className="text-purple-600" />
                  {items.length} Master Tasks
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Centralized registry of recurring operational work templates. Edits instantly update master definitions and propagate to pending (unsubmitted, unexpired) scheduled tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Refresh master task data from server"
            >
              <RefreshCw size={13} className={loading || isRefreshing ? "animate-spin text-purple-600" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Tasks */}
          <div
            onClick={resetFilters}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              !hasActiveFilters
                ? "bg-purple-50/70 border-purple-200 shadow-2xs ring-1 ring-purple-200"
                : "bg-white border-slate-200/80 hover:border-purple-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Tasks</span>
              <Layers size={14} className="text-purple-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 font-mono">{stats.total}</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">All registered templates</div>
          </div>

          {/* Active Masters */}
          <div
            onClick={() => setActive((prev) => (prev === "Active" ? "All" : "Active"))}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              active === "Active"
                ? "bg-emerald-50/80 border-emerald-300 shadow-2xs ring-1 ring-emerald-300"
                : "bg-white border-slate-200/80 hover:border-emerald-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Active</span>
              <CheckCircle2 size={14} className="text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700 font-mono">{stats.activeCount}</div>
            <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">
              {stats.total ? Math.round((stats.activeCount / stats.total) * 100) : 0}% of all tasks
            </div>
          </div>

          {/* Inactive Masters */}
          <div
            onClick={() => setActive((prev) => (prev === "Inactive" ? "All" : "Inactive"))}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              active === "Inactive"
                ? "bg-slate-100 border-slate-300 shadow-2xs ring-1 ring-slate-300"
                : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Inactive</span>
              <PauseCircle size={14} className="text-slate-500" />
            </div>
            <div className="text-xl font-extrabold text-slate-700 font-mono">{stats.inactiveCount}</div>
            <div className="text-[10px] text-slate-400 font-medium mt-0.5">Paused generation</div>
          </div>

          {/* Requiring Proof */}
          <div
            onClick={() => setProofFilter((prev) => (prev === "Yes" ? "All" : "Yes"))}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              proofFilter === "Yes"
                ? "bg-amber-50/80 border-amber-300 shadow-2xs ring-1 ring-amber-300"
                : "bg-white border-slate-200/80 hover:border-amber-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Proof Required</span>
              <Camera size={14} className="text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-700 font-mono">{stats.proofCount}</div>
            <div className="text-[10px] text-amber-600/80 font-medium mt-0.5">Mandates photo proof</div>
          </div>

          {/* In Flight / Generated */}
          <div
            onClick={() => setStatus((prev) => (prev === "GENERATED" ? "All" : "GENERATED"))}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              status === "GENERATED"
                ? "bg-indigo-50/80 border-indigo-300 shadow-2xs ring-1 ring-indigo-300"
                : "bg-white border-slate-200/80 hover:border-indigo-200 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">In Flight</span>
              <Activity size={14} className="text-indigo-600" />
            </div>
            <div className="text-xl font-extrabold text-indigo-700 font-mono">{stats.inFlightCount}</div>
            <div className="text-[10px] text-indigo-600/80 font-medium mt-0.5">Active or generated</div>
          </div>
        </div>

        {/* Filter Controls Suite */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by task name, task ID, shop, or department..."
                className="w-full pl-9.5 pr-8 py-2 text-xs sm:text-sm bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Showing Count Indicator */}
            <div className="flex items-center justify-between lg:justify-end gap-2 shrink-0">
              <span className="h-9 inline-flex items-center text-xs font-semibold text-slate-600 bg-slate-50 px-3.5 rounded-lg border border-slate-200/80 whitespace-nowrap shadow-2xs font-mono">
                Showing: <b className="text-purple-700 ml-1 font-mono">{rows.length}</b>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-slate-600 font-mono">{total}</span>
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-9 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200/60 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <RotateCcw size={12} />
                  <span>Reset filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Dropdown Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1 border-t border-slate-100">
            {/* Shop Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={11} /> Shop
              </label>
              <div className="relative">
                <select
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer truncate"
                >
                  <option value="All">All Shops ({shops.length})</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Department Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag size={11} /> Department
              </label>
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer truncate"
                >
                  <option value="All">All Depts ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Runtime Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Activity size={11} /> Runtime Status
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  {["GENERATED", "LOCKED", "ACTIVE", "AVAILABLE", "UNASSIGNED"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Master Active / Inactive */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={11} /> Master Status
              </label>
              <div className="relative">
                <select
                  value={active}
                  onChange={(e) => setActive(e.target.value)}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Active">Active only</option>
                  <option value="Inactive">Inactive only</option>
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Proof Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Camera size={11} /> Photo Proof
              </label>
              <div className="relative">
                <select
                  value={proofFilter}
                  onChange={(e) => setProofFilter(e.target.value)}
                  className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="All">All Tasks</option>
                  <option value="Yes">Photo Required</option>
                  <option value="No">No Photo</option>
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Master Work Table - Pure Horizontal Scroll, no trapped vertical scroll div */}
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/95 backdrop-blur-xs text-slate-600 text-[11px] font-bold tracking-wider uppercase border-b border-slate-200 shadow-2xs select-none">
                <tr>
                  <th className="px-3.5 py-3 text-left w-[85px]">Actions</th>
                  <th
                    onClick={() => handleSort("id")}
                    className="px-3 py-3 text-left w-[80px] cursor-pointer hover:text-purple-700 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>ID</span>
                      <ArrowUpDown size={11} className={sortBy === "id" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("task_name")}
                    className="px-3.5 py-3 text-left cursor-pointer hover:text-purple-700 transition-colors min-w-[260px]"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Task Name</span>
                      <ArrowUpDown size={11} className={sortBy === "task_name" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("shop_name")}
                    className="px-3 py-3 text-left w-[150px] cursor-pointer hover:text-purple-700 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Shop</span>
                      <ArrowUpDown size={11} className={sortBy === "shop_name" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("department")}
                    className="px-3 py-3 text-left w-[130px] cursor-pointer hover:text-purple-700 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Department</span>
                      <ArrowUpDown size={11} className={sortBy === "department" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("estimated_minutes")}
                    className="px-3 py-3 text-left w-[110px] cursor-pointer hover:text-purple-700 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Duration</span>
                      <ArrowUpDown size={11} className={sortBy === "estimated_minutes" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left w-[100px]">Photo Proof</th>
                  <th
                    onClick={() => handleSort("assignment_count")}
                    className="px-3 py-3 text-left w-[100px] cursor-pointer hover:text-purple-700 transition-colors"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Assignments</span>
                      <ArrowUpDown size={11} className={sortBy === "assignment_count" ? "text-purple-600" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left w-[130px]">Runtime Status</th>
                  <th className="px-3.5 pr-5 py-3 text-left w-[110px]">Master Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-20">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                        <span className="text-xs font-semibold text-slate-500">Loading master work tasks...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Filter className="w-9 h-9 stroke-[1.5] text-slate-300" />
                        <span className="text-sm font-semibold text-slate-700">No master work tasks match your filter</span>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Try searching for a different task name, ID, or reset your filters to see all available templates.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer border border-purple-200/80"
                          >
                            <RotateCcw size={12} />
                            <span>Reset all filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.UNASSIGNED;
                    const isActive = t.is_active !== false;

                    return (
                      <tr key={t.id} className="hover:bg-purple-50/30 transition-colors align-middle">
                        {/* Actions */}
                        <td className="px-3.5 py-2.5">
                          {canModify ? (
                            <button
                              onClick={() => openEdit(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200/70 transition-colors cursor-pointer shadow-2xs"
                              title="Edit master work parameters"
                            >
                              <Edit size={12} />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* ID */}
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/70">
                            {t.id}
                          </span>
                        </td>

                        {/* Task Name */}
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-slate-900 text-[13px] hover:text-purple-700 transition-colors leading-snug">
                            {t.task_name}
                          </div>
                        </td>

                        {/* Shop */}
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800 text-xs truncate max-w-[160px]" title={t.shop_name}>
                            {t.shop_name || "—"}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="px-3 py-2.5">
                          {t.department ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                              {t.department}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-2.5">
                          <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                            <Clock size={11} className="text-slate-400" />
                            <span>{t.estimated_minutes ?? 0}m</span>
                          </div>
                        </td>

                        {/* Proof */}
                        <td className="px-3 py-2.5">
                          {t.proof_required ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                              <Camera size={11} className="text-emerald-600" />
                              <span>Required</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-400 border border-slate-200/60">
                              <span>No</span>
                            </span>
                          )}
                        </td>

                        {/* Assignments */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center justify-center font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                              t.assignment_count > 0
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200/80"
                                : "bg-slate-50 text-slate-400 border-slate-200/60"
                            }`}
                          >
                            {t.assignment_count}
                          </span>
                        </td>

                        {/* Runtime Status */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${st.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                            <span>{st.label}</span>
                          </span>
                        </td>

                        {/* Master Status */}
                        <td className="px-3.5 pr-5 py-2.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Progress & Load More Toolbar */}
          <div className="bg-slate-50/80 border-t border-slate-200/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Showing <b className="text-slate-800 font-mono">{rows.length}</b> of{" "}
              <b className="text-slate-800 font-mono">{total}</b> tasks
              {total > 0 && (
                <span className="text-slate-400 ml-1.5">({Math.round((rows.length / total) * 100)}% loaded)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasMore && (
                <>
                  <button
                    onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, total))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-purple-700 bg-white hover:bg-purple-50 rounded-lg border border-purple-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Load {Math.min(PAGE_SIZE, total - visible)} More</span>
                  </button>
                  <button
                    onClick={() => setVisible(total)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Load All ({total})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Master Work Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Edit size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">Edit Master Work</h2>
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      #{editing.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Update task parameters and propagate to active pending schedules.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Task Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Task Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editing.task_name}
                  onChange={(e) => setField("task_name", e.target.value)}
                  placeholder="Enter task name..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium"
                />
              </div>

              {/* Grid: Shop & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Shop Assigned
                  </label>
                  <div className="relative">
                    <select
                      value={editing.shop_id}
                      onChange={(e) => setField("shop_id", e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none cursor-pointer"
                    >
                      <option value="">Select Shop</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shop_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editing.department}
                    onChange={(e) => setField("department", e.target.value)}
                    list="mw-departments-modal"
                    placeholder="e.g. RETAIL, EXCISE"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all uppercase"
                  />
                  <datalist id="mw-departments-modal">
                    {departments.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Duration with Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Estimated Duration (Minutes)
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {editing.estimated_minutes || 0} mins
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      value={editing.estimated_minutes}
                      onChange={(e) => setField("estimated_minutes", e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setField("estimated_minutes", mins)}
                        className={`px-2 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                          Number(editing.estimated_minutes) === mins
                            ? "bg-purple-100 text-purple-700 border-purple-300"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles: Proof Required & Active Master */}
              <div className="space-y-2.5 pt-1">
                {/* Proof Required Card */}
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                      <Camera size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Photo Proof Required</div>
                      <div className="text-[11px] text-slate-500">
                        Staff must submit a live camera photo to complete this task.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.proof_required}
                    onChange={(e) => setField("proof_required", e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                </label>

                {/* Active Master Card */}
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Active Master Work</div>
                      <div className="text-[11px] text-slate-500">
                        When enabled, scheduled daily task instances are automatically generated.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => setField("is_active", e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Sync Notice Callout */}
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/70 text-[11px] text-purple-800 leading-relaxed flex items-start gap-2">
                <AlertCircle size={14} className="text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <b>Automatic Task Sync:</b> Saving changes updates this master template and recalculates duration, proof requirements, and names for all pending (unsubmitted and unexpired) tasks dated today and later.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editing.task_name.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-purple-600/20 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Update Master Task</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
