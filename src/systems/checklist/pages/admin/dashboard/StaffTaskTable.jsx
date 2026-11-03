"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchStaffTasksDataApi, getStaffTasksCountApi, getTotalUsersCountApi } from "../../../redux/api/dashboardApi"
import supabase from "../../../SupabaseClient"

export default function StaffTasksTable({
  dashboardType,
  dashboardStaffFilter,
  shopFilter,
  parseTaskStartDate,
  dateRange
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [staffMembers, setStaffMembers] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [totalStaffCount, setTotalStaffCount] = useState(0)
  const [totalUsersCount, setTotalUsersCount] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const itemsPerPage = 50

  const [userRolesMap, setUserRolesMap] = useState({})

  // Fetch user roles from users table
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const { data } = await supabase.from('users').select('user_name, role');
        if (data) {
          const rMap = {};
          data.forEach(u => {
            if (u.user_name) {
              rMap[u.user_name.toLowerCase().trim()] = u.role || 'user';
            }
          });
          setUserRolesMap(rMap);
        }
      } catch (err) {
        console.error("Error fetching user roles in StaffTaskTable:", err);
      }
    };
    fetchUserRoles();
  }, []);

  // Generate available months (last 12 months)
  useEffect(() => {
    const months = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      const value = `${year}-${month.toString().padStart(2, '0')}`;

      months.push({
        value,
        label: monthName
      });
    }

    setAvailableMonths(months);
    const currentMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
    setStaffMembers([])
    setHasMoreData(true)
    setTotalStaffCount(0)
  }, [dashboardType, dashboardStaffFilter, shopFilter, selectedMonth, dateRange])

  // Function to load staff data from server
  const loadStaffData = useCallback(async (page = 1, append = false) => {
    if (isLoadingMore) return;

    try {
      setIsLoadingMore(true)

      const useDateRange = dateRange && dateRange.filtered;
      const startParam = useDateRange ? dateRange.startDate : null;
      const endParam = useDateRange ? dateRange.endDate : null;
      const monthParam = useDateRange ? null : selectedMonth;

      const userRoleLower = (localStorage.getItem("role") || "").toLowerCase();
      const currentUsername = (localStorage.getItem("user-name") || "").toLowerCase();

      let effectiveShopFilter = shopFilter;
      let managerShopUsers = [];

      if (userRoleLower === "manager" && currentUsername) {
        try {
          const { data: mgrData } = await supabase
            .from("users")
            .select("shop_name")
            .ilike("user_name", currentUsername)
            .maybeSingle();
          if (mgrData?.shop_name) {
            effectiveShopFilter = mgrData.shop_name;
            const { data: shopUsers } = await supabase
              .from("users")
              .select("user_name")
              .eq("shop_name", mgrData.shop_name)
              .eq("status", "active");
            if (shopUsers) {
              managerShopUsers = shopUsers.map(u => (u.user_name || "").toLowerCase());
            }
          }
        } catch (e) {
          console.error("Error fetching manager shop:", e);
        }
      }

      // Fetch staff data with their task summaries
      const data = await fetchStaffTasksDataApi(
        dashboardType,
        dashboardStaffFilter,
        effectiveShopFilter,
        page,
        itemsPerPage,
        monthParam,
        startParam,
        endParam
      )

      // Get total counts for both staff with tasks and total users
      if (page === 1) {
        const [staffCount, usersCount] = await Promise.all([
          getStaffTasksCountApi(
            dashboardType,
            dashboardStaffFilter,
            effectiveShopFilter,
            monthParam,
            startParam,
            endParam
          ),
          getTotalUsersCountApi(effectiveShopFilter)
        ]);
        
        if (userRoleLower === "user") {
          setTotalStaffCount(1)
          setTotalUsersCount(1)
        } else {
          setTotalStaffCount(staffCount)
          setTotalUsersCount(usersCount)
        }
      }

      if (!data || data.length === 0) {
        setHasMoreData(false)
        if (!append) {
          setStaffMembers([])
        }
        setIsLoadingMore(false)
        return
      }

      let filteredData = data || [];
      if (userRoleLower === "user" && currentUsername) {
        filteredData = filteredData.filter(staff => (staff.name || "").toLowerCase() === currentUsername);
      } else if (userRoleLower === "manager" && managerShopUsers.length > 0) {
        filteredData = filteredData.filter(staff => managerShopUsers.includes((staff.name || "").toLowerCase()));
      }

      if (append) {
        setStaffMembers(prev => [...prev, ...filteredData])
      } else {
        setStaffMembers(filteredData)
      }

      setHasMoreData(data.length === itemsPerPage)

    } catch (error) {
      console.error('Error loading staff data:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [dashboardType, dashboardStaffFilter, shopFilter, selectedMonth, dateRange, isLoadingMore])

  // Initial load when component mounts or dependencies change
  useEffect(() => {
    if (selectedMonth || (dateRange && dateRange.filtered)) {
      loadStaffData(1, false)
    }
  }, [dashboardType, dashboardStaffFilter, shopFilter, selectedMonth, dateRange])

  // Function to load more data when scrolling
  const loadMoreData = () => {
    if (!isLoadingMore && hasMoreData) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadStaffData(nextPage, true)
    }
  }

  // Handle scroll event for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMoreData || isLoadingMore) return

      const tableContainer = document.querySelector('.staff-table-container')
      if (!tableContainer) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainer
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2

      if (isNearBottom) {
        loadMoreData()
      }
    }

    const tableContainer = document.querySelector('.staff-table-container')
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll)
      return () => tableContainer.removeEventListener('scroll', handleScroll)
    }
  }, [hasMoreData, isLoadingMore, currentPage])

  // Format month for display
  const getDisplayMonth = () => {
    if (dateRange && dateRange.filtered) {
      return `${dateRange.startDate} to ${dateRange.endDate}`;
    }
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-3.5 font-sans">
      {/* Top Status & Active Filters Toolbar */}
      <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Audit Log Count */}
        {totalStaffCount > 0 ? (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Log</span>
            <span className="text-sm font-mono font-bold text-slate-800 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
              <span className="text-indigo-600">{staffMembers.length}</span> / {totalUsersCount} active
            </span>
          </div>
        ) : <div />}

        {/* Right: Active Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {dashboardStaffFilter !== "all" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200/60 rounded-md text-xs sm:text-[13px] font-medium text-indigo-700 font-sans shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Staff: {dashboardStaffFilter}
            </div>
          )}
          {shopFilter !== "all" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs sm:text-[13px] font-medium text-slate-700 font-sans shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              Shop: {shopFilter}
            </div>
          )}
        </div>
      </div>

      {staffMembers.length === 0 && !isLoadingMore ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M15 11h-8" /></svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Activity Found</h3>
            <p className="text-xs sm:text-[13px] text-slate-500 max-w-xs mx-auto mt-1">No tasks were assigned or processed for the selected criteria in {getDisplayMonth()}.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="staff-table-container overflow-auto" style={{ maxHeight: "560px" }}>
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  {(() => {
                    const getTabLabel = () => {
                      switch (dashboardType) {
                        case 'checklist': return 'Checklist';
                        case 'delegation': return 'Delegation';
                        case 'work': return 'Work';
                        case 'maintenance': return 'Maintenance';
                        case 'repair': return 'Repair';
                        case 'ea': return 'EA';
                        default: return 'Task';
                      }
                    };
                    const label = getTabLabel();
                    return ["Seq", "Staff Performance Detail", "Shop", "Total", "Done", "On-Time", `${label} Score`, `${label} On-Time Score`].map((header, i) => (
                      <th key={header} scope="col" className={`px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans ${i === 1 ? 'min-w-[220px]' : ''}`}>
                        {header}
                      </th>
                    ));
                  })()}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs sm:text-[13px]">
                {staffMembers.map((staff, index) => {
                  const score = staff.completion_score;
                  const scoreColor = score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200';
                  const ontimeScore = staff.ontime_score;
                  const ontimeColor = ontimeScore >= 80 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    ontimeScore >= 50 ? 'bg-sky-50 text-sky-700 border-sky-200' :
                      'bg-slate-100 text-slate-700 border-slate-200';

                  const role = (userRolesMap[(staff.name || "").toLowerCase().trim()] || "user").toLowerCase();

                  return (
                    <tr key={`${staff.name}-${index}`} className="hover:bg-slate-50/70 transition-colors group/row">
                      <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] font-mono font-bold text-slate-400 group-hover/row:text-indigo-600 transition-colors">
                        {(index + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {staff.profile_image ? (
                            <div className="w-9 h-9 rounded-full border border-slate-200 shadow-2xs overflow-hidden shrink-0">
                              <img
                                src={staff.profile_image}
                                alt={staff.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div
                                style={{ display: 'none' }}
                                className="w-full h-full flex items-center justify-center font-bold text-xs bg-indigo-50 text-indigo-700"
                              >
                                {staff.name.charAt(0)}
                              </div>
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 border border-indigo-200/60 bg-indigo-50 text-indigo-700">
                              {staff.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="text-[13px] sm:text-sm font-bold text-slate-900 tracking-tight">{staff.name}</div>
                            <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                              role === 'superadmin' || role === 'masteradmin' || role === 'admin'
                                ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                                : role === 'hod'
                                ? 'bg-sky-50 text-sky-700 border-sky-200/70'
                                : role === 'manager'
                                ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 font-sans">
                          {staff.shop || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-bold text-slate-800">
                        {staff.total_tasks}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-bold text-emerald-600">
                        {staff.total_completed_tasks}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-bold text-indigo-600">
                        {staff.total_done_on_time}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start min-w-[95px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border shadow-2xs ${scoreColor}`}>
                              {score}%
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-semibold">
                              {staff.total_completed_tasks}/{staff.total_tasks}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start min-w-[95px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border shadow-2xs ${ontimeColor}`}>
                              {ontimeScore}%
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-semibold">
                              {staff.total_done_on_time} on-time
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${ontimeScore >= 80 ? 'bg-indigo-500' : ontimeScore >= 50 ? 'bg-sky-500' : 'bg-slate-400'}`}
                              style={{ width: `${ontimeScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLoadingMore && (
              <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm w-full py-5 flex flex-col items-center justify-center border-t border-slate-100">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-150" />
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-300" />
                </div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-2">
                  Loading performance data
                </p>
              </div>
            )}

            {!hasMoreData && staffMembers.length > 0 && (
              <div className="py-5 bg-slate-50/50 flex flex-col items-center justify-center border-t border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Audit complete for {getDisplayMonth()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
