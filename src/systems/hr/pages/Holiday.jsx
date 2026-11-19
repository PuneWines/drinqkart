import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Search, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { showConfirm } from '../../../context/DialogContext';
import { useAuth } from '../../../context/AuthContext';
import { getPagePermission, ViewOnlyBanner } from '../../../utils/permissionUtils';

export default function Holiday() {
  const { user: authUser } = useAuth();
  const pagePerm = getPagePermission(authUser, 'hr', 'Holiday');
  const canModify = pagePerm.canModify;

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [newHoliday, setNewHoliday] = useState({
    holiday_date: '',
    holiday_name: ''
  });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          setHolidays([]);
        } else {
          throw error;
        }
      } else {
        setHolidays(data || []);
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!canModify) {
      toast.error('You have view-only access. Cannot add holidays.');
      return;
    }
    if (!newHoliday.holiday_date || !newHoliday.holiday_name.trim()) return;

    try {
      setIsSubmitting(true);

      const selectedDate = newHoliday.holiday_date; // YYYY-MM-DD
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;

      // 1. Insert into holidays table
      const { error: holidayError } = await supabase
        .from('holidays')
        .insert([{
          holiday_date: selectedDate,
          holiday_name: newHoliday.holiday_name.trim()
        }]);

      if (holidayError) throw holidayError;

      // 2. Remove from working_day_calender
      await supabase
        .from('working_day_calender')
        .delete()
        .eq('working_date', selectedDate);

      // 3. Remove assigned tasks from all relevant tables for this specific day
      const cleanupResults = await Promise.allSettled([
        supabase.from('checklist').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
        supabase.from('delegation').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
        supabase.from('maintenance_tasks').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
        supabase.from('ea_tasks').delete().gte('planned_date', startOfDay).lte('planned_date', endOfDay)
      ]);

      cleanupResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Task cleanup failed for table index ${index}:`, result.reason);
        } else if (result.value?.error) {
          console.error(`Task cleanup error for table index ${index}:`, result.value.error);
        }
      });

      setNewHoliday({ holiday_date: '', holiday_name: '' });
      fetchHolidays();
      toast.success('Holiday added & operational tasks synchronized successfully!');
    } catch (err) {
      console.error('Error adding holiday:', err);
      toast.error(`Error adding holiday: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (holiday) => {
    if (!canModify) {
      toast.error('You have view-only access. Cannot delete holidays.');
      return;
    }

    const ok = await showConfirm({
      title: 'Delete Company Holiday',
      message: `Are you sure you want to delete holiday "${holiday.holiday_name}" (${holiday.holiday_date})?`,
      confirmText: 'Delete Holiday',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase
        .from('holidays')
        .delete()
        .eq('id', holiday.id);

      if (deleteError) throw deleteError;

      const dateObj = new Date(holiday.holiday_date);
      const dow = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ...

      // Restore to working_day_calender if not a Sunday
      if (dow !== 0) {
        const hindiDays = {
          1: 'सोम',
          2: 'मंगल',
          3: 'बुध',
          4: 'गुरु',
          5: 'शुक्र',
          6: 'शनि'
        };

        const dayName = hindiDays[dow];
        const monthNum = dateObj.getMonth() + 1;

        const getISOWeek = (date) => {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + 4 - (d.getDay() || 7));
          const yearStart = new Date(d.getFullYear(), 0, 1);
          return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        };

        const weekNum = getISOWeek(dateObj);

        await supabase.from('working_day_calender').insert([{
          working_date: holiday.holiday_date,
          day: dayName,
          week_num: weekNum,
          month: monthNum
        }]);
      }

      toast.success('Holiday removed successfully!');
      fetchHolidays();
    } catch (err) {
      console.error('Error deleting holiday:', err);
      toast.error(`Error removing holiday: ${err.message || 'Unknown error'}`);
    }
  };

  // Distinct years available in dataset
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    holidays.forEach(h => {
      if (h.holiday_date) {
        const y = h.holiday_date.split('-')[0];
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [holidays]);

  // Filtered dataset
  const filteredHolidays = useMemo(() => {
    return holidays.filter(h => {
      const matchesSearch =
        (h.holiday_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.holiday_date || '').includes(searchTerm);
      const matchesYear = yearFilter === 'all' || (h.holiday_date && h.holiday_date.startsWith(yearFilter));
      return matchesSearch && matchesYear;
    });
  }, [holidays, searchTerm, yearFilter]);

  // Statistics
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingCount = useMemo(() => {
    return holidays.filter(h => h.holiday_date && h.holiday_date >= todayStr).length;
  }, [holidays, todayStr]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <Toaster position="top-right" />

      {/* View-Only Banner */}
      {!canModify && (
        <ViewOnlyBanner
          pageTitle="Company Holidays"
          message="You have view-only access to Company Holidays. Only authorized HR administrators can add or remove holidays."
        />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <CalendarIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Company Holidays</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                HR FMS Central
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official company-wide holidays for payroll calculations, daily attendance records, and operational scheduling.
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Holidays</span>
            <span className="text-base font-extrabold text-slate-800">{holidays.length}</span>
          </div>
          <div className="bg-indigo-50/70 border border-indigo-200 px-3.5 py-2 rounded-xl text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-500">Upcoming</span>
            <span className="text-base font-extrabold text-indigo-700">{upcomingCount}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Add Form + Holidays Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Add Holiday Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Plus size={16} className="text-indigo-600" />
              Declare Holiday
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Wide</span>
          </div>

          <form onSubmit={handleAddHoliday} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Holiday Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canModify || isSubmitting}
                placeholder="e.g. Independence Day, Diwali"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:bg-slate-100"
                value={newHoliday.holiday_name}
                onChange={(e) => setNewHoliday({ ...newHoliday, holiday_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Holiday Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                disabled={!canModify || isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:bg-slate-100"
                value={newHoliday.holiday_date}
                onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-0.5">
                <AlertCircle size={13} /> Automatic Coordination
              </div>
              Adding a company holiday automatically marks attendance as paid holiday in HR, excludes it from working calendars, and removes tasks scheduled for this day in Checklist.
            </div>

            <button
              type="submit"
              disabled={!canModify || isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving & Syncing Systems...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Company Holiday
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Existing Holidays Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Table Controls Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <h2 className="text-sm font-bold text-slate-800">
                Official Calendar ({filteredHolidays.length})
              </h2>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Year Filter */}
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search holidays..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                  <th className="py-3 px-4">Date & Day</th>
                  <th className="py-3 px-4">Holiday Name</th>
                  <th className="py-3 px-4">Status</th>
                  {canModify && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={canModify ? 4 : 3} className="py-12 text-center text-slate-400 italic">
                      <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading official holidays...
                    </td>
                  </tr>
                ) : filteredHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={canModify ? 4 : 3} className="py-12 text-center text-slate-400 font-medium">
                      No holidays match the specified filters.
                    </td>
                  </tr>
                ) : (
                  filteredHolidays.map((holiday) => {
                    const isUpcoming = holiday.holiday_date >= todayStr;
                    const dateObj = new Date(holiday.holiday_date);

                    return (
                      <tr key={holiday.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">
                            {dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            {dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span className="text-base">🏖️</span>
                            {holiday.holiday_name}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isUpcoming ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> Upcoming
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                              Past
                            </span>
                          )}
                        </td>

                        {canModify && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteHoliday(holiday)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Holiday"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
