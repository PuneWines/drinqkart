import supabase from "../../SupabaseClient";
import { sendTaskAssignmentNotification, sendMultipleWorkTasksNotification } from "../../services/whatsappService";

/**
 * Fetches all active tasks from master_work_tasks.
 * Includes shop information.
 */
export const fetchMasterWorkTasksApi = async () => {
  try {
    const { data, error } = await supabase
      .from('master_work_tasks')
      .select('*, shop(id, shop_name), task_assignments(*)')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) throw error;

    // Filter task_assignments to only include active assignments (is_active !== false)
    const cleaned = (data || []).map(task => {
      let asgns = task.task_assignments;
      if (Array.isArray(asgns)) {
        asgns = asgns.filter(a => a.is_active !== false);
      } else if (asgns && asgns.is_active === false) {
        asgns = null;
      }
      return {
        ...task,
        task_assignments: asgns
      };
    });

    return cleaned;
  } catch (error) {
    console.error("❌ Error fetching master work tasks:", error);
    throw error;
  }
};

/**
 * Fetches all current assignments from task_assignments.
 */
export const fetchTaskAssignmentsApi = async () => {
  try {
    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .neq('is_active', false);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching task assignments:", error);
    throw error;
  }
};

/**
 * Bulk upserts task assignments.
 * Uses task_id as the conflict target.
 */
export const upsertTaskAssignmentsApi = async (assignments) => {
  try {
    const { data, error } = await supabase
      .from('task_assignments')
      .upsert(assignments, { onConflict: 'task_id' })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Error upserting task assignments:", error);
    throw error;
  }
};

export const extractTimeFromDatetime = (datetimeVal) => {
  if (!datetimeVal) return null;

  if (typeof datetimeVal === 'string') {
    const str = datetimeVal.trim();
    if (str.includes('T')) {
      const timePart = str.split('T')[1];
      if (timePart) return timePart.split('.')[0].split('+')[0].split('Z')[0].trim();
    }
    if (str.includes(' ')) {
      const spaceParts = str.split(/\s+/);
      if (spaceParts.length > 1) {
        return spaceParts[1].split('.')[0].split('+')[0].split('Z')[0].trim();
      }
    }
    if (str.includes(':')) {
      return str;
    }
  }

  const d = new Date(datetimeVal);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return null;
};

/**
 * Generates individual work_task records for each day in the assignment range.
 */
