import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { deleteSupersededLifecycleItems } from "../services/purchaseOrderService";
import { dashboardSyncService } from "../services/dashboardSyncService";
import { 
  FileText, CheckCircle2, Loader2, AlertCircle, 
  ChevronDown, ChevronUp, Check, X, Calendar, 
  Hash, MessageSquare, ArrowRight, ShoppingBag,
  Share2, Download, Copy, ArrowLeft, Clock,
  ShieldCheck, Phone, MapPin, RefreshCw
} from "lucide-react";
import html2pdf from "html2pdf.js";
import useCompanyStore from "../store/useCompanyStore";
import { isTransporterSkippedForOrder } from "../utils/poHelpers";
import "../styles/PurchaseOrder.css"; // Kept solely for off-screen PDF styling

// Company info is loaded dynamically from purchase_company_settings

const TERMS = [
  "We reserve the right to cancel the purchase order anytime before product shipment.",
  "Invoice raised to us should contain the details of purchase order with date mentioned.",
  "Adherence to agreed product specifications is a must. Any deviation during delivery will result in cancellation of PO.",
  "Packing and shipping charges are to be borne by the supplier.",
  "Delivery should be strictly done within 5 days from the date of purchase order.",
];

const formatForDateOnly = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    return `${year}-${month}-${day}`;
  } catch (e) {
    return "";
  }
};

const combineDateWithCurrentTime = (dateStr) => {
  if (!dateStr) return null;
  const now = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  const combined = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  return combined.toISOString();
};

