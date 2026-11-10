"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Filter, ChevronDown, ChevronUp, Play, Pause, Edit, Save, X, Mic, Square, Trash2, Loader2, Search } from "lucide-react"
import { ReactMediaRecorder } from "react-media-recorder"
import AudioPlayer from "../../../components/AudioPlayer"
import RenderDescription from "../../../components/RenderDescription"
import supabase from "../../../SupabaseClient"
import { fetchDashboardDataApi, getDashboardDataCount } from "../../../redux/api/dashboardApi"
import { useDispatch } from "react-redux"
import { updateChecklistTask, updateDelegationTask } from "../../../redux/slice/quickTaskSlice"
import { updateMaintenanceTask } from "../../../redux/slice/maintenanceSlice"
import { fetchUniqueShopDataApi, fetchUniqueGivenByDataApi, fetchUniqueDoerNameDataApi } from "../../../redux/api/assignTaskApi"

const isAudioUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http') && (
    url.includes('audio-recordings') ||
    url.includes('voice-notes') ||
    url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
  );
};

export default function TaskNavigationTabs({
  dashboardType,
  taskView,
  setTaskView,
  searchQuery,
  setSearchQuery,
  filterStaff,
  setFilterStaff,
  shopData,
  getFrequencyColor,
  dashboardStaffFilter,
  shopFilter,
  userRole,
  dateRange
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [displayedTasks, setDisplayedTasks] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [recordedAudio, setRecordedAudio] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Dropdown lists
  const [shops, setShops] = useState([]);
  const [givenByList, setGivenByList] = useState([]);
  const [doersList, setDoersList] = useState([]);

  const dispatch = useDispatch()
  const itemsPerPage = 50

  // Edit Handlers
  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setEditFormData({
      id: task.id,
      task_description: task.title || '',
      name: task.assignedTo || '',
      shop: (task.shop || task.shop_name) || '',
      task_start_date: task.originalTaskStartDate || '',
      frequency: task.frequency || '',
      originalAudioUrl: isAudioUrl(task.title) ? task.title : null,
    });
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditFormData({});
    setRecordedAudio(null);
  };

  const handleInputChange = async (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'shop') {
      const doers = await fetchUniqueDoerNameDataApi(value);
      setDoersList(doers);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      let finalEditData = { ...editFormData };
      let audioToCleanup = null;

      // Handle Audio Upload or Change
      if (recordedAudio && recordedAudio.blob) {
        setIsUploading(true);
        try {
          const fileName = `voice-notes/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audio-recordings')
            .upload(fileName, recordedAudio.blob, {
              contentType: recordedAudio.blob.type || 'audio/webm',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from('audio-recordings')
            .getPublicUrl(fileName);

          finalEditData.task_description = publicUrlData.publicUrl;

          if (editFormData.originalAudioUrl) {
            audioToCleanup = editFormData.originalAudioUrl;
          }
        } catch (error) {
          console.error("Audio upload failed:", error);
          alert("Failed to upload voice note. Saving without it.");
        } finally {
          setIsUploading(false);
        }
      } else if (editFormData.originalAudioUrl && isAudioUrl(editFormData.task_description)) {
        // No new recording, keeping old audio
      } else if (editFormData.originalAudioUrl && !isAudioUrl(editFormData.task_description)) {
        audioToCleanup = editFormData.originalAudioUrl;
      }

      if (dashboardType === 'checklist') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        await dispatch(updateChecklistTask({
          updatedTask: finalEditData,
          originalTask: {
            shop: originalTask.shop,
            name: originalTask.assignedTo,
            task_description: originalTask.title
          }
        })).unwrap();
      } else if (dashboardType === 'maintenance') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        const updatedTask = {
          ...finalEditData,
          freq: finalEditData.frequency
        };
        await dispatch(updateMaintenanceTask({
          updatedTask,
          originalTask: {
            machine_name: originalTask.machine_name || originalTask.title,
            part_name: originalTask.part_name || '',
            task_description: originalTask.title
          }
        })).unwrap();
      } else if (dashboardType === 'delegation') {
        const originalTask = displayedTasks.find(t => t.id === editingTaskId);
        await dispatch(updateDelegationTask({
          updatedTask: finalEditData,
          originalTask: {
            shop: originalTask.shop,
            name: originalTask.assignedTo,
            task_description: originalTask.title
          }
        })).unwrap();
      }

      if (audioToCleanup) {
        try {
          const path = audioToCleanup.split('audio-recordings/').pop().split('?')[0];
          await supabase.storage.from('audio-recordings').remove([path]);
        } catch (cleanupError) {
          console.error("Failed to cleanup old audio:", cleanupError);
        }
      }

      setEditingTaskId(null);
      setRecordedAudio(null);
      loadTasksFromServer(1, false);
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Failed to save changes: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset pagination when filters change without wiping tasks to prevent UI shuffle
  useEffect(() => {
    setCurrentPage(1)
    setHasMoreData(true)
  }, [taskView, dashboardType, dashboardStaffFilter, shopFilter, dateRange])

  // Function to load tasks from server
  const loadTasksFromServer = useCallback(async (page = 1, append = false) => {
    if (isLoadingMore) return;

    try {
      setIsLoadingMore(true)

      const useDateRange = dateRange && dateRange.filtered;
      const startParam = useDateRange ? dateRange.startDate : null;
      const endParam = useDateRange ? dateRange.endDate : null;

      const data = await fetchDashboardDataApi(
        dashboardType,
        dashboardStaffFilter,
        page,
        itemsPerPage,
        taskView,
        shopFilter,
        startParam,
        endParam
      )

      if (page === 1) {
        const count = await getDashboardDataCount(
          dashboardType,
          dashboardStaffFilter,
          taskView,
          shopFilter,
          startParam,
          endParam
        )
        setTotalCount(count)
      }

      if (!data || data.length === 0) {
        setHasMoreData(false)
        if (!append) {
          setDisplayedTasks([])
        }
        setIsLoadingMore(false)
        return
      }

      const seen = new Set();
      const processedTasks = data.map((task) => {
        const dateToUse = (dashboardType === 'checklist' || dashboardType === 'delegation')
          ? (task.planned_date || task.task_start_date)
          : (dashboardType === 'work' ? task.current_date : task.task_start_date);

        const taskStartDate = parseTaskStartDate(dateToUse)
        const completionDate = task.submission_date ? parseTaskStartDate(task.submission_date) : null

        let status = "pending"
        let timeStatus = "Upcoming"
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (completionDate || task.status === 'yes' || task.status === 'done' || task.admin_done) {
          status = "completed"
          timeStatus = "Submitted"
        } else if (taskStartDate) {
          const taskDateOnly = new Date(taskStartDate);
          taskDateOnly.setHours(0, 0, 0, 0);

          if (taskDateOnly < now) {
            status = "overdue"
            timeStatus = dashboardType === "work" ? "Not Done" : "Overdue"
          } else if (taskDateOnly.getTime() === now.getTime()) {
            status = "pending"
            timeStatus = "Today"
          } else {
            status = "upcoming"
            timeStatus = "Upcoming"
          }
        }

        return {
          ...task,
          id: task.id,
          title: task.task_description,
          assignedTo: task.name || task.assigned_person || task.doer_name || "Unassigned",
          taskStartDate: formatDateToDDMMYYYY(taskStartDate),
          originalTaskStartDate: task.task_start_date,
          plannedDate: task.planned_date,
          status,
          timeStatus,
          frequency: task.frequency || "one-time",
          rating: task.color_code_for || 0,
          shop: (task.shop || task.shop_name) || "N/A",
          managerName: task.task_assignments?.manager_name || "—",
        }
      })

      let filteredTasks = processedTasks.filter((task) => {
        const userRoleLower = (localStorage.getItem("role") || "").toLowerCase();
        const currentUsername = (localStorage.getItem("user-name") || "").toLowerCase();
        if (userRoleLower === "user" && currentUsername) {
          const assigned = (task.assignedTo || "").toLowerCase();
          if (assigned !== currentUsername) return false;
        }

        if (taskView === 'recent') {
          if (task.timeStatus !== 'Today' && task.timeStatus !== 'Submitted') return false;
        } else if (taskView === 'upcoming') {
          if (task.timeStatus !== 'Upcoming') return false;
        } else if (taskView === 'overdue') {
          if (task.timeStatus !== (dashboardType === 'work' ? 'Not Done' : 'Overdue')) return false;
        }

        if (searchQuery && searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase().trim()
          const matchesSearch = (
            (task.title && task.title.toLowerCase().includes(query)) ||
            (task.id && task.id.toString().includes(query)) ||
            (task.assignedTo && task.assignedTo.toLowerCase().includes(query))
          )
          if (!matchesSearch) return false;
        }

        if (dashboardType === 'checklist' || dashboardType === 'delegation' || dashboardType === 'maintenance') {
          if (task.status === "upcoming") {
            const descKey = task.task_description || task.title || "";
            const nameKey = task.name || task.assignedTo || "";
            const key = `upcoming::${descKey}::${nameKey}`;
            if (seen.has(key)) return false;
            seen.add(key);
          } else {
            const taskDate = task.plannedDate ? new Date(task.plannedDate).toDateString() :
              (task.originalTaskStartDate ? new Date(task.originalTaskStartDate).toDateString() : "");
            const descKey = task.task_description || task.title || "";
            const nameKey = task.name || task.assignedTo || "";
            const key = `${descKey}::${nameKey}::${taskDate}`;
            if (seen.has(key)) return false;
            seen.add(key);
          }
        }

        return true
      })

      if (append) {
        setDisplayedTasks(prev => [...prev, ...filteredTasks])
      } else {
        setDisplayedTasks(filteredTasks)
      }

      setHasMoreData(data.length === itemsPerPage)

    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [dashboardType, dashboardStaffFilter, taskView, searchQuery, shopFilter, dateRange, isLoadingMore, itemsPerPage])

  const parseTaskStartDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null

    if (dateStr.includes("-") && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parsed = new Date(dateStr)
      return isNaN(parsed) ? null : parsed
    }

    if (dateStr.includes("/")) {
      const parts = dateStr.split(" ")
      const datePart = parts[0]
      const dateComponents = datePart.split("/")
      if (dateComponents.length !== 3) return null

      const [day, month, year] = dateComponents.map(Number)
      if (!day || !month || !year) return null

      const date = new Date(year, month - 1, day)
      if (parts.length > 1) {
        const timePart = parts[1]
        const timeComponents = timePart.split(":")
        if (timeComponents.length >= 2) {
          const [hours, minutes, seconds] = timeComponents.map(Number)
          date.setHours(hours || 0, minutes || 0, seconds || 0)
        }
      }
      return isNaN(date) ? null : date
    }

    const parsed = new Date(dateStr)
    return isNaN(parsed) ? null : parsed
  }

  const formatDateToDDMMYYYY = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return ""
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  useEffect(() => {
    loadTasksFromServer(1, false)

    const fetchDropdownData = async () => {
      const [shopData, givens, doers] = await Promise.all([
        fetchUniqueShopDataApi(),
        fetchUniqueGivenByDataApi(),
        fetchUniqueDoerNameDataApi()
      ]);
      setShops(shopData);
      setGivenByList(givens);
      setDoersList(doers);
    };
    fetchDropdownData();
  }, [taskView, dashboardType, dashboardStaffFilter, shopFilter, dateRange])

  useEffect(() => {
    if (currentPage === 1) {
      loadTasksFromServer(1, false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (dashboardStaffFilter !== "all") {
      setFilterStaff("all")
    }
  }, [dashboardStaffFilter])

  const loadMoreData = () => {
    if (!isLoadingMore && hasMoreData) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadTasksFromServer(nextPage, true)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (!hasMoreData || isLoadingMore) return

      const tableContainer = document.querySelector('.task-table-container')
      if (!tableContainer) return

      const { scrollTop, scrollHeight, clientHeight } = tableContainer
      const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2

      if (isNearBottom) {
        loadMoreData()
      }
    }

    const tableContainer = document.querySelector('.task-table-container')
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll)
      return () => tableContainer.removeEventListener('scroll', handleScroll)
    }
  }, [hasMoreData, isLoadingMore, currentPage])

  return (
    <div className="w-full rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden font-sans">
      {/* Top Bar: Tabs & Search */}
      <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
        <div className="inline-flex p-1 bg-slate-100/90 rounded-lg border border-slate-200/70">
          {["recent", "upcoming", "overdue"].map((view) => {
            const isActive = taskView === view;
            const label = view === "overdue" ? (dashboardType === "work" ? "Not Done" : "Overdue") :
              (dashboardType === "delegation"
                ? (view === "recent" ? "Today Task" : "Future Task")
                : (view === "recent" ? "Recent" : "Upcoming")
              );
            return (
              <button
                key={view}
                type="button"
                onClick={() => setTaskView(view)}
                className={`
                  h-8.5 px-4 text-xs sm:text-[13px] font-bold !rounded-md font-sans transition-all cursor-pointer whitespace-nowrap
                  ${isActive ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search title, ID, staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs sm:text-[13px] font-sans text-slate-700 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          ) : (
            <Search size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
      </div>

      <div className="p-3">
        {/* Task List / Table Rendering */}
        {displayedTasks.length === 0 && !isLoadingMore ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-slate-200 m-2">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-slate-50 rounded-full text-slate-300">
                <Filter size={26} />
              </div>
            </div>
            <p className="text-slate-800 font-bold text-sm">No tasks found for {taskView} view.</p>
            <p className="text-xs sm:text-[13px] text-slate-500 mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div
                className="task-table-container overflow-x-auto"
                style={{ maxHeight: "calc(100vh - 380px)", minHeight: "300px", overflowY: "auto" }}
              >
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">ID</th>
                      {dashboardType === "delegation" && (
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Time Status</th>
                      )}
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Description</th>
                      {dashboardType === "work" && (
                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Manager Name</th>
                      )}
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Staff</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Shop</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Department</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Date</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">Freq</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs sm:text-[13px]">
                    {displayedTasks.map((task) => (
                      <tr
                        key={`${task.id}-${task.taskStartDate}`}
                        className="hover:bg-slate-50/70 transition-colors border-b last:border-0 cursor-pointer"
                        onDoubleClick={() => handleEditClick(task)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] font-mono font-bold text-indigo-600">
                          #{task.id}
                        </td>
                        {dashboardType === "delegation" && (
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">
                            <span className={`px-2.5 py-0.5 rounded-md font-mono ${task.timeStatus === "Overdue" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                              task.timeStatus === "Today" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                task.timeStatus === "Submitted" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                  "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}>
                              {task.timeStatus}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs sm:text-[13px] text-slate-800 min-w-[300px] max-w-sm font-medium">
                          {editingTaskId === task.id ? (
                            <ReactMediaRecorder
                              audio
                              onStop={(blobUrl, blob) => setRecordedAudio({ blobUrl, blob })}
                              render={({ status, startRecording, stopRecording, clearBlobUrl }) => (
                                <div className="space-y-2">
                                  {status !== 'recording' && !recordedAudio && (
                                    <div className="relative">
                                      {isAudioUrl(editFormData.task_description) ? (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 mb-2">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-indigo-600 uppercase">Existing Audio</span>
                                            <button
                                              type="button"
                                              onClick={() => handleInputChange('task_description', '')}
                                              className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                                            >
                                              <Trash2 size={12} /> Remove & Edit Text
                                            </button>
                                          </div>
                                          <AudioPlayer url={editFormData.task_description} />
                                          <button
                                            type="button"
                                            onClick={startRecording}
                                            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-all"
                                          >
                                            <Mic size={14} /> Replace with New Recording
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <textarea
                                            value={editFormData.task_description}
                                            onChange={(e) => handleInputChange('task_description', e.target.value)}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs sm:text-[13px] pr-8"
                                            rows="2"
                                            placeholder="Edit description..."
                                          />
                                          <button
                                            type="button"
                                            onClick={startRecording}
                                            className="absolute bottom-2 right-2 p-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-all shadow-2xs"
                                            title="Record Voice Note"
                                          >
                                            <Mic size={14} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {status === 'recording' && (
                                    <div className="flex flex-col items-center justify-center p-3.5 bg-red-50 border border-red-100 rounded-lg space-y-2 animate-pulse">
                                      <Mic size={20} className="text-red-600" />
                                      <button
                                        type="button"
                                        onClick={stopRecording}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-full hover:bg-red-700 text-xs font-bold shadow-2xs"
                                      >
                                        <Square size={12} /> Stop
                                      </button>
                                    </div>
                                  )}

                                  {recordedAudio && status !== 'recording' && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-indigo-600 uppercase">Voice Note Attached</span>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              clearBlobUrl();
                                              setRecordedAudio(null);
                                              startRecording();
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                                          >
                                            <Mic size={12} /> Give Again
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              clearBlobUrl();
                                              setRecordedAudio(null);
                                            }}
                                            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                                          >
                                            <Trash2 size={12} /> Remove
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <AudioPlayer url={recordedAudio.blobUrl} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            />
                          ) : (
                            <RenderDescription
                              text={task.title || task.task_description}
                              audioUrl={task.audio_url}
                              instructionUrl={task.instruction_attachment_url}
                              instructionType={task.instruction_attachment_type}
                            />
                          )}
                        </td>
                        {dashboardType === "work" && (
                          <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] text-slate-600 font-medium">
                            {task.managerName}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] text-slate-700 font-medium">
                          {editingTaskId === task.id ? (
                            <select
                              value={editFormData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs sm:text-[13px]"
                            >
                              <option value="">Select Name</option>
                              {doersList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          ) : (
                            task.assignedTo
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] text-slate-600">
                          {editingTaskId === task.id ? (
                            <select
                              value={editFormData.shop}
                              onChange={(e) => handleInputChange('shop', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs sm:text-[13px]"
                            >
                              <option value="">Select Shop</option>
                              {shops.map(shop => (
                                <option key={shop} value={shop}>{shop}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200">
                              {task.shop || task.shop_name || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] text-slate-500">
                          {task.department || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs sm:text-[13px] font-mono text-slate-600">
                          {task.taskStartDate}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">
                          <span className={`px-2.5 py-0.5 rounded-md font-mono border ${
                            (task.status === "completed" || task.status === "done" || task.status === "yes")
                              ? (task.admin_done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")
                              : (task.status === "overdue" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200")
                          }`}>
                            {(task.status === "completed" || task.status === "done" || task.status === "yes")
                              ? (task.admin_done ? "Approved" : "Pending Approval")
                              : (task.status === 'overdue' ? (dashboardType === 'work' ? 'Not Done' : 'Overdue') : 'Pending')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {editingTaskId === task.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                              >
                                <Save size={13} /> Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="h-7 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold flex items-center gap-1"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getFrequencyColor(task.frequency)}`}>
                              {task.frequency}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3.5">
              {displayedTasks.map((task) => (
                <div key={`${task.id}-${task.taskStartDate}`} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs font-sans">
                  <div className="flex justify-between items-start mb-2.5">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200/60">
                      #{task.id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getFrequencyColor(task.frequency)}`}>
                      {task.frequency}
                    </span>
                  </div>
                  <div className="mb-3">
                    {isAudioUrl(task.title) ? (
                      <AudioPlayer url={task.title} />
                    ) : (
                      <h3 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-relaxed line-clamp-2">{task.title}</h3>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 text-xs sm:text-[13px]">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400">Assigned To</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{task.assignedTo}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400">Date</span>
                      <p className="font-mono text-slate-700 mt-0.5">{task.taskStartDate}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400">Shop</span>
                      <p className="text-slate-700 mt-0.5">{task.shop || task.shop_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400">Status</span>
                      <p className="mt-0.5">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${
                          (task.status === "completed" || task.status === "done" || task.status === "yes")
                            ? (task.admin_done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")
                            : (task.status === "overdue" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200")
                        }`}>
                          {task.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isLoadingMore && (
              <div className="flex flex-col items-center justify-center py-7">
                <div className="h-7 w-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs font-bold text-indigo-600 mt-2.5 uppercase tracking-wider">Loading Tasks...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
