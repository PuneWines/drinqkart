import supabase from "../../SupabaseClient";
import { deleteUnsubmittedFutureWorkTasks } from "./workRecordsApi";

// Helper to parse JSON strings if accidentally stored as such
const parseJsonIfNeeded = (val) => {
  if (typeof val === 'string' && val.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(val);
      return parsed.given_by || parsed.name || parsed.user_name || val;
    } catch (e) {
      return val;
    }
  }
  return val;
};

// Fetch unique checklist tasks — one row per unique task series
export const fetchChecklistData = async (page = 0, pageSize = 50, nameFilter = '', dateFilter = 'all') => {
  try {
    const FETCH_LIMIT = 100000;
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const username = localStorage.getItem("user-name");
    console.log(`[QuickTask Identity] User: ${username} | Role: ${role}`);

    let query = supabase
      .from('checklist')
      .select('*')
      .is('submission_date', null)
      .order('task_start_date', { ascending: true })
      .limit(FETCH_LIMIT);

    const roleUpper = (localStorage.getItem('role') || '').toUpperCase().trim();
    const userAccess = (localStorage.getItem('user_access') || localStorage.getItem('shop_name') || '').trim();
    const isMasterAdmin = (username || '').toLowerCase().trim() === 'admin' || (username || '').toLowerCase().trim() === 'masteradmin';

    const rawShops = userAccess.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'all' && s.toLowerCase() !== 'admin');
    const allowedShops = [...new Set(rawShops.flatMap(s => [s, s.toUpperCase(), s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()]))];

    if (!isMasterAdmin && allowedShops.length > 0) {
      query = query.in('shop_name', allowedShops);
    }
    if (roleUpper === 'USER' && username) {
      query = query.eq('name', username);
    }

    if (nameFilter) {
      query = query.or(`task_description.ilike.%${nameFilter}%,name.ilike.%${nameFilter}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Error when fetching data", error);
      return { data: [], total: 0 };
    }

    // Deduplicate: prioritize series_id, fallback to task_description + name combo
    const seen = new Set();
    let missingIdCount = 0;

    const uniqueRows = (data || []).filter(row => {
      // Track records without series_id for debugging
      if (!row.series_id) missingIdCount++;

      // Primary key: series_id
      if (row.series_id) {
        if (seen.has(row.series_id)) return false;
        seen.add(row.series_id);
        return true;
      }

      // Fallback key: legacy grouping
      const legacyKey = `${(row.shop || row.shop_name || '').trim()}::${(row.task_description || '').trim()}::${(row.name || '').trim()}`;
      if (seen.has(legacyKey)) return false;
      seen.add(legacyKey);
      return true;
    });

    console.log(`[QuickTask API Stats] Total Rows: ${data?.length || 0} | Unique Series: ${uniqueRows.length} | Rows missing series_id: ${missingIdCount}`);

    const mapped = uniqueRows.map(row => ({
      ...row,
      id: row.task_id,
      given_by: parseJsonIfNeeded(row.given_by),
      name: parseJsonIfNeeded(row.name)
    }));

    // Paginate the deduplicated result
    const start = page * pageSize;
    const paginated = mapped.slice(start, start + pageSize);

    return {
      data: paginated,
      total: mapped.length
    };

  } catch (error) {
    console.log("Error from Supabase", error);
    return { data: [], total: 0 };
  }
};

// Fetch unique delegation tasks — one row per unique task_description + name combination
export const fetchDelegationData = async (page = 0, pageSize = 50, nameFilter = '', dateFilter = 'all') => {
  try {
    const FETCH_LIMIT = 100000;
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const username = localStorage.getItem("user-name");

    let query = supabase
      .from('delegation')
      .select('*')
      .is('submission_date', null)
      .order('task_start_date', { ascending: true })
      .limit(FETCH_LIMIT);

    const roleUpper = (localStorage.getItem('role') || '').toUpperCase().trim();
    const userAccess = (localStorage.getItem('user_access') || localStorage.getItem('shop_name') || '').trim();
    const isMasterAdmin = (username || '').toLowerCase().trim() === 'admin' || (username || '').toLowerCase().trim() === 'masteradmin';

    if (roleUpper === 'USER' && username) {
      query = query.eq('name', username);
    } else if (!isMasterAdmin && (roleUpper === 'ADMIN' || roleUpper === 'HOD' || roleUpper === 'MANAGER')) {
      const rawShops = userAccess.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'all' && s.toLowerCase() !== 'admin');
      const allowedShops = [...new Set(rawShops.flatMap(s => [s, s.toUpperCase(), s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()]))];
      if (allowedShops.length > 0) {
        query = query.in('shop_name', allowedShops);
      }
    }

    if (nameFilter) {
      query = query.or(`task_description.ilike.%${nameFilter}%,name.ilike.%${nameFilter}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Error when fetching data", error);
      return { data: [], total: 0 };
    }

    // Deduplicate: prioritize series_id, fallback to task_description + name combo
    const seen = new Set();
    const uniqueRows = (data || []).filter(row => {
      // Use series_id if available, otherwise fallback to legacy grouping
      const key = row.series_id || `${(row.shop || row.shop_name || '').trim()}::${(row.task_description || '').trim()}::${(row.name || '').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mapped = uniqueRows.map(row => ({
      ...row,
      id: row.task_id,
      given_by: parseJsonIfNeeded(row.given_by),
      name: parseJsonIfNeeded(row.name)
    }));

    // Paginate the deduplicated result
    const start = page * pageSize;
    const paginated = mapped.slice(start, start + pageSize);

    return {
      data: paginated,
      total: mapped.length
    };

  } catch (error) {
    console.log("Error from Supabase delegation", error);
    return { data: [], total: 0 };
  }
};

export const deleteChecklistTasksApi = async (tasks) => {
  for (const task of tasks) {
    const { error } = await supabase
      .from("checklist")
      .delete()
      .eq("shop_name", (task.shop || task.shop_name))
      .eq("name", task.name)
      .eq("task_description", task.task_description)
      .eq("frequency", task.frequency)
      .eq("given_by", task.given_by)
      .is("submission_date", null);

    if (error) throw error;
  }
  return tasks;
};

export const deleteDelegationTasksApi = async (tasks) => {
  for (const task of tasks) {
    const { error } = await supabase
      .from("delegation")
      .delete()
      .eq("shop_name", (task.shop || task.shop_name))
      .eq("name", task.name)
      .eq("task_description", task.task_description)
      .eq("frequency", task.frequency)
      .eq("given_by", task.given_by)
      .is("submission_date", null);

    if (error) throw error;
  }
  return tasks;
};

export const updateChecklistTaskApi = async (updatedTask, originalTask) => {
  try {
    let query = supabase.from("checklist").update({
      shop_name: updatedTask.shop || updatedTask.shop_name,
      given_by: updatedTask.given_by,
      name: updatedTask.name,
      task_description: updatedTask.task_description,
      audio_url: updatedTask.audio_url,
      frequency: updatedTask.frequency,
      duration: updatedTask.duration || null,
      require_attachment: updatedTask.require_attachment,
      instruction_attachment_url: updatedTask.instruction_attachment_url,
      instruction_attachment_type: updatedTask.instruction_attachment_type,
      remark: updatedTask.remark,
      admin_done: false
    });

    if (originalTask) {
      // Update all matching pending tasks
      query = query
        .eq("shop_name", originalTask.shop || originalTask.shop_name)
        .eq("name", originalTask.name)
        .eq("task_description", originalTask.task_description)
        .is("submission_date", null);
    } else {
      // Fallback to single record update
      query = query.eq("task_id", updatedTask.id || updatedTask.task_id);
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("API Error updating checklist task:", error);
    throw error;
  }
};

export const updateDelegationTaskApi = async (updatedTask, originalTask) => {
  try {
    let query = supabase.from("delegation").update({
      shop_name: updatedTask.shop || updatedTask.shop_name,
      given_by: updatedTask.given_by,
      name: updatedTask.name,
      task_description: updatedTask.task_description,
      audio_url: updatedTask.audio_url,
      frequency: updatedTask.frequency,
      duration: updatedTask.duration || null,
      enable_reminder: updatedTask.enable_reminder,
      require_attachment: updatedTask.require_attachment,
      instruction_attachment_url: updatedTask.instruction_attachment_url,
      instruction_attachment_type: updatedTask.instruction_attachment_type,
      remarks: updatedTask.remarks
    });

    if (originalTask) {
      // Update all matching pending tasks
      query = query
        .eq("shop_name", originalTask.shop || originalTask.shop_name)
        .eq("name", originalTask.name)
        .eq("task_description", originalTask.task_description)
        .is("submission_date", null);
    } else {
      // Fallback to single record update
      query = query.eq("task_id", updatedTask.id || updatedTask.task_id);
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("API Error updating delegation task:", error);
    throw error;
  }
};

// Add this new function
export const fetchUsersData = async () => {
  try {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const username = localStorage.getItem("user-name");

    let query = supabase
      .from('users')
      .select('user_name, reported_by, role, shop_name, user_access')
      .not('user_name', 'is', null);

    if (role === 'hod' && username) {
      query = query.or(`reported_by.eq.${username},user_name.eq.${username}`);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Error when fetching users", error);
      return [];
    }

    console.log("Fetched users successfully", data);
    return data;

  } catch (error) {
    console.log("Error from Supabase", error);
    return [];
  }
};

export const fetchPendingChecklistApprovals = async () => {
  try {
    const { data, error } = await supabase
      .from('checklist')
      .select('*')
      .not('submission_date', 'is', null) // Has been submitted
      .or('admin_done.is.null,admin_done.eq.false') // Not yet admin approved
      .order('submission_date', { ascending: false });

    if (error) {
      console.error("Supabase Error fetching pending checklist approvals:", error);
      throw error;
    }
    return (data || []).map(row => ({ ...row, id: row.task_id }));
  } catch (error) {
    console.error("Error fetching pending checklist approvals:", error);
    return [];
  }
};

export const approveChecklistTask = async (id) => {
  try {
    const username = localStorage.getItem("user-name") || "Admin";
    const now = new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30');
    const { data, error } = await supabase
      .from('checklist')
      .update({
        admin_done: true,
        admin_approval_date: now,
        admin_approved_by: username
      })
      .eq('task_id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error approving checklist task:", error);
    throw error;
  }
};

export const rejectChecklistTask = async (id, reason) => {
  try {
    const { data, error } = await supabase
      .from('checklist')
      .update({
        admin_done: false,
        submission_date: null,
        remark: reason,
      })
      .eq('task_id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error rejecting checklist task:", error);
    throw error;
  }
};

export const fetchChecklistHistory = async () => {
  try {
    const { data, error } = await supabase
      .from('checklist')
      .select('*')
      .eq('admin_done', true)
      .order('submission_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({ ...row, id: row.task_id }));
  } catch (error) {
    console.error("Error fetching checklist history:", error);
    return [];
  }
};

// Fetch unique work task assignments
export const fetchWorkTaskData = async (page = 0, pageSize = 50, nameFilter = '', dateFilter = 'all', shopFilter = 'All', statusFilter = 'All') => {
  try {
    const FETCH_LIMIT = 100000;
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const username = localStorage.getItem("user-name");

    let query = supabase
      .from('task_assignments')
      .select('*, master_work_tasks!inner(*, shop(shop_name))')
      .eq('master_work_tasks.is_active', true)
      .neq('is_active', false)
      .limit(FETCH_LIMIT);

    if (role === 'user' && username) {
      query = query.ilike('employee_name', `%${username}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error when fetching work task assignments:", error);
      return { data: [], total: 0 };
    }

    // Map to a common format expected by the frontend
    let mapped = (data || [])
      .filter(row => row.is_active !== false && row.master_work_tasks && row.master_work_tasks.is_active !== false)
      .map(row => {
      const master = row.master_work_tasks || {};
      const shopName = master.shop?.shop_name || "N/A";
      return {
        ...row,
        id: row.id,
        assignment_id: row.id,
        task_id: row.task_id,
        task_description: master.task_name || "N/A",
        shop_name: shopName,
        shop: shopName,
        name: row.employee_name,
        given_by: row.manager_name,
        duration: master.estimated_minutes ? `${Math.floor(master.estimated_minutes / 60).toString().padStart(2, '0')}:${(master.estimated_minutes % 60).toString().padStart(2, '0')}` : "00:00",
        task_start_date: row.start_datetime,
        end_datetime: row.end_datetime,
        status: row.status
      };
    });

    if (nameFilter) {
      const term = nameFilter.toLowerCase();
      mapped = mapped.filter(item =>
        (item.task_description || '').toLowerCase().includes(term) ||
        (item.name || '').toLowerCase().includes(term) ||
        (item.given_by || '').toLowerCase().includes(term)
      );
    }

    if (shopFilter && shopFilter !== 'All') {
      const termShop = shopFilter.trim().toLowerCase();
      mapped = mapped.filter(item => (item.shop_name || item.shop || '').trim().toLowerCase() === termShop);
    }

    if (statusFilter && statusFilter !== 'All') {
      const termStatus = statusFilter.trim().toLowerCase();
      mapped = mapped.filter(item => (item.status || '').trim().toLowerCase() === termStatus);
    }

    const start = page * pageSize;
    const paginated = mapped.slice(start, start + pageSize);

    return {
      data: paginated,
      total: mapped.length
    };
  } catch (error) {
    console.error("Error fetching work task assignments:", error);
    return { data: [], total: 0 };
  }
};

// Update work task assignment and sync with work_task table
export const updateWorkTaskAssignmentApi = async (updatedTask, originalTask) => {
  try {
    const durationMinutes = updatedTask.duration ? (
      (() => {
        const parts = updatedTask.duration.split(':');
        if (parts.length === 2) {
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
        return parseInt(updatedTask.duration, 10) || 0;
      })()
    ) : null;

    const resolvedStartDatetime = updatedTask.start_datetime || updatedTask.task_start_date;
    const resolvedEndDatetime = updatedTask.end_datetime;

    // Combine dates with updated times if start_time / end_time provided
    let finalStartDatetime = resolvedStartDatetime;
    let finalEndDatetime = resolvedEndDatetime;

    const startDatePart = resolvedStartDatetime ? (resolvedStartDatetime.split('T')[0] || "2000-01-01") : "2000-01-01";
    const endDatePart = resolvedEndDatetime ? (resolvedEndDatetime.split('T')[0] || "2000-01-01") : "2000-01-01";

    if (updatedTask.start_time) {
      finalStartDatetime = `${startDatePart}T${updatedTask.start_time}:00`;
    }
    if (updatedTask.end_time) {
      finalEndDatetime = `${endDatePart}T${updatedTask.end_time}:00`;
    }

    const datesChanged = originalTask && (
      originalTask.start_datetime !== finalStartDatetime ||
      originalTask.end_datetime !== finalEndDatetime
    );

    const employeesChanged = originalTask && originalTask.name !== updatedTask.name;

    const targetAsgnId = updatedTask.assignmentId || updatedTask.assignment_id;
    const targetTaskId = updatedTask.task_id || updatedTask.taskId || updatedTask.id;

    let asgnQuery = supabase
      .from('task_assignments')
      .update({
        employee_name: updatedTask.name,
        manager_name: updatedTask.given_by,
        start_datetime: finalStartDatetime,
        end_datetime: finalEndDatetime,
        status: (datesChanged || employeesChanged) ? 'LOCKED' : updatedTask.status,
        updated_at: new Date().toISOString()
      });

    if (targetAsgnId) {
      asgnQuery = asgnQuery.eq('id', targetAsgnId);
    } else {
      asgnQuery = asgnQuery.or(`id.eq.${updatedTask.id},task_id.eq.${targetTaskId}`);
    }

    const { data: updatedAsgnList, error: asgnError } = await asgnQuery.select();

    if (asgnError) throw asgnError;
    const updatedAsgn = updatedAsgnList?.[0] || null;

    // Update master_work_tasks legacy template fields
    const masterUpdates = {};
    if (updatedTask.task_description !== undefined) masterUpdates.task_name = updatedTask.task_description;
    if (updatedTask.department !== undefined) masterUpdates.department = updatedTask.department;
    if (updatedTask.shop_id !== undefined) masterUpdates.shop_id = updatedTask.shop_id;
    if (durationMinutes !== null) masterUpdates.estimated_minutes = durationMinutes;
    if (updatedTask.proof_required !== undefined) masterUpdates.proof_required = Boolean(updatedTask.proof_required);

    if (Object.keys(masterUpdates).length > 0 && targetTaskId) {
      const { error: masterError } = await supabase
        .from('master_work_tasks')
        .update(masterUpdates)
        .eq('id', targetTaskId);
      if (masterError) throw masterError;
    }

    if (datesChanged || employeesChanged) {
      const asgnIdToDelete = targetAsgnId || updatedTask?.id || updatedTask?.assignment_id;
      if (asgnIdToDelete) {
        await deleteUnsubmittedFutureWorkTasks(asgnIdToDelete);
      }
    } else {
      const asgnIdToUpdate = targetAsgnId || updatedTask?.id || updatedTask?.assignment_id;
      if (asgnIdToUpdate) {
        const { error: syncError } = await supabase
          .from('work_task_new')
          .update({
            task_description: updatedTask.task_description,
            manager_name: updatedTask.given_by
          })
          .eq('assignment_id', asgnIdToUpdate)
          .is('submission_date', null);
        if (syncError) throw syncError;
      }
    }

    return [updatedAsgn];
  } catch (error) {
    console.error("API Error updating work task assignment:", error);
    throw error;
  }
};

// Soft-delete work task assignment, master work task, and clean up generated unsubmitted tasks (Individual or Bulk)
export const deleteWorkTaskAssignmentApi = async (tasks) => {
  const taskArray = Array.isArray(tasks) ? tasks : [tasks];
  for (const task of taskArray) {
    const targetAsgnId = typeof task === 'object' && task !== null
      ? (task.id ?? task.assignment_id)
      : task;
    const targetTaskId = typeof task === 'object' && task !== null
      ? (task.task_id ?? task.taskId)
      : null;

    if (targetAsgnId) {
      // 1. Delete matching unsubmitted active/future tasks (protects past & today's expired 'Not Done' tasks)
      await deleteUnsubmittedFutureWorkTasks(targetAsgnId);

      // 2. Soft-delete parent task assignment
      const { data: updatedAsgns, error: assignError } = await supabase
        .from('task_assignments')
        .update({ is_active: false })
        .eq('id', targetAsgnId)
        .select('task_id');
      if (assignError) throw assignError;

      // 3. Soft-delete linked master_work_task
      const masterIdToDeactivate = targetTaskId || updatedAsgns?.[0]?.task_id;
      if (masterIdToDeactivate) {
        const { error: masterError } = await supabase
          .from('master_work_tasks')
          .update({ is_active: false })
          .eq('id', masterIdToDeactivate);
        if (masterError) throw masterError;
      }
    }
  }
  return tasks;
};

// Bulk reset work task assignments: resets manager/employee to null, sets status to ACTIVE, date parts to '2000-01-01', and clears unsubmitted live tasks
export const bulkResetWorkTasksApi = async (selectedTasksList) => {
  const taskArray = Array.isArray(selectedTasksList) ? selectedTasksList : [selectedTasksList];
  
  const assignmentIds = taskArray
    .map(t => (typeof t === 'object' && t !== null) ? (t.id ?? t.assignment_id ?? t.assignmentId) : t)
    .filter(Boolean);

  if (assignmentIds.length === 0) return { success: true };

  // 1. Clear unsubmitted live tasks from work_task_new
  await deleteUnsubmittedFutureWorkTasks(assignmentIds);

  // 2. Reset each assignment in task_assignments
  for (const task of taskArray) {
    const asgnId = typeof task === 'object' && task !== null
      ? (task.id ?? task.assignment_id ?? task.assignmentId)
      : task;

    if (!asgnId) continue;

    const rawStart = typeof task === 'object' ? (task.task_start_date || task.start_datetime) : null;
    const rawEnd = typeof task === 'object' ? task.end_datetime : null;

    const extractTime = (val, fallback) => {
      if (!val) return fallback;
      if (typeof val === 'string') {
        if (val.includes('T')) return val.split('T')[1].substring(0, 5);
        if (val.includes(' ')) return val.split(' ')[1].substring(0, 5);
        if (val.includes(':')) return val.substring(0, 5);
      }
      return fallback;
    };

    const sTime = extractTime(rawStart, "09:00");
    const eTime = extractTime(rawEnd, "18:00");

    const resetStartDatetime = `2000-01-01T${sTime}:00`;
    const resetEndDatetime = `2000-01-01T${eTime}:00`;

    const { error } = await supabase
      .from('task_assignments')
      .update({
        manager_name: null,
        employee_name: null,
        start_datetime: resetStartDatetime,
        end_datetime: resetEndDatetime,
        status: 'ACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', asgnId);

    if (error) throw error;
  }

  return { success: true };
};
