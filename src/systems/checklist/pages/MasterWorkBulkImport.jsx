import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ArrowLeft, Plus, Trash2, Save, Loader2, ChevronDown, Check, X
} from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { useMagicToast } from '../context/MagicToastContext';
import supabase from '../SupabaseClient';
import { getShifts, getShiftsSync } from '../services/shiftService';

// Custom Multi-Select Component
const MultiSelectDropdown = ({ options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const dropdownHeight = 240;
      const minWidth = Math.max(260, rect.width);

      let left = rect.left;
      if (left + minWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - minWidth - 16);
      }

      let top = rect.bottom + 4;
      // If not enough room below in the viewport, open upward
      if (top + dropdownHeight > window.innerHeight && rect.top > dropdownHeight) {
        top = rect.top - dropdownHeight - 4;
      }

      setDropdownPos({
        top: Math.max(10, top),
        left: Math.max(10, left),
        width: minWidth
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [selectedValues, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        (!menuRef.current || !menuRef.current.contains(event.target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (id) => {
    if (id === 'all') {
      if (selectedValues.length === options.length) {
        onChange([]);
      } else {
        onChange(options.map(o => o.id));
      }
      return;
    }

    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter(val => val !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const removeOption = (id, e) => {
    e.stopPropagation();
    onChange(selectedValues.filter(val => val !== id));
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return "Select Shops";
    if (selectedValues.length === options.length) return "All Shops Selected";
    if (selectedValues.length <= 2) {
      return selectedValues.map(id => options.find(o => o.id === id)?.shop_name).join(', ');
    }
    return `${selectedValues.length} Shops Selected`;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        onClick={() => {
          if (!isOpen) {
            updatePosition();
          }
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between w-full min-h-[42px] text-xs font-bold p-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all cursor-pointer"
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selectedValues.length > 0 && selectedValues.length <= 2 ? (
            selectedValues.map(id => {
              const opt = options.find(o => o.id === id);
              return opt ? (
                <span key={id} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-1">
                  {opt.shop_name}
                  <X className="w-3 h-3 hover:text-purple-900 cursor-pointer" onClick={(e) => removeOption(id, e)} />
                </span>
              ) : null;
            })
          ) : (
            <span className={selectedValues.length === 0 ? "text-gray-400 font-normal" : "text-gray-800"}>
              {getDisplayText()}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 99999
          }}
          className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          <div 
            onClick={() => toggleOption('all')}
            className="flex items-center px-3 py-2.5 cursor-pointer hover:bg-purple-50/50 border-b border-slate-100 transition-colors"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 flex-shrink-0 ${selectedValues.length === options.length ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
              {selectedValues.length === options.length && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs font-bold text-slate-700">Select All</span>
          </div>
          {options.map(option => (
            <div 
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className="flex items-center px-3 py-2 cursor-pointer hover:bg-purple-50/50 transition-colors"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 flex-shrink-0 ${selectedValues.includes(option.id) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                {selectedValues.includes(option.id) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-xs ${selectedValues.includes(option.id) ? 'font-bold text-purple-700' : 'font-medium text-slate-600'}`}>
                {option.shop_name}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const MasterWorkBulkImport = () => {
  const [shops, setShops] = useState([]);
  const initialShifts = getShiftsSync();
  const [shifts, setShifts] = useState(() => initialShifts);
  const [isLoadingShifts, setIsLoadingShifts] = useState(() => initialShifts.length === 0);
  const defaultShift = initialShifts.length > 0 ? initialShifts[0] : null;

  const [rows, setRows] = useState([
    {
      id: Date.now(),
      shop_ids: [],
      task_name: '',
      department: '',
      shift_id: defaultShift ? defaultShift.id : '',
      estimated_minutes: 0,
      start_time: defaultShift ? defaultShift.start_time : '',
      end_time: defaultShift ? defaultShift.end_time : '',
      proof_required: false
    }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useMagicToast();
  const navigate = useNavigate();

  // Concurrently fetch shops and shifts for ID mapping and auto-fill
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [shopsRes, shiftsData] = await Promise.all([
          supabase.from('shop').select('id, shop_name').order('shop_name', { ascending: true }),
          getShifts()
        ]);

        if (!isMounted) return;

        if (shopsRes.data) {
          setShops(shopsRes.data);
        }

        if (shiftsData && Array.isArray(shiftsData)) {
          setShifts(shiftsData);
          setIsLoadingShifts(false);
          // If the initial row has no shift_id, auto-select the first shift
          setRows(prevRows => prevRows.map(r => {
            if (!r.shift_id && shiftsData.length > 0) {
              return {
                ...r,
                shift_id: shiftsData[0].id,
                start_time: shiftsData[0].start_time,
                end_time: shiftsData[0].end_time
              };
            }
            return r;
          }));
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      } finally {
        if (isMounted) setIsLoadingShifts(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const addRow = () => {
    const activeShift = shifts.length > 0 ? shifts[0] : null;
    setRows(prev => [...prev, {
      id: Date.now(),
      shop_ids: [],
      task_name: '',
      department: '',
      shift_id: activeShift ? activeShift.id : '',
      estimated_minutes: 0,
      start_time: activeShift ? activeShift.start_time : '',
      end_time: activeShift ? activeShift.end_time : '',
      proof_required: false
    }]);
  };

  const removeRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const handleRowChange = (id, field, value) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleShiftChange = (id, shiftId) => {
    const selected = shifts.find(s => String(s.id) === String(shiftId));
    if (selected) {
      setRows(rows.map(row => row.id === id ? {
        ...row,
        shift_id: selected.id,
        start_time: selected.start_time || '',
        end_time: selected.end_time || ''
      } : row));
    }
  };

  const handleSave = async () => {
    // Validate rows
    const activeRows = rows.filter(row => row.shop_ids.length > 0 || row.task_name.trim());
    
    if (activeRows.length === 0) {
      showToast("Please fill in at least one valid row (Shop and Task Description are required)", "warning");
      return;
    }

    const missingShopOrTask = activeRows.find(row => row.shop_ids.length === 0 || !row.task_name.trim());
    if (missingShopOrTask) {
      showToast("Shop Name(s) and Task Description are required for each row", "warning");
      return;
    }

    const missingShift = activeRows.find(row => !row.shift_id);
    if (missingShift) {
      showToast("Please select a Shift for all tasks", "warning");
      return;
    }

    if (activeRows.length !== rows.length) {
      showToast(`Skipping ${rows.length - activeRows.length} empty rows.`, "warning");
    }

    setIsSaving(true);

    try {
      let successCount = 0;
      let failedCount = 0;

      for (const row of activeRows) {
        for (const shop_id of row.shop_ids) {
          // 1. Insert into master_work_tasks
          const { data: insertedMaster, error: masterErr } = await supabase
            .from('master_work_tasks')
            .insert([{
              shop_id: shop_id,
              task_name: row.task_name.trim(),
              department: row.department.trim() || "RETAIL",
              estimated_minutes: parseInt(row.estimated_minutes, 10) || 0,
              proof_required: Boolean(row.proof_required),
              is_active: true
            }])
            .select('id')
            .single();

          if (masterErr || !insertedMaster?.id) {
            console.error("Master insert error:", masterErr);
            failedCount++;
            continue;
          }

          // 2. Insert corresponding task_assignments row with shift time formatted with dummy ISO date (2000-01-01)
          const selectedShift = shifts.find(s => String(s.id) === String(row.shift_id));
          const sTime = row.start_time || selectedShift?.start_time || '09:00';
          const eTime = row.end_time || selectedShift?.end_time || '18:00';
          const dummyStart = `2000-01-01T${sTime}:00`;
          const dummyEnd = `2000-01-01T${eTime}:00`;

          const { error: asgnErr } = await supabase
            .from('task_assignments')
            .insert([{
              task_id: insertedMaster.id,
              start_datetime: dummyStart,
              end_datetime: dummyEnd,
              status: 'ACTIVE',
              manager_name: null,
              employee_name: null
            }]);

          if (asgnErr) {
            console.error("Task assignment insert error:", asgnErr);
          }
          successCount++;
        }
      }

      if (failedCount > 0) {
        showToast(`Saved ${successCount} tasks. ${failedCount} failed.`, "warning");
      } else {
        showToast(`Successfully saved ${successCount} tasks across selected shops.`, "success");
        setTimeout(() => navigate('/dashboard/work-details'), 1500);
      }
    } catch (err) {
      console.error(err);
      showToast("Critical error during save", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:text-purple-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Master Task <span className="text-purple-600">Entry</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manually Add Master Definitions</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : "Save Tasks"}
            </button>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-visible">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Task Entry</span>
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            
            <div className="p-4 sm:p-6 pb-40">
              {/* Mobile View (< 768px): Stacked input cards */}
              <div className="md:hidden space-y-4">
                {rows.map((row, idx) => (
                  <div 
                    key={row.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Task Row #{idx + 1}</span>
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Shop Name(s) *</label>
                      <MultiSelectDropdown 
                        options={shops}
                        selectedValues={row.shop_ids}
                        onChange={(vals) => handleRowChange(row.id, 'shop_ids', vals)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Task Description *</label>
                      <textarea
                        placeholder="Enter task description"
                        value={row.task_name}
                        onChange={(e) => handleRowChange(row.id, 'task_name', e.target.value)}
                        className="w-full text-xs font-bold p-2.5 min-h-[60px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none box-border"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Department</label>
                        <input
                          type="text"
                          placeholder="Optional (e.g., RETAIL)"
                          value={row.department}
                          onChange={(e) => handleRowChange(row.id, 'department', e.target.value)}
                          className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all box-border"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Extra Time (Mins)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Mins"
                          value={row.estimated_minutes}
                          onChange={(e) => handleRowChange(row.id, 'estimated_minutes', parseInt(e.target.value) || 0)}
                          className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all box-border"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Shift *</label>
                      <select
                        value={row.shift_id || ''}
                        onChange={(e) => handleShiftChange(row.id, e.target.value)}
                        disabled={isLoadingShifts}
                        className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all box-border cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isLoadingShifts ? (
                          <option value="" disabled>Loading shifts...</option>
                        ) : (
                          <>
                            {!row.shift_id && <option value="" disabled>Select Shift *</option>}
                            {shifts.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.shift_name} ({s.start_time} - {s.end_time})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Start Time</label>
                        <input
                          type="time"
                          value={row.start_time || ''}
                          readOnly
                          disabled
                          className="w-full text-xs font-bold p-2 min-h-[42px] border border-slate-200 rounded-xl outline-none bg-slate-100 text-slate-600 cursor-not-allowed select-none box-border"
                          title="Auto-filled from selected shift"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">End Time</label>
                        <input
                          type="time"
                          value={row.end_time || ''}
                          readOnly
                          disabled
                          className="w-full text-xs font-bold p-2 min-h-[42px] border border-slate-200 rounded-xl outline-none bg-slate-100 text-slate-600 cursor-not-allowed select-none box-border"
                          title="Auto-filled from selected shift"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Proof Required?</label>
                      <select
                        value={row.proof_required ? 'yes' : 'no'}
                        onChange={(e) => handleRowChange(row.id, 'proof_required', e.target.value === 'yes')}
                        className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View (>= 768px): Table */}
              <div className="hidden md:block overflow-x-auto min-h-[320px]">
                <table className="w-full text-left min-w-[950px] border-separate border-spacing-y-2">
                  <thead className="bg-transparent">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/5">Shop Name(s) *</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-1/4">Task Description *</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Dept</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Extra (Mins)</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-44">Shift *</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Start Time</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">End Time</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Req. Proof</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-transparent">
                    {rows.map((row) => (
                      <tr 
                        key={row.id}
                        className="group hover:bg-purple-50/20 transition-colors"
                      >
                        <td className="px-2 py-1 align-top">
                          <MultiSelectDropdown 
                            options={shops}
                            selectedValues={row.shop_ids}
                            onChange={(vals) => handleRowChange(row.id, 'shop_ids', vals)}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="text"
                            placeholder="Enter task description"
                            value={row.task_name}
                            onChange={(e) => handleRowChange(row.id, 'task_name', e.target.value)}
                            className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="text"
                            placeholder="RETAIL"
                            value={row.department}
                            onChange={(e) => handleRowChange(row.id, 'department', e.target.value)}
                            className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.estimated_minutes}
                            onChange={(e) => handleRowChange(row.id, 'estimated_minutes', parseInt(e.target.value) || 0)}
                            className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-center"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            value={row.shift_id || ''}
                            onChange={(e) => handleShiftChange(row.id, e.target.value)}
                            disabled={isLoadingShifts}
                            className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {isLoadingShifts ? (
                              <option value="" disabled>Loading shifts...</option>
                            ) : (
                              <>
                                {!row.shift_id && <option value="" disabled>Select Shift *</option>}
                                {shifts.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.shift_name} ({s.start_time} - {s.end_time})
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="time"
                            value={row.start_time || ''}
                            readOnly
                            disabled
                            className="w-full text-xs font-bold p-2 min-h-[42px] border border-slate-200 rounded-xl outline-none bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                            title="Auto-filled from selected shift"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="time"
                            value={row.end_time || ''}
                            readOnly
                            disabled
                            className="w-full text-xs font-bold p-2 min-h-[42px] border border-slate-200 rounded-xl outline-none bg-slate-100 text-slate-600 cursor-not-allowed select-none"
                            title="Auto-filled from selected shift"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            value={row.proof_required ? 'yes' : 'no'}
                            onChange={(e) => handleRowChange(row.id, 'proof_required', e.target.value === 'yes')}
                            className="w-full text-xs font-bold p-2 min-h-[42px] bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 text-center align-top pt-2">
                          <button
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length === 1}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Remove Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {rows.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm font-medium">
                No rows added. Click "Add Row" to start.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default MasterWorkBulkImport;
