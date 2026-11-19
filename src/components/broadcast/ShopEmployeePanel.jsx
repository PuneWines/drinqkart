import React, { useState, useMemo } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { Search, X, Check, Building2, Users } from 'lucide-react'

export default function ShopEmployeePanel() {
  const [showNamesOnly, setShowNamesOnly] = useState(false)
  const {
    shops,
    selectedShopIds,
    selectedEmployeeIds,
    roleFilter,
    shopSearchQuery,
    setShopSearchQuery,
    setRoleFilter,
    toggleShopSelection,
    toggleEmployeeSelection,
    toggleAllEmployees,
    selectAllShops,
    clearAllShops,
  } = useChatStore()

  // Filter shops by search query and sort matching shops to top
  const filteredShops = useMemo(() => {
    return shops
      .filter((shop) => {
        const q = shopSearchQuery.toLowerCase().trim()
        if (!q) return true
        const matchesName = shop.name.toLowerCase().includes(q)
        const matchesEmp = shop.employees.some(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.role.toLowerCase().includes(q) ||
            (e.phone && e.phone.includes(q))
        )
        return matchesName || matchesEmp
      })
      .sort((a, b) => {
        if (!shopSearchQuery.trim()) return 0
        const q = shopSearchQuery.toLowerCase().trim()
        const aEmpMatch = a.employees.some((e) => e.name.toLowerCase().includes(q))
        const bEmpMatch = b.employees.some((e) => e.name.toLowerCase().includes(q))
        if (aEmpMatch && !bEmpMatch) return -1
        if (!aEmpMatch && bEmpMatch) return 1
        return 0
      })
  }, [shops, shopSearchQuery])

  // Base pool of employees from selected shops
  const basePool = useMemo(() => {
    return shops
      .filter((shop) => selectedShopIds.includes(shop.id))
      .flatMap((shop) => shop.employees)
  }, [shops, selectedShopIds])

  // Count by role category for live filter badges
  const roleCounts = useMemo(() => {
    return {
      all: basePool.length,
      Employees: basePool.filter((e) => e.roleCategory === 'employee').length,
      Managers: basePool.filter((e) => e.roleCategory === 'manager').length,
      Admins: basePool.filter((e) => e.roleCategory === 'admin').length,
    }
  }, [basePool])

  // Filtered employees according to active roleFilter and search query
  const activeEmployees = useMemo(() => {
    return basePool
      .filter((emp) => {
        if (roleFilter === 'Employees' && emp.roleCategory !== 'employee') return false
        if (roleFilter === 'Managers' && emp.roleCategory !== 'manager') return false
        if (roleFilter === 'Admins' && emp.roleCategory !== 'admin') return false

        if (shopSearchQuery.trim()) {
          const q = shopSearchQuery.toLowerCase().trim()
          const matchesName = (emp.name || '').toLowerCase().includes(q)
          const matchesRole = (emp.role || '').toLowerCase().includes(q)
          const matchesPhone = (emp.phone || '').includes(q)
          return matchesName || matchesRole || matchesPhone
        }
        return true
      })
      .sort((a, b) => {
        if (!shopSearchQuery.trim()) return 0
        const q = shopSearchQuery.toLowerCase().trim()
        const aStarts = (a.name || '').toLowerCase().startsWith(q)
        const bStarts = (b.name || '').toLowerCase().startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return 0
      })
  }, [basePool, roleFilter, shopSearchQuery])

  const allActiveEmpIds = useMemo(() => activeEmployees.map((e) => e.id), [activeEmployees])
  const isAllEmpSelected =
    allActiveEmpIds.length > 0 && allActiveEmpIds.every((id) => selectedEmployeeIds.includes(id))

  const isAllShopsSelected = shops.length > 0 && selectedShopIds.length === shops.length

  const getRoleBadge = (roleCat, displayRole) => {
    if (roleCat === 'admin') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          {displayRole || 'Admin'}
        </span>
      )
    }
    if (roleCat === 'manager') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          {displayRole || 'Manager'}
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {displayRole || 'Employee'}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm border border-gray-100 flex flex-col gap-3 overflow-hidden h-full">
      {/* Top Search & Show Names Switch */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={shopSearchQuery}
            onChange={(e) => setShopSearchQuery(e.target.value)}
            placeholder="Search shop, name, or phone…"
            className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-[#f9fafb] border border-gray-200 rounded-xl text-xs sm:text-sm placeholder:text-[11px] sm:placeholder:text-xs focus:outline-none focus:border-[#25D366] transition-colors font-medium placeholder-gray-400"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          {shopSearchQuery && (
            <button
              onClick={() => setShopSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0 text-xs font-semibold text-gray-700 select-none">
          <input
            type="checkbox"
            checked={showNamesOnly}
            onChange={(e) => setShowNamesOnly(e.target.checked)}
            className="accent-[#25D366] w-3.5 h-3.5 cursor-pointer rounded border-gray-300"
          />
          <span className="hidden sm:inline">Show names</span>
          <span className="sm:hidden">Names</span>
        </label>
      </div>

      {/* Role Filter Pills (All Roles, Employees, Managers, Admins) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { key: 'all', label: 'All Roles', count: roleCounts.all },
          { key: 'Employees', label: 'Employees', count: roleCounts.Employees },
          { key: 'Managers', label: 'Managers', count: roleCounts.Managers },
          { key: 'Admins', label: 'Admins', count: roleCounts.Admins },
        ].map(({ key, label, count }) => {
          const isActive = roleFilter === key
          return (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {showNamesOnly ? (
        /* Full Expanded Employees Table View */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center mb-1.5">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Employees ({activeEmployees.length})</span>
            </h2>
            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activeEmployees.filter((e) => selectedEmployeeIds.includes(e.id)).length} selected
            </span>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 overflow-y-auto bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-emerald-50/80 text-emerald-900 font-bold border-b border-emerald-100 sticky top-0 z-10 backdrop-blur-xs">
                  <th className="p-2 sm:p-2.5 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={isAllEmpSelected}
                      onChange={() => toggleAllEmployees(allActiveEmpIds)}
                      className="accent-[#25D366] w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </th>
                  <th className="p-2 sm:p-2.5">Name</th>
                  <th className="p-2 sm:p-2.5">Role</th>
                  <th className="p-2 sm:p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      {selectedShopIds.length === 0
                        ? 'No shops selected. Please select one or more shops to view staff.'
                        : 'No active employees found matching filters'}
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    const isEmpSelected = selectedEmployeeIds.includes(emp.id)
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => toggleEmployeeSelection(emp.id)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          isEmpSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="p-2 sm:p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isEmpSelected}
                            onChange={() => toggleEmployeeSelection(emp.id)}
                            className="accent-[#25D366] w-3.5 h-3.5 cursor-pointer rounded"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5 font-semibold text-gray-800">
                          <div>{emp.name}</div>
                          {emp.phone && (
                            <div className="text-[10px] text-gray-400 font-mono font-normal">
                              {emp.phone}
                            </div>
                          )}
                        </td>
                        <td className="p-2 sm:p-2.5">{getRoleBadge(emp.roleCategory, emp.role)}</td>
                        <td className="p-2 sm:p-2.5 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Standard View: Shop Selection (Top) + Employees Table (Bottom) */
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Shop Selection Section */}
          <div className="flex flex-col flex-1 min-h-0 gap-1.5">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Shop Selection ({filteredShops.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {selectedShopIds.length > 0 && selectedShopIds.length < shops.length && (
                  <button
                    type="button"
                    onClick={clearAllShops}
                    className="text-[11px] font-semibold text-gray-500 hover:text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={isAllShopsSelected ? clearAllShops : selectAllShops}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  {isAllShopsSelected ? 'Clear All' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[130px] sm:max-h-[160px] pr-1">
              {filteredShops.map((shop) => {
                const isSelected = selectedShopIds.includes(shop.id)
                return (
                  <div
                    key={shop.id}
                    onClick={() => toggleShopSelection(shop.id)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#25D366] bg-emerald-50/60 shadow-xs'
                        : 'border-gray-200/70 bg-gray-50/80 hover:border-[#25D366]/40 hover:bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-gray-900">{shop.name}</h3>
                      {isSelected ? (
                        <span className="bg-[#25D366] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Selected
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium">Click to select</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                      {shop.totalEmployees} Active Staff {isSelected ? '• Included in campaign' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Employees Section */}
          <div className="flex flex-col flex-1 min-h-[140px] sm:min-h-0 gap-1.5">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Employees ({activeEmployees.length})</span>
              </h2>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {activeEmployees.filter((e) => selectedEmployeeIds.includes(e.id)).length} selected
              </span>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 overflow-y-auto bg-white min-h-[120px]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-emerald-50/80 text-emerald-900 font-bold border-b border-emerald-100 sticky top-0 z-10 backdrop-blur-xs">
                    <th className="p-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={isAllEmpSelected}
                        onChange={() => toggleAllEmployees(allActiveEmpIds)}
                        className="accent-[#25D366] w-3.5 h-3.5 cursor-pointer rounded"
                      />
                    </th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400 text-xs">
                        {selectedShopIds.length === 0
                          ? 'No shops selected. Select a shop above to view staff.'
                          : 'No active employees found matching selection'}
                      </td>
                    </tr>
                  ) : (
                    activeEmployees.map((emp) => {
                      const isEmpSelected = selectedEmployeeIds.includes(emp.id)
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => toggleEmployeeSelection(emp.id)}
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                            isEmpSelected ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isEmpSelected}
                              onChange={() => toggleEmployeeSelection(emp.id)}
                              className="accent-[#25D366] w-3.5 h-3.5 cursor-pointer rounded"
                            />
                          </td>
                          <td className="p-2 font-semibold text-gray-800">
                            <div>{emp.name}</div>
                            {emp.phone && (
                              <div className="text-[10px] text-gray-400 font-mono font-normal">
                                {emp.phone}
                              </div>
                            )}
                          </td>
                          <td className="p-2">{getRoleBadge(emp.roleCategory, emp.role)}</td>
                          <td className="p-2 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