const VendorPortal = () => {
  const { vendorId } = useParams();
  const [vendorName, setVendorName] = useState("Vendor");
  const [companyName, setCompanyName] = useState("");
  const { companies, fetchCompanies } = useCompanyStore();

  useEffect(() => {
    if (!companies || companies.length === 0) {
      fetchCompanies();
    }
  }, [companies, fetchCompanies]);

  const [poList, setPoList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scoped District & Identity Authentication State
  const [vendorData, setVendorData] = useState(null);
  const [authorizedContact, setAuthorizedContact] = useState(null);
  const [authorizedDistrict, setAuthorizedDistrict] = useState(null);
  const [authorizedArea, setAuthorizedArea] = useState(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneAuthError, setPhoneAuthError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const isCompanyScoped = useMemo(() => {
    return Boolean(vendorData?.company_name && vendorData.company_name.trim() !== "");
  }, [vendorData]);

  // Authorization check: If vendor has district contacts, require authorizedDistrict; otherwise require authorizedContact
  const isAuthorized = useMemo(() => {
    if (!vendorData) return false;
    const contacts = Array.isArray(vendorData?.district_contacts) ? vendorData.district_contacts : [];
    if (contacts.length > 0) {
      return Boolean(authorizedDistrict);
    }
    return Boolean(authorizedContact);
  }, [vendorData, authorizedDistrict, authorizedContact]);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setPhoneAuthError("");

    const cleanInput = (phoneInput || "").replace(/\D/g, "");
    if (cleanInput.length < 10) {
      setPhoneAuthError("Please enter a valid 10-digit registered mobile number.");
      return;
    }
    const last10 = cleanInput.slice(-10);

    const contacts = Array.isArray(vendorData?.district_contacts) ? vendorData.district_contacts : [];
    
    // 1. Check if phone matches any registered district contact (for both company-scoped and direct vendors)
    const matchedContact = contacts.find(c => {
      const cPhone = (c.phone || c.contact || c.contact_number || "").replace(/\D/g, "").slice(-10);
      return cPhone && cPhone === last10;
    });

    if (matchedContact && matchedContact.district) {
      const authInfo = {
        isDirect: !isCompanyScoped,
        phone: last10,
        district: matchedContact.district,
        area: matchedContact.area || "",
        name: matchedContact.name || ""
      };
      try {
        if (vendorData?.id) {
          sessionStorage.setItem(`drinqkart_vendor_auth_${vendorData.id}`, JSON.stringify(authInfo));
        }
      } catch (err) {}
      setAuthorizedContact(authInfo);
      setAuthorizedDistrict(matchedContact.district);
      setAuthorizedArea(matchedContact.area || null);

      // Immediately fetch latest POs so pending items appear without requiring a refresh
      setIsVerifying(true);
      try {
        await fetchPortalData(true);
      } finally {
        setIsVerifying(false);
      }
    } else {
      // 2. Fallback: Check primary vendor phone if no district contacts or matching primary contact
      const primaryPhone = (
        vendorData?.contact_number || 
        vendorData?.contact || 
        vendorData?.phone || 
        vendorData?.mobile || 
        ""
      ).replace(/\D/g, "").slice(-10);

      if (contacts.length === 0 && (!primaryPhone || primaryPhone === last10)) {
        const authInfo = {
          isDirect: !isCompanyScoped,
          phone: last10,
          district: null,
          area: "",
          name: vendorData?.contact_name || vendorData?.contact_person || ""
        };
        try {
          if (vendorData?.id) {
            sessionStorage.setItem(`drinqkart_vendor_auth_${vendorData.id}`, JSON.stringify(authInfo));
          }
        } catch (err) {}
        setAuthorizedContact(authInfo);
        setAuthorizedDistrict(null);
        setAuthorizedArea(null);

        setIsVerifying(true);
        try {
          await fetchPortalData(true);
        } finally {
          setIsVerifying(false);
        }
      } else {
        const targetLabel = vendorData?.company_name
          ? `"${vendorData.company_name}"`
          : (contacts.length > 0 ? "any assigned district contact for this supplier" : "this supplier");
        setPhoneAuthError(`Mobile number +91 ${last10} is not registered for ${targetLabel}. Please check your number or contact administration.`);
      }
    }
  };

  const handleLogout = () => {
    if (vendorData?.id) {
      sessionStorage.removeItem(`drinqkart_vendor_auth_${vendorData.id}`);
    }
    setAuthorizedContact(null);
    setAuthorizedDistrict(null);
    setAuthorizedArea(null);
    setPhoneInput("");
    setPhoneAuthError("");
  };
  
  // Expanded PO Tracking
  const [expandedPoId, setExpandedPoId] = useState(null);
  
  // Cache for PO items to avoid multiple fetches
  const [poItems, setPoItems] = useState({});
  const [loadingItems, setLoadingItems] = useState({});
  
  // Form input states mapped by poId
  const [tpNumbers, setTpNumbers] = useState({});
  const [dispatchDates, setDispatchDates] = useState({});
  const [remarks, setRemarks] = useState({});
  
  // Item approvals mapped by poId: { [poId]: { [itemId]: "approved" | "rejected" } }
  const [itemStatuses, setItemStatuses] = useState({});
  
  // Form submission tracking
  const [submittingPoId, setSubmittingPoId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [successPoIds, setSuccessPoIds] = useState({});

  // One-time Submission Preview
  const [previewPoId, setPreviewPoId] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);

  // Active Tab: pending | history
  const [activeTab, setActiveTab] = useState("pending");

  // Filter PO list strictly by authorized district AND area/contact number for company-scoped vendors
  const districtFilteredPoList = useMemo(() => {
    if (!authorizedDistrict) return poList;
    const authDistLower = (authorizedDistrict || "").trim().toLowerCase();
    const authAreaLower = (authorizedArea || "").trim().toLowerCase();
    const authPhoneClean = (authorizedContact?.phone || "").replace(/\D/g, "").slice(-10);

    return poList.filter(po => {
      // 1. Strict District Check
      if (!po.district || !po.district.trim()) return false;
      if (po.district.trim().toLowerCase() !== authDistLower) return false;

      // Extract items to read area & contact phone metadata
      let items = [];
      if (Array.isArray(po.po_items)) {
        items = po.po_items;
      } else if (typeof po.po_items === "string") {
        try {
          const parsed = JSON.parse(po.po_items);
          if (Array.isArray(parsed)) items = parsed;
        } catch (e) {}
      }

      // 2. Identify assigned area & phone for this PO
      const poArea = (
        po.area ||
        items[0]?.vendor_area ||
        items[0]?.area ||
        items.find(it => it && (it.vendor_area || it.area))?.vendor_area ||
        items.find(it => it && (it.vendor_area || it.area))?.area ||
        ""
      ).trim().toLowerCase();

      const rawPoPhone = (
        po.vendor_phone ||
        items[0]?.vendor_phone ||
        items[0]?.vendor_contact ||
        items.find(it => it && (it.vendor_phone || it.vendor_contact))?.vendor_phone ||
        items.find(it => it && (it.vendor_phone || it.vendor_contact))?.vendor_contact ||
        ""
      );
      const poPhoneClean = String(rawPoPhone).replace(/\D/g, "").slice(-10);

      // 3. Strict Phone Matching (if PO has a recorded phone)
      if (poPhoneClean && authPhoneClean) {
        if (poPhoneClean !== authPhoneClean) {
          return false;
        }
      }

      // 4. Strict Area Matching (if PO has a recorded area)
      if (poArea) {
        if (authAreaLower) {
          if (poArea !== authAreaLower) {
            return false;
          }
        } else if (poPhoneClean && authPhoneClean && poPhoneClean !== authPhoneClean) {
          return false;
        }
      }

      return true;
    });
  }, [poList, authorizedDistrict, authorizedArea, authorizedContact]);

  // Memoized filter for pending purchase orders
  const pendingPoList = useMemo(() => {
    return districtFilteredPoList.filter(po => po.trader_status !== "yes" && po.trader_status !== "no" && !successPoIds[po.id]);
  }, [districtFilteredPoList, successPoIds]);

  // Memoized filter for history purchase orders
  const historyPoList = useMemo(() => {
    return districtFilteredPoList.filter(po => po.trader_status === "yes" || po.trader_status === "no" || successPoIds[po.id]);
  }, [districtFilteredPoList, successPoIds]);

  const displayedPoList = activeTab === "pending" ? pendingPoList : historyPoList;

  // Refs for PDF off-screen rendering
  const offscreenRef = useRef(null);
  const [pdfData, setPdfData] = useState(null);

  // Fetch Vendor details and purchase orders
  const fetchPortalData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Ensure companies are loaded for reliable district matching
      if (!companies || companies.length === 0) {
        try { await fetchCompanies(); } catch (e) {}
      }

      // 1. Resolve vendor profile by numeric ID, VN-xxx prefix, or party_name
      let vendorRow = null;
      let vendorErr = null;

      const rawParam = String(vendorId || "").trim();
      let cleanNumeric = rawParam;
      if (cleanNumeric.startsWith("VN-")) {
        cleanNumeric = cleanNumeric.replace("VN-", "").trim();
      }

      const isNumeric = cleanNumeric !== "" && !isNaN(cleanNumeric) && !isNaN(parseInt(cleanNumeric, 10));

      if (isNumeric) {
        const res = await supabase
          .from("purchase_vendors")
          .select("*")
          .eq("id", parseInt(cleanNumeric, 10))
          .limit(1)
          .maybeSingle();
        if (res.data) {
          vendorRow = res.data;
        } else if (res.error) {
          vendorErr = res.error;
        }
      }

      // If not found by numeric ID, fallback to match by party_name or portal_link
      if (!vendorRow) {
        const decodedParam = decodeURIComponent(rawParam).trim();
        const res = await supabase
          .from("purchase_vendors")
          .select("*")
          .or(`party_name.ilike."${decodedParam}",portal_link.ilike."%${decodedParam}%"`)
          .limit(1)
          .maybeSingle();
        if (res.data) {
          vendorRow = res.data;
          vendorErr = null;
        } else if (res.error && !vendorErr) {
          vendorErr = res.error;
        }
      }

      if (vendorErr || !vendorRow) {
        throw new Error(vendorErr?.message || `Vendor profile not found for identifier "${vendorId}".`);
      }

      setVendorName(vendorRow.party_name);
      setCompanyName(vendorRow.company_name || "");

      let contacts = vendorRow.district_contacts;
      if (typeof contacts === "string") {
        try { contacts = JSON.parse(contacts); } catch(e) { contacts = []; }
      }
      if (!Array.isArray(contacts) || contacts.length === 0) {
        try {
          const cached = localStorage.getItem(`drinqkart_vendor_district_contacts_${vendorRow.id}`);
          if (cached) {
            contacts = JSON.parse(cached);
          }
        } catch(e) {}
      }
      const enrichedVendor = {
        ...vendorRow,
        district_contacts: Array.isArray(contacts) ? contacts : []
      };
      setVendorData(enrichedVendor);

      // Check session storage for existing authorization
      try {
        const savedAuth = sessionStorage.getItem(`drinqkart_vendor_auth_${vendorRow.id}`);
        if (savedAuth) {
          const parsed = JSON.parse(savedAuth);
          if (parsed) {
            const contacts = enrichedVendor.district_contacts || [];
            if (contacts.length > 0) {
              let matched = null;
              // 1. Strictly match by phone if phone is present in saved session
              if (parsed.phone) {
                const parsedLast10 = String(parsed.phone).replace(/\D/g, "").slice(-10);
                matched = contacts.find(c => {
                  const cPh = (c.phone || c.contact || c.contact_number || "").replace(/\D/g, "").slice(-10);
                  return cPh && cPh === parsedLast10;
                });
              }
              // 2. If no phone in session or not matched by phone, fallback to district AND area if area is present
              if (!matched && parsed.district && !parsed.phone) {
                matched = contacts.find(c => {
                  const distMatches = (c.district || "").trim().toLowerCase() === parsed.district.trim().toLowerCase();
                  if (parsed.area) {
                    return distMatches && (c.area || "").trim().toLowerCase() === parsed.area.trim().toLowerCase();
                  }
                  return distMatches;
                });
              }

              if (matched && matched.district) {
                setAuthorizedContact({
                  ...parsed,
                  district: matched.district,
                  area: matched.area || parsed.area || "",
                  name: matched.name || parsed.name || ""
                });
                setAuthorizedDistrict(matched.district);
                setAuthorizedArea(matched.area || parsed.area || null);
              } else {
                sessionStorage.removeItem(`drinqkart_vendor_auth_${vendorRow.id}`);
              }
            } else {
              setAuthorizedContact(parsed);
              setAuthorizedDistrict(null);
              setAuthorizedArea(null);
            }
          }
        }
      } catch (e) {}

      const targetParty = (vendorRow.party_name || "").trim();
      const targetCompany = (vendorRow.company_name || "").trim();

      // 3. Fetch POs with strict scoping and safe fallback
      let pos = [];
      try {
        let poQuery = supabase
          .from("purchase_purchase_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (targetCompany) {
          const safeParty = targetParty.replace(/"/g, '""');
          const safeComp = targetCompany.replace(/"/g, '""');
          poQuery = poQuery.or(
            `and(vendor_name.eq."${safeParty}",company_scope.eq."${safeComp}"),and(vendor_name.eq."${safeParty}",filtered_company_name.eq."${safeComp}"),vendor_name.eq."${safeParty}::${safeComp}"`
          );
        } else {
          const safeParty = targetParty.replace(/"/g, '""');
          poQuery = poQuery
            .eq("vendor_name", safeParty)
            .or("company_scope.is.null,company_scope.eq.'',filtered_company_name.is.null,filtered_company_name.eq.''");
        }

        const res = await poQuery;
        if (res.error) {
          console.warn("Scoped PO query with company_scope warning, attempting legacy column fallback:", res.error.message);
          let fallbackQuery = supabase
            .from("purchase_purchase_orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

          if (targetCompany) {
            const safeParty = targetParty.replace(/"/g, '""');
            const safeComp = targetCompany.replace(/"/g, '""');
            fallbackQuery = fallbackQuery.or(
              `and(vendor_name.eq."${safeParty}",filtered_company_name.eq."${safeComp}"),vendor_name.eq."${safeParty}::${safeComp}"`
            );
          } else {
            const safeParty = targetParty.replace(/"/g, '""');
            fallbackQuery = fallbackQuery
              .eq("vendor_name", safeParty)
              .or("filtered_company_name.is.null,filtered_company_name.eq.''");
          }

          const fbRes = await fallbackQuery;
          if (fbRes.error) {
            console.warn("Legacy column query warning, using relaxed fallback:", fbRes.error.message);
            const cleanPartyPart = targetParty.includes("::") ? targetParty.split("::")[0].trim() : targetParty;
            const fallbackRes = await supabase
              .from("purchase_purchase_orders")
              .select("*")
              .ilike("vendor_name", `%${cleanPartyPart}%`)
              .order("created_at", { ascending: false })
              .limit(100);
            pos = fallbackRes.data || [];
          } else {
            pos = fbRes.data || [];
          }
        } else {
          pos = res.data || [];
        }
      } catch (poErr) {
        console.warn("PO fetch caught error, using empty list:", poErr);
        pos = [];
      }

      setPoList(pos || []);

      if (!targetCompany && (pos?.[0]?.company_scope || pos?.[0]?.filtered_company_name)) {
        setCompanyName(pos[0].company_scope || pos[0].filtered_company_name);
      }

      // Initialize form fields for submitted POs
      const newTpNumbers = {};
      const newDispatchDates = {};
      const newRemarks = {};
      const newItemStatuses = {};

      pos?.forEach(po => {
        if (po.trader_status === "yes") {
          newTpNumbers[po.id] = po.tp_number || "";
          newDispatchDates[po.id] = formatForDateOnly(po.dispatch_date);
          newRemarks[po.id] = po.remarks || "";
          newItemStatuses[po.id] = po.trader_item_statuses || {};
        }
      });

      setTpNumbers(prev => ({ ...newTpNumbers, ...prev }));
      setDispatchDates(prev => ({ ...newDispatchDates, ...prev }));
      setRemarks(prev => ({ ...newRemarks, ...prev }));
      setItemStatuses(prev => ({ ...newItemStatuses, ...prev }));

    } catch (err) {
      console.error("Error loading vendor portal data:", err);
      setError(err?.message || "Unable to load portal records. Please check the portal link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchPortalData();
    }

    // Realtime subscription for incoming/updated POs
    const channel = supabase
      .channel(`realtime:vendor_portal_${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_purchase_orders"
        },
        () => {
          fetchPortalData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId]);

  // Fetch PO items when expanding a card
  const handleToggleExpand = async (po) => {
    if (expandedPoId === po.id) {
      setExpandedPoId(null);
      return;
    }

    setExpandedPoId(po.id);

    // If items already loaded, don't fetch again
    if (poItems[po.id]) return;

    // If po has saved po_items, load them directly
    if (po.po_items && Array.isArray(po.po_items) && po.po_items.length > 0) {
      const processed = po.po_items.map(item => ({
        id: item.id,
        itemName: item.itemName || item.item_name,
        brandName: item.brandName || item.brand_name,
        orderQty: item.orderQty !== undefined ? parseFloat(item.orderQty) : parseFloat(item.order_qty || 0),
        orderBox: item.orderBox !== undefined ? parseFloat(item.orderBox) : parseFloat(item.order_box || 0),
        qtyType: item.qtyType,
        displayQty: item.displayQty,
        shopName: item.shopName || item.shop_name || "Unknown"
      }));

      setPoItems(prev => ({ ...prev, [po.id]: processed }));

      // If PO not yet submitted, initialize item statuses to approved
      if (po.trader_status !== "yes" && !itemStatuses[po.id]) {
        const initialStatuses = {};
        processed.forEach(item => {
          initialStatuses[item.id] = "approved";
        });
        setItemStatuses(prev => ({ ...prev, [po.id]: initialStatuses }));
      }
      return;
    }

    try {
      setLoadingItems(prev => ({ ...prev, [po.id]: true }));

      const hasValidIndentId = po.indent_id && String(po.indent_id).trim() !== "" && String(po.indent_id).trim() !== "null" && String(po.indent_id).trim() !== "undefined";
      
      const approvedQuery = hasValidIndentId
        ? supabase.from("purchase_approved_indent_items").select("*").or(`po_id.eq.${po.id},unique_indent_id.eq.${po.indent_id}`).neq("po_status", "excluded")
        : supabase.from("purchase_approved_indent_items").select("*").eq("po_id", po.id).neq("po_status", "excluded");

      const indentQuery = supabase
        .from("purchase_indent_items")
        .select("*")
        .eq("po_id", po.id)
        .neq("po_status", "excluded");

      const [approvedRes, indentRes] = await Promise.all([approvedQuery, indentQuery]);

      if (approvedRes.error) console.error("Error fetching approved items:", approvedRes.error);
      if (indentRes.error) console.error("Error fetching indent items:", indentRes.error);

      const items = [...(approvedRes.data || []), ...(indentRes.data || [])];

      // Filter in-memory by po_id or vendor_name and positive quantity/box
      const filtered = (items || []).filter(item => {
        const isPoMatch = item.po_id && String(item.po_id) === String(po.id);
        const isVendorMatch = item.party_name && po.vendor_name && item.party_name.trim().toLowerCase() === po.vendor_name.trim().toLowerCase();
        
        const box = parseFloat(item.po_box ?? item.approved_box ?? item.order_box ?? 0) || 0;
        const qty = parseFloat(item.po_qty ?? item.approved_qty ?? item.order_qty ?? 0) || 0;

        return (isPoMatch || isVendorMatch) && (box > 0 || qty > 0);
      });

      // Process items to standard shape
      const processed = filtered.map(row => {
        const orderBox = parseFloat(row.po_box ?? row.approved_box ?? row.order_box ?? 0) || 0;
        let orderQty = parseFloat(row.po_qty ?? row.approved_qty ?? row.order_qty ?? 0) || 0;
        const bcs = parseFloat(row.bcs) || 0;
        
        if (orderQty === 0 && orderBox > 0 && bcs > 0) {
          orderQty = orderBox * bcs;
        }

        const qtyType = orderBox >= 0.90 ? "Box" : "Bottles";
        const displayQty = qtyType === "Box" 
          ? Math.round(orderBox).toString() 
          : Math.ceil(orderQty).toString();

        return {
          id: row.id,
          itemName: row.item_name,
          brandName: row.brand_name,
          orderQty,
          orderBox,
          qtyType,
          displayQty,
          shopName: row.shop_name || "Unknown"
        };
      });

      setPoItems(prev => ({ ...prev, [po.id]: processed }));

      // If PO not yet submitted, initialize item statuses to approved
      if (po.trader_status !== "yes" && !itemStatuses[po.id]) {
        const initialStatuses = {};
        processed.forEach(item => {
          initialStatuses[item.id] = "approved";
        });
        setItemStatuses(prev => ({ ...prev, [po.id]: initialStatuses }));
      }

    } catch (err) {
      console.error("Error fetching PO items:", err);
    } finally {
      setLoadingItems(prev => ({ ...prev, [po.id]: false }));
    }
  };

  // Toggle approval decision for a single item
  const handleToggleItemStatus = (poId, itemId) => {
    const currentStatuses = itemStatuses[poId] || {};
    const newStatus = currentStatuses[itemId] === "rejected" ? "approved" : "rejected";
    
    setItemStatuses(prev => ({
      ...prev,
      [poId]: {
        ...currentStatuses,
        [itemId]: newStatus
      }
    }));
  };

  // Helper to extract storage filename from Supabase public URL
  const getFilenameFromUrl = (url) => {
    if (!url) return null;
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  // Handle PO Submission
  const handleSubmitPo = async (e, po, customDecisions = null, customRemarks = null) => {
    if (e) e.preventDefault();
    const poId = po.id;
    setFormErrors(prev => ({ ...prev, [poId]: "" }));

    const dDate = dispatchDates[poId];
    const rem = customRemarks !== null ? customRemarks.trim() : (remarks[poId]?.trim() || "");
    const decisions = customDecisions !== null ? customDecisions : (itemStatuses[poId] || {});

    const items = poItems[poId] || [];
    const allRejected = items.length > 0 && items.every(item => decisions[item.id] === "rejected");

    if (!allRejected && !dDate) {
      setFormErrors(prev => ({ ...prev, [poId]: "Expected Dispatch Date is required." }));
      return;
    }

    const finalDispatchDate = allRejected ? new Date().toISOString() : combineDateWithCurrentTime(dDate);

    setSubmittingPoId(poId);

    try {
      const isTransporterSkipped = isTransporterSkippedForOrder(po, companies);

      const updatePayload = {
        trader_status: allRejected ? "no" : "yes",
        trader_item_statuses: decisions,
        dispatch_date: finalDispatchDate,
        trader_remarks: rem
      };

      if (isTransporterSkipped && !allRejected) {
        updatePayload.transporter_status = "yes";
        updatePayload.pickup_date = finalDispatchDate;
        updatePayload.transporter_remarks = `Transporter Bypassed (${po.shop_name || "Direct Delivery"})`;
      }

      // 2. Perform DB Update
      const { error: dbError } = await supabase
        .from("purchase_purchase_orders")
        .update(updatePayload)
        .eq("id", poId);

      if (dbError) throw dbError;

      // Sync to purchase_dashboard with atomicity
      await dashboardSyncService.syncPortalStatus({
        poId,
        statusType: "trader",
        statusValue: allRejected ? "no" : "yes",
      });

      if (isTransporterSkipped && !allRejected) {
        await dashboardSyncService.syncPortalStatus({
          poId,
          statusType: "transporter",
          statusValue: "yes",
        });
      }

      if (allRejected) {
        const itemNames = items.map(i => i.itemName).filter(Boolean);
        if (po.shop_name && itemNames.length > 0) {
          await deleteSupersededLifecycleItems(po.shop_name, itemNames);
        }
      }

      // 3. Regenerate and Re-upload PDF
      let finalTraderPdfUrl = po.trader_pdf_url;
      try {
        // Fetch detailed vendor data for PDF
        const { data: vDetails } = await supabase
          .from("purchase_vendors")
          .select("*")
          .eq("party_name", po.vendor_name)
          .single();

        // Fetch company details from the `shop` table — same source as PurchaseOrder.jsx
        // The PO's shop_name field identifies which shop this belongs to
        const poShopName = (po.shop_name || items[0]?.shopName || "").trim();
        let matchedCompany = null;

        if (poShopName) {
          const { data: shopRow } = await supabase
            .from("shop")
            .select("id, shop_name, full_name, gstin, contact, email, address")
            .or(`shop_name.ilike.${poShopName},full_name.ilike.${poShopName}`)
            .limit(1)
            .maybeSingle();

          if (shopRow) {
            matchedCompany = {
              name: shopRow.full_name || shopRow.shop_name,
              address: shopRow.address || "",
              gstin: shopRow.gstin || "",
              contact: shopRow.contact || "",
              email: shopRow.email || "",
            };
          }
        }

        // Fallback: try purchase_company_settings if shop table had no match
        if (!matchedCompany) {
          const { data: companiesList } = await supabase.from("purchase_company_settings").select("*");
          const shopNameLower = poShopName.toLowerCase();
          matchedCompany = (companiesList || []).find(c => {
            const compName = (c.name || "").toLowerCase();
            return compName.includes(shopNameLower) || shopNameLower.includes(compName);
          }) || (companiesList && companiesList.length > 0 ? companiesList[0] : null);
        }

        // Set state for PDF generation DOM
        setPdfData({
          po,
          items,
          tpNum: po.tp_number || "",
          dDate: finalDispatchDate,
          remarks: rem,
          decisions,
          vendorDetails: vDetails,
          companyInfo: matchedCompany || null,
          isKunalShop
        });

        // Small delay to allow the DOM to render
        await new Promise(resolve => setTimeout(resolve, 500));

        const docElement = offscreenRef.current;
        if (docElement) {
          docElement.classList.add("pdf-export");
          
          const opt = {
            margin:       0.2,
            filename:     `PO_${po.po_number.replace(/\//g, "_")}_Trader_Transporter.pdf`,
            image:        { type: "jpeg", quality: 1 },
            html2canvas:  { scale: 2, useCORS: true, windowWidth: 1000, width: 1000 },
            jsPDF:        { unit: "in", format: "a4", orientation: "portrait" }
          };

          const pdfBlob = await new Promise((resolve) => {
            html2pdf().set(opt).from(docElement).toContainer().toCanvas().get("canvas").then((canvas) => {
              canvas.toBlob((blob) => {
                resolve(blob);
              }, "image/png");
            });
          });

          docElement.classList.remove("pdf-export");

          // Extract old filename and re-upload (upsert = true)
          const storageFilename = getFilenameFromUrl(po.trader_pdf_url);
          if (storageFilename) {
            const { error: uploadErr } = await supabase.storage
              .from("purchase_PO")
              .upload(storageFilename, pdfBlob, { contentType: "image/png", upsert: true });

            if (uploadErr) throw uploadErr;

            // Get new public URL just in case
            const newUrl = supabase.storage.from("purchase_PO").getPublicUrl(storageFilename).data.publicUrl;
            if (newUrl) {
              finalTraderPdfUrl = newUrl;
              // Update po trader_pdf_url in DB
              await supabase
                .from("purchase_purchase_orders")
                .update({ trader_pdf_url: newUrl })
                .eq("id", poId);
            }
          }
        }
      } catch (pdfErr) {
        console.error("PDF Regeneration failed, continuing with WhatsApp notifications:", pdfErr);
      }

      // 4. Send WhatsApp Messages (Removed to avoid double/spammed notifications)

      setSuccessPoIds(prev => ({ ...prev, [poId]: true }));
      setExpandedPoId(null);
      setPdfData(null);

      // Re-fetch PO list to update UI
      await fetchPortalData();

      // Show submission preview screen immediately
      setPreviewPoId(poId);
      setSubmittedAt(new Date().toISOString());

    } catch (err) {
      console.error("Error submitting vendor portal confirmation:", err);
      setFormErrors(prev => ({ ...prev, [poId]: "Failed to submit. Please try again." }));
    } finally {
      setSubmittingPoId(null);
    }
  };

  const handleApproveAllItems = (poId) => {
    const items = poItems[poId] || [];
    const approvedStatuses = {};
    items.forEach(item => {
      approvedStatuses[item.id] = "approved";
    });
    setItemStatuses(prev => ({
      ...prev,
      [poId]: approvedStatuses
    }));
  };

  const handleRejectEntireOrder = async (po) => {
    const poId = po.id;
    if (!window.confirm(`Are you sure you want to reject the entire Purchase Order (${po.po_number})?`)) {
      return;
    }

    const userRemarks = window.prompt("Optional: Enter remarks/reason for rejecting this entire order:");
    if (userRemarks === null) return; // User cancelled

    const items = poItems[poId] || [];
    const rejectedStatuses = {};
    items.forEach(item => {
      rejectedStatuses[item.id] = "rejected";
    });

    setItemStatuses(prev => ({
      ...prev,
      [poId]: rejectedStatuses
    }));
    setRemarks(prev => ({
      ...prev,
      [poId]: userRemarks
    }));

    await handleSubmitPo(null, po, rejectedStatuses, userRemarks);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-slate-600 font-medium">Loading Vendor Portal dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Portal Error</h2>
        <p className="text-slate-600 max-w-md">{error}</p>
      </div>
    );
  }

  // Verification Gate:
  // - Requires Registered Mobile Number ONLY (Auto-identifies regional district for company-scoped suppliers)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <span className="inline-block bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              Supplier Verification Portal
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {vendorName}
            </h2>
            {companyName ? (
              <p className="text-slate-400 text-xs mt-1 font-medium">
                Company Scope: <span className="text-indigo-300 font-semibold">{companyName}</span>
              </p>
            ) : (
              <p className="text-slate-400 text-xs mt-1 font-medium">
                Direct Supplier Account
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleVerify} className="p-6 sm:p-8 space-y-5">
            {/* Registered Mobile Number Input (Number verification ONLY) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Registered Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone size={18} />
                </div>
                <input
                  type="tel"
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (phoneAuthError) setPhoneAuthError("");
                  }}
                  placeholder="e.g. 9822746825"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {vendorData?.district_contacts?.length > 0
                  ? "Enter the registered mobile number assigned to your regional district."
                  : "Enter your registered 10-digit mobile number."}
              </p>
            </div>

            {phoneAuthError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 text-red-700 text-xs leading-relaxed">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                <span>{phoneAuthError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-75 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying & Loading Orders...</span>
                </>
              ) : (
                <>
                  <span>Verify & Access Orders</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                DRINQKART B2B Purchase Management System &bull; Secure Portal
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (previewPoId) {
    const previewPo = poList.find(p => p.id === previewPoId);
    if (previewPo) {
      return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <SubmissionPreview
              po={previewPo}
              items={poItems[previewPoId] || []}
              vendorName={vendorName}
              companyName={companyName}
              submittedAt={submittedAt}
              onClose={() => {
                setPreviewPoId(null);
                setActiveTab("history");
                setExpandedPoId(previewPoId);
              }}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Portal Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-sm mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{vendorName}</h1>
            <p className="text-slate-400 text-sm mt-1">Supplier Verification Portal</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {companyName && (
              <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                Company: {companyName}
              </span>
            )}
            {authorizedDistrict ? (
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 flex-wrap">
                <MapPin size={13} className="shrink-0 text-emerald-400" />
                <span>District: {authorizedDistrict}</span>
                {(authorizedContact?.area || authorizedArea) && (
                  <span className="bg-emerald-800/90 text-emerald-100 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    Area: {authorizedContact?.area || authorizedArea}
                  </span>
                )}
                {authorizedContact?.name && (
                  <span className="opacity-90 text-[11px] font-medium">({authorizedContact.name})</span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 text-emerald-400 hover:text-white underline text-[11px] font-semibold cursor-pointer"
                  title="Switch District / Sign Out"
                >
                  Switch
                </button>
              </span>
            ) : authorizedContact?.phone ? (
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 flex-wrap">
                <Phone size={13} className="shrink-0 text-emerald-400" />
                <span>Verified: +91 {authorizedContact.phone}</span>
                {(authorizedContact?.area || authorizedArea) && (
                  <span className="bg-emerald-800/90 text-emerald-100 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    Area: {authorizedContact?.area || authorizedArea}
                  </span>
                )}
                {authorizedContact?.name && (
                  <span className="opacity-90 text-[11px] font-medium">({authorizedContact.name})</span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-1 text-emerald-400 hover:text-white underline text-[11px] font-semibold cursor-pointer"
                  title="Sign Out / Switch"
                >
                  Switch
                </button>
              </span>
            ) : null}
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              Vendor: {vendorId}
            </span>
            <button
              type="button"
              onClick={() => fetchPortalData(false)}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Sync latest purchase orders"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Sync Orders</span>
            </button>
          </div>
        </div>

        {/* Success Banner for submissions in current session */}
        {Object.keys(successPoIds).length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 shadow-sm flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 mt-0.5 shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-bold text-emerald-800">Verification Submitted Successfully!</h4>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                Your verification has been recorded, the PO invoice has been updated with your TP number stamp, and the transporter has been notified.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.keys(successPoIds).map((id) => (
                  <span key={id} className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200 shadow-sm">
                    Verified ID: {id}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex bg-white border border-slate-200 rounded-xl p-1.5 w-fit shadow-xs mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab("pending"); setExpandedPoId(null); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === "pending"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Clock size={16} />
            <span>Pending</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "pending"
                  ? "bg-slate-800 text-amber-400"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {pendingPoList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("history"); setExpandedPoId(null); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>History</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "history"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {historyPoList.length}
            </span>
          </button>
        </div>

        {/* PO List */}
        {displayedPoList.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            {activeTab === "pending" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Pending Purchase Orders</h3>
                <p className="text-slate-500 text-sm max-w-md">
                  There are no active purchase orders requiring verification. {historyPoList.length > 0 && (
                    <>You can check your {historyPoList.length} verified order{historyPoList.length > 1 ? "s" : ""} in the <button type="button" onClick={() => setActiveTab("history")} className="font-bold text-indigo-600 hover:underline inline cursor-pointer">History</button> tab.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4 border border-slate-200">
                  <ShoppingBag size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Verification History</h3>
                <p className="text-slate-500 text-sm max-w-md">
                  There are no previously verified or archived purchase orders registered to your supplier profile yet.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPoList.map((po) => {
              const isExpanded = expandedPoId === po.id;
              const isSubmitted = po.trader_status === "yes" || successPoIds[po.id];
              const isRejected = po.trader_status === "no";
              const items = poItems[po.id] || [];
              const isLoadingPoItems = loadingItems[po.id];

              const poItemStatuses = itemStatuses[po.id] || {};
              const allRejected = items.length > 0 && items.every(item => poItemStatuses[item.id] === "rejected");

              // Totals
              const totalQty = po.total_order_qty || 0;
              const totalBox = po.total_order_box || 0;

              const getShopName = () => {
                if (po.shop_name) return po.shop_name;
                let list = po.po_items;
                if (typeof list === "string") {
                  try {
                    list = JSON.parse(list);
                  } catch (e) {
                    list = null;
                  }
                }
                return list?.[0]?.shopName || list?.[0]?.shop_name || "Unknown";
              };
              const shopName = getShopName();

              const getPoArea = () => {
                let list = po.po_items;
                if (typeof list === "string") {
                  try {
                    list = JSON.parse(list);
                  } catch (e) {
                    list = null;
                  }
                }
                const firstWithArea = Array.isArray(list)
                  ? list.find(it => it && (it.vendor_area || it.area))
                  : null;
                return po.area || firstWithArea?.vendor_area || firstWithArea?.area || "";
              };
              const poAreaTag = getPoArea();

              return (
                <div key={po.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                   
                  {/* PO Card Header */}
                  <div 
                    onClick={() => handleToggleExpand(po)}
                    className="p-5 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer select-none gap-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-slate-900">{po.po_number}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(po.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      {/* Info mini-tags */}
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-bold">
                        {shopName}
                      </span>
                      {(po.company_scope || po.filtered_company_name || companyName) && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-bold">
                          {po.company_scope || po.filtered_company_name || companyName}
                        </span>
                      )}
                      {poAreaTag && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold">
                          Area: {poAreaTag}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Status Badges */}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isSubmitted 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : isRejected 
                            ? "bg-red-50 text-red-700 border-red-200" 
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {isSubmitted ? "✓ Confirmed" : isRejected ? "✕ Rejected" : "⏳ Pending Review"}
                      </span>

                      {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* PO Card Body (Expandable) */}
                  {isExpanded && (
                    <div className="px-5 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50 space-y-6">
                      
                      {/* Quick Actions & Original PO Document View Link */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        {!isSubmitted && !isRejected && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveAllItems(po.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              <Check size={14} /> Approve All Items
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectEntireOrder(po)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              <X size={14} /> Reject Entire Order
                            </button>
                          </div>
                        )}
                        {po.trader_pdf_url && (
                          <a 
                            href={po.trader_pdf_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition-colors sm:ml-auto"
                          >
                            <FileText size={16} /> View Current PO Invoice
                          </a>
                        )}
                        {isSubmitted && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewPoId(po.id);
                              setSubmittedAt(po.dispatch_date || po.updated_at || po.created_at);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText size={14} /> View Submission Receipt
                          </button>
                        )}
                      </div>

                      {/* Items Loading State */}
                      {isLoadingPoItems ? (
                        <div className="flex flex-col items-center justify-center py-10">
                          <Loader2 className="animate-spin text-indigo-600" size={24} />
                          <span className="text-slate-500 text-xs mt-2 font-medium">Fetching purchase items...</span>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          
                          {/* Item Verification Table */}
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-sm text-slate-800">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">S.No</th>
                                    <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</th>
                                    <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Order Qty</th>
                                    <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-28">Qty Type</th>
                                    <th className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-56">Verification Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item, index) => {
                                    const itemDec = (itemStatuses[po.id] || {})[item.id] || "approved";
                                    const isItemApproved = itemDec === "approved";

                                    return (
                                      <tr key={item.id} className={`border-b border-slate-100 transition-colors ${isItemApproved ? "hover:bg-slate-50/50" : "bg-red-50/20 hover:bg-red-50/30"}`}>
                                        <td className="p-3 text-center text-slate-500 font-medium">{index + 1}</td>
                                        <td className="p-3">
                                          <strong className="text-slate-900 font-semibold">{item.itemName}</strong>
                                          <div className="text-xs text-slate-500 mt-0.5">{item.brandName} • {item.shopName}</div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-900">{item.displayQty}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs font-semibold">{item.qtyType}</td>
                                        
                                        <td className="p-3 text-center">
                                          {isSubmitted ? (
                                            <span className={`inline-flex items-center gap-1 text-sm font-bold ${isItemApproved ? "text-emerald-600" : "text-red-600"}`}>
                                              {isItemApproved ? <Check size={16} /> : <X size={16} />}
                                              {isItemApproved ? "Approved" : "Rejected"}
                                            </span>
                                          ) : (
                                            <div className="flex justify-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => handleToggleItemStatus(po.id, item.id)}
                                                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                  isItemApproved 
                                                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                                                    : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                                }`}
                                              >
                                                <Check size={14} /> Approve
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleItemStatus(po.id, item.id)}
                                                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                  !isItemApproved 
                                                    ? "bg-red-50 border-red-500 text-red-700 shadow-sm" 
                                                    : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                                                }`}
                                              >
                                                <X size={14} /> Reject
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  {(() => {
                                    const sumBoxes = items.reduce((sum, item) => {
                                      const isBox = (item.qtyType || "").toLowerCase() === "box";
                                      const val = parseFloat(item.displayQty) || parseFloat(item.orderBox) || 0;
                                      return isBox ? sum + val : sum;
                                    }, 0);

                                    const sumBottles = items.reduce((sum, item) => {
                                      const isBottle = (item.qtyType || "").toLowerCase() === "bottles" || (item.qtyType || "").toLowerCase() === "bottle";
                                      const val = parseFloat(item.displayQty) || parseFloat(item.orderQty) || 0;
                                      return isBottle ? sum + val : sum;
                                    }, 0);

                                    const calculatedTotalBoxes = sumBoxes > 0 ? Math.round(sumBoxes) : (Number(po.total_order_box) || 0);
                                    const calculatedTotalBottles = sumBottles > 0 ? Math.round(sumBottles) : (sumBoxes === 0 && Number(po.total_order_qty) > 0 ? Number(po.total_order_qty) : 0);

                                    return (
                                      <tr className="bg-slate-50 border-t-2 border-slate-300 text-slate-900 font-bold">
                                        <td colSpan={2} className="p-3.5 text-right text-xs uppercase tracking-wider text-slate-700 font-bold">
                                          {calculatedTotalBottles > 0 && calculatedTotalBoxes > 0 ? "Total Order:" : "Total Box:"}
                                        </td>
                                        <td className="p-3.5 text-center text-sm font-extrabold text-slate-900">
                                          {calculatedTotalBottles > 0 && calculatedTotalBoxes > 0 ? (
                                            <span>{calculatedTotalBoxes} bx / {calculatedTotalBottles} un</span>
                                          ) : calculatedTotalBoxes > 0 ? (
                                            <span>{calculatedTotalBoxes}</span>
                                          ) : (
                                            <span>{calculatedTotalBottles}</span>
                                          )}
                                        </td>
                                        <td className="p-3.5 text-center text-xs font-bold text-slate-600">
                                          {calculatedTotalBottles > 0 && calculatedTotalBoxes > 0 ? "Mixed" : calculatedTotalBoxes > 0 ? "Box" : "Bottles"}
                                        </td>
                                        <td className="p-3.5 text-center text-xs font-semibold text-slate-500">
                                          {isSubmitted ? (
                                            <div className="inline-flex items-center gap-1.5 justify-center">
                                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold">
                                                {items.filter(it => (itemStatuses[po.id] || {})[it.id] === "approved").length} Approved
                                              </span>
                                              {items.some(it => (itemStatuses[po.id] || {})[it.id] === "rejected") && (
                                                <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs font-bold">
                                                  {items.filter(it => (itemStatuses[po.id] || {})[it.id] === "rejected").length} Rejected
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 font-normal">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tfoot>
                              </table>
                            </div>
                          </div>

                          {/* Submission Fields Section */}
                          {isSubmitted ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
                                Submitted Verification Details
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">TP Number</span>
                                  <strong className="text-slate-900 font-semibold">{tpNumbers[po.id] || po.tp_number || "—"}</strong>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Expected Dispatch Date & Time</span>
                                  <strong className="text-slate-900 font-semibold">
                                    {dispatchDates[po.id] || po.dispatch_date ? new Date(dispatchDates[po.id] || po.dispatch_date).toLocaleString("en-IN", { 
                                      day: "2-digit", month: "short", year: "numeric",
                                      hour: "2-digit", minute: "2-digit", hour12: true
                                    }) : "—"}
                                  </strong>
                                </div>
                                {(remarks[po.id] || po.remarks) && (
                                  <div className="col-span-1 sm:col-span-2 space-y-0.5 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Remarks</span>
                                    <p className="text-slate-700 text-sm mt-1">{remarks[po.id] || po.remarks}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : isRejected ? (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm space-y-3">
                              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider border-b border-red-200 pb-2">
                                Order Rejection Summary
                              </h4>
                              <p className="text-sm text-red-700">
                                This purchase order was marked as rejected by the supplier.
                              </p>
                              {(remarks[po.id] || po.remarks) && (
                                <div className="space-y-0.5 pt-2 border-t border-red-200">
                                  <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider block">Remarks</span>
                                  <p className="text-red-900 text-sm mt-1">{remarks[po.id] || po.remarks}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <form 
                              onSubmit={(e) => handleSubmitPo(e, po)} 
                              className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-5"
                            >
                              <h4 className="text-sm font-bold text-slate-950 border-b border-slate-200 pb-2">
                                Enter PO Dispatch Verification
                              </h4>

                              {formErrors[po.id] && (
                                <div className="bg-red-50 border border-red-200 text-red-800 text-sm font-medium p-3.5 rounded-lg flex items-center gap-2">
                                  <AlertCircle size={16} />
                                  <span>{formErrors[po.id]}</span>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <Calendar size={15} className="text-slate-400" /> Expected Dispatch Date {allRejected ? "" : "*"}
                                </label>
                                <input
                                  type="date"
                                  required={!allRejected}
                                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold disabled:bg-slate-100 disabled:cursor-not-allowed"
                                  value={allRejected ? "" : (dispatchDates[po.id] || "")}
                                  onChange={(e) => setDispatchDates(prev => ({ ...prev, [po.id]: e.target.value }))}
                                  min={formatForDateOnly(new Date())}
                                  disabled={allRejected}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <MessageSquare size={15} className="text-slate-400" /> Additional Remarks (Optional)
                                </label>
                                <textarea
                                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                  rows={3}
                                  placeholder="Any remarks, packaging details or loading notes..."
                                  value={remarks[po.id] || ""}
                                  onChange={(e) => setRemarks(prev => ({ ...prev, [po.id]: e.target.value }))}
                                />
                              </div>

                              <button 
                                type="submit" 
                                className={`w-full py-3.5 px-6 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all duration-200 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer ${
                                  allRejected ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                                }`}
                                disabled={submittingPoId === po.id}
                              >
                                {submittingPoId === po.id ? (
                                  <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>{allRejected ? "Rejecting PO..." : "Regenerating PO & Notifying Transporter..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>{allRejected ? "Reject Entire PO" : "Submit PO"}</span>
                                    <ArrowRight size={18} />
                                  </>
                                )}
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Offscreen PO Renderer for PDF Regeneration ── */}
      {pdfData && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
          <div 
            ref={offscreenRef} 
            className="po-document" 
            id={`pdf-trader-portal-${pdfData.po.id}`}
            style={{ width: "1000px", padding: "32px", background: "white" }}
          >
            {/* PO Header */}
            <div className="po-header-area">
              <div className="po-logo-block">
                <div className="po-logo-icon" style={{ backgroundColor: "#0052cc", display: "flex", alignItems: "center", justifyItems: "center" }}>
                  <ShoppingBag size={24} color="#fff" />
                </div>
                <div className="po-company-info">
                  <h1 style={{ fontSize: "1.5rem", fontWeight: "700", margin: 0 }}>{pdfData.companyInfo?.name || "—"}</h1>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#5e6c84" }}>{pdfData.companyInfo?.address || ""}</p>
                </div>
              </div>

              <div className="po-header-right">
                <h1 style={{ color: "#0052cc", fontSize: "1.35rem", textTransform: "uppercase", margin: 0 }}>Purchase Order</h1>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#64748b", margin: "4px 0 8px 0" }}>TRADER & TRANSPORTER COPY</div>
                <table className="po-meta-table">
                  <tbody>
                    <tr>
                      <td>PO No:</td>
                      <td>{pdfData.po.po_number}</td>
                    </tr>
                    <tr>
                      <td>PO Date:</td>
                      <td>{new Date(pdfData.po.created_at).toLocaleDateString("en-IN")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vendor & Ship To Row */}
            <div className="po-boxes-row">
              <div className="po-box">
                <div className="po-box-header">Vendor</div>
                <div className="po-box-body">
                  <strong>{pdfData.po.vendor_name}</strong><br />
                  Address: {pdfData.vendorDetails?.address || "—"}<br />
                  GSTIN: {pdfData.vendorDetails?.gstin || "—"}<br />
                  Contact: {pdfData.vendorDetails?.contact || "—"}<br />
                  Email: {pdfData.vendorDetails?.email || "—"}
                </div>
              </div>

              <div className="po-box">
                <div className="po-box-header">Ship To</div>
                <div className="po-box-body">
                  <strong>{pdfData.companyInfo?.name || "—"}</strong><br />
                  {pdfData.companyInfo?.address || ""}<br />
                  GSTIN: {pdfData.companyInfo?.gstin || "—"}<br />
                  Contact: {pdfData.companyInfo?.contact || "—"}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="po-items-table">
              <thead>
                <tr>
                  <th className="po-text-center">S.No</th>
                  <th>Shop Name</th>
                  <th>Item Name</th>
                  <th className="po-text-center">Order Qty (Boxes)</th>
                  <th className="po-text-center">Order Qty (Bottles)</th>
                  <th className="po-text-center">Qty Type</th>
                  <th className="po-text-center">Verification</th>
                </tr>
              </thead>
              <tbody>
                {pdfData.items.map((item, index) => {
                  const itemDec = pdfData.decisions[item.id] || "approved";
                  const isItemApproved = itemDec === "approved";

                  return (
                    <tr key={item.id}>
                      <td className="po-text-center">{index + 1}</td>
                      <td><strong>{item.shopName}</strong></td>
                      <td><strong>{item.itemName}</strong></td>
                      <td className="po-text-center">{item.qtyType === "Box" ? item.displayQty : "—"}</td>
                      <td className="po-text-center">{item.qtyType === "Bottles" ? item.displayQty : "—"}</td>
                      <td className="po-text-center" style={{ color: "#64748b" }}>{item.qtyType}</td>
                      <td className="po-text-center" style={{ fontWeight: "700", color: isItemApproved ? "#16a34a" : "#dc2626" }}>
                        {isItemApproved ? "Approved" : "Rejected"}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: "bold", borderTop: "2px solid #94a3b8", backgroundColor: "#f8fafc" }}>
                  <td colSpan={3} style={{ textAlign: "right", padding: "10px 16px" }}>Total:</td>
                  <td className="po-text-center" style={{ color: "#1e1b4b" }}>
                    {pdfData.po.total_order_box}
                  </td>
                  <td className="po-text-center" style={{ color: "#1e1b4b" }}>
                    {pdfData.po.total_order_qty.toLocaleString("en-IN")}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>

            {/* Verification Stamp Section */}
            <div style={{
              marginTop: "24px", border: "2px solid #10b981", borderRadius: "8px",
              padding: "16px", backgroundColor: "#f0fdf4", display: "grid",
              gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px"
            }}>
              <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid #bbf7d0", paddingBottom: "8px" }}>
                <h4 style={{ margin: 0, color: "#166534", fontSize: "14px", textTransform: "uppercase", fontWeight: "700" }}>
                  Supplier Dispatch Verification details
                </h4>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "#166534", textTransform: "uppercase", fontWeight: "700" }}>TP Number:</span>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#14532d" }}>{pdfData.tpNum}</div>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "#166534", textTransform: "uppercase", fontWeight: "700" }}>Expected Dispatch Date & Time:</span>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#14532d" }}>
                  {pdfData.dDate ? new Date(pdfData.dDate).toLocaleString("en-IN", { 
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit", hour12: true
                  }) : "—"}
                </div>
              </div>
              {pdfData.remarks && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "10px", color: "#166534", textTransform: "uppercase", fontWeight: "700" }}>Supplier Remarks:</span>
                  <div style={{ fontSize: "13px", color: "#14532d" }}>{pdfData.remarks}</div>
                </div>
              )}
            </div>

            {/* Signature Section */}
            <div className="po-footer-section" style={{ marginTop: "24px" }}>
              <div className="po-terms-block">
                <h4 style={{ fontSize: "0.85rem", margin: "0 0 6px 0" }}>Terms and conditions:</h4>
                <ol style={{ fontSize: "0.75rem", paddingLeft: "16px", color: "#5e6c84" }}>
                  {TERMS.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>

              <div className="po-signature-block">
                <div className="po-signature-body" style={{ height: "60px", borderBottom: "1px solid #172b4d" }}></div>
                <div className="po-signature-header" style={{ fontSize: "0.85rem" }}>For {pdfData.companyInfo?.name || ""}</div>
                <div className="po-signature-sub" style={{ fontSize: "0.7rem", color: "#5e6c84" }}>Authorized signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SubmissionPreview = ({ po, items, vendorName, companyName, submittedAt, onClose }) => {
  const [copiedId, setCopiedId] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(po.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleShare = async () => {
    const shareText = `Vendor Submission Details:\nPO Number: ${po.po_number}\nVendor: ${vendorName}\nStatus: ${po.trader_status === 'yes' ? 'Confirmed' : 'Rejected'}\nTP Number: ${po.tp_number || 'N/A'}\nDispatch Date: ${po.dispatch_date ? new Date(po.dispatch_date).toLocaleString('en-IN') : 'N/A'}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `PO Submission - ${po.po_number}`,
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.warn("Share failed:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // 1. If official generated Trader PDF URL exists, open/download it directly
      if (po.trader_pdf_url) {
        const win = window.open(po.trader_pdf_url, "_blank");
        if (!win || win.closed || typeof win.closed === "undefined") {
          // Fallback if popup is blocked by browser: trigger anchor tag download/open
          const link = document.createElement("a");
          link.href = po.trader_pdf_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setIsGeneratingPdf(false);
        return;
      }

      // 2. Otherwise capture submission card
      const element = document.getElementById("submission-preview-card");
      if (!element) {
        window.print();
        setIsGeneratingPdf(false);
        return;
      }
      
      const opt = {
        margin:       0.3,
        filename:     `Submission_${(po.po_number || "PO").replace(/\//g, "_")}.pdf`,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: "in", format: "letter", orientation: "portrait" }
      };

      const h2p = typeof html2pdf === "function" ? html2pdf : html2pdf?.default;
      if (h2p) {
        // Run with safety timeout fallback to window.print if html2pdf hangs
        const savePromise = h2p().set(opt).from(element).save();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("PDF generation timeout")), 4000)
        );
        await Promise.race([savePromise, timeoutPromise]);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn("PDF capture failed or timed out, triggering system print fallback:", err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isConfirmed = po.trader_status === "yes";
  const formattedSubmittedAt = submittedAt 
    ? new Date(submittedAt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
      }) 
    : "—";

  const totalQty = po.total_order_qty || 0;
  const totalBox = po.total_order_box || 0;

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto py-2">
      {/* Action Bar (Top) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClose?.();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-all cursor-pointer border border-slate-200"
        >
          <ArrowLeft size={16} /> Back to Portal
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer relative"
          >
            <Copy size={14} /> 
            {copiedId ? "Copied!" : "Copy ID"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Share2 size={14} />
            {shareSuccess ? "Link Copied!" : "Share"}
          </button>
          {po.trader_pdf_url && (
            <a
              href={po.trader_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              <FileText size={14} /> PO Invoice
            </a>
          )}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-75"
          >
            <Download size={14} /> {isGeneratingPdf ? "Opening..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Main Preview Card */}
      <div 
        id="submission-preview-card" 
        className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden transition-all p-6 md:p-8 space-y-8"
      >
        {/* Banner */}
        <div className={`p-6 rounded-2xl flex flex-col items-center text-center gap-3 ${
          isConfirmed 
            ? "bg-emerald-50/80 border border-emerald-100" 
            : "bg-red-50/80 border border-red-100"
        }`}>
          <div className={`p-3 rounded-full ${
            isConfirmed ? "bg-emerald-100 text-emerald-600 animate-pulse" : "bg-red-100 text-red-600"
          }`}>
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h2 className={`text-xl font-extrabold ${isConfirmed ? "text-emerald-950" : "text-red-950"}`}>
              {isConfirmed ? "Submission Confirmed" : "Submission Rejected"}
            </h2>
            <p className={`text-sm font-semibold mt-1 max-w-md ${isConfirmed ? "text-emerald-800" : "text-red-800"}`}>
              {isConfirmed 
                ? "Your expected dispatch date and verification details have been successfully recorded."
                : "This Purchase Order has been marked as rejected."}
            </p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
            isConfirmed 
              ? "bg-emerald-100/80 text-emerald-800 border-emerald-300" 
              : "bg-red-100/80 text-red-800 border-red-300"
          }`}>
            {isConfirmed ? "Confirmed Successfully" : "Order Rejected"}
          </span>
        </div>

        {/* Info Grid (Responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">PO Number</span>
                <strong className="text-slate-900 font-bold text-sm block mt-0.5">{po.po_number}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Shop Name</span>
                <strong className="text-slate-900 font-bold text-sm block mt-0.5">{po.shop_name || "N/A"}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Supplier Name</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <strong className="text-slate-900 font-bold text-sm block">{vendorName}</strong>
                  {(companyName || po.company_scope || po.filtered_company_name) && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-md text-xs font-bold">
                      {companyName || po.company_scope || po.filtered_company_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Submission Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Timestamp</span>
                <div className="flex items-center gap-1 mt-0.5 text-slate-700 text-sm font-semibold">
                  <Clock size={14} className="text-slate-400" />
                  <span>{formattedSubmittedAt}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Submission ID</span>
                <span className="text-xs font-mono text-slate-500 block mt-0.5 select-all truncate max-w-[150px]" title={po.id}>
                  {po.id}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Status Code</span>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5 uppercase">
                  {po.trader_status === "yes" ? "TRADER_CONFIRMED" : "TRADER_REJECTED"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification details */}
        {isConfirmed && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
              Verification Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">TP Number</span>
                <strong className="text-slate-900 font-bold text-sm block mt-1 break-words">
                  {po.tp_number || "—"}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Expected Dispatch Date & Time</span>
                <strong className="text-slate-900 font-bold text-sm block mt-1">
                  {po.dispatch_date ? new Date(po.dispatch_date).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit", hour12: true
                  }) : "—"}
                </strong>
              </div>
              {po.remarks && (
                <div className="sm:col-span-2 border-t border-slate-200/60 pt-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Remarks / Notes</span>
                  <p className="text-slate-700 text-sm mt-1 whitespace-pre-wrap break-words leading-relaxed">
                    {po.remarks}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rejection Details */}
        {!isConfirmed && po.remarks && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-800 border-b border-red-200 pb-2">
              Rejection Details
            </h3>
            <div className="mt-3">
              <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider block">Reason for Rejection</span>
              <p className="text-red-950 text-sm mt-1 whitespace-pre-wrap break-words leading-relaxed font-medium">
                {po.remarks}
              </p>
            </div>
          </div>
        )}

        {/* Verified Items List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Items ({items.length})</h3>
            <span className="text-xs text-slate-500 font-bold">
              Total Qty: {totalQty} Bottles {totalBox > 0 ? `(${totalBox} Boxes)` : ""}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="divide-y divide-slate-200/60">
              {items.map((item, index) => {
                const itemDec = (po.trader_item_statuses || {})[item.id] || "approved";
                const isItemApproved = itemDec === "approved";

                return (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-slate-400 mt-0.5">{index + 1}</span>
                      <div>
                        <strong className="text-slate-900 font-bold text-sm block">{item.itemName}</strong>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          {item.brandName} • {item.shopName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Qty / Unit</span>
                        <strong className="text-slate-950 font-bold text-sm">
                          {item.displayQty} {item.qtyType}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold">
                        {isItemApproved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <Check size={12} strokeWidth={3} /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 bg-red-100/80 border border-red-200 px-2.5 py-1 rounded-full">
                            <X size={12} strokeWidth={3} /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            SUPPLIER VERIFICATION PORTAL • SHOT FOR RECORD
          </p>
        </div>
      </div>

      {/* Action Bar (Bottom) */}
      <div className="print:hidden flex justify-center pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClose?.();
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Return to Portal Dashboard
        </button>
      </div>
    </div>
  );
};

export default VendorPortal;
