import { supabase } from "../lib/supabase";

/**
 * Service to synchronize lifecycle events with the dedicated `purchase_dashboard` audit table.
 * Adheres to strict "No Partial Submit" rules: every operation throws an error on failure,
 * enabling automatic compensating rollbacks in the caller.
 */

const CHUNK_SIZE = 100;

export const dashboardSyncService = {
  /**
   * 1. INDENT GENERATION:
   * Inserts all calculated items into purchase_dashboard.
   */
  async syncIndentCreated({ indentId, shopName, itemsPayload, empCode }) {
    if (!indentId || !itemsPayload || itemsPayload.length === 0) return;

    const now = new Date().toISOString();
    const dashboardRows = itemsPayload.map((itm) => ({
      indent_id: String(indentId),
      shop_name: shopName || itm.shop_name || "UNKNOWN",
      party_name: itm.party_name || "UNKNOWN",
      company_name: itm.company_name || null,
      item_name: itm.item_name || itm.itemName || "UNKNOWN",
      order_box: itm.order_box != null ? parseFloat(itm.order_box) : 0,
      order_qty: itm.order_qty != null ? parseFloat(itm.order_qty) : 0,
      indent_emp_code: empCode || "Indent Team",
      indent_created_at: now,
      trader_status: "Pending",
      transporter_status: "Pending",
      receiver_status: "Pending",
      is_deleted: Boolean(itm.is_excluded),
      deletion_stage: itm.is_excluded ? "indent" : null,
      deletion_reason: itm.exclusion_reason || null,
      updated_at: now,
    }));

    // Insert in chunks of 100
    for (let i = 0; i < dashboardRows.length; i += CHUNK_SIZE) {
      const chunk = dashboardRows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("purchase_dashboard").insert(chunk);
      if (error) {
        console.error("Failed to insert chunk into purchase_dashboard:", error);
        throw new Error(`Dashboard sync failed: ${error.message}`);
      }
    }
  },

  /**
   * Compensating rollback for failed indent generation:
   * Cleans up purchase_dashboard, purchase_indent_items, and purchase_indents.
   */
  async rollbackIndentCreated(indentId) {
    if (!indentId) return;
    try {
      await supabase
        .from("purchase_dashboard")
        .delete()
        .eq("indent_id", String(indentId));
      await supabase
        .from("purchase_indent_items")
        .delete()
        .eq("indent_id", indentId);
      await supabase
        .from("purchase_indents")
        .delete()
        .eq("id", indentId);
      console.log(`[Rollback] Cleaned up failed indent creation for ID: ${indentId}`);
    } catch (rbErr) {
      console.error("[Rollback Error] Failed to completely roll back indent:", rbErr);
    }
  },

  /**
   * 2. INDENT DELETION:
   * Deletes ungenerated records from purchase_dashboard before PO generated.
   */
  async syncIndentDeleted(indentId) {
    if (!indentId) return;
    const { error } = await supabase
      .from("purchase_dashboard")
      .delete()
      .eq("indent_id", String(indentId))
      .is("po_id", null);

    if (error) {
      console.error("Failed to delete ungenerated records from purchase_dashboard:", error);
      throw new Error(`Failed to delete audit records: ${error.message}`);
    }
  },

  /**
   * 3. APPROVAL SUBMISSION:
   * Updates approved items (approved, modified, extra added, or rejected).
   */
  async syncApprovalSubmitted({
    targetIndentId,
    itemsToProcess,
    indentStatuses,
    approverEmpCode,
    effectiveCompany,
    currentShopName,
  }) {
    if (!targetIndentId || !itemsToProcess || itemsToProcess.length === 0) return;

    const validItemNames = itemsToProcess.map((i) => i.item_name).filter(Boolean);
    const now = new Date().toISOString();

    // Query existing dashboard rows for this indent
    const { data: existingRows, error: fetchErr } = await supabase
      .from("purchase_dashboard")
      .select("id, item_name, order_box, order_qty")
      .eq("indent_id", String(targetIndentId))
      .in("item_name", validItemNames);

    if (fetchErr) {
      throw new Error(`Failed to query existing dashboard records: ${fetchErr.message}`);
    }

    const existingMap = {};
    (existingRows || []).forEach((row) => {
      existingMap[row.item_name] = row;
    });

    const updatesToRun = [];
    const insertsToRun = [];

    for (const item of itemsToProcess) {
      const status = indentStatuses[item.id];
      const isApproved = status === "approved";
      const isRejected = status === "rejected";

      if (!isApproved && !isRejected) continue; // Untouched items

      const finalApprovedBox =
        item.approved_box !== undefined && item.approved_box !== null
          ? parseFloat(item.approved_box)
          : parseFloat(item.order_box || 0);

      const finalApprovedQty =
        item.approved_qty !== undefined && item.approved_qty !== null
          ? parseFloat(item.approved_qty)
          : parseFloat(item.order_qty || 0);

      const existingRecord = existingMap[item.item_name];
      const existingId = existingRecord?.id;

      let approverAction = "";
      if (isApproved) {
        if (!existingId || parseFloat(item.order_box || 0) === 0) {
          approverAction = "Extra add by approver";
        } else if (
          finalApprovedBox !== parseFloat(item.order_box || 0) ||
          Math.round(finalApprovedQty) !== Math.round(parseFloat(item.order_qty || 0))
        ) {
          approverAction = `Modified by (${approverEmpCode})`;
        } else {
          approverAction = `Approved by (${approverEmpCode})`;
        }
      } else {
        approverAction = `Rejected by (${approverEmpCode})`;
      }

      if (existingId) {
        updatesToRun.push(
          supabase
            .from("purchase_dashboard")
            .update({
              approved_box: isApproved ? finalApprovedBox : null,
              approved_qty: isApproved ? finalApprovedQty : null,
              approver_action: approverAction,
              approver_emp_code: approverEmpCode,
              company_name: effectiveCompany || item.company_name || null,
              approved_at: now,
              is_deleted: isRejected,
              deletion_stage: isRejected ? "approval" : null,
              deletion_reason: isRejected ? "Rejected by Approver" : null,
              deleted_by_emp_code: isRejected ? approverEmpCode : null,
              deleted_at: isRejected ? now : null,
              updated_at: now,
            })
            .eq("id", existingId)
        );
      } else {
        // Extra add by approver that was not in original indent
        insertsToRun.push({
          indent_id: String(targetIndentId),
          shop_name: item.shop_name || currentShopName || "UNKNOWN",
          party_name: item.party_name || "UNKNOWN",
          company_name: effectiveCompany || item.company_name || null,
          item_name: item.item_name,
          order_box: 0,
          order_qty: 0,
          indent_emp_code: null,
          indent_created_at: now,
          approved_box: isApproved ? finalApprovedBox : null,
          approved_qty: isApproved ? finalApprovedQty : null,
          approver_action: approverAction,
          approver_emp_code: approverEmpCode,
          approved_at: now,
          trader_status: "Pending",
          transporter_status: "Pending",
          receiver_status: "Pending",
          is_deleted: isRejected,
          updated_at: now,
        });
      }
    }

    if (insertsToRun.length > 0) {
      const { error: insErr } = await supabase
        .from("purchase_dashboard")
        .insert(insertsToRun);
      if (insErr) {
        throw new Error(`Failed to insert extra approval items to dashboard: ${insErr.message}`);
      }
    }

    if (updatesToRun.length > 0) {
      const updateResults = await Promise.all(updatesToRun);
      for (const res of updateResults) {
        if (res.error) {
          throw new Error(`Failed to update approval records in dashboard: ${res.error.message}`);
        }
      }
    }
  },

  /**
   * Compensating rollback for failed approval submission:
   * Deletes newly inserted approved items and resets indent items back to Pending.
   */
  async rollbackApprovalSubmitted({ insertedApprovedIds, itemIdsToRevert }) {
    try {
      if (insertedApprovedIds && insertedApprovedIds.length > 0) {
        await supabase
          .from("purchase_approved_indent_items")
          .delete()
          .in("id", insertedApprovedIds);
      }
      if (itemIdsToRevert && itemIdsToRevert.length > 0) {
        await supabase
          .from("purchase_indent_items")
          .update({ status: "pending" })
          .in("id", itemIdsToRevert);
      }
      console.log("[Rollback] Cleaned up failed approval submission.");
    } catch (rbErr) {
      console.error("[Rollback Error] Failed to rollback approvals:", rbErr);
    }
  },

  /**
   * 4. PO CREATION:
   * Links PO number, PO box/qty, marks removed items as deleted.
   */
  async syncPurchaseOrderCreated({
    insertedPoId,
    freshPoNumber,
    currentIndentId,
    itemsForActiveParty,
    activeParty,
    currentShopName,
    removedItemIds,
    filteredApprovedItems,
    currentEmpCode,
  }) {
    if (!insertedPoId || !freshPoNumber) return;

    const cleanIndentId = currentIndentId ? currentIndentId.split("::")[0].trim() : null;
    const now = new Date().toISOString();

    for (const item of itemsForActiveParty) {
      const itemTitle = (item.itemName || item.item_name || "").trim();
      if (!itemTitle) continue;

      let existingRow = null;
      if (cleanIndentId) {
        const { data: matchedRows, error: matchErr } = await supabase
          .from("purchase_dashboard")
          .select("id")
          .eq("indent_id", cleanIndentId)
          .eq("item_name", itemTitle)
          .limit(1);

        if (matchErr) {
          throw new Error(`Failed to lookup item in dashboard: ${matchErr.message}`);
        }
        if (matchedRows && matchedRows.length > 0) {
          existingRow = matchedRows[0];
        }
      }

      if (existingRow) {
        const { error: updErr } = await supabase
          .from("purchase_dashboard")
          .update({
            po_id: insertedPoId,
            po_number: freshPoNumber,
            po_box: item.poBox != null ? parseFloat(item.poBox) : null,
            po_qty: item.poQty != null ? parseFloat(item.poQty) : null,
            po_action: item.isDirectAdded ? "Direct Added in PO" : "PO Generated",
            po_emp_code: currentEmpCode,
            po_generated_at: now,
            trader_status: "Pending",
            transporter_status: "Pending",
            receiver_status: "Pending",
            is_deleted: false,
            updated_at: now,
          })
          .eq("id", existingRow.id);

        if (updErr) {
          throw new Error(`Failed to update PO record in dashboard: ${updErr.message}`);
        }
      } else {
        // Direct added item at PO stage
        const { error: insErr } = await supabase
          .from("purchase_dashboard")
          .insert({
            indent_id: cleanIndentId || `PO-${freshPoNumber}`,
            shop_name: currentShopName || "Default",
            company_name: item.companyName || item.company_name || null,
            party_name: activeParty || "UNKNOWN",
            item_name: itemTitle,
            order_box: 0,
            order_qty: 0,
            approved_box: item.approvedBox != null ? parseFloat(item.approvedBox) : 0,
            approved_qty: item.approvedQty != null ? parseFloat(item.approvedQty) : 0,
            po_id: insertedPoId,
            po_number: freshPoNumber,
            po_box: item.poBox != null ? parseFloat(item.poBox) : null,
            po_qty: item.poQty != null ? parseFloat(item.poQty) : null,
            po_action: "Direct Added in PO",
            po_emp_code: currentEmpCode,
            po_generated_at: now,
            trader_status: "Pending",
            transporter_status: "Pending",
            receiver_status: "Pending",
            is_deleted: false,
            indent_created_at: now,
            updated_at: now,
          });

        if (insErr) {
          throw new Error(`Failed to insert Direct Added PO item to dashboard: ${insErr.message}`);
        }
      }
    }

    // Mark items removed/excluded at PO stage as po_action = 'delete'
    if (removedItemIds && removedItemIds.size > 0 && cleanIndentId) {
      const removedItemsList = (filteredApprovedItems || []).filter((i) =>
        removedItemIds.has(i.id)
      );
      for (const remItem of removedItemsList) {
        const remTitle = (remItem.item_name || remItem.itemName || "").trim();
        if (remTitle) {
          const { error: remErr } = await supabase
            .from("purchase_dashboard")
            .update({
              po_action: "delete",
              po_emp_code: currentEmpCode,
              updated_at: now,
            })
            .eq("indent_id", cleanIndentId)
            .eq("item_name", remTitle);

          if (remErr) {
            throw new Error(`Failed to mark dropped item in dashboard: ${remErr.message}`);
          }
        }
      }
    }
  },

  /**
   * Compensating rollback for failed PO creation:
   * Deletes the created PO and resets linked PO IDs in purchase_dashboard.
   */
  async rollbackPurchaseOrderCreated(insertedPoId) {
    if (!insertedPoId) return;
    try {
      await supabase
        .from("purchase_purchase_orders")
        .delete()
        .eq("id", insertedPoId);

      await supabase
        .from("purchase_dashboard")
        .update({
          po_id: null,
          po_number: null,
          po_box: null,
          po_qty: null,
          po_action: null,
          po_emp_code: null,
          po_generated_at: null,
        })
        .eq("po_id", insertedPoId);

      console.log(`[Rollback] Cleaned up failed PO creation for ID: ${insertedPoId}`);
    } catch (rbErr) {
      console.error("[Rollback Error] Failed to rollback PO creation:", rbErr);
    }
  },

  /**
   * 5. DOWNSTREAM PORTAL SUBMISSIONS:
   * Updates trader_status, transporter_status, or receiver_status by po_id.
   */
  async syncPortalStatus({ poId, statusType, statusValue }) {
    if (!poId || !statusType) return;
    const now = new Date().toISOString();
    const updatePayload = { updated_at: now };

    if (statusType === "trader") {
      updatePayload.trader_status = statusValue;
    } else if (statusType === "transporter") {
      updatePayload.transporter_status = statusValue;
    } else if (statusType === "receiver") {
      updatePayload.receiver_status = statusValue;
    }

    const { error } = await supabase
      .from("purchase_dashboard")
      .update(updatePayload)
      .eq("po_id", poId);

    if (error) {
      console.error(`Failed to update ${statusType} status in dashboard:`, error);
      throw new Error(`Failed to update portal status in dashboard: ${error.message}`);
    }
  },
};
