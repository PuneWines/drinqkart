import supabase from "../../SupabaseClient";

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
      .select('*, master_work_tasks(*, shop(shop_name))')
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
    let mapped = (data || []).map(row => {
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

    const datesChanged = originalTask && (
      originalTask.start_datetime !== resolvedStartDatetime ||
      originalTask.end_datetime !== resolvedEndDatetime
    );

    const employeesChanged = originalTask && originalTask.name !== updatedTask.name;

    const targetAsgnId = updatedTask.assignmentId || updatedTask.assignment_id;
    const targetTaskId = updatedTask.task_id || updatedTask.taskId || updatedTask.id;

    let asgnQuery = supabase
      .from('task_assignments')
      .update({
        employee_name: updatedTask.name,
        manager_name: updatedTask.given_by,
        start_datetime: resolvedStartDatetime,
        end_datetime: resolvedEndDatetime,
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

    if (originalTask && originalTask.task_description !== updatedTask.task_description) {
      const { error: masterError } = await supabase
        .from('master_work_tasks')
        .update({
          task_name: updatedTask.task_description,
          estimated_minutes: durationMinutes
        })
        .eq('id', updatedTask.task_id);
      if (masterError) throw masterError;
    } else if (durationMinutes !== null) {
      const { error: masterError } = await supabase
        .from('master_work_tasks')
        .update({
          estimated_minutes: durationMinutes
        })
        .eq('id', updatedTask.task_id);
      if (masterError) throw masterError;
    }

    if (datesChanged || employeesChanged) {
      const { error: deleteError } = await supabase
        .from('work_task_new')
        .delete()
        .eq('assignment_id', targetAsgnId || updatedTask.id)
        .is('submission_date', null);
      if (deleteError) throw deleteError;
    } else {
      const { error: syncError } = await supabase
        .from('work_task_new')
        .update({
          task_description: updatedTask.task_description
        })
        .eq('assignment_id', targetAsgnId || updatedTask.id)
        .is('submission_date', null);
      if (syncError) throw syncError;
    }

    return [updatedAsgn];
  } catch (error) {
    console.error("API Error updating work task assignment:", error);
    throw error;
  }
};

// Delete work task assignment and generated work tasks
export const deleteWorkTaskAssignmentApi = async (tasks) => {
  for (const task of tasks) {
    const { error: taskError } = await supabase
      .from('work_task_new')
      .delete()
      .eq('assignment_id', task.id);
    if (taskError) throw taskError;

    const { error: assignError } = await supabase
      .from('task_assignments')
      .delete()
      .eq('id', task.id);
    if (assignError) throw assignError;
  }
  return tasks;
};
