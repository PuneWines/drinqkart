import { supabase } from "../supabase";

interface OtherExpense {
  expenseName: string;
  employeeName: string;
  fromShop?: string;
  toShop?: string;
  description?: string;
  amount: string | number;
}

/**
 * Normalizes text to lower-case alphanumeric for reliable matching
 */
const cleanStr = (s: any): string => {
  return (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
};

/**
 * Syncs any "Advance Amount" items in Petty Cash directly to hr_management_advance_requests
 * as 'Monthly Advance' with status = 'Approved'.
 * If the employee already has an advance, this adds an approved monthly advance row,
 * which Payroll automatically sums and HR Advance tracks in the history statement.
 */
export async function syncPettyCashAdvances(
  otherExpenses: OtherExpense[] | undefined,
  basePattyId: string,
  shopName: string,
  date: string,
  previousPattyId?: string
) {
  if (!basePattyId && !previousPattyId) return;

  try {
    // 1. Remove any previous advance rows linked to this specific voucher ID (handles edits/updates)
    const idsToClean = Array.from(new Set([basePattyId, previousPattyId].filter(Boolean)));
    for (const id of idsToClean) {
      await supabase
        .from("hr_management_advance_requests")
        .delete()
        .ilike("admin_remarks", `%${id}%`);
    }

    if (!otherExpenses || otherExpenses.length === 0) return;

    // 2. Filter for "Advance Amount" / "Advance" entries with positive amounts
    const advanceEntries = otherExpenses
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => {
        const cleanName = cleanStr(entry.expenseName);
        const amt = parseFloat(String(entry.amount)) || 0;
        return (cleanName === "advanceamount" || cleanName === "advance") && amt > 0 && entry.employeeName;
      });

    if (advanceEntries.length === 0) return;

    // 3. Fetch active employees from hr_management_employees to resolve employee_id
    const { data: hrEmployees } = await supabase
      .from("hr_management_employees")
      .select("employee_id, name_as_per_aadhar");

    // Also fetch users to check if employee_id is stored directly on the user
    const { data: dbUsers } = await supabase
      .from("users")
      .select("user_name, employee_id");

    const resolveEmpId = (empName: string): string => {
      const targetClean = cleanStr(empName);
      if (!targetClean) return empName;

      // 1. Check users table for a matching user and employee_id
      if (dbUsers && dbUsers.length > 0) {
        const matchedUser = dbUsers.find(
          (u) => cleanStr(u.user_name) === targetClean
        );
        if (matchedUser?.employee_id) return matchedUser.employee_id.trim();
      }

      // 2. Check hr_management_employees table
      if (hrEmployees && hrEmployees.length > 0) {
        // Direct match on employee_id
        const byId = hrEmployees.find(
          (e) => cleanStr(e.employee_id) === targetClean
        );
        if (byId?.employee_id) return byId.employee_id.trim();

        // Match on name_as_per_aadhar
        const byName = hrEmployees.find((e) => {
          const eClean = cleanStr(e.name_as_per_aadhar);
          return (
            eClean &&
            targetClean &&
            (eClean === targetClean ||
              eClean.startsWith(targetClean) ||
              targetClean.startsWith(eClean))
          );
        });
        if (byName?.employee_id) return byName.employee_id.trim();
      }

      return empName.trim();
    };

    const startingMonth = date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);

    // 4. Construct 'Monthly Advance' records with status: 'Approved'
    const recordsToInsert = advanceEntries.map(({ entry, idx }) => {
      const amt = parseFloat(String(entry.amount)) || 0;
      const empId = resolveEmpId(entry.employeeName);
      const voucherRef = `${basePattyId}-${String(idx + 1).padStart(2, "0")}`;

      return {
        employee_id: empId,
        amount: amt,
        approved_amount: amt,
        monthly_deduction: amt, // full recovery default for monthly advance
        approved_monthly_deduction: amt,
        remaining_amount: amt,
        type: "Monthly Advance", // STRICTLY 'Monthly Advance'
        status: "Approved",      // DIRECTLY Approved
        reason: `${entry.description ? entry.description + " - " : ""}Petty Cash Disbursed at ${shopName || "Shop"}`,
        admin_remarks: `Petty Cash Voucher: ${voucherRef}`,
        starting_month: startingMonth,
      };
    });

    if (recordsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("hr_management_advance_requests")
        .insert(recordsToInsert);

      if (insertErr) {
        console.error("[pettyCashAdvanceBridge] Error syncing Monthly Advance:", insertErr);
      } else {
        console.log(`[pettyCashAdvanceBridge] Successfully synced ${recordsToInsert.length} Monthly Advance(s) directly as Approved.`);
      }
    }
  } catch (err) {
    console.error("[pettyCashAdvanceBridge] Error in syncPettyCashAdvances:", err);
  }
}

/**
 * Removes any linked Monthly Advance from hr_management_advance_requests
 * when a Petty Cash voucher is deleted.
 */
export async function deletePettyCashAdvances(basePattyId: string) {
  if (!basePattyId) return;
  try {
    const { error } = await supabase
      .from("hr_management_advance_requests")
      .delete()
      .ilike("admin_remarks", `%${basePattyId}%`);

    if (error) {
      console.error("[pettyCashAdvanceBridge] Error deleting linked Monthly Advance for", basePattyId, error);
    } else {
      console.log(`[pettyCashAdvanceBridge] Successfully removed linked Monthly Advance for ${basePattyId}`);
    }
  } catch (err) {
    console.error("[pettyCashAdvanceBridge] Error in deletePettyCashAdvances:", err);
  }
}
