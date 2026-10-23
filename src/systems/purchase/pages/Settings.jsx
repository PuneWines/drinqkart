import React, { useState, useEffect, useMemo, useRef } from "react";
import useAuthStore from "../store/useAuthStore";
import useVendorStore from "../store/useVendorStore";
import useCompanyStore from "../store/useCompanyStore";
import {
  Plus,
  Trash2,
  Edit2,
  Shield,
  Settings as SettingsIcon,
  Search,
  Copy,
  Check,
  Truck,
  UserCheck,
  Package,
  ShoppingBag,
  AlertCircle,
  Loader2,
  X,
  MapPin,
  Phone,
  User,
  Mail,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import districtService from "../services/districtService";
import "../styles/Settings.css";

// Skeleton Table Rows Loader
const SkeletonTableRows = ({ columns = 6, rows = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, rIdx) => (
      <tr key={rIdx} className="border-b border-slate-100">
        {Array.from({ length: columns }).map((__, cIdx) => (
          <td key={cIdx} className="px-6 py-4 whitespace-nowrap">
            <div
              className="h-4 bg-slate-200/80 rounded-md animate-pulse"
              style={{
                width:
                  cIdx === 0
                    ? "75%"
                    : cIdx === 1
                      ? "50%"
                      : cIdx === columns - 1
                        ? "40%"
                        : `${40 + ((rIdx * 7 + cIdx * 11) % 5) * 10}%`,
              }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const Settings = ({ readOnly = false }) => {
  const { users, fetchUsers, updateUser, createUser, deleteUser, currentUser } =
    useAuthStore();
  const {
    vendors,
    fetchVendors,
    updateVendor,
    createVendor,
    deleteVendor,
    loading: vendorStoreLoading,
  } = useVendorStore();
  const {
    companies,
    fetchCompanySettings,
    createCompany,
    updateCompany,
    deleteCompany,
    loading: companyStoreLoading,
  } = useCompanyStore();

  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingTransporters, setLoadingTransporters] = useState(true);
  const [loadingReceivers, setLoadingReceivers] = useState(true);

  const [activeTab, setActiveTab] = useState("vendors");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [transporterSearchQuery, setTransporterSearchQuery] = useState("");
  const [receiverSearchQuery, setReceiverSearchQuery] = useState("");
  const [districtSearchQuery, setDistrictSearchQuery] = useState("");
  const [availableParties, setAvailableParties] = useState([]);
  const [vendorPartyCompanyMap, setVendorPartyCompanyMap] = useState({});
  const [hoverDistrictPreview, setHoverDistrictPreview] = useState(null);
  const [copiedContactPhone, setCopiedContactPhone] = useState(null);
  const hoverDistrictTimerRef = useRef(null);
  const hoverDistrictPreviewRef = useRef(null);
  hoverDistrictPreviewRef.current = hoverDistrictPreview;

  // User Form State
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    permissions: [],
  });

  // Vendor Form State
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [isVendorSubmitting, setIsVendorSubmitting] = useState(false);
  const [isCustomParty, setIsCustomParty] = useState(false);
  const [vendorFormData, setVendorFormData] = useState({
    party_name: "",
    address: "",
    gstin: "",
    contact_name: "",
    contact_number: "",
    email: "",
    company_name: "",
    terms: [],
    district_contacts: [],
  });

  // Company Form State
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    name: "",
    address: "",
    gstin: "",
    contact: "",
    email: "",
    district: "",
    terms: [],
    requires_transporter: true,
  });

  // District Form State
  const [districts, setDistricts] = useState([]);
  const [showDistrictForm, setShowDistrictForm] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [isDistrictSubmitting, setIsDistrictSubmitting] = useState(false);
  const [districtFormData, setDistrictFormData] = useState({ name: "" });

  // Transporter Form State
  const [transporters, setTransporters] = useState([]);
  const [showTransporterForm, setShowTransporterForm] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState(null);
  const [isTransporterSubmitting, setIsTransporterSubmitting] = useState(false);
  const [transporterFormData, setTransporterFormData] = useState({
    name: "",
    contact_number: "",
  });

  // Receiver Form State
  const [receivers, setReceivers] = useState([]);
  const [showReceiverForm, setShowReceiverForm] = useState(false);
  const [editingReceiver, setEditingReceiver] = useState(null);
  const [isReceiverSubmitting, setIsReceiverSubmitting] = useState(false);
  const [receiverFormData, setReceiverFormData] = useState({
    name: "",
    contact_number: "",
  });

  const isVendorsLoading = loadingVendors || (vendorStoreLoading && vendors.length === 0);
  const isCompaniesLoading = loadingCompanies || (companyStoreLoading && companies.length === 0);
  const isDistrictsLoading = loadingDistricts && districts.length === 0;
  const isTransportersLoading = loadingTransporters && transporters.length === 0;
  const isReceiversLoading = loadingReceivers && receivers.length === 0;

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      try {
        await Promise.allSettled([
          (async () => {
            try {
              setLoadingVendors(true);
              await fetchVendors();
            } finally {
              if (isMounted) setLoadingVendors(false);
            }
          })(),
          (async () => {
            try {
              setLoadingCompanies(true);
              await fetchCompanySettings();
            } finally {
              if (isMounted) setLoadingCompanies(false);
            }
          })(),
          fetchDistricts(),
          fetchTransporters(),
          fetchReceivers(),
          fetchUsers(),
          fetchAvailableParties(),
        ]);
      } catch (err) {
        console.error("Error loading settings data:", err);
      }
    };
    loadAll();
    return () => {
      isMounted = false;
    };
  }, [fetchUsers, fetchVendors, fetchCompanySettings]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        hoverDistrictPreview &&
        !e.target.closest(".district-popover-container") &&
        !e.target.closest(".district-badge-trigger")
      ) {
        setHoverDistrictPreview(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [hoverDistrictPreview]);

  const fetchDistricts = async () => {
    try {
      const data = await districtService.getDistricts();
      if (data) setDistricts(data);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const fetchTransporters = async () => {
    try {
      const { data } = await supabase
        .from("purchase_transporters")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTransporters(data);
    } finally {
      setLoadingTransporters(false);
    }
  };

  const fetchReceivers = async () => {
    try {
      const { data } = await supabase
        .from("purchase_receivers")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setReceivers(data);
    } finally {
      setLoadingReceivers(false);
    }
  };

  const fetchAvailableParties = async () => {
    try {
      const fetchWithFallback = async (table) => {
        let res = await supabase
          .from(table)
          .select(
            "party_name, company_name, company_scope, filtered_company_name, purchase_indents(shop_name)",
          )
          .not("party_name", "is", null);
        if (res.error) {
          res = await supabase
            .from(table)
            .select(
              "party_name, company_name, filtered_company_name, purchase_indents(shop_name)",
            )
            .not("party_name", "is", null);
        }
        return res;
      };

      const [res1, res2] = await Promise.all([
        fetchWithFallback("purchase_indent_items"),
        fetchWithFallback("purchase_approved_indent_items"),
      ]);

      const combined = [...(res1.data || []), ...(res2.data || [])];

      const partyList = combined
        .map((d) => d.party_name?.trim())
        .filter(Boolean);
      vendors.forEach((v) => {
        if (v.party_name && v.party_name.trim())
          partyList.push(v.party_name.trim());
      });
      const uniqueParties = [...new Set(partyList)].sort();
      setAvailableParties(uniqueParties);

      // Build mapping of party_name -> associated companies & shops
      const mapping = {};
      combined.forEach((item) => {
        const partyKey = (item.party_name || "").trim().toLowerCase();
        if (!partyKey) return;
        if (!mapping[partyKey]) {
          mapping[partyKey] = {
            explicitCompanies: new Set(),
            shops: new Set(),
          };
        }
        const compScope = (
          item.company_scope ||
          item.filtered_company_name ||
          ""
        ).trim();
        if (compScope) {
          mapping[partyKey].explicitCompanies.add(compScope);
        }
        if (item.company_name && item.company_name.trim()) {
          mapping[partyKey].explicitCompanies.add(item.company_name.trim());
        }
        const shop = item.purchase_indents?.shop_name;
        if (
          shop &&
          typeof shop === "string" &&
          shop.trim() &&
          shop.toLowerCase() !== "all"
        ) {
          mapping[partyKey].shops.add(shop.trim());
        }
      });

      // Also register any company_name from existing vendors
      vendors.forEach((v) => {
        const partyKey = (v.party_name || "").trim().toLowerCase();
        if (!partyKey) return;
        if (!mapping[partyKey]) {
          mapping[partyKey] = {
            explicitCompanies: new Set(),
            shops: new Set(),
          };
        }
        if (v.company_name && v.company_name.trim()) {
          mapping[partyKey].explicitCompanies.add(v.company_name.trim());
        }
      });

      setVendorPartyCompanyMap(mapping);
    } catch (error) {
      console.error(
        "Error fetching available parties and company mappings:",
        error,
      );
    }
  };

  const availableCompaniesForVendor = useMemo(() => {
    const selectedParty = (vendorFormData.party_name || "")
      .trim()
      .toLowerCase();
    const companySet = new Set();

    // 1. Existing vendors configured in ledger with this same party_name
    if (selectedParty) {
      vendors.forEach((v) => {
        if (
          (v.party_name || "").trim().toLowerCase() === selectedParty &&
          v.company_name?.trim()
        ) {
          companySet.add(v.company_name.trim());
        }
      });
    }

    // 2. Explicit company/brand names associated with this party from indents
    if (selectedParty && vendorPartyCompanyMap[selectedParty]) {
      (vendorPartyCompanyMap[selectedParty].explicitCompanies || []).forEach(
        (name) => {
          if (name && name.trim()) companySet.add(name.trim());
        },
      );
    }

    // 3. Current vendorFormData.company_name (if already assigned to this vendor, e.g. BUDWEISER)
    if (vendorFormData.company_name && vendorFormData.company_name.trim()) {
      companySet.add(vendorFormData.company_name.trim());
    }

    return Array.from(companySet).sort();
  }, [
    vendors,
    vendorPartyCompanyMap,
    vendorFormData.party_name,
    vendorFormData.company_name,
  ]);

  const allAvailableParties = useMemo(() => {
    const partySet = new Set(availableParties);
    (vendors || []).forEach((v) => {
      if (v.party_name && v.party_name.trim()) partySet.add(v.party_name.trim());
    });
    if (vendorFormData.party_name && vendorFormData.party_name.trim()) {
      partySet.add(vendorFormData.party_name.trim());
    }
    return Array.from(partySet).sort((a, b) => a.localeCompare(b));
  }, [availableParties, vendors, vendorFormData.party_name]);

  const allPermissions = [
    { key: "dashboard", label: "Dashboard" },
    { key: "indent", label: "Indent" },
    { key: "approval", label: "Approval" },
    { key: "po", label: "Purchase Order" },
    { key: "po_history", label: "PO History" },
    { key: "trader_verification", label: "Trader Verification" },
    { key: "transporter_verification", label: "Transporter Verification" },
    { key: "receiving", label: "Receiving" },
    { key: "orders_pipeline", label: "Orders Pipeline" },
    { key: "setting", label: "Settings" },
  ];

  // --- USER HANDLERS ---
  const handleEdit = (user) => {
    setEditingUser(user.id);
    setFormData({
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role,
      permissions: user.permissions || [],
    });
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setFormData({
      username: "",
      email: "",
      password: "",
      role: "user",
      permissions: [],
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    let res;
    if (editingUser) {
      res = await updateUser(editingUser, formData);
    } else {
      res = await createUser(formData);
    }

    setIsSubmitting(false);

    if (res.success) {
      alert(`User ${editingUser ? "updated" : "created"} successfully!`);
      setShowForm(false);
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handlePermissionChange = (permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleDelete = async (userId) => {
    if (userId === currentUser?.id) {
      alert("Cannot delete your own account!");
      return;
    }
    if (window.confirm("Are you sure you want to delete this user?")) {
      const res = await deleteUser(userId);
      if (res.success) {
        alert("User deleted successfully!");
      } else {
        alert(`Error deleting user: ${res.error}`);
      }
    }
  };

  // --- VENDOR HANDLERS ---
  const getDistrictAreas = (distOrName) => {
    if (!distOrName) return [];
    const dObj =
      typeof distOrName === "object"
        ? distOrName
        : districts.find(
            (d) =>
              (d.name || "").trim().toLowerCase() ===
              String(distOrName).trim().toLowerCase(),
          );
    const distName =
      dObj?.name || (typeof distOrName === "string" ? distOrName : "");
    let dAreas = (dObj?.areas || [])
      .map((a) => (typeof a === "string" ? a : a?.name || "").trim())
      .filter(Boolean);
    if (dAreas.length === 0 && distName) {
      const assignedCompNames = companies
        .filter(
          (c) =>
            (c.district || "").trim().toLowerCase() ===
            distName.trim().toLowerCase(),
        )
        .map((c) => (c.name || "").trim())
        .filter(Boolean);
      dAreas = [...new Set(assignedCompNames)];
    }
    return dAreas;
  };

  const handleEditVendor = (vendor) => {
    setEditingVendor(vendor.id);
    setIsCustomParty(false);

    let contacts = [];
    if (Array.isArray(vendor.district_contacts)) {
      contacts = vendor.district_contacts;
    } else if (typeof vendor.district_contacts === "string") {
      try {
        contacts = JSON.parse(vendor.district_contacts);
      } catch {
        contacts = [];
      }
    } else if (vendor.id) {
      try {
        const cached = localStorage.getItem(
          `drinqkart_vendor_district_contacts_${vendor.id}`,
        );
        if (cached) contacts = JSON.parse(cached);
      } catch {
        contacts = [];
      }
    }

    // If contacts is empty, but there is an existing phone number:
    if (
      contacts.length === 0 &&
      (vendor.contact_number || vendor.contact)
    ) {
      contacts = [
        {
          district: "",
          area: "",
          phone: vendor.contact_number || vendor.contact || "",
          name: vendor.contact_name || "",
          email: vendor.email || "",
        },
      ];
    }

    // Normalize contacts: match district case-insensitively to canonical district name in districts
    const normalizedContacts = (Array.isArray(contacts) ? contacts : []).map((dc) => {
      if (!dc) return { district: "", area: "", phone: "", name: "", email: "" };
      const matchedDist = districts.find(
        (d) => (d.name || "").trim().toLowerCase() === (dc.district || "").trim().toLowerCase()
      );
      const canonicalDistrictName = matchedDist ? matchedDist.name : (dc.district || "");
      let rawArea = (dc.area || "").trim();
      if (
        rawArea.toLowerCase() === "all areas / direct" ||
        rawArea.toLowerCase() === "all areas" ||
        rawArea.toLowerCase() === "direct"
      ) {
        rawArea = "";
      }
      if (!rawArea && canonicalDistrictName) {
        const dAreas = getDistrictAreas(canonicalDistrictName);
        if (dAreas.length === 1) {
          rawArea = dAreas[0];
        }
      }
      return {
        district: canonicalDistrictName,
        area: rawArea,
        phone: dc.phone || dc.contact_number || dc.contact || "",
        name: dc.name || dc.contact_name || dc.person_name || "",
        email: dc.email || "",
      };
    });

    let terms = [];
    if (Array.isArray(vendor.terms)) {
      terms = vendor.terms;
    } else if (typeof vendor.terms === "string") {
      try {
        terms = JSON.parse(vendor.terms);
      } catch {
        terms = [];
      }
    }

    setVendorFormData({
      party_name: vendor.party_name || "",
      address: vendor.address || "",
      gstin: vendor.gstin || "",
      contact_name: vendor.contact_name || "",
      contact_number: vendor.contact_number || vendor.contact || "",
      email: vendor.email || "",
      terms: Array.isArray(terms) ? terms : [],
      company_name: vendor.company_name || "",
      district_contacts: normalizedContacts,
    });
    setShowVendorForm(true);
  };

  const handleAddNewVendor = () => {
    setEditingVendor(null);
    setIsCustomParty(false);
    const firstDist = districts.length > 0 ? districts[0].name : "";
    const firstDistAreas = firstDist ? getDistrictAreas(firstDist) : [];
    const firstArea = firstDistAreas.length === 1 ? firstDistAreas[0] : "";
    setVendorFormData({
      party_name: allAvailableParties.length > 0 ? allAvailableParties[0] : "",
      address: "",
      gstin: "",
      contact_name: "",
      contact_number: "",
      email: "",
      terms: [],
      company_name: "",
      district_contacts: firstDist
        ? [{ district: firstDist, area: firstArea, phone: "", name: "", email: "" }]
        : [],
    });
    setShowVendorForm(true);
  };

  const handleVendorAddDistrictContact = () => {
    const currentContacts = vendorFormData.district_contacts || [];

    // Find the first district that has at least one unassigned area
    const availableDistrict = districts.find((d) => {
      const dAreas = getDistrictAreas(d);
      const rowsWithD = currentContacts.filter(
        (item) =>
          (item.district || "").trim().toLowerCase() ===
          (d.name || "").trim().toLowerCase(),
      );
      const takenAreas = rowsWithD
        .map((item) => (item.area || "").trim().toLowerCase())
        .filter(Boolean);
      return dAreas.some((a) => !takenAreas.includes(a.toLowerCase()));
    });

    const defaultDistrict = availableDistrict
      ? availableDistrict.name
      : districts[0]?.name || "";

    let defaultArea = "";
    if (availableDistrict) {
      const dAreas = getDistrictAreas(availableDistrict);
      const rowsWithD = currentContacts.filter(
        (item) =>
          (item.district || "").trim().toLowerCase() ===
          (availableDistrict.name || "").trim().toLowerCase(),
      );
      const takenAreas = rowsWithD
        .map((item) => (item.area || "").trim().toLowerCase())
        .filter(Boolean);
      const nextArea = dAreas.find((a) => !takenAreas.includes(a.toLowerCase()));
      if (nextArea) defaultArea = nextArea;
    } else if (defaultDistrict) {
      const dAreas = getDistrictAreas(defaultDistrict);
      if (dAreas.length > 0) defaultArea = dAreas[0];
    }

    setVendorFormData((prev) => ({
      ...prev,
      district_contacts: [
        ...(prev.district_contacts || []),
        {
          district: defaultDistrict,
          area: defaultArea,
          phone: "",
          name: "",
          email: "",
        },
      ],
    }));
  };

  const handleVendorUpdateDistrictContact = (index, field, value) => {
    setVendorFormData((prev) => {
      const updated = [...(prev.district_contacts || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, district_contacts: updated };
    });
  };

  const handleVendorRemoveDistrictContact = (index) => {
    setVendorFormData((prev) => {
      const updated = [...(prev.district_contacts || [])];
      updated.splice(index, 1);
      return { ...prev, district_contacts: updated };
    });
  };

  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    if (!vendorFormData.party_name) {
      alert("Party Name is required");
      return;
    }

    const validDistrictContacts = (
      vendorFormData.district_contacts || []
    ).filter((dc) => dc && (dc.district || dc.phone || dc.name || dc.email || dc.area));

    if (validDistrictContacts.length === 0) {
      alert("Please add at least one District Contact with a District, Area, and Contact Number.");
      return;
    }

    const incompleteContact = validDistrictContacts.find(
      (dc) =>
        !dc.district ||
        !dc.district.trim() ||
        !dc.phone ||
        !dc.phone.trim() ||
        !dc.area ||
        !dc.area.trim() ||
        dc.area.trim().toLowerCase() === "all areas / direct" ||
        dc.area.trim().toLowerCase() === "all areas" ||
        dc.area.trim().toLowerCase() === "direct"
    );

    if (incompleteContact) {
      if (!incompleteContact.district || !incompleteContact.district.trim()) {
        alert("Please select a District for each district contact.");
      } else if (
        !incompleteContact.area ||
        !incompleteContact.area.trim() ||
        incompleteContact.area.trim().toLowerCase() === "all areas / direct" ||
        incompleteContact.area.trim().toLowerCase() === "all areas" ||
        incompleteContact.area.trim().toLowerCase() === "direct"
      ) {
        alert(
          `Please select an Area for District "${incompleteContact.district}". Form cannot be submitted without an assigned Area.`,
        );
      } else {
        alert("Please provide a Contact Number for each district contact.");
      }
      return;
    }

    // Check for duplicate (district + area) entries
    const seenDistrictAreas = new Set();
    for (const dc of validDistrictContacts) {
      const distKey = `${(dc.district || "").trim().toLowerCase()}::${(dc.area || "").trim().toLowerCase()}`;
      if (seenDistrictAreas.has(distKey)) {
        alert(
          `Duplicate contact entry: District "${dc.district}" with Area "${dc.area}" is assigned more than once.`,
        );
        return;
      }
      seenDistrictAreas.add(distKey);
    }

    setIsVendorSubmitting(true);

    let payload = { ...vendorFormData };
    payload.district_contacts = validDistrictContacts;

    // Primary contact fields auto-sync to the first district contact
    const firstContact = validDistrictContacts[0];
    payload.contact_number = firstContact ? firstContact.phone || "" : "";
    payload.contact = firstContact ? firstContact.phone || "" : "";
    payload.contact_name = firstContact ? firstContact.name || "" : "";
    payload.email = firstContact ? firstContact.email || "" : "";

    let res;
    if (editingVendor) {
      res = await updateVendor(editingVendor, payload);
    } else {
      res = await createVendor(payload);
    }

    setIsVendorSubmitting(false);

    if (res.success) {
      alert(`Vendor ${editingVendor ? "updated" : "created"} successfully!`);
      setShowVendorForm(false);
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      const res = await deleteVendor(vendorId);
      if (res.success) {
        alert("Vendor deleted successfully!");
      } else {
        alert(`Error deleting vendor: ${res.error}`);
      }
    }
  };

  // --- VENDOR DISTRICT CONTACTS HELPER & HOVER PREVIEW ---
  const getVendorDistrictContactsList = (vendor) => {
    if (!vendor) return [];
    let contacts = vendor.district_contacts;
    if (typeof contacts === "string") {
      try {
        contacts = JSON.parse(contacts);
      } catch (e) {
        contacts = [];
      }
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      try {
        const cached = localStorage.getItem(
          `drinqkart_vendor_district_contacts_${vendor.id}`,
        );
        if (cached) contacts = JSON.parse(cached);
      } catch (e) {}
    }
    return Array.isArray(contacts) ? contacts : [];
  };

  const groupVendorContactsByDistrict = (vendor) => {
    const list = getVendorDistrictContactsList(vendor);
    const districtMap = new Map();

    list.forEach((item) => {
      const rawDistrict = (item.district || "").trim();
      if (!rawDistrict) return;
      const key = rawDistrict.toLowerCase();
      if (!districtMap.has(key)) {
        districtMap.set(key, {
          districtName: rawDistrict.toUpperCase(),
          items: [],
        });
      }
      districtMap.get(key).items.push(item);
    });

    return Array.from(districtMap.values());
  };

  const handleCloseDistrictHover = () => {
    if (hoverDistrictPreviewRef.current?.isPinned) return;
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
    }
    hoverDistrictTimerRef.current = setTimeout(() => {
      if (!hoverDistrictPreviewRef.current?.isPinned) {
        setHoverDistrictPreview(null);
      }
    }, 1200);
  };

  const handleOpenDistrictHover = (e, group, vendor, isPinned = false) => {
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
      hoverDistrictTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vendorUniqueKey = `${vendor.id || ""}_${vendor.company_name || "direct"}`;
    setHoverDistrictPreview({
      district: group.districtName,
      vendorId: vendor.id,
      vendorUniqueKey,
      vendorName: vendor.party_name || vendor.name || "Vendor",
      companyName: vendor.company_name || "",
      items: group.items,
      groups: [group],
      activeDistrictIndex: 0,
      isPinned: Boolean(isPinned),
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  const handleToggleDistrictHover = (e, group, vendor) => {
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
      hoverDistrictTimerRef.current = null;
    }
    const vendorUniqueKey = `${vendor.id || ""}_${vendor.company_name || "direct"}`;
    if (
      hoverDistrictPreview &&
      hoverDistrictPreview.district?.toLowerCase() ===
        group.districtName.toLowerCase() &&
      (hoverDistrictPreview.vendorUniqueKey
        ? hoverDistrictPreview.vendorUniqueKey === vendorUniqueKey
        : hoverDistrictPreview.vendorId === vendor.id)
    ) {
      if (hoverDistrictPreview.isPinned) {
        setHoverDistrictPreview(null);
      } else {
        setHoverDistrictPreview((prev) => ({ ...prev, isPinned: true }));
      }
    } else {
      handleOpenDistrictHover(e, group, vendor, true);
    }
  };

  const handleOpenMultiDistrictHover = (e, groups, vendor, initialDistrictIndex = 0, isPinned = false) => {
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
      hoverDistrictTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const vendorUniqueKey = `${vendor.id || ""}_${vendor.company_name || "direct"}`;
    const activeIdx = Math.max(0, Math.min(initialDistrictIndex, groups.length - 1));
    const activeGrp = groups[activeIdx] || groups[0];

    setHoverDistrictPreview({
      district: activeGrp.districtName,
      vendorId: vendor.id,
      vendorUniqueKey,
      vendorName: vendor.party_name || vendor.name || "Vendor",
      companyName: vendor.company_name || "",
      groups,
      activeDistrictIndex: activeIdx,
      items: activeGrp.items,
      isPinned: Boolean(isPinned),
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  const handleToggleMultiDistrictHover = (e, groups, vendor) => {
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
      hoverDistrictTimerRef.current = null;
    }
    const vendorUniqueKey = `${vendor.id || ""}_${vendor.company_name || "direct"}`;
    if (
      hoverDistrictPreview &&
      (hoverDistrictPreview.vendorUniqueKey
        ? hoverDistrictPreview.vendorUniqueKey === vendorUniqueKey
        : hoverDistrictPreview.vendorId === vendor.id)
    ) {
      if (hoverDistrictPreview.isPinned) {
        setHoverDistrictPreview(null);
      } else {
        setHoverDistrictPreview((prev) => ({ ...prev, isPinned: true }));
      }
    } else {
      handleOpenMultiDistrictHover(e, groups, vendor, 0, true);
    }
  };

  const handleSelectHoverDistrict = (idx) => {
    if (hoverDistrictTimerRef.current) {
      clearTimeout(hoverDistrictTimerRef.current);
      hoverDistrictTimerRef.current = null;
    }
    setHoverDistrictPreview((prev) => {
      if (!prev || !prev.groups || !prev.groups[idx]) return prev;
      const grp = prev.groups[idx];
      return {
        ...prev,
        activeDistrictIndex: idx,
        district: grp.districtName,
        items: grp.items,
      };
    });
  };

  const renderVendorDistrictContactBadges = (vendor) => {
    const grouped = groupVendorContactsByDistrict(vendor);

    if (grouped.length > 0) {
      const vendorUniqueKey = `${vendor.id || ""}_${vendor.company_name || "direct"}`;
      const isHovered =
        hoverDistrictPreview &&
        (hoverDistrictPreview.vendorUniqueKey
          ? hoverDistrictPreview.vendorUniqueKey === vendorUniqueKey
          : hoverDistrictPreview.vendorId === vendor.id);

      // If vendor has 2 or more districts: show compact "X Districts" mention
      if (grouped.length > 1) {
        return (
          <div className="inline-block">
            <div
              onMouseEnter={(e) => handleOpenMultiDistrictHover(e, grouped, vendor, 0)}
              onMouseLeave={handleCloseDistrictHover}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMultiDistrictHover(e, grouped, vendor);
              }}
              className={`district-badge-trigger group inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer shadow-sm select-none ${
                isHovered
                  ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200"
                  : "bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border-indigo-200 hover:border-indigo-300"
              }`}
              title={`Click or hover to preview ${grouped.length} districts and their area contacts`}
            >
              <MapPin
                size={12}
                className={
                  isHovered
                    ? "text-white shrink-0 animate-pulse"
                    : "text-indigo-600 shrink-0"
                }
              />
              <span className="font-bold tracking-tight">
                {grouped.length} Districts
              </span>
            </div>
          </div>
        );
      }

      // If vendor has 1 district: show that district badge directly
      const group = grouped[0];
      const count = group.items.length;
      return (
        <div className="inline-block">
          <div
            key={group.districtName}
            onMouseEnter={(e) => handleOpenDistrictHover(e, group, vendor)}
            onMouseLeave={handleCloseDistrictHover}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleDistrictHover(e, group, vendor);
            }}
            className={`district-badge-trigger group inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer shadow-sm select-none ${
              isHovered
                ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200"
                : "bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border-indigo-200 hover:border-indigo-300"
            }`}
            title={`Click or hover to preview area contacts for ${group.districtName}`}
          >
            <MapPin
              size={12}
              className={
                isHovered
                  ? "text-white shrink-0 animate-pulse"
                  : "text-indigo-600 shrink-0"
              }
            />
            <span className="font-bold tracking-tight">
              {group.districtName}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                isHovered
                  ? "bg-white/20 text-white"
                  : "bg-indigo-200/80 text-indigo-950"
              }`}
            >
              {count} {count === 1 ? "area" : "areas"}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="font-semibold text-slate-800 text-xs">
        {vendor.contact_number || vendor.contact || "—"}
      </div>
    );
  };

  // --- COMPANY SETTINGS HANDLERS ---
  const handleAddNewCompany = () => {
    setEditingCompany(null);
    setCompanyFormData({
      name: "",
      address: "",
      gstin: "",
      contact: "",
      email: "",
      district: "",
      terms: [],
      requires_transporter: true,
    });
    setShowCompanyForm(true);
  };

  const handleEditCompany = (company) => {
    setEditingCompany(company.id);
    setCompanyFormData({
      name: company.name || "",
      address: company.address || "",
      gstin: company.gstin || "",
      contact: company.contact || "",
      email: company.email || "",
      district: company.district || "",
      terms: company.terms || [],
      requires_transporter: company.requires_transporter !== false,
    });
    setShowCompanyForm(true);
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setIsCompanySubmitting(true);

    let res;
    if (editingCompany) {
      res = await updateCompany(editingCompany, companyFormData);
    } else {
      res = await createCompany(companyFormData);
    }

    setIsCompanySubmitting(false);

    if (res.success) {
      alert(
        `Company profile ${editingCompany ? "updated" : "created"} successfully!`,
      );
      setShowCompanyForm(false);
    } else {
      alert(`Error saving company details: ${res.error}`);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this company profile? This action cannot be undone.",
      )
    ) {
      const res = await deleteCompany(companyId);
      if (res.success) {
        alert("Company profile deleted successfully!");
      } else {
        alert(`Error deleting company profile: ${res.error}`);
      }
    }
  };

  const handleTermChange = (index, value) => {
    const newTerms = [...companyFormData.terms];
    newTerms[index] = value;
    setCompanyFormData({ ...companyFormData, terms: newTerms });
  };

  const handleAddTerm = () => {
    setCompanyFormData({
      ...companyFormData,
      terms: [...companyFormData.terms, ""],
    });
  };

  const handleRemoveTerm = (index) => {
    const newTerms = companyFormData.terms.filter((_, i) => i !== index);
    setCompanyFormData({ ...companyFormData, terms: newTerms });
  };

  const handleVendorTermChange = (index, value) => {
    const newTerms = [...(vendorFormData.terms || [])];
    newTerms[index] = value;
    setVendorFormData({ ...vendorFormData, terms: newTerms });
  };

  const handleVendorAddTerm = () => {
    setVendorFormData({
      ...vendorFormData,
      terms: [...(vendorFormData.terms || []), ""],
    });
  };

  const handleVendorRemoveTerm = (index) => {
    const newTerms = (vendorFormData.terms || []).filter((_, i) => i !== index);
    setVendorFormData({ ...vendorFormData, terms: newTerms });
  };

  // --- TRANSPORTER HANDLERS ---
  const handleEditTransporter = (t) => {
    setEditingTransporter(t.id);
    setTransporterFormData({
      name: t.name || "",
      contact_number: t.contact_number || "",
    });
    setShowTransporterForm(true);
  };

  const handleTransporterSubmit = async (e) => {
    e.preventDefault();
    setIsTransporterSubmitting(true);
    let res;
    if (editingTransporter) {
      res = await supabase
        .from("purchase_transporters")
        .update(transporterFormData)
        .eq("id", editingTransporter);
    } else {
      res = await supabase
        .from("purchase_transporters")
        .insert([transporterFormData]);
    }
    setIsTransporterSubmitting(false);

    if (!res.error) {
      alert(
        `Transporter ${editingTransporter ? "updated" : "added"} successfully!`,
      );
      setShowTransporterForm(false);
      fetchTransporters();
    } else {
      alert(`Error: ${res.error.message}`);
    }
  };

  const handleDeleteTransporter = async (id) => {
    if (window.confirm("Delete this transporter?")) {
      await supabase.from("purchase_transporters").delete().eq("id", id);
      fetchTransporters();
    }
  };

  // --- RECEIVER HANDLERS ---
  const handleEditReceiver = (r) => {
    setEditingReceiver(r.id);
    setReceiverFormData({
      name: r.name || "",
      contact_number: r.contact_number || "",
    });
    setShowReceiverForm(true);
  };

  const handleReceiverSubmit = async (e) => {
    e.preventDefault();
    setIsReceiverSubmitting(true);
    let res;
    if (editingReceiver) {
      res = await supabase
        .from("purchase_receivers")
        .update(receiverFormData)
        .eq("id", editingReceiver);
    } else {
      res = await supabase
        .from("purchase_receivers")
        .insert([receiverFormData]);
    }
    setIsReceiverSubmitting(false);

    if (!res.error) {
      alert(`Receiver ${editingReceiver ? "updated" : "added"} successfully!`);
      setShowReceiverForm(false);
      fetchReceivers();
    } else {
      alert(`Error: ${res.error.message}`);
    }
  };

  const handleDeleteReceiver = async (id) => {
    if (window.confirm("Delete this receiver?")) {
      await supabase.from("purchase_receivers").delete().eq("id", id);
      fetchReceivers();
    }
  };

  // --- DISTRICT HANDLERS ---
  const handleAddNewDistrict = () => {
    setEditingDistrict(null);
    setDistrictFormData({ name: "", areas: [] });
    setShowDistrictForm(true);
  };

  const handleEditDistrict = (dist) => {
    setEditingDistrict(dist.id);
    setDistrictFormData({
      name: dist.name || "",
      areas: Array.isArray(dist.areas) ? dist.areas : []
    });
    setShowDistrictForm(true);
  };

  const handleDistrictAddArea = () => {
    setDistrictFormData((prev) => ({
      ...prev,
      areas: [
        ...(prev.areas || []),
        {
          id: `area_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: "",
        },
      ],
    }));
  };

  const handleDistrictRemoveArea = (index) => {
    setDistrictFormData((prev) => ({
      ...prev,
      areas: (prev.areas || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleDistrictUpdateArea = (index, value) => {
    setDistrictFormData((prev) => {
      const updated = [...(prev.areas || [])];
      const curr = typeof updated[index] === "string" ? { name: updated[index] } : updated[index];
      updated[index] = { ...curr, name: value };
      return { ...prev, areas: updated };
    });
  };

  const handleDistrictSubmit = async (e) => {
    e.preventDefault();
    setIsDistrictSubmitting(true);
    
    // Clean and validate areas (only district and area name)
    const cleanAreas = (districtFormData.areas || [])
      .map((a) => {
        const name = (typeof a === "string" ? a : a?.name || "").trim();
        return {
          id: a?.id || `area_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name,
        };
      })
      .filter((a) => a.name.length > 0);

    let res;
    if (editingDistrict) {
      res = await districtService.updateDistrict(
        editingDistrict,
        districtFormData.name,
        cleanAreas
      );
    } else {
      res = await districtService.createDistrict(districtFormData.name, cleanAreas);
    }
    setIsDistrictSubmitting(false);

    if (res.success) {
      alert(
        `District ${editingDistrict ? "updated" : "created"} successfully!`,
      );
      setShowDistrictForm(false);
      fetchDistricts();
    } else {
      alert(`Error: ${res.error}`);
    }
  };

  const handleDeleteDistrict = async (id, name) => {
    if (
      window.confirm(
        `Are you sure you want to delete district "${name}"? This action cannot be undone.`,
      )
    ) {
      const res = await districtService.deleteDistrict(id);
      if (res.success) {
        alert("District deleted successfully!");
        fetchDistricts();
      } else {
        alert(`Error deleting district: ${res.error}`);
      }
    }
  };

  // Districts Tab Filter
  const filteredDistricts = districts.filter((d) => {
    if (!(districtSearchQuery || "").trim()) return true;
    const q = (districtSearchQuery || "").toLowerCase().trim();
    return d.name && d.name.toLowerCase().includes(q);
  });

  // Vendors Tab Filter
  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearchQuery.trim()) return true;
    const q = vendorSearchQuery.toLowerCase().trim();
    return (
      (v.party_name && v.party_name.toLowerCase().includes(q)) ||
      (v.company_name && v.company_name.toLowerCase().includes(q)) ||
      ((v.contact_number || v.contact) &&
        String(v.contact_number || v.contact)
          .toLowerCase()
          .includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q)) ||
      (v.contact_name && v.contact_name.toLowerCase().includes(q))
    );
  });

  // Transporters Tab Filter
  const filteredTransporters = transporters.filter((t) => {
    if (!(transporterSearchQuery || "").trim()) return true;
    const q = (transporterSearchQuery || "").toLowerCase().trim();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.contact_number && String(t.contact_number).toLowerCase().includes(q))
    );
  });

  // Receivers Tab Filter
  const filteredReceivers = receivers.filter((r) => {
    if (!(receiverSearchQuery || "").trim()) return true;
    const q = (receiverSearchQuery || "").toLowerCase().trim();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.contact_number && String(r.contact_number).toLowerCase().includes(q))
    );
  });

  // Secure Portal Links Tab Filter (searches across all 3 portal types)
  const portalFilteredVendors = vendors.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (v.party_name && v.party_name.toLowerCase().includes(q)) ||
      (v.company_name && v.company_name.toLowerCase().includes(q)) ||
      ((v.contact_number || v.contact) &&
        String(v.contact_number || v.contact)
          .toLowerCase()
          .includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q))
    );
  });

  const portalFilteredTransporters = transporters.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.contact_number && String(t.contact_number).toLowerCase().includes(q))
    );
  });

  const portalFilteredReceivers = receivers.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.contact_number && String(r.contact_number).toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 text-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <SettingsIcon className="text-indigo-400" size={32} />
              Settings & Portal Control
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1">
              Configure system user roles, vendors ledger, logistics partners,
              and manage permanent verification portal links.
            </p>
          </div>
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            Admin Console
          </span>
        </div>

        {/* Tab Navigation pills */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: "vendors", label: "Vendor Management" },
            { id: "company", label: "Company Profile" },
            { id: "districts", label: "Districts" },
            { id: "transporters", label: "Transporters" },
            { id: "receivers", label: "Receivers" },
            { id: "portal_links", label: "Secure Portal Links" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery("");
                  setDistrictSearchQuery("");
                }}
                className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings Content Area */}
        <div className="space-y-6">
          {/* VENDORS TAB */}
          {activeTab === "vendors" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Supplier Ledger
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Register manufacturing plants, contact info, and tax
                    credentials.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Search Filter for Vendors */}
                  <div className="relative flex-1 sm:w-72 shadow-2xs rounded-lg">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search vendors by name, GSTIN, phone..."
                      value={vendorSearchQuery}
                      onChange={(e) => setVendorSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    {vendorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setVendorSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    onClick={handleAddNewVendor}
                  >
                    <Plus size={15} /> Add New Vendor
                  </button>
                </div>
              </div>

              {/* Vendors Count & Active Filter Indicator */}
              <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-medium">
                {isVendorsLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-36 bg-slate-200/80 rounded animate-pulse" />
                  </div>
                ) : (
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 font-bold">
                      {filteredVendors.length}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-900 font-bold">
                      {vendors.length}
                    </strong>{" "}
                    vendors
                  </span>
                )}
                {vendorSearchQuery && !isVendorsLoading && (
                  <button
                    type="button"
                    onClick={() => setVendorSearchQuery("")}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {showVendorForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto pt-16">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 w-full max-w-3xl relative">
                    <button
                      type="button"
                      onClick={() => setShowVendorForm(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">
                      {editingVendor
                        ? "📝 Edit Supplier details"
                        : "✨ Create New Supplier Entry"}
                    </h3>
                    <form onSubmit={handleVendorSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700">
                              Party / Vendor Name *
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsCustomParty(!isCustomParty)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline font-bold cursor-pointer"
                            >
                              {isCustomParty
                                ? "← Choose from List"
                                : "+ Enter Custom Party"}
                            </button>
                          </div>
                          {isCustomParty ? (
                            <input
                              type="text"
                              placeholder="Type party / vendor name..."
                              value={vendorFormData.party_name || ""}
                              onChange={(e) =>
                                setVendorFormData({
                                  ...vendorFormData,
                                  party_name: e.target.value,
                                })
                              }
                              required
                              disabled={isVendorSubmitting}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                          ) : (
                            <select
                              value={vendorFormData.party_name || ""}
                              onChange={(e) =>
                                setVendorFormData({
                                  ...vendorFormData,
                                  party_name: e.target.value,
                                })
                              }
                              required
                              disabled={isVendorSubmitting}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                            >
                              <option value="">Select a Party Name</option>
                              {allAvailableParties.map((party, idx) => (
                                <option key={idx} value={party}>
                                  {party}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            GSTIN / Tax ID
                          </label>
                          <input
                            type="text"
                            value={vendorFormData.gstin}
                            onChange={(e) =>
                              setVendorFormData({
                                ...vendorFormData,
                                gstin: e.target.value,
                              })
                            }
                            disabled={isVendorSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-700">
                            Company Scope (Optional)
                          </label>
                          {vendorFormData.company_name && (
                            <button
                              type="button"
                              onClick={() =>
                                setVendorFormData({
                                  ...vendorFormData,
                                  company_name: "",
                                })
                              }
                              className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline font-medium cursor-pointer"
                            >
                              Reset to Direct
                            </button>
                          )}
                        </div>

                        <select
                          value={vendorFormData.company_name || ""}
                          onChange={(e) =>
                            setVendorFormData({
                              ...vendorFormData,
                              company_name: e.target.value,
                            })
                          }
                          disabled={isVendorSubmitting}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                        >
                          <option value="">
                            Direct / All (No Company Filter)
                          </option>
                          {vendorFormData.company_name &&
                            !availableCompaniesForVendor.includes(
                              vendorFormData.company_name,
                            ) && (
                              <option value={vendorFormData.company_name}>
                                {vendorFormData.company_name}
                              </option>
                            )}
                          {availableCompaniesForVendor.map((comp) => (
                            <option key={comp} value={comp}>
                              {comp}
                            </option>
                          ))}
                        </select>

                        <p className="text-[11px] text-slate-500">
                          {vendorFormData.company_name
                            ? `Active Scope: "${vendorFormData.company_name}". This supplier profile applies to orders matching this company.`
                            : "Direct / All: Available for all purchase orders without brand or company filter."}
                        </p>
                      </div>

                      {/* District-Wise Vendor Contacts (Available for all vendors) */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-indigo-600" />
                                <span className="text-xs font-bold text-slate-800">
                                  District-Wise Vendor Contacts
                                </span>
                                {vendorFormData.district_contacts?.length >
                                  0 && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-700">
                                    {vendorFormData.district_contacts.length}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Assign unique contact numbers, persons, and
                                emails for specific districts.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleVendorAddDistrictContact}
                              disabled={
                                isVendorSubmitting ||
                                districts.length === 0 ||
                                (vendorFormData.district_contacts?.length || 0) >=
                                  districts.reduce((acc, d) => {
                                    const dAreas = getDistrictAreas(d);
                                    return acc + Math.max(1, dAreas.length);
                                  }, 0)
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-indigo-700 rounded border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                districts.length === 0
                                  ? "No districts configured"
                                  : (vendorFormData.district_contacts?.length || 0) >=
                                    districts.reduce((acc, d) => {
                                      const dAreas = getDistrictAreas(d);
                                      return acc + Math.max(1, dAreas.length);
                                    }, 0)
                                  ? "All available districts and areas have been assigned"
                                  : "Add contact for another district or area"
                              }
                            >
                              <Plus size={12} /> Add District Contact
                            </button>
                          </div>

                          {!Array.isArray(vendorFormData.district_contacts) ||
                          vendorFormData.district_contacts.length === 0 ? (
                            <div className="text-center py-4 bg-white/70 border border-dashed border-slate-200 rounded-lg">
                              <p className="text-slate-500 text-xs font-medium italic">
                                {vendorFormData.company_name
                                  ? `No district-specific numbers defined for "${vendorFormData.company_name}".`
                                  : "No district-specific contacts defined for this vendor."}
                              </p>
                              <button
                                type="button"
                                onClick={handleVendorAddDistrictContact}
                                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                + Add District Contact
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                              {vendorFormData.district_contacts.map(
                                (dc, index) => {
                                  const currentMatchedDist = districts.find(
                                    (d) =>
                                      (d.name || "").trim().toLowerCase() ===
                                      (dc.district || "").trim().toLowerCase()
                                  );
                                  const canonicalDistrict = currentMatchedDist ? currentMatchedDist.name : (dc.district || "");
                                  const distAreas = getDistrictAreas(canonicalDistrict);

                                  // Only show areas that have not been selected by an earlier row (or belong to this row)
                                  const availableDistAreas = distAreas.filter((aName) => {
                                    const firstIndexWithArea = (vendorFormData.district_contacts || []).findIndex(
                                      (item) =>
                                        (item.district || "").trim().toLowerCase() === (dc.district || "").trim().toLowerCase() &&
                                        (item.area || "").trim().toLowerCase() === aName.toLowerCase()
                                    );
                                    return firstIndexWithArea === -1 || firstIndexWithArea === index;
                                  });

                                  // Detect if this row is an exact duplicate of an earlier card
                                  const isDuplicateEntry = (vendorFormData.district_contacts || []).some(
                                    (item, idx) =>
                                      idx < index &&
                                      (item.district || "").trim().toLowerCase() === (dc.district || "").trim().toLowerCase() &&
                                      (item.area || "").trim().toLowerCase() === (dc.area || "").trim().toLowerCase() &&
                                      (dc.area || "").trim() !== ""
                                  );

                                  return (
                                    <div
                                      key={index}
                                      className={`p-3 bg-white rounded-xl border shadow-xs space-y-2.5 relative group transition-all ${
                                        isDuplicateEntry ? "border-rose-300 bg-rose-50/20" : "border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] text-indigo-700 font-bold">
                                            {index + 1}
                                          </span>
                                          District Contact{" "}
                                          {dc.district
                                            ? `(${dc.district}${dc.area ? ` - ${dc.area}` : ""})`
                                            : ""}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleVendorRemoveDistrictContact(
                                              index,
                                            )
                                          }
                                          disabled={isVendorSubmitting}
                                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                          title="Remove this district entry"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                                        {/* 1st field: District dropdown */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            1. District *
                                          </label>
                                          <select
                                            value={canonicalDistrict}
                                            required
                                            onChange={(e) => {
                                              const newDist = e.target.value;
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "district",
                                                newDist,
                                              );
                                              // Auto-assign first available area for this newly selected district
                                              const newDistAreas = getDistrictAreas(newDist);
                                              const otherRowsWithNewD = (vendorFormData.district_contacts || []).filter(
                                                (item, idx) =>
                                                  idx !== index &&
                                                  (item.district || "").trim().toLowerCase() === newDist.trim().toLowerCase()
                                              );
                                              const otherTaken = otherRowsWithNewD.map(item => (item.area || "").trim().toLowerCase());
                                              const firstAvailable = newDistAreas.find(a => !otherTaken.includes(a.toLowerCase())) || "";
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "area",
                                                firstAvailable,
                                              );
                                            }}
                                            disabled={isVendorSubmitting}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                                          >
                                            <option value="">
                                              Select District
                                            </option>
                                            {canonicalDistrict &&
                                              !districts.some(
                                                (d) =>
                                                  (d.name || "").trim().toLowerCase() ===
                                                  canonicalDistrict.trim().toLowerCase(),
                                              ) && (
                                                <option value={canonicalDistrict}>
                                                  {canonicalDistrict}
                                                </option>
                                              )}
                                            {districts.map((d) => {
                                              const dAreas = getDistrictAreas(d);
                                              const otherRowsWithD = (vendorFormData.district_contacts || []).filter(
                                                (item, idx) =>
                                                  idx !== index &&
                                                  (item.district || "").trim().toLowerCase() === (d.name || "").trim().toLowerCase()
                                              );
                                              const otherTakenAreas = otherRowsWithD
                                                .map((item) => (item.area || "").trim().toLowerCase())
                                                .filter(Boolean);
                                              const isCurrentDist = canonicalDistrict.trim().toLowerCase() === (d.name || "").trim().toLowerCase();
                                              const hasRemainingAreas = dAreas.length > 0 && dAreas.some((a) => !otherTakenAreas.includes(a.toLowerCase()));
                                              const isExhausted = !isCurrentDist && (dAreas.length > 0 ? !hasRemainingAreas : false);

                                              return (
                                                <option
                                                  key={d.id || d.name}
                                                  value={d.name}
                                                  disabled={isExhausted}
                                                >
                                                  {d.name} {isExhausted ? "(All areas assigned)" : ""}
                                                </option>
                                              );
                                            })}
                                          </select>
                                        </div>

                                        {/* 2nd field: Area dropdown (under that district only, mandatory) */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            2. Area *
                                          </label>
                                          <select
                                            value={dc.area || ""}
                                            required
                                            onChange={(e) =>
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "area",
                                                e.target.value,
                                              )
                                            }
                                            disabled={isVendorSubmitting || !dc.district}
                                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 ${
                                              !dc.area ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                                            }`}
                                          >
                                            {!dc.district ? (
                                              <option value="">
                                                Select District first
                                              </option>
                                            ) : distAreas.length === 0 ? (
                                              <option value="" disabled>
                                                No areas configured for this district
                                              </option>
                                            ) : (
                                              <>
                                                <option value="">
                                                  Select Area *
                                                </option>
                                                {availableDistAreas.map((aName) => (
                                                  <option
                                                    key={aName}
                                                    value={aName}
                                                  >
                                                    {aName}
                                                  </option>
                                                ))}
                                                {availableDistAreas.length === 0 && (
                                                  <option value="" disabled>
                                                    All areas for this district assigned
                                                  </option>
                                                )}
                                              </>
                                            )}
                                          </select>
                                        </div>

                                        {/* 3rd field: Contact Number */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            3. Phone *
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="e.g. 9822746825"
                                            value={dc.phone || ""}
                                            onChange={(e) =>
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "phone",
                                                e.target.value,
                                              )
                                            }
                                            disabled={isVendorSubmitting}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                          />
                                        </div>

                                        {/* 4th field: Contact Name */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            4. Person Name
                                          </label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Rahul Sharma"
                                            value={dc.name || ""}
                                            onChange={(e) =>
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "name",
                                                e.target.value,
                                              )
                                            }
                                            disabled={isVendorSubmitting}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                          />
                                        </div>

                                        {/* 5th field: Email */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            5. Email
                                          </label>
                                          <input
                                            type="email"
                                            placeholder="e.g. rep@dist.com"
                                            value={dc.email || ""}
                                            onChange={(e) =>
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "email",
                                                e.target.value,
                                              )
                                            }
                                            disabled={isVendorSubmitting}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                          />
                                        </div>
                                      </div>

                                      {isDuplicateEntry && (
                                        <div className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded px-2.5 py-1 mt-1 flex items-center gap-1.5">
                                          <span>⚠️</span>
                                          <span>
                                            Duplicate contact entry: This area is already assigned in another contact card above. Please select a different area or district.
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Corporate Address
                        </label>
                        <textarea
                          value={vendorFormData.address}
                          onChange={(e) =>
                            setVendorFormData({
                              ...vendorFormData,
                              address: e.target.value,
                            })
                          }
                          disabled={isVendorSubmitting}
                          rows={3}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium"
                        />
                      </div>

                      {/* Standard Terms */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-xs font-bold text-slate-800">
                            Standard Purchase Terms
                          </span>
                          <button
                            type="button"
                            onClick={handleVendorAddTerm}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} /> Add term
                          </button>
                        </div>

                        {!Array.isArray(vendorFormData.terms) ||
                        vendorFormData.terms.length === 0 ? (
                          <p className="text-slate-500 text-xs font-medium italic">
                            No terms defined for this profile.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {vendorFormData.terms.map((term, index) => (
                              <div
                                key={index}
                                className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm"
                              >
                                <span className="text-xs font-bold text-slate-400 mt-2 shrink-0">
                                  {index + 1}.
                                </span>
                                <textarea
                                  value={term}
                                  onChange={(e) =>
                                    handleVendorTermChange(
                                      index,
                                      e.target.value,
                                    )
                                  }
                                  disabled={isVendorSubmitting}
                                  rows={2}
                                  className="w-full text-xs border-0 bg-transparent text-slate-800 font-medium resize-none focus:outline-none p-0"
                                  placeholder="E.g. Payment is net 30 days..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVendorRemoveTerm(index)}
                                  disabled={isVendorSubmitting}
                                  className="p-1 hover:bg-red-50 text-red-600 rounded border border-transparent hover:border-red-200 transition-all shrink-0 cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isVendorSubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isVendorSubmitting
                            ? "Saving..."
                            : "Save Vendor Details"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowVendorForm(false)}
                          className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Vendors Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Party / Vendor Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Company Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          GSTIN
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isVendorsLoading ? (
                        <SkeletonTableRows columns={6} rows={6} />
                      ) : filteredVendors.length > 0 ? (
                        filteredVendors.map((vendor) => (
                          <tr
                            key={vendor.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <strong className="text-slate-900 font-bold">
                                {vendor.party_name}
                              </strong>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {vendor.company_name ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-md ${
                                    districts.some(
                                      (d) =>
                                        (d.name || "").toLowerCase() ===
                                        (vendor.company_name || "").toLowerCase(),
                                    )
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  }`}
                                >
                                  {districts.some(
                                    (d) =>
                                      (d.name || "").toLowerCase() ===
                                      (vendor.company_name || "").toLowerCase(),
                                  ) && (
                                    <MapPin
                                      size={11}
                                      className="text-emerald-600"
                                    />
                                  )}
                                  {vendor.company_name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                  Direct
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-medium">
                              {renderVendorDistrictContactBadges(vendor)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                              {vendor.email || "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold uppercase">
                              {vendor.gstin || "—"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleEditVendor(vendor)}
                              >
                                Edit
                              </button>
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleDeleteVendor(vendor.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-6 py-8 text-center text-slate-500 font-medium"
                          >
                            {vendorSearchQuery ? (
                              <div className="space-y-1.5">
                                <p>
                                  No vendors found matching "
                                  <strong className="text-slate-800">
                                    {vendorSearchQuery}
                                  </strong>
                                  ".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setVendorSearchQuery("")}
                                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                                >
                                  Clear Search
                                </button>
                              </div>
                            ) : (
                              'No vendors found. Select "+ Add New Vendor".'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* COMPANY PROFILE TAB */}
          {activeTab === "company" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Corporate Profiles
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Manage billing entities, invoicing addresses, and standard
                    PO terms.
                  </p>
                </div>
                <button
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  onClick={handleAddNewCompany}
                >
                  <Plus size={15} /> Add New Company
                </button>
              </div>

              {showCompanyForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto pt-16">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 w-full max-w-2xl relative">
                    <button
                      type="button"
                      onClick={() => setShowCompanyForm(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">
                      {editingCompany
                        ? "📝 Edit Company Profile"
                        : "✨ Create Corporate Billing Profile"}
                    </h3>
                    <form onSubmit={handleCompanySubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Company Billing Name *
                          </label>
                          <input
                            type="text"
                            value={companyFormData.name}
                            onChange={(e) =>
                              setCompanyFormData({
                                ...companyFormData,
                                name: e.target.value,
                              })
                            }
                            required
                            disabled={isCompanySubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            GSTIN / Corporate Tax ID *
                          </label>
                          <input
                            type="text"
                            value={companyFormData.gstin}
                            onChange={(e) =>
                              setCompanyFormData({
                                ...companyFormData,
                                gstin: e.target.value,
                              })
                            }
                            required
                            disabled={isCompanySubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Billing Contact Number *
                          </label>
                          <input
                            type="text"
                            value={companyFormData.contact}
                            onChange={(e) =>
                              setCompanyFormData({
                                ...companyFormData,
                                contact: e.target.value,
                              })
                            }
                            required
                            disabled={isCompanySubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            value={companyFormData.email}
                            onChange={(e) =>
                              setCompanyFormData({
                                ...companyFormData,
                                email: e.target.value,
                              })
                            }
                            required
                            disabled={isCompanySubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <MapPin size={13} className="text-indigo-600" />
                            Shop / Billing District
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCompanyForm(false);
                              setActiveTab("districts");
                            }}
                            className="text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline font-bold cursor-pointer"
                          >
                            + Create / Manage Districts
                          </button>
                        </div>
                        <select
                          value={companyFormData.district || ""}
                          onChange={(e) =>
                            setCompanyFormData({
                              ...companyFormData,
                              district: e.target.value,
                            })
                          }
                          disabled={isCompanySubmitting}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                        >
                          <option value="">
                            -- Select District (e.g. Pune, Akole) --
                          </option>
                          {districts.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500">
                          Assign this company/shop to an operational district.
                          You can define new districts in the Districts tab.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Corporate Address *
                        </label>
                        <textarea
                          value={companyFormData.address}
                          onChange={(e) =>
                            setCompanyFormData({
                              ...companyFormData,
                              address: e.target.value,
                            })
                          }
                          required
                          disabled={isCompanySubmitting}
                          rows={2}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-medium"
                        />
                      </div>

                      {/* Transporter Requirement Toggle */}
                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Truck size={14} className="text-indigo-600" />
                            Require Transporter for Purchase Orders
                          </label>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Turn OFF if this shop/company operates via
                            self-pickup or vendor direct delivery.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              companyFormData.requires_transporter !== false
                            }
                            onChange={(e) =>
                              setCompanyFormData({
                                ...companyFormData,
                                requires_transporter: e.target.checked,
                              })
                            }
                            disabled={isCompanySubmitting}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {/* Invoicing Terms */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <span className="text-xs font-bold text-slate-800">
                            Standard Purchase Terms
                          </span>
                          <button
                            type="button"
                            onClick={handleAddTerm}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} /> Add term
                          </button>
                        </div>

                        {!Array.isArray(companyFormData.terms) ||
                        companyFormData.terms.length === 0 ? (
                          <p className="text-slate-500 text-xs font-medium italic">
                            No terms defined for this profile.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {companyFormData.terms.map((term, index) => (
                              <div
                                key={index}
                                className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-200 shadow-sm"
                              >
                                <span className="text-xs font-bold text-slate-400 mt-2 shrink-0">
                                  {index + 1}.
                                </span>
                                <textarea
                                  value={term}
                                  onChange={(e) =>
                                    handleTermChange(index, e.target.value)
                                  }
                                  disabled={isCompanySubmitting}
                                  rows={2}
                                  className="w-full text-xs border-0 bg-transparent text-slate-800 font-medium resize-none focus:outline-none p-0"
                                  placeholder="E.g. Payment is net 30 days..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTerm(index)}
                                  disabled={isCompanySubmitting}
                                  className="p-1 hover:bg-red-50 text-red-600 rounded border border-transparent hover:border-red-200 transition-all shrink-0 cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isCompanySubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isCompanySubmitting
                            ? "Saving..."
                            : "Save Corporate Profile"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCompanyForm(false)}
                          className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Company Profiles Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Company Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          GSTIN
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          District
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Transporter
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Billing Contact
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Terms Count
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isCompaniesLoading ? (
                        <SkeletonTableRows columns={8} rows={4} />
                      ) : companies.length > 0 ? (
                        companies.map((company) => (
                          <tr
                            key={company.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <strong className="text-slate-900 font-bold">
                                {company.name}
                              </strong>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold uppercase">
                              {company.gstin}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {company.district ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
                                  <MapPin size={12} className="text-indigo-500" />
                                  {company.district}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium italic text-xs">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold rounded ${company.requires_transporter !== false ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}
                              >
                                {company.requires_transporter !== false
                                  ? "Required"
                                  : "Not Required"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                              {company.contact}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                              {company.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold">
                              {company.terms?.length || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleEditCompany(company)}
                              >
                                Edit
                              </button>
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleDeleteCompany(company.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="8"
                            className="px-6 py-8 text-center text-slate-500 font-medium"
                          >
                            No company billing profile defined.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DISTRICTS TAB */}
          {activeTab === "districts" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <MapPin className="text-indigo-600" size={20} />
                    Shop & Billing Districts
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Manage regional districts (e.g. Pune, Akole ) used for
                    categorizing shops and billing entities.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Search Filter for Districts */}
                  <div className="relative flex-1 sm:w-72 shadow-2xs rounded-lg">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search districts by name..."
                      value={districtSearchQuery}
                      onChange={(e) => setDistrictSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    {districtSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDistrictSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    onClick={handleAddNewDistrict}
                  >
                    <Plus size={15} /> Add New District
                  </button>
                </div>
              </div>

              {/* District Form Modal */}
              {showDistrictForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto pt-16">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5 w-full max-w-md relative">
                    <button
                      type="button"
                      onClick={() => setShowDistrictForm(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                    <div>
                      <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                        <MapPin className="text-indigo-600" size={18} />
                        {editingDistrict
                          ? "📝 Edit District"
                          : "✨ Create New District"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Districts created here will appear as dropdown options
                        in company billing profiles and shop configurations.
                      </p>
                    </div>

                    <form onSubmit={handleDistrictSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          District Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Raipur, Pune, Raigad, Akole..."
                          value={districtFormData.name}
                          onChange={(e) =>
                            setDistrictFormData({
                              ...districtFormData,
                              name: e.target.value,
                            })
                          }
                          required
                          autoFocus
                          disabled={isDistrictSubmitting}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        />
                      </div>

                      {/* District Areas Management Section */}
                      <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <div>
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              District Areas
                              {districtFormData.areas?.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                  {districtFormData.areas.length}
                                </span>
                              )}
                            </label>
                            <p className="text-[11px] text-slate-500">
                              Define multiple areas under this district (e.g. Saddu, Pandri, Wagholi).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleDistrictAddArea}
                            disabled={isDistrictSubmitting}
                            className="px-2.5 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={13} /> Add Area
                          </button>
                        </div>

                        {(!districtFormData.areas || districtFormData.areas.length === 0) ? (
                          <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                            <p className="text-xs text-slate-500 font-medium">No areas added yet for this district.</p>
                            <button
                              type="button"
                              onClick={handleDistrictAddArea}
                              className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                              + Add First Area
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {districtFormData.areas.map((area, aIdx) => {
                              const aName = typeof area === "string" ? area : (area.name || "");
                              return (
                                <div
                                  key={area.id || aIdx}
                                  className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5 shadow-2xs"
                                >
                                  <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold shrink-0">
                                    {aIdx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      placeholder="e.g. Saddu, Pandri, Wagholi..."
                                      value={aName}
                                      onChange={(e) =>
                                        handleDistrictUpdateArea(aIdx, e.target.value)
                                      }
                                      required
                                      disabled={isDistrictSubmitting}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDistrictRemoveArea(aIdx)}
                                    disabled={isDistrictSubmitting}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                    title="Remove this area"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isDistrictSubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isDistrictSubmitting
                            ? "Saving..."
                            : editingDistrict
                              ? "Update District & Areas"
                              : "Create District"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDistrictForm(false)}
                          className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Districts Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                          #
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          District Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Areas
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isDistrictsLoading ? (
                        <SkeletonTableRows columns={4} rows={5} />
                      ) : filteredDistricts.length > 0 ? (
                        filteredDistricts.map((dist, idx) => {
                          const assignedCompanies = companies.filter(
                            (c) =>
                              (c.district || "").trim().toLowerCase() ===
                              dist.name.trim().toLowerCase(),
                          );
                          return (
                            <tr
                              key={dist.id}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-2 font-bold text-slate-900">
                                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    <MapPin size={15} />
                                  </span>
                                  {dist.name}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {(() => {
                                  const areasList = (Array.isArray(dist.areas) ? dist.areas : [])
                                    .map((a) => (typeof a === "string" ? a : a?.name || "").trim())
                                    .filter(Boolean);
                                  if (areasList.length > 0) {
                                    return (
                                      <div className="flex flex-wrap gap-1.5 items-center">
                                        {areasList.map((aName, aIdx) => (
                                          <span
                                            key={aIdx}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md"
                                          >
                                            <MapPin size={10} className="text-indigo-500" />
                                            {aName}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  if (assignedCompanies.length > 0) {
                                    return (
                                      <div className="flex flex-wrap gap-1.5">
                                        {assignedCompanies.map((c) => (
                                          <span
                                            key={c.id}
                                            className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-md"
                                          >
                                            {c.name}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return (
                                    <span className="text-slate-400 text-xs italic">
                                      No areas defined
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                                <button
                                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                  onClick={() => handleEditDistrict(dist)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
                                  onClick={() =>
                                    handleDeleteDistrict(dist.id, dist.name)
                                  }
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="px-6 py-8 text-center text-slate-500 font-medium"
                          >
                            {districtSearchQuery ? (
                              <div className="space-y-1.5">
                                <p>
                                  No districts found matching "
                                  <strong className="text-slate-800">
                                    {districtSearchQuery}
                                  </strong>
                                  ".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setDistrictSearchQuery("")}
                                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                                >
                                  Clear Search
                                </button>
                              </div>
                            ) : (
                              'No districts defined. Click "+ Add New District" to create one.'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TRANSPORTERS TAB */}
          {activeTab === "transporters" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Transporter Directory
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Manage logistics partners and mobile contact details.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Search Filter for Transporters */}
                  <div className="relative flex-1 sm:w-72 shadow-2xs rounded-lg">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search transporters by name or phone..."
                      value={transporterSearchQuery}
                      onChange={(e) =>
                        setTransporterSearchQuery(e.target.value)
                      }
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    {transporterSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTransporterSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    onClick={() => {
                      setEditingTransporter(null);
                      setTransporterFormData({ name: "", contact_number: "" });
                      setShowTransporterForm(true);
                    }}
                  >
                    <Plus size={15} /> Add Transporter
                  </button>
                </div>
              </div>

              {/* Transporters Count & Active Filter Indicator */}
              <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-medium">
                {isTransportersLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-36 bg-slate-200/80 rounded animate-pulse" />
                  </div>
                ) : (
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 font-bold">
                      {filteredTransporters.length}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-900 font-bold">
                      {transporters.length}
                    </strong>{" "}
                    transporters
                  </span>
                )}
                {transporterSearchQuery && !isTransportersLoading && (
                  <button
                    type="button"
                    onClick={() => setTransporterSearchQuery("")}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {showTransporterForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto pt-16">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 w-full max-w-2xl relative">
                    <button
                      type="button"
                      onClick={() => setShowTransporterForm(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">
                      {editingTransporter
                        ? "📝 Edit Transporter Details"
                        : "✨ Add Logistics Partner"}
                    </h3>
                    <form
                      onSubmit={handleTransporterSubmit}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Company Name *
                          </label>
                          <input
                            type="text"
                            value={transporterFormData.name}
                            onChange={(e) =>
                              setTransporterFormData({
                                ...transporterFormData,
                                name: e.target.value,
                              })
                            }
                            required
                            disabled={isTransporterSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Logistics Contact Number *
                          </label>
                          <input
                            type="text"
                            value={transporterFormData.contact_number}
                            onChange={(e) =>
                              setTransporterFormData({
                                ...transporterFormData,
                                contact_number: e.target.value,
                              })
                            }
                            required
                            disabled={isTransporterSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isTransporterSubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isTransporterSubmitting
                            ? "Saving..."
                            : "Save Transporter"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTransporterForm(false)}
                          className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Transporters Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Logistics Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Contact Number
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isTransportersLoading ? (
                        <SkeletonTableRows columns={3} rows={4} />
                      ) : filteredTransporters.length > 0 ? (
                        filteredTransporters.map((t) => (
                          <tr
                            key={t.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <strong className="text-slate-900 font-bold">
                                {t.name}
                              </strong>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                              {t.contact_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleEditTransporter(t)}
                              >
                                Edit
                              </button>
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleDeleteTransporter(t.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="3"
                            className="px-6 py-8 text-center text-slate-500 font-medium"
                          >
                            {transporterSearchQuery ? (
                              <div className="space-y-1.5">
                                <p>
                                  No transporters found matching "
                                  <strong className="text-slate-800">
                                    {transporterSearchQuery}
                                  </strong>
                                  ".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setTransporterSearchQuery("")}
                                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                                >
                                  Clear Search
                                </button>
                              </div>
                            ) : (
                              'No transporters defined. Select "+ Add Transporter".'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RECEIVERS TAB */}
          {activeTab === "receivers" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Receivers Directory
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Manage delivery partner sites and contact credentials.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Search Filter for Receivers */}
                  <div className="relative flex-1 sm:w-72 shadow-2xs rounded-lg">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search receivers by name or phone..."
                      value={receiverSearchQuery}
                      onChange={(e) => setReceiverSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    {receiverSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setReceiverSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    onClick={() => {
                      setEditingReceiver(null);
                      setReceiverFormData({ name: "", contact_number: "" });
                      setShowReceiverForm(true);
                    }}
                  >
                    <Plus size={15} /> Add Receiver
                  </button>
                </div>
              </div>

              {/* Receivers Count & Active Filter Indicator */}
              <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-medium">
                {isReceiversLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 bg-slate-200/80 rounded animate-pulse" />
                  </div>
                ) : (
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 font-bold">
                      {filteredReceivers.length}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-900 font-bold">
                      {receivers.length}
                    </strong>{" "}
                    receivers
                  </span>
                )}
                {receiverSearchQuery && !isReceiversLoading && (
                  <button
                    type="button"
                    onClick={() => setReceiverSearchQuery("")}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {showReceiverForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto pt-16">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 w-full max-w-2xl relative">
                    <button
                      type="button"
                      onClick={() => setShowReceiverForm(false)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3">
                      {editingReceiver
                        ? "📝 Edit Receiver Details"
                        : "✨ Add Stock Receiver Profile"}
                    </h3>
                    <form onSubmit={handleReceiverSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Receiver Name *
                          </label>
                          <input
                            type="text"
                            value={receiverFormData.name}
                            onChange={(e) =>
                              setReceiverFormData({
                                ...receiverFormData,
                                name: e.target.value,
                              })
                            }
                            required
                            disabled={isReceiverSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">
                            Contact Number *
                          </label>
                          <input
                            type="text"
                            value={receiverFormData.contact_number}
                            onChange={(e) =>
                              setReceiverFormData({
                                ...receiverFormData,
                                contact_number: e.target.value,
                              })
                            }
                            required
                            disabled={isReceiverSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isReceiverSubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isReceiverSubmitting ? "Saving..." : "Save Receiver"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReceiverForm(false)}
                          className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Receivers Ledger Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Receiver Site / Name
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Contact Number
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {isReceiversLoading ? (
                        <SkeletonTableRows columns={3} rows={4} />
                      ) : filteredReceivers.length > 0 ? (
                        filteredReceivers.map((r) => (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <strong className="text-slate-900 font-bold">
                                {r.name}
                              </strong>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                              {r.contact_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleEditReceiver(r)}
                              >
                                Edit
                              </button>
                              <button
                                className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition-all cursor-pointer"
                                onClick={() => handleDeleteReceiver(r.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="3"
                            className="px-6 py-8 text-center text-slate-500 font-medium"
                          >
                            {receiverSearchQuery ? (
                              <div className="space-y-1.5">
                                <p>
                                  No receivers found matching "
                                  <strong className="text-slate-800">
                                    {receiverSearchQuery}
                                  </strong>
                                  ".
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setReceiverSearchQuery("")}
                                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                                >
                                  Clear Search
                                </button>
                              </div>
                            ) : (
                              'No receivers defined. Select "+ Add Receiver".'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECURE PORTAL LINKS TAB */}
          {activeTab === "portal_links" && (
            <div className="space-y-8">
              {/* Accessibility Header + Searchbar */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                      <Shield className="text-indigo-600" size={24} />
                      Permanent Secure Portal Links
                    </h2>
                    <p className="text-slate-500 text-xs md:text-sm mt-1 font-medium">
                      Copy and share permanent links for vendors, transporters,
                      and receivers to securely submit reports.
                    </p>
                  </div>
                  {/* Accessibility Searchbar */}
                  <div className="relative w-full md:w-80 shadow-sm rounded-lg">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={18} className="text-slate-400" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search portals by name or number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* THREE DISTINCT SECTIONS FOR PORTAL LINKS */}

              {/* SECTION 1: SUPPLIER / VENDOR PORTALS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="bg-emerald-500/10 text-emerald-600 p-1.5 rounded-lg">
                    <ShoppingBag size={18} />
                  </span>
                  Supplier / Vendor Portals
                </h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Vendor Name
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Company Name
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {isVendorsLoading ? (
                          <SkeletonTableRows columns={5} rows={4} />
                        ) : portalFilteredVendors.length > 0 ? (
                          portalFilteredVendors.map((v) => {
                            const baseUrl = window.location.origin;

                            let link = v.portal_link || `/vendor-portal/${v.id}`;
                            if (!link.startsWith("http")) {
                              link = `${baseUrl}${link}`;
                            }

                            return (
                              <tr
                                key={v.id}
                                className="hover:bg-slate-50/40 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <strong
                                    className="text-slate-950 font-bold block truncate max-w-[200px]"
                                    title={v.party_name}
                                  >
                                    {v.party_name}
                                  </strong>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {v.company_name ? (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {v.company_name}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                      Direct
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-medium">
                                  {renderVendorDistrictContactBadges(v)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center max-w-[200px]">
                                    <code
                                      title={link}
                                      className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono text-indigo-700 truncate select-all block w-full"
                                    >
                                      {link.replace(/^https?:\/\/[^/]+/, "") ||
                                        link}
                                    </code>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <button
                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(link);
                                      alert(
                                        "Vendor Portal Link copied to clipboard!",
                                      );
                                    }}
                                  >
                                    <Copy size={12} /> Copy Link
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-4 py-8 text-center text-slate-500 font-medium italic"
                            >
                              No matching vendors found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TRANSPORTER / LOGISTICS PORTALS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="bg-blue-500/10 text-blue-600 p-1.5 rounded-lg">
                    <Truck size={18} />
                  </span>
                  Transporter / Logistics Portals
                </h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Transporter Name
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {isTransportersLoading ? (
                          <SkeletonTableRows columns={4} rows={4} />
                        ) : portalFilteredTransporters.length > 0 ? (
                          portalFilteredTransporters.map((t) => {
                            const baseUrl = window.location.origin;
                            let link =
                              t.portal_link || `/transporter-portal/${t.id}`;
                            if (!link.startsWith("http")) {
                              link = `${baseUrl}${link}`;
                            }

                            return (
                              <tr
                                key={t.id}
                                className="hover:bg-slate-50/40 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <strong
                                    className="text-slate-950 font-bold block truncate max-w-[240px]"
                                    title={t.name}
                                  >
                                    {t.name}
                                  </strong>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-semibold font-mono text-xs">
                                  {t.contact_number || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center max-w-[240px]">
                                    <code
                                      title={link}
                                      className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono text-indigo-700 truncate select-all block w-full"
                                    >
                                      {link.replace(/^https?:\/\/[^/]+/, "") ||
                                        link}
                                    </code>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <button
                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(link);
                                      alert(
                                        "Transporter Portal Link copied to clipboard!",
                                      );
                                    }}
                                  >
                                    <Copy size={12} /> Copy Link
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-4 py-8 text-center text-slate-500 font-medium italic"
                            >
                              No matching transporters found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECTION 3: RECEIVER PORTALS */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="bg-purple-500/10 text-purple-600 p-1.5 rounded-lg">
                    <Package size={18} />
                  </span>
                  Receiver / Site Portals
                </h3>
                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Receiver Name
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {isReceiversLoading ? (
                          <SkeletonTableRows columns={4} rows={4} />
                        ) : portalFilteredReceivers.length > 0 ? (
                          portalFilteredReceivers.map((r) => {
                            const baseUrl = window.location.origin;
                            let link =
                              r.portal_link || `/receiver-portal/${r.id}`;
                            if (!link.startsWith("http")) {
                              link = `${baseUrl}${link}`;
                            }

                            return (
                              <tr
                                key={r.id}
                                className="hover:bg-slate-50/40 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <strong
                                    className="text-slate-950 font-bold block truncate max-w-[240px]"
                                    title={r.name}
                                  >
                                    {r.name}
                                  </strong>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-semibold font-mono text-xs">
                                  {r.contact_number || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center max-w-[240px]">
                                    <code
                                      title={link}
                                      className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono text-indigo-700 truncate select-all block w-full"
                                    >
                                      {link.replace(/^https?:\/\/[^/]+/, "") ||
                                        link}
                                    </code>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <button
                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(link);
                                      alert(
                                        "Receiver Portal Link copied to clipboard!",
                                      );
                                    }}
                                  >
                                    <Copy size={12} /> Copy Link
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-4 py-8 text-center text-slate-500 font-medium italic"
                            >
                              No matching receivers found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating District Area Contacts Preview Popover */}
      {hoverDistrictPreview && (
        <div
          style={(() => {
            if (!hoverDistrictPreview?.rect) return {};
            const { top, bottom, left } = hoverDistrictPreview.rect;
            const modalWidth = 360;
            const modalEstimatedHeight = 280;

            let adjustedLeft = left;
            if (adjustedLeft + modalWidth > window.innerWidth - 16) {
              adjustedLeft = Math.max(16, window.innerWidth - modalWidth - 16);
            }

            const fitsBelow =
              bottom + modalEstimatedHeight < window.innerHeight - 16;
            if (fitsBelow) {
              return {
                position: "fixed",
                top: `${bottom + 4}px`,
                left: `${adjustedLeft}px`,
                width: `${modalWidth}px`,
                zIndex: 9999,
              };
            } else {
              return {
                position: "fixed",
                bottom: `${window.innerHeight - top + 4}px`,
                left: `${adjustedLeft}px`,
                width: `${modalWidth}px`,
                zIndex: 9999,
              };
            }
          })()}
          onMouseEnter={() => {
            if (hoverDistrictTimerRef.current) {
              clearTimeout(hoverDistrictTimerRef.current);
              hoverDistrictTimerRef.current = null;
            }
          }}
          onMouseLeave={handleCloseDistrictHover}
          onClick={(e) => e.stopPropagation()}
          className="district-popover-container bg-white rounded-xl shadow-2xl border border-indigo-100 overflow-hidden ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-150 select-none before:absolute before:-bottom-3 before:left-0 before:right-0 before:h-3 before:content-[''] after:absolute after:-top-3 after:left-0 after:right-0 after:h-3 after:content-['']"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <MapPin size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm tracking-wide text-white uppercase">
                      {hoverDistrictPreview.groups && hoverDistrictPreview.groups.length > 1
                        ? `${hoverDistrictPreview.groups.length} Districts`
                        : hoverDistrictPreview.district}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                      {hoverDistrictPreview.items.length}{" "}
                      {hoverDistrictPreview.items.length === 1
                        ? "Area"
                        : "Areas"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium truncate max-w-[210px]">
                    {hoverDistrictPreview.vendorName}
                    {hoverDistrictPreview.companyName && (
                      <span className="text-slate-400">
                        {" "}
                        • {hoverDistrictPreview.companyName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoverDistrictPreview(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Multi-District Selector (Hover over any district to show its areas) */}
          {hoverDistrictPreview.groups && hoverDistrictPreview.groups.length > 1 && (
            <div className="bg-slate-100/90 border-b border-slate-200 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
                <span>Districts ({hoverDistrictPreview.groups.length}):</span>
                <span className="text-indigo-600 font-semibold normal-case">
                  Hover to switch district
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {hoverDistrictPreview.groups.map((grp, idx) => {
                  const isActive = (hoverDistrictPreview.activeDistrictIndex ?? 0) === idx;
                  return (
                    <button
                      key={grp.districtName}
                      type="button"
                      onMouseEnter={() => handleSelectHoverDistrict(idx)}
                      onClick={() => handleSelectHoverDistrict(idx)}
                      className={`flex items-center justify-between px-2.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-left shadow-xs ${
                        isActive
                          ? "bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-sm"
                          : "bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin
                          size={12}
                          className={isActive ? "text-white" : "text-indigo-600"}
                        />
                        <span className="truncate uppercase">{grp.districtName}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ml-1 ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {grp.items.length} {grp.items.length === 1 ? "area" : "areas"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active District Header Banner */}
          <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between border-b border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {hoverDistrictPreview.district} District Areas
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {hoverDistrictPreview.items.length}{" "}
              {hoverDistrictPreview.items.length === 1 ? "contact" : "contacts"}
            </span>
          </div>

          {/* Area List */}
          <div className="p-3 max-h-72 overflow-y-auto space-y-2 bg-slate-50/60">
            {hoverDistrictPreview.items.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg p-2.5 border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {item.area || `${item.district || hoverDistrictPreview.district} (Direct / All Areas)`}
                  </span>
                  {item.name && (
                    <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 truncate max-w-[140px]" title={item.name}>
                      <User size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800">
                    <Phone size={12} className="text-indigo-600 shrink-0" />
                    <span>{item.phone || item.contact || "No phone"}</span>
                  </div>
                  {(item.phone || item.contact) && (
                    <button
                      type="button"
                      onClick={() => {
                        const num = item.phone || item.contact;
                        navigator.clipboard.writeText(num);
                        setCopiedContactPhone(num);
                        setTimeout(() => setCopiedContactPhone(null), 1800);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                        copiedContactPhone === (item.phone || item.contact)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-white text-slate-600 hover:text-indigo-600 border-slate-200 hover:border-indigo-200"
                      }`}
                    >
                      {copiedContactPhone ===
                      (item.phone || item.contact) ? (
                        <>
                          <Check size={10} className="text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>

                {item.email && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1.5 px-0.5 truncate">
                    <Mail size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{item.email}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 bg-slate-100/70 border-t border-slate-200/60 text-[10px] text-slate-500 flex items-center justify-between">
            <span>District Area Directory</span>
            <span className="font-semibold text-indigo-600">DRINQKART</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