export const generateWorkTasksApi = async (assignments) => {
  try {
    const tasksToInsert = [];

    // Gather all employee names, dates, task descriptions, and task_ids to query comprehensively
    const employeeNames = [];
    const dateStrings = [];
    const taskDescriptions = [];
    const taskIds = [];

    assignments.forEach(asgn => {
      if (asgn.employee_name) {
        asgn.employee_name.split(',').forEach(e => {
          const trimmed = e.trim();
          if (trimmed && !employeeNames.includes(trimmed)) employeeNames.push(trimmed);
        });
      }
      if (asgn.task_name && !taskDescriptions.includes(asgn.task_name)) {
        taskDescriptions.push(asgn.task_name);
      }
      if (asgn.task_id && !taskIds.includes(asgn.task_id)) {
        taskIds.push(asgn.task_id);
      }

      const start = new Date(asgn.start_datetime);
      const end = new Date(asgn.end_datetime);
      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dateStrings.includes(dateStr)) dateStrings.push(dateStr);
      }
    });

    let existingTasks = [];
    if (employeeNames.length > 0 && dateStrings.length > 0) {
      const { data, error } = await supabase
        .from('work_task_new')
        .select('assignment_id, current_date, name, task_description, task_id')
        .in('name', employeeNames)
        .in('current_date', dateStrings);

      if (!error && data) {
        existingTasks = data;
      }
    }

    // Build existing keys sets for different possible unique constraints
    const existingAsgnKeys = new Set(existingTasks.map(t => `${t.assignment_id}_${t.current_date}_${t.name}`));
    const existingDescKeys = new Set(existingTasks.map(t => `${t.name}_${t.current_date}_${t.task_description}`));
    const existingIdKeys = new Set(existingTasks.map(t => `${t.name}_${t.current_date}_${t.task_id}`));

    // Keep track of keys we are about to insert to avoid duplicates within the insertion payload itself
    const insertedKeys = new Set();

    for (const asgn of assignments) {
      const start = new Date(asgn.start_datetime);
      const end = new Date(asgn.end_datetime);

      const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      const employeeNamesList = asgn.employee_name
        ? asgn.employee_name.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        for (const empName of employeeNamesList) {
          const asgnKey = `${asgn.assignmentId || asgn.id}_${dateStr}_${empName}`;
          const descKey = `${empName}_${dateStr}_${asgn.task_name}`;
          const idKey = `${empName}_${dateStr}_${asgn.task_id}`;

          // Avoid inserting if it already exists in the database under any of the unique constraints
          const existsInDb =
            ((asgn.assignmentId || asgn.id) && existingAsgnKeys.has(asgnKey)) ||
            existingDescKeys.has(descKey) ||
            existingIdKeys.has(idKey);

          // Avoid inserting if we already added it in this run
          const existsInCurrentPayload = insertedKeys.has(descKey) || insertedKeys.has(idKey);

          if (!existsInDb && !existsInCurrentPayload) {
            insertedKeys.add(descKey);
            insertedKeys.add(idKey);

            tasksToInsert.push({
              task_id: asgn.task_id,
              assignment_id: asgn.assignmentId || asgn.id,
              name: empName,
              manager_name: asgn.manager_name || asgn.givenBy || asgn.next_manager_name || "Admin",
              task_description: asgn.task_name,
              shop_name: asgn.shopName,
              department: asgn.department,
              duration: asgn.estimated_minutes || asgn.duration || 0,
              extra_time: asgn.extra_time || asgn.extraTime || asgn.extra_minutes || 0,
              "current_date": dateStr,
              start_time: extractTimeFromDatetime(asgn.start_datetime),
              end_time: extractTimeFromDatetime(asgn.end_datetime),
              tab_status: 'live',
              work_status: 'PENDING'
            });
          }
        }
      }
    }

    if (tasksToInsert.length > 0) {
      // 1. Insert into work_task_new
      const { error: insertError } = await supabase
        .from('work_task_new')
        .insert(tasksToInsert);

      if (insertError) throw insertError;
    }

    // 2. Update task_assignments status to 'GENERATED'
    const { error: updateError } = await supabase
      .from('task_assignments')
      .update({ status: 'GENERATED' })
      .in('id', assignments.map(a => a.id));

    if (updateError) throw updateError;

    return { success: true, count: tasksToInsert.length };
  } catch (error) {
    console.error("❌ Error generating work tasks:", error);
    throw error;
  }
};

/**
 * Helper to delete ONLY unsubmitted future or currently active tasks for given assignment IDs.
 * Preserves past tasks and today's expired 'Not Done' tasks in history.
 */
export const deleteUnsubmittedFutureWorkTasks = async (assignmentIds) => {
  const ids = Array.isArray(assignmentIds)
    ? assignmentIds.filter(Boolean)
    : [assignmentIds].filter(Boolean);
  if (ids.length === 0) return;

  const getLocalDateStr = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  // 1. Fetch candidate unsubmitted tasks for today or later
  const { data: candidates, error: fetchErr } = await supabase
    .from('work_task_new')
    .select('id, current_date, start_time, end_time, duration, extra_time')
    .in('assignment_id', ids)
    .is('submission_date', null)
    .gte('current_date', todayStr);

  if (fetchErr || !candidates || candidates.length === 0) return;

  // 2. Filter IDs to ONLY those whose deadline has NOT passed yet!
  const deletableIds = candidates.filter(task => {
    if (task.current_date > todayStr) return true; // Future date -> Deletable

    // Calculate taskEnd for today's tasks
    let endHour = 23;
    let endMin = 59;
    if (task.end_time) {
      const timePart = task.end_time.includes('T') ? task.end_time.split('T')[1] : task.end_time;
      const timeParts = timePart.split(':');
      endHour = parseInt(timeParts[0], 10) || 0;
      endMin = parseInt(timeParts[1], 10) || 0;
    }

    const [year, month, day] = task.current_date.split('-').map(Number);
    const baseEnd = new Date(year, month - 1, day, endHour, endMin, 0);
    const totalMins = (task.duration || 0) + (task.extra_time || 0);
    const taskEnd = new Date(baseEnd.getTime() + totalMins * 60 * 1000);

    return now <= taskEnd; // Deletable ONLY if deadline has NOT passed yet today!
  }).map(t => t.id);

  // 3. Delete ONLY the filtered deletable IDs
  if (deletableIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('work_task_new')
      .delete()
      .in('id', deletableIds);

    if (deleteError) throw deleteError;
  }
};

