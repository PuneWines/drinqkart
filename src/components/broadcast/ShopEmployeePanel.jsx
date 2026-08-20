import React, { useState } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { Search } from 'lucide-react'

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
  } = useChatStore()

  // Filter shops by search query and sort employee-matching shops to top
  const filteredShops = shops
    .filter((shop) => {
      if (showNamesOnly && !selectedShopIds.includes(shop.id)) {
        return false
      }
      const q = shopSearchQuery.toLowerCase().trim()
      if (!q) return true
      const matchesName = shop.name.toLowerCase().includes(q)
      const matchesEmp = shop.employees.some((e) => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
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

  // Get employees from currently selected shops, filter by search query & sort matching names to the top
  const activeEmployees = shops
    .filter((shop) => selectedShopIds.includes(shop.id))
    .flatMap((shop) => shop.employees)
    .filter((emp) => {
      if (showNamesOnly && !selectedEmployeeIds.includes(emp.id)) {
        return false
      }
      if (roleFilter === 'Managers' && !emp.role.toLowerCase().includes('manager')) return false
      if (roleFilter === 'Admins' && !emp.role.toLowerCase().includes('admin')) return false

      if (shopSearchQuery.trim()) {
        const q = shopSearchQuery.toLowerCase().trim()
        const matchesName = emp.name.toLowerCase().includes(q)
        const matchesRole = emp.role.toLowerCase().includes(q)
        return matchesName || matchesRole
      }
      return true
    })
    .sort((a, b) => {
      if (!shopSearchQuery.trim()) return 0
      const q = shopSearchQuery.toLowerCase().trim()
      const aStarts = a.name.toLowerCase().startsWith(q)
      const bStarts = b.name.toLowerCase().startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return 0
    })

  const allActiveEmpIds = activeEmployees.map((e) => e.id)
  const isAllEmpSelected =
    allActiveEmpIds.length > 0 && allActiveEmpIds.every((id) => selectedEmployeeIds.includes(id))

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm border border-gray-100 flex flex-col gap-3 sm:gap-4 overflow-hidden h-full">
      {/* Search Input and Show Names Checkbox */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={shopSearchQuery}
            onChange={(e) => setShopSearchQuery(e.target.value)}
            placeholder="Search Shop or Employee"
            className="w-full pl-9 sm:pl-10 pr-3.5 py-2 sm:py-2.5 bg-[#f9fafb] border border-gray-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm placeholder:text-[10px] sm:placeholder:text-xs focus:outline-none focus:border-[#25D366] transition-colors font-medium placeholder-gray-400"
          />
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 text-xs sm:text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={showNamesOnly}
            onChange={(e) => setShowNamesOnly(e.target.checked)}
            className="accent-[#25D366] w-4 h-4 cursor-pointer rounded border-gray-300"
          />
          <span>Show names</span>
        </label>
      </div>

      {showNamesOnly ? (
        /* Employees List Only (Starting from just below the search box) */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center mb-1.5">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span>👥</span> Employees ({activeEmployees.length})
            </h2>
            <span className="text-[11px] sm:text-xs text-emerald-600 font-semibold">
              {activeEmployees.filter((e) => selectedEmployeeIds.includes(e.id)).length} selected
            </span>
          </div>

          <div className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden flex-1 overflow-y-auto bg-white">
            <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-emerald-50/80 text-emerald-800 font-bold border-b border-emerald-100">
                  <th className="p-2 sm:p-2.5 w-7 text-center">
                    <input
                      type="checkbox"
                      checked={isAllEmpSelected}
                      onChange={() => toggleAllEmployees(allActiveEmpIds)}
                      className="accent-[#25D366] w-3 h-3 cursor-pointer rounded"
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
                    <td colSpan={4} className="p-3 text-center text-gray-400">
                      No employees found for selection
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
                          isEmpSelected ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="p-2 sm:p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isEmpSelected}
                            onChange={() => toggleEmployeeSelection(emp.id)}
                            className="accent-[#25D366] w-3 h-3 cursor-pointer rounded"
                          />
                        </td>
                        <td className="p-2 sm:p-2.5 font-semibold text-gray-800">{emp.name}</td>
                        <td className="p-2 sm:p-2.5 text-gray-600 font-medium">{emp.role}</td>
                        <td className="p-2 sm:p-2.5 text-center">
                          <span className={emp.status === 'online' ? 'text-emerald-500' : 'text-gray-300'}>
                            🟢
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
        <>
          {/* Filter Row */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {['all', 'Managers', 'Admins'].map((role) => {
              const isActive = roleFilter === role || (role === 'all' && roleFilter === 'all')
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {role === 'all' ? 'All Shops' : role}
                </button>
              )
            })}
          </div>

          {/* Shop Selection Section */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2 sm:gap-2.5">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>🏪</span> Shop Selection
            </h2>

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[110px] sm:max-h-[140px] pr-1">
              {filteredShops.map((shop) => {
                const isSelected = selectedShopIds.includes(shop.id)
                return (
                  <div
                    key={shop.id}
                    onClick={() => toggleShopSelection(shop.id)}
                    className={`p-2 sm:p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-[#25D366] bg-emerald-50/50 shadow-sm'
                        : 'border-transparent bg-gray-50 hover:border-[#25D366]/40 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-gray-900">{shop.name}</h3>
                      {isSelected && (
                        <span className="bg-[#25D366] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 font-medium">
                      {shop.totalEmployees} Employees {isSelected ? '• Included in campaign' : ''}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Employees Section */}
            <div className="flex flex-col flex-1 min-h-[120px] sm:min-h-0 mt-0.5">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <span>👥</span> Employees ({activeEmployees.length})
                </h2>
                <span className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold">
                  {activeEmployees.filter((e) => selectedEmployeeIds.includes(e.id)).length} selected
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden flex-1 overflow-y-auto bg-white max-h-[140px] sm:max-h-none">
                <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-emerald-50/80 text-emerald-800 font-bold border-b border-emerald-100">
                      <th className="p-2 sm:p-2.5 w-7 text-center">
                        <input
                          type="checkbox"
                          checked={isAllEmpSelected}
                          onChange={() => toggleAllEmployees(allActiveEmpIds)}
                          className="accent-[#25D366] w-3 h-3 cursor-pointer rounded"
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
                        <td colSpan={4} className="p-3 text-center text-gray-400">
                          No employees found for selection
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
                              isEmpSelected ? 'bg-emerald-50/20' : ''
                            }`}
                          >
                            <td className="p-2 sm:p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isEmpSelected}
                                onChange={() => toggleEmployeeSelection(emp.id)}
                                className="accent-[#25D366] w-3 h-3 cursor-pointer rounded"
                              />
                            </td>
                            <td className="p-2 sm:p-2.5 font-semibold text-gray-800">{emp.name}</td>
                            <td className="p-2 sm:p-2.5 text-gray-600 font-medium">{emp.role}</td>
                            <td className="p-2 sm:p-2.5 text-center">
                              <span className={emp.status === 'online' ? 'text-emerald-500' : 'text-gray-300'}>
                                🟢
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
        </>
      )}
    </div>
  )
}
