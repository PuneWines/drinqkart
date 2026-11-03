import React from "react"
import { ListTodo, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

export default function StatisticsCards({
  dashboardType,
  totalTask = 0,
  completeTask = 0,
  pendingTask = 0,
  overdueTask = 0,
  dateRange = null
}) {
  const completionRate = totalTask > 0 ? (completeTask / totalTask) * 100 : 0;
  const pendingRate = totalTask > 0 ? (pendingTask / totalTask) * 100 : 0;
  const overdueRate = totalTask > 0 ? (overdueTask / totalTask) * 100 : 0;

  const accountedTasks = completeTask + pendingTask + overdueTask;
  const notDoneTaskCount = Math.max(0, totalTask - accountedTasks);
  const notDoneRate = totalTask > 0 ? (notDoneTaskCount / totalTask) * 100 : 0;

  // Calculate stroke dash arrays for donut segments (radius = 40, circumference = 2 * PI * 40 = 251.327)
  const circumference = 251.3;
  const completedDash = (completionRate * circumference) / 100;
  const pendingDash = (pendingRate * circumference) / 100;
  const overdueDash = (overdueRate * circumference) / 100;
  const notDoneDash = (notDoneRate * circumference) / 100;

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 font-sans">
      {/* Left side - 4 Statistics Cards */}
      <div className="lg:w-1/2 w-full">
        <div className="grid grid-cols-2 gap-3.5 h-full">
          {/* Analyzed */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Analyzed
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ListTodo size={15} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums leading-none">
                {totalTask}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium font-sans">
                Up to Today
              </p>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Done
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-3xl font-bold text-emerald-600 font-mono tabular-nums leading-none">
                {completeTask}
              </div>
              <p className="text-xs text-emerald-600/90 mt-1.5 font-medium font-sans">
                {completionRate.toFixed(1)}% Completed
              </p>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Due Today
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={15} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-3xl font-bold text-amber-600 font-mono tabular-nums leading-none">
                {pendingTask}
              </div>
              <p className="text-xs text-amber-600/90 mt-1.5 font-medium font-sans">
                Active Today
              </p>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {dashboardType === "work" ? "Not Done" : "Overdue"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-3xl font-bold text-rose-600 font-mono tabular-nums leading-none">
                {overdueTask}
              </div>
              <p className="text-xs text-rose-600/90 mt-1.5 font-medium font-sans">
                Action Required
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Period Analytics Circular Progress */}
      <div className="lg:w-1/2 w-full">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center justify-between px-4.5 py-3.5 bg-slate-50/70 border-b border-slate-100">
            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wider font-sans">
              {dateRange ? "Period Analytics" : "Compliance Overview"}
            </h3>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-mono font-bold rounded-full border border-emerald-200/60">
              LIVE
            </span>
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-around gap-6">
              {/* Donut Chart */}
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f1f5f9"
                    strokeWidth="10"
                    fill="none"
                  />
                  {/* Overdue segment - Rose */}
                  {overdueDash > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#f43f5e"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${overdueDash} ${circumference}`}
                    />
                  )}
                  {/* Pending segment - Amber */}
                  {pendingDash > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#f59e0b"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${pendingDash} ${circumference}`}
                      strokeDashoffset={-overdueDash}
                    />
                  )}
                  {/* Completed segment - Emerald */}
                  {completedDash > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#10b981"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${completedDash} ${circumference}`}
                      strokeDashoffset={-(overdueDash + pendingDash)}
                    />
                  )}
                </svg>

                {/* Percentage Text In Center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-900 font-mono leading-none">
                      {completionRate.toFixed(1)}%
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">
                      Success
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-2.5 w-full sm:w-52">
                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[13px] font-semibold text-slate-700">Completed</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {completionRate.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-[13px] font-semibold text-slate-700">Due Today</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {pendingRate.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-[13px] font-semibold text-slate-700">
                      {dashboardType === "work" ? "Not Done" : "Overdue"}
                    </span>
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {overdueRate.toFixed(1)}%
                  </span>
                </div>

                {notDoneRate > 0 && (
                  <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-700">Other</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {notDoneRate.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Period Footer */}
            {dateRange && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <span className="text-xs font-medium text-slate-500 font-sans">
                  Audit Period: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