/**
 * Resets task assignments and deletes generated work_task_new records.
 */
export const resetWorkTasksApi = async (assignmentIds) => {
  if (!assignmentIds || assignmentIds.length === 0) return { success: true };

  try {
    // 1. Delete matching unsubmitted active/future tasks (protects past & today's expired 'Not Done' tasks)
    await deleteUnsubmittedFutureWorkTasks(assignmentIds);

    // 2. Update task_assignments status back to 'ACTIVE'
    const { error: updateError } = await supabase
      .from('task_assignments')
      .update({ status: 'ACTIVE' })
      .in('id', assignmentIds);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error("❌ Error resetting work tasks:", error);
    throw error;
  }
};

/**
 * Fetches work tasks for a specific employee.
 */
export const fetchWorkTasksForUserApi = async (username) => {
  try {
    const { data, error } = await supabase
      .from('work_task')
      .select('*, task_assignments:assignment_id(start_datetime, end_datetime)')
      .eq('name', username)
      .order('current_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching user work tasks:", error);
    throw error;
  }
};

/**
 * Submits a work task.
 */
export const submitWorkTaskApi = async (taskId, submissionData) => {
  try {
    const { data, error } = await supabase
      .from('work_task_new')
      .update({
        remark: submissionData.remark,
        image: submissionData.image,
        work_status: 'SUBMITTED',
        submission_date: new Date().toISOString()
      })
      .eq('id', taskId)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Error submitting work task:", error);
    throw error;
  }
};

/**
 * Fetches pending approvals for work tasks.
 */
export const fetchPendingWorkApprovalsApi = async (role) => {
  try {
    const userRole = (role || "").toLowerCase();
    let query = supabase.from('work_task_new').select('*, task_assignments:assignment_id(manager_name, end_datetime)');

    if (userRole === 'manager') {
      query = query.or('work_status.eq.SUBMITTED,work_status.eq.Done,work_status.eq.done,work_status.eq.COMPLETED,work_status.eq.completed');
    } else if (userRole === 'admin') {
      query = query.eq('work_status', 'MANAGER_APPROVED');
    } else {
      query = query.or('work_status.eq.SUBMITTED,work_status.eq.Done,work_status.eq.done,work_status.eq.COMPLETED,work_status.eq.completed');
    }

    const { data, error } = await query
      .not('submission_date', 'is', null)
      .order('submission_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching pending work approvals:", error);
    throw error;
  }
};

/**
 * Fetches approved/rejected history for work tasks.
 */
export const fetchWorkTaskHistoryApi = async (role, username, selectedShop) => {
  try {
    const userRole = (role || localStorage.getItem("role") || "").toLowerCase();
    const userName = username || localStorage.getItem("user-name");
    let query = supabase.from('work_task_new').select('*, task_assignments:assignment_id(manager_name, end_datetime)');

    if (userRole === 'manager') {
      query = query
        .or(`manager_approved_by.eq."${userName}",admin_approved_by.eq."${userName}",work_status.in.("SUBMITTED","Done","done","COMPLETED","completed","APPROVED","ADMIN_APPROVED","MANAGER_APPROVED","REJECTED")`)
        .order('submission_date', { ascending: false });
    } else {
      query = query
        .in('work_status', ['APPROVED', 'ADMIN_APPROVED', 'REJECTED', 'MANAGER_APPROVED', 'SUBMITTED', 'Done', 'done', 'COMPLETED', 'completed'])
        .order('submission_date', { ascending: false });
    }

    if (selectedShop && selectedShop !== 'All' && selectedShop !== 'all') {
      query = query.eq('shop_name', selectedShop);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching work task history:", error);
    throw error;
  }
};

/**
 * Approves a work task.
 */
export const approveWorkTaskApi = async (taskId) => {
  try {
    let role = "";
    let userName = localStorage.getItem("user-name") || "";
    try {
      const currentUserStr = localStorage.getItem("currentUser");
      if (currentUserStr) {
        const parsed = JSON.parse(currentUserStr);
        if (parsed?.role) role = String(parsed.role).toLowerCase();
        if (parsed?.user_name) userName = parsed.user_name;
      }
    } catch (e) {
      console.error("Error parsing currentUser in approveWorkTaskApi:", e);
    }
    if (!role) role = (localStorage.getItem("role") || "").toLowerCase();

    const now = new Date().toISOString();

    let updateFields = {};
    if (role === 'manager') {
      updateFields = {
        work_status: 'MANAGER_APPROVED',
        manager_approved_by: userName,
        manager_approval_date: now
      };
    } else {
      updateFields = {
        work_status: 'ADMIN_APPROVED',
        admin_approved_by: userName,
        admin_approval_date: now
      };
    }

    const { data, error } = await supabase
      .from('work_task_new')
      .update(updateFields)
      .eq('id', taskId)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Error approving work task:", error);
    throw error;
  }
};

/**
 * Rejects a work task.
 */
export const rejectWorkTaskApi = async (taskId, reason) => {
  try {
    let role = "";
    let userName = localStorage.getItem("user-name") || "";
    try {
      const currentUserStr = localStorage.getItem("currentUser");
      if (currentUserStr) {
        const parsed = JSON.parse(currentUserStr);
        if (parsed?.role) role = String(parsed.role).toLowerCase();
        if (parsed?.user_name) userName = parsed.user_name;
      }
    } catch (e) {
      console.error("Error parsing currentUser in rejectWorkTaskApi:", e);
    }
    if (!role) role = (localStorage.getItem("role") || "").toLowerCase();

    const now = new Date().toISOString();

    let updateFields = {};
    if (role === 'manager') {
      updateFields = {
        work_status: 'REJECTED',
        rejection_reason: reason,
        submission_date: null
      };
    } else {
      updateFields = {
        work_status: 'REJECTED',
        rejection_reason: reason,
        submission_date: null,
        manager_approved_by: null,
        manager_approval_date: null
      };
    }

    const { data, error } = await supabase
      .from('work_task_new')
      .update(updateFields)
      .eq('id', taskId)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Error rejecting work task:", error);
    throw error;
  }
};

/**
 * Automatically checks for expired assignments and promotes next scheduled assignments to active.
 */
export const checkAndPromoteAssignmentsApi = async () => {
  try {
    const now = new Date();

    // 1. Update status to 'AVAILABLE' in DB for expired assignments with NO next assignment scheduled
    const { data: expiredNoNext, error: expiredError } = await supabase
      .from('task_assignments')
      .select('*')
      .is('next_start_datetime', null)
      .neq('status', 'AVAILABLE')
      .not('end_datetime', 'is', null);

    if (!expiredError && expiredNoNext && expiredNoNext.length > 0) {
      for (const asgn of expiredNoNext) {
        const end = new Date(asgn.end_datetime);
        const durationMins = Number(asgn.estimated_minutes || 0);
        const endWithDuration = new Date(end.getTime() + durationMins * 60 * 1000);

        if (now > endWithDuration) {
          await supabase
            .from('task_assignments')
            .update({
              status: 'AVAILABLE',
              updated_at: new Date().toISOString()
            })
            .eq('id', asgn.id);
        }
      }
    }

    // 2. Fetch all assignments that have a scheduled next assignment to promote
    const { data: assignments, error } = await supabase
      .from('task_assignments')
      .select('*')
      .not('next_start_datetime', 'is', null);

    if (error) throw error;
    if (!assignments || assignments.length === 0) return { promotedCount: 0 };

    const promoted = [];
    for (const asgn of assignments) {
      // Check if current assignment is expired (end_datetime passed) OR is null
      const isExpired = !asgn.end_datetime || new Date(asgn.end_datetime) < now;

      if (isExpired && asgn.next_start_datetime && asgn.next_end_datetime) {
        promoted.push(asgn);
      }
    }

    if (promoted.length === 0) return { promotedCount: 0 };

    // Promote in database
    for (const asgn of promoted) {
      // 1. Update task_assignments row to promote next_* fields to active fields, status to 'LOCKED', and clear next_*
      const { error: updateErr } = await supabase
        .from('task_assignments')
        .update({
          start_datetime: asgn.next_start_datetime,
          end_datetime: asgn.next_end_datetime,
          manager_name: asgn.next_manager_name,
          employee_name: asgn.next_employee_name,
          status: 'LOCKED', // Promote to LOCKED so it can be generated
          next_start_datetime: null,
          next_end_datetime: null,
          next_manager_name: null,
          next_employee_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', asgn.id);

      if (updateErr) throw updateErr;

      // 2. Fetch the updated assignment details (with shop name, etc. if needed for generation)
      const { data: masterTask, error: masterErr } = await supabase
        .from('master_work_tasks')
        .select('*, shop(shop_name)')
        .eq('id', asgn.task_id)
        .single();

      if (masterErr) throw masterErr;

      // Prepare the assignment object for generateWorkTasksApi
      const promotedAssignment = {
        id: asgn.id,
        assignmentId: asgn.id,
        task_id: asgn.task_id,
        task_name: masterTask.task_name,
        shopName: masterTask.shop?.shop_name || "N/A",
        department: masterTask.department || "N/A",
        estimated_minutes: masterTask.estimated_minutes || 0,
        extra_time: masterTask.extra_time || asgn.extra_time || asgn.extraTime || 0,
        start_datetime: asgn.next_start_datetime,
        end_datetime: asgn.next_end_datetime,
        employee_name: asgn.next_employee_name,
        manager_name: asgn.next_manager_name,
        status: 'LOCKED'
      };

      // 3. Generate the work tasks checklist for this promoted assignment
      await generateWorkTasksApi([promotedAssignment]);

      // 4. Send WhatsApp notification grouped by employee name
      const nowTime = new Date();
      const startTime = new Date(promotedAssignment.start_datetime);
      if (startTime <= nowTime) {
        const employeeNames = promotedAssignment.employee_name
          ? promotedAssignment.employee_name.split(',').map(e => e.trim()).filter(Boolean)
          : [];

        const empTasks = [];
        employeeNames.forEach(empName => {
          empTasks.push({
            taskType: 'work',
            doerName: empName,
            taskId: promotedAssignment.task_id,
            description: promotedAssignment.task_name,
            start_datetime: promotedAssignment.start_datetime,
            end_datetime: promotedAssignment.end_datetime,
            givenBy: promotedAssignment.manager_name || 'Admin',
            shop_name: promotedAssignment.shopName,
            department: promotedAssignment.department,
            duration: promotedAssignment.estimated_minutes
          });
        });

        empTasks.forEach(task => {
          sendTaskAssignmentNotification(task).catch(err => {
            console.error(`❌ Error sending auto-scheduled WhatsApp alert for ${task.doerName}:`, err);
          });
        });
      }
    }

    return { promotedCount: promoted.length };
  } catch (error) {
    console.error("❌ Error checking and promoting assignments:", error);
    throw error;
  }
};

const getUserAssignedShops = () => {
  const username = (localStorage.getItem('user-name') || localStorage.getItem('username') || '').toLowerCase().trim();
  const shopNameVal = (localStorage.getItem('shop_name') || localStorage.getItem('user_access') || '').trim();

  if (username === 'admin' || username === 'masteradmin' || shopNameVal.toLowerCase() === 'all' || !shopNameVal) {
    return null;
  }

  const shops = shopNameVal.split(',').map(s => s.trim()).filter(Boolean);
  return shops.length > 0 ? shops : null;
};

/**
 * Fetches paginated work records with search and filter applied directly in the database.
 */
export const fetchPaginatedWorkRecordsApi = async ({ page, limit, searchTerm, selectedShop, role, managerShops }) => {
  try {
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('master_work_tasks')
      .select('*, shop!inner(id, shop_name), task_assignments(*)', { count: 'exact' })
      .eq('is_active', true);

    const userAssignedShops = getUserAssignedShops();
    if (userAssignedShops) {
      query = query.in('shop.shop_name', userAssignedShops);
    } else if (role === 'manager' && managerShops && managerShops.length > 0) {
      query = query.in('shop.shop_name', managerShops);
    }

    if (selectedShop && selectedShop !== 'All') {
      query = query.eq('shop.shop_name', selectedShop);
    }

    if (searchTerm) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(`task_name.ilike.${term},task_assignments.manager_name.ilike.${term},task_assignments.employee_name.ilike.${term}`);
    }

    const { data, count, error } = await query
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const formattedData = (data || []).map(task => {
      const assignment = task.task_assignments?.[0] || null;
      return {
        ...task,
        ...(assignment || {}),
        taskId: task.id,
        shopName: task.shop?.shop_name || "N/A",
        assignmentId: assignment?.id || null
      };
    });

    return { data: formattedData, totalCount: count || 0 };
  } catch (error) {
    console.error("❌ Error fetching paginated work records:", error);
    throw error;
  }
};

/**
 * Fetches paginated scheduled work tasks with search and filter applied directly in the database.
 */
export const fetchPaginatedScheduledWorkTasksApi = async ({ page, limit, searchTerm, selectedShop, role, managerShops }) => {
  try {
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('master_work_tasks')
      .select('*, shop!inner(id, shop_name), task_assignments(*)', { count: 'exact' })
      .eq('is_active', true);

    if (userAssignedShops) {
      query = query.in('shop.shop_name', userAssignedShops);
    } else if (role === 'manager' && managerShops && managerShops.length > 0) {
      query = query.in('shop.shop_name', managerShops);
    }

    if (selectedShop && selectedShop !== 'All') {
      query = query.eq('shop.shop_name', selectedShop);
    }

    if (searchTerm) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(`task_name.ilike.${term},task_assignments.next_manager_name.ilike.${term},task_assignments.next_employee_name.ilike.${term}`);
    }

    const { data, count, error } = await query
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const formattedData = (data || []).map(task => {
      const assignment = task.task_assignments?.[0] || null;
      return {
        ...task,
        ...(assignment || {}),
        taskId: task.id,
        shopName: task.shop?.shop_name || "N/A",
        assignmentId: assignment?.id || null
      };
    });

    return { data: formattedData, totalCount: count || 0 };
  } catch (error) {
    console.error("❌ Error fetching paginated scheduled work tasks:", error);
    throw error;
  }
};

/**
 * Soft deletes (deactivates) a single task from master_work_tasks.
 */
export const deactivateMasterTaskApi = async (taskId) => {
  try {
    const { error } = await supabase
      .from('master_work_tasks')
      .update({ is_active: false })
      .eq('id', taskId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("❌ Error deactivating master task:", error);
    throw error;
  }
};

/**
 * Soft deletes (deactivates) multiple tasks from master_work_tasks in bulk.
 */
export const deactivateMasterTasksBulkApi = async (taskIds) => {
  try {
    const { error } = await supabase
      .from('master_work_tasks')
      .update({ is_active: false })
      .in('id', taskIds);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("❌ Error deactivating master tasks in bulk:", error);
    throw error;
  }
};

