import React from "react"
import StatisticsCards from "../StaticsCard"
import TaskNavigationTabs from "../TaskNavigationTab"
import StaffTasksTable from "../StaffTaskTable"

export default function DefaultView({
    dashboardType,
    taskView,
    setTaskView,
    searchQuery,
    setSearchQuery,
    filterStaff,
    setFilterStaff,
    shopData,
    getTasksByView,
    getFrequencyColor,
    isLoadingMore,
    hasMoreData,
    displayStats,
    notDoneTask,
    dateRange,
    activeTab,
    dashboardStaffFilter,
    shopFilter,
    parseTaskStartDate,
    userRole,
}) {
    return (
        <div className="space-y-4 font-sans text-sm text-slate-800">
            <StatisticsCards
                totalTask={displayStats.totalTasks}
                completeTask={displayStats.completedTasks}
                pendingTask={displayStats.pendingTasks}
                overdueTask={displayStats.overdueTasks}
                notDoneTask={notDoneTask}
                dashboardType={dashboardType}
                dateRange={dateRange.filtered ? dateRange : null}
            />

            <TaskNavigationTabs
                taskView={taskView}
                setTaskView={setTaskView}
                dashboardType={dashboardType}
                dashboardStaffFilter={dashboardStaffFilter}
                shopFilter={shopFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterStaff={filterStaff}
                setFilterStaff={setFilterStaff}
                shopData={shopData}
                getTasksByView={getTasksByView}
                getFrequencyColor={getFrequencyColor}
                isLoadingMore={isLoadingMore}
                hasMoreData={hasMoreData}
                userRole={userRole}
                dateRange={dateRange}
            />

            {activeTab === "overview" && (
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-sans">
                                Staff Task Summary
                            </h3>
                            <p className="text-xs text-slate-500 font-sans mt-0.5">
                                Overview of tasks assigned to each staff member
                            </p>
                        </div>
                    </div>
                    <div className="p-4 overflow-auto">
                        <StaffTasksTable
                            dashboardType={dashboardType}
                            dashboardStaffFilter={dashboardStaffFilter}
                            shopFilter={shopFilter}
                            parseTaskStartDate={parseTaskStartDate}
                            dateRange={dateRange}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
