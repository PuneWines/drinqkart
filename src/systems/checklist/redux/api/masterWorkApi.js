import supabase from "../../SupabaseClient";
import { getUserAssignedShops, isUserShopScoped } from "../../../../utils/permissionUtils";
import { isAssignmentExpired } from "../../utils/assignmentStatus";

const getLocalDateStr = (d) => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Fetch every row of a query in 1000-row chunks (Supabase caps a single response)
const fetchAll = async (buildQuery) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

const STATUS_RANK = { LOCKED: 1, GENERATED: 2, ACTIVE: 3, AVAILABLE: 4, UNASSIGNED: 5 };

// Loads ALL master work tasks once, each with a status derived from its assignments:
// GENERATED / LOCKED / ACTIVE / AVAILABLE (expired or swept) / UNASSIGNED (no assignment).
// Filtering and paging are done in the browser, so filter changes are instant.
export const fetchMasterWorksApi = async () => {
  const [masters, assignments] = await Promise.all([
    fetchAll(() =>
      supabase.from("master_work_tasks").select("*, shop(shop_name)").order("task_name", { ascending: true }).order("id", { ascending: true })
    ),
    fetchAll(() =>
      supabase
        .from("task_assignments")
        .select("id, task_id, status, employee_name, manager_name, start_datetime, end_datetime, next_start_datetime")
        .neq("is_active", false)
        .order("id", { ascending: true })
    ),
  ]);

  const byTask = {};
  assignments.forEach((a) => {
    (byTask[a.task_id] = byTask[a.task_id] || []).push(a);
  });

  let scopedNames = null;
  if (isUserShopScoped()) scopedNames = getUserAssignedShops().map((s) => s.toLowerCase());

  return masters
    .filter((m) => !scopedNames || scopedNames.includes((m.shop?.shop_name || "").trim().toLowerCase()))
    .map((m) => {
      const list = byTask[m.id] || [];
      const statuses = list.map((a) => {
        const derivedAvailable =
          !a.next_start_datetime &&
          (a.status === "AVAILABLE" || isAssignmentExpired({ end_datetime: a.end_datetime, estimated_minutes: m.estimated_minutes }));
        return derivedAvailable ? "AVAILABLE" : a.status || "ACTIVE";
      });
      const status = statuses.length
        ? [...statuses].sort((x, y) => (STATUS_RANK[x] || 9) - (STATUS_RANK[y] || 9))[0]
        : "UNASSIGNED";
      return {
        ...m,
        shop_name: m.shop?.shop_name || "",
        assignment_count: list.length,
        status,
      };
    });
};

export const fetchMasterWorkShopsApi = async () => {
  const { data, error } = await supabase.from("shop").select("id, shop_name").order("shop_name", { ascending: true });
  if (error) throw error;
  let shops = (data || []).filter((s) => s.shop_name && s.shop_name.trim());
  if (isUserShopScoped()) {
    const assigned = getUserAssignedShops().map((s) => s.toLowerCase());
    shops = shops.filter((s) => assigned.includes(s.shop_name.trim().toLowerCase()));
  }
  return shops;
};

// Update master fields, then sync ONLY unsubmitted, not-yet-expired tasks dated today or later
export const updateMasterWorkApi = async ({ id, task_name, department, shop_id, estimated_minutes, proof_required, is_active }) => {
  const minutes = parseInt(estimated_minutes, 10);
  if (!task_name || !task_name.trim()) throw new Error("Task name is required");
  if (Number.isNaN(minutes) || minutes < 0) throw new Error("Duration must be a non-negative number of minutes");

  const payload = {
    task_name: task_name.trim(),
    department: department ? department.trim() : null,
    shop_id: shop_id || null,
    estimated_minutes: minutes,
    proof_required: !!proof_required,
    is_active: !!is_active,
  };

  const { error } = await supabase.from("master_work_tasks").update(payload).eq("id", id);
  if (error) throw error;

  let shopName = null;
  if (payload.shop_id) {
    const { data: shopRow } = await supabase.from("shop").select("shop_name").eq("id", payload.shop_id).maybeSingle();
    shopName = shopRow?.shop_name || null;
  }

  const now = new Date();
  const todayStr = getLocalDateStr(now);

  // Candidates: not submitted, not approved/completed, dated today or later
  const { data: candidates, error: fetchErr } = await supabase
    .from("work_task_new")
    .select("id, current_date, end_time, duration, extra_time")
    .eq("task_id", id)
    .is("submission_date", null)
    .or("work_status.is.null,work_status.eq.PENDING,work_status.eq.REJECTED")
    .gte("current_date", todayStr);
  if (fetchErr) throw fetchErr;

  // Today's tasks whose deadline already passed are history -> leave them alone
  const syncIds = (candidates || [])
    .filter((t) => {
      if (t.current_date > todayStr) return true;
      let h = 23, m = 59;
      if (t.end_time) {
        const part = t.end_time.includes("T") ? t.end_time.split("T")[1] : t.end_time;
        const [hh, mm] = part.split(":");
        h = parseInt(hh, 10) || 0;
        m = parseInt(mm, 10) || 0;
      }
      const [y, mo, d] = t.current_date.split("-").map(Number);
      const end = new Date(y, mo - 1, d, h, m, 0);
      end.setMinutes(end.getMinutes() + (t.duration || 0) + (t.extra_time || 0));
      return now <= end;
    })
    .map((t) => t.id);

  if (syncIds.length > 0) {
    const syncPayload = {
      task_description: payload.task_name,
      department: payload.department,
      duration: payload.estimated_minutes,
    };
    if (shopName) syncPayload.shop_name = shopName;
    const { error: syncErr } = await supabase.from("work_task_new").update(syncPayload).in("id", syncIds);
    if (syncErr) throw syncErr;
  }

  return { id, ...payload, shop_name: shopName, synced: syncIds.length };
};
