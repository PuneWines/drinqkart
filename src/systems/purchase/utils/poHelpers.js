export const formatINR = (n) =>
  isNaN(n) ? "—" : Number(n).toFixed(2);

export const today = () => {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
};

/**
 * Determines whether the transporter step is skipped / not required for a purchase order.
 * Transporter is skipped if:
 * 1. Remarks indicate "Transporter Bypassed"
 * 2. Shop/Company has `requires_transporter: false` in purchase_company_settings (e.g. BALAJI, Kunal Fine Wine)
 * 3. Shop name matches known bypassed shops (BALAJI, KUNAL)
 * 4. No transporter was selected/assigned (transporter_number is null/empty) and no explicit transporter_pdf_url exists
 */
export const isTransporterSkippedForOrder = (order, companies = []) => {
  if (!order) return true;

  // 1. If explicit bypass is recorded in transporter remarks or status
  if (
    (order.transporter_remarks &&
      (order.transporter_remarks.includes("Bypassed") ||
       order.transporter_remarks.includes("bypassed"))) ||
    order.transporter_status === "bypassed"
  ) {
    return true;
  }

  // 2. If the order has actual transporter details recorded (transporter_number, transporter_pdf_url, or status),
  // then this specific order had a transporter stage, so preserve it regardless of current company settings toggle!
  const hasTransporterDetails = Boolean(
    (order.transporter_number && String(order.transporter_number).trim() !== "" && String(order.transporter_number).trim() !== "null") ||
    (order.transporter_pdf_url && String(order.transporter_pdf_url).trim() !== "") ||
    (order.transporter_status && order.transporter_status !== "null" && order.transporter_status !== "")
  );

  if (hasTransporterDetails) {
    return false; // Order has a real transporter stage -> NOT skipped
  }

  // 3. Check shop / company setting from purchase_company_settings (for orders without transporter details)
  const shopName = (order.shop_name || "").trim().toLowerCase();
  const compName = (order.company_scope || order.company_name || "").trim().toLowerCase();

  const matched = (companies || []).find((c) => {
    const cName = (c.name || "").trim().toLowerCase();
    const cShop = (c.shop_name || "").trim().toLowerCase();
    return (
      (shopName && (cName === shopName || cShop === shopName || cName.includes(shopName) || shopName.includes(cName))) ||
      (compName && (cName === compName || cShop === compName))
    );
  });

  if (matched && matched.requires_transporter === false) {
    return true;
  }

  // 4. Known shops where transporter is skipped by system rule
  if (shopName.includes("kunal") || shopName === "balaji" || shopName.includes("balaji")) {
    if (matched?.requires_transporter !== true) {
      return true;
    }
  }

  // 5. Default fallback: If no transporter was assigned and no transporter details exist
  if (!order.transporter_number || String(order.transporter_number).trim() === "") {
    return true;
  }

  return false;
};

