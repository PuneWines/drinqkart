import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { supabase } from "../lib/supabase";
import districtService from "../services/districtService";
import "../styles/Settings.css";

const Settings = ({ readOnly = false }) => {
  const { users, fetchUsers, updateUser, createUser, deleteUser, currentUser } =
    useAuthStore();
  const { vendors, fetchVendors, updateVendor, createVendor, deleteVendor } =
    useVendorStore();
  const {
    companies,
    fetchCompanySettings,
    createCompany,
    updateCompany,
    deleteCompany,
  } = useCompanyStore();

  const [activeTab, setActiveTab] = useState("vendors");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [transporterSearchQuery, setTransporterSearchQuery] = useState("");
  const [receiverSearchQuery, setReceiverSearchQuery] = useState("");
  const [districtSearchQuery, setDistrictSearchQuery] = useState("");
  const [availableParties, setAvailableParties] = useState([]);
  const [vendorPartyCompanyMap, setVendorPartyCompanyMap] = useState({});

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
  const [isCustomCompany, setIsCustomCompany] = useState(false);
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

  useEffect(() => {
    fetchUsers();
    fetchVendors();
    fetchAvailableParties();
    fetchCompanySettings();
    fetchDistricts();
    fetchTransporters();
    fetchReceivers();
  }, [fetchUsers, fetchVendors, fetchCompanySettings]);

  const fetchDistricts = async () => {
    const data = await districtService.getDistricts();
    if (data) setDistricts(data);
  };

  const fetchTransporters = async () => {
    const { data } = await supabase
      .from("purchase_transporters")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTransporters(data);
  };

  const fetchReceivers = async () => {
    const { data } = await supabase
      .from("purchase_receivers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReceivers(data);
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
  const handleEditVendor = (vendor) => {
    setEditingVendor(vendor.id);
    setIsCustomCompany(false);

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

    // If company_name is set and contacts is empty, but there is an existing phone number:
    if (
      vendor.company_name &&
      contacts.length === 0 &&
      (vendor.contact_number || vendor.contact)
    ) {
      contacts = [
        {
          district: "",
          phone: vendor.contact_number || vendor.contact || "",
          name: vendor.contact_name || "",
          email: vendor.email || "",
        },
      ];
    }

    setVendorFormData({
      party_name: vendor.party_name || "",
      address: vendor.address || "",
      gstin: vendor.gstin || "",
      contact_name: vendor.contact_name || "",
      contact_number: vendor.contact_number || vendor.contact || "",
      email: vendor.email || "",
      terms: vendor.terms || [],
      company_name: vendor.company_name || "",
      district_contacts: Array.isArray(contacts) ? contacts : [],
    });
    setShowVendorForm(true);
  };

  const handleAddNewVendor = () => {
    setEditingVendor(null);
    setIsCustomCompany(false);
    setVendorFormData({
      party_name: availableParties.length > 0 ? availableParties[0] : "",
      address: "",
      gstin: "",
      contact_name: "",
      contact_number: "",
      email: "",
      terms: [],
      company_name: "",
      district_contacts: [],
    });
    setShowVendorForm(true);
  };

  const handleVendorAddDistrictContact = () => {
    const selectedDistricts = (vendorFormData.district_contacts || [])
      .map((dc) => dc.district)
      .filter(Boolean);
    const firstAvailable =
      districts.find((d) => !selectedDistricts.includes(d.name))?.name || "";

    setVendorFormData((prev) => ({
      ...prev,
      district_contacts: [
        ...(prev.district_contacts || []),
        { district: firstAvailable, phone: "", name: "", email: "" },
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

    setIsVendorSubmitting(true);

    const isScoped = Boolean(
      vendorFormData.company_name && vendorFormData.company_name.trim(),
    );
    let payload = { ...vendorFormData };

    if (isScoped) {
      // When company scope is selected: data is stored exclusively via district_contacts
      const validDistrictContacts = (
        vendorFormData.district_contacts || []
      ).filter((dc) => dc && (dc.district || dc.phone || dc.name || dc.email));
      payload.district_contacts = validDistrictContacts;

      // Sync primary fields to the first district contact for database / schema compatibility
      const firstContact = validDistrictContacts[0];
      payload.contact_number = firstContact ? firstContact.phone || "" : "";
      payload.contact = firstContact ? firstContact.phone || "" : "";
      payload.contact_name = firstContact ? firstContact.name || "" : "";
      payload.email = firstContact ? firstContact.email || "" : "";
    } else {
      // When Direct (no company scope): district_contacts is not used
      payload.district_contacts = [];
    }

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
    setDistrictFormData({ name: "" });
    setShowDistrictForm(true);
  };

  const handleEditDistrict = (dist) => {
    setEditingDistrict(dist.id);
    setDistrictFormData({ name: dist.name || "" });
    setShowDistrictForm(true);
  };

  const handleDistrictSubmit = async (e) => {
    e.preventDefault();
    setIsDistrictSubmitting(true);
    let res;
    if (editingDistrict) {
      res = await districtService.updateDistrict(
        editingDistrict,
        districtFormData.name,
      );
    } else {
      res = await districtService.createDistrict(districtFormData.name);
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
                {vendorSearchQuery && (
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
                          <label className="text-xs font-bold text-slate-700">
                            Party / Vendor Name *
                          </label>
                          <select
                            value={vendorFormData.party_name}
                            onChange={(e) =>
                              setVendorFormData({
                                ...vendorFormData,
                                party_name: e.target.value,
                              })
                            }
                            required
                            disabled={isVendorSubmitting}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                          >
                            <option value="">Select a Party Name</option>
                            {availableParties.map((party, idx) => (
                              <option key={idx} value={party}>
                                {party}
                              </option>
                            ))}
                          </select>
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
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setIsCustomCompany(!isCustomCompany)
                              }
                              className="text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline font-bold cursor-pointer"
                            >
                              {isCustomCompany
                                ? "← Choose from List"
                                : "+ Enter Custom"}
                            </button>
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
                        </div>

                        {isCustomCompany ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Type company or brand name (e.g. BUDWEISER...)"
                              value={vendorFormData.company_name || ""}
                              onChange={(e) =>
                                setVendorFormData({
                                  ...vendorFormData,
                                  company_name: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                          </div>
                        ) : (
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
                            {availableCompaniesForVendor.map((comp) => (
                              <option key={comp} value={comp}>
                                {comp}
                              </option>
                            ))}
                          </select>
                        )}

                        <p className="text-[11px] text-slate-500">
                          {vendorFormData.company_name
                            ? `Active Scope: "${vendorFormData.company_name}". This supplier profile applies to orders matching this company.`
                            : "Direct / All: Available for all purchase orders without brand or company filter."}
                        </p>
                      </div>

                      {/* Primary Contact Details (Only shown when company scope is NOT selected) */}
                      {!vendorFormData.company_name && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700">
                                Primary Contact Phone
                              </label>
                              <input
                                type="text"
                                value={vendorFormData.contact_number}
                                onChange={(e) =>
                                  setVendorFormData({
                                    ...vendorFormData,
                                    contact_number: e.target.value,
                                  })
                                }
                                disabled={isVendorSubmitting}
                                placeholder="e.g. 9822746825"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-700">
                                Email Address
                              </label>
                              <input
                                type="email"
                                value={vendorFormData.email}
                                onChange={(e) =>
                                  setVendorFormData({
                                    ...vendorFormData,
                                    email: e.target.value,
                                  })
                                }
                                disabled={isVendorSubmitting}
                                placeholder="e.g. contact@supplier.com"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700">
                              Contact Person Name
                            </label>
                            <input
                              type="text"
                              value={vendorFormData.contact_name}
                              onChange={(e) =>
                                setVendorFormData({
                                  ...vendorFormData,
                                  contact_name: e.target.value,
                                })
                              }
                              disabled={isVendorSubmitting}
                              placeholder="e.g. Rahul Sharma"
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                          </div>
                        </div>
                      )}

                      {/* District-Wise Vendor Contacts (Only shown when company scope IS selected) */}
                      {Boolean(vendorFormData.company_name) && (
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
                                (districts.length > 0 &&
                                  (vendorFormData.district_contacts?.length ||
                                    0) >= districts.length)
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-indigo-700 rounded border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                districts.length > 0 &&
                                (vendorFormData.district_contacts?.length ||
                                  0) >= districts.length
                                  ? "All available districts have been assigned"
                                  : "Add contact for another district"
                              }
                            >
                              <Plus size={12} /> Add District Contact
                            </button>
                          </div>

                          {!Array.isArray(vendorFormData.district_contacts) ||
                          vendorFormData.district_contacts.length === 0 ? (
                            <div className="text-center py-4 bg-white/70 border border-dashed border-slate-200 rounded-lg">
                              <p className="text-slate-500 text-xs font-medium italic">
                                No district-specific numbers defined for "
                                {vendorFormData.company_name}".
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
                                  // Exclude districts selected in other divs
                                  const otherSelectedDistricts = (
                                    vendorFormData.district_contacts || []
                                  )
                                    .filter((_, idx) => idx !== index)
                                    .map((item) => item.district)
                                    .filter(Boolean);

                                  const availableDistrictsForRow =
                                    districts.filter(
                                      (d) =>
                                        !otherSelectedDistricts.includes(
                                          d.name,
                                        ),
                                    );

                                  return (
                                    <div
                                      key={index}
                                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5 relative group hover:border-slate-300 transition-all"
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] text-indigo-700 font-bold">
                                            {index + 1}
                                          </span>
                                          District Contact{" "}
                                          {dc.district
                                            ? `(${dc.district})`
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

                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                        {/* 1st field: District dropdown */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            1. District *
                                          </label>
                                          <select
                                            value={dc.district || ""}
                                            onChange={(e) =>
                                              handleVendorUpdateDistrictContact(
                                                index,
                                                "district",
                                                e.target.value,
                                              )
                                            }
                                            disabled={isVendorSubmitting}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium cursor-pointer"
                                          >
                                            <option value="">
                                              Select District
                                            </option>
                                            {availableDistrictsForRow.map(
                                              (d) => (
                                                <option
                                                  key={d.id || d.name}
                                                  value={d.name}
                                                >
                                                  {d.name}
                                                </option>
                                              ),
                                            )}
                                          </select>
                                        </div>

                                        {/* 2nd field: Input field for its number for that vendor number */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            2. Contact Number *
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

                                        {/* 3rd field: Contact person name */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            3. Contact Name
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

                                        {/* 4th field: Email */}
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            4. Email Address
                                          </label>
                                          <input
                                            type="email"
                                            placeholder="e.g. pune@supplier.com"
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
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      )}

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
                      {filteredVendors.map((vendor) => (
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
                            {vendor.company_name &&
                            Array.isArray(vendor.district_contacts) &&
                            vendor.district_contacts.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {vendor.district_contacts.map((dc, idx) => (
                                  <span
                                    key={idx}
                                    title={`${dc.district}: ${dc.phone || "No phone"}${dc.name ? ` (${dc.name})` : ""}${dc.email ? ` • ${dc.email}` : ""}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-100"
                                  >
                                    <MapPin
                                      size={9}
                                      className="text-indigo-500 shrink-0"
                                    />
                                    <span className="font-bold text-slate-800">
                                      {dc.district}:
                                    </span>{" "}
                                    {dc.phone || "—"}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="font-semibold text-slate-800">
                                {vendor.contact_number || vendor.contact || "—"}
                              </div>
                            )}
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
                      ))}
                      {filteredVendors.length === 0 && (
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
                      {companies.map((company) => (
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
                      ))}
                      {companies.length === 0 && (
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
                          placeholder="e.g. Pune, Akole , Ahilyanagar..."
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

                      <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={isDistrictSubmitting}
                          className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                          {isDistrictSubmitting
                            ? "Saving..."
                            : editingDistrict
                              ? "Update District"
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
                          Assigned Companies
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredDistricts.map((dist, idx) => {
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              {assignedCompanies.length > 0 ? (
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
                              ) : (
                                <span className="text-slate-400 text-xs italic">
                                  No company assigned yet
                                </span>
                              )}
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
                      })}
                      {filteredDistricts.length === 0 && (
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
                {transporterSearchQuery && (
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
                      {filteredTransporters.map((t) => (
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
                      ))}
                      {portalFilteredTransporters.length === 0 && (
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
                {receiverSearchQuery && (
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
                      {filteredReceivers.map((r) => (
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
                      ))}
                      {portalFilteredReceivers.length === 0 && (
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
                <div className="overflow-hidden border border-slate-150 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/70">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Vendor Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Company Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {portalFilteredVendors.map((v) => {
                          const baseUrl = window.location.origin;

                          let link = v.portal_link || `/vendor-portal/${v.id}`;
                          if (!link.startsWith("http")) {
                            link = `${baseUrl}${link}`;
                          }

                          return (
                            <tr
                              key={v.id}
                              className="hover:bg-slate-50/30 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <strong className="text-slate-950 font-bold">
                                  {v.party_name}
                                </strong>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {v.company_name ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {v.company_name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                    Direct
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">
                                {(() => {
                                  let contacts = v.district_contacts;
                                  if (typeof contacts === "string") {
                                    try {
                                      contacts = JSON.parse(contacts);
                                    } catch (e) {
                                      contacts = [];
                                    }
                                  }
                                  if (
                                    !Array.isArray(contacts) ||
                                    contacts.length === 0
                                  ) {
                                    try {
                                      const cached = localStorage.getItem(
                                        `drinqkart_vendor_district_contacts_${v.id}`,
                                      );
                                      if (cached) contacts = JSON.parse(cached);
                                    } catch (e) {}
                                  }
                                  const list = Array.isArray(contacts)
                                    ? contacts
                                    : [];

                                  if (v.company_name && list.length > 0) {
                                    return (
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {list.map((dc, idx) => (
                                          <span
                                            key={idx}
                                            title={`${dc.district}: ${dc.phone || dc.contact || "No phone"}${dc.name ? ` (${dc.name})` : ""}${dc.email ? ` • ${dc.email}` : ""}`}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-100"
                                          >
                                            <MapPin
                                              size={9}
                                              className="text-indigo-500 shrink-0"
                                            />
                                            <span className="font-bold text-slate-800">
                                              {dc.district}:
                                            </span>{" "}
                                            {dc.phone || dc.contact || "—"}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="font-semibold text-slate-800">
                                      {v.contact_number || v.contact || "—"}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap max-w-xs md:max-w-sm truncate">
                                <code className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs font-mono text-indigo-700 break-all select-all">
                                  {link}
                                </code>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    alert(
                                      "Vendor Portal Link copied to clipboard!",
                                    );
                                  }}
                                >
                                  <Copy size={13} /> Copy Link
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {portalFilteredVendors.length === 0 && (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-6 py-8 text-center text-slate-500 font-medium italic"
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
                <div className="overflow-hidden border border-slate-150 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/70">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Transporter Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {portalFilteredTransporters.map((t) => {
                          const baseUrl = window.location.origin;
                          let link =
                            t.portal_link || `/transporter-portal/${t.id}`;
                          if (!link.startsWith("http")) {
                            link = `${baseUrl}${link}`;
                          }

                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-slate-50/30 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <strong className="text-slate-950 font-bold">
                                  {t.name}
                                </strong>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-semibold">
                                {t.contact_number || "—"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap max-w-xs md:max-w-sm truncate">
                                <code className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs font-mono text-indigo-700 break-all select-all">
                                  {link}
                                </code>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    alert(
                                      "Transporter Portal Link copied to clipboard!",
                                    );
                                  }}
                                >
                                  <Copy size={13} /> Copy Link
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredTransporters.length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-6 py-8 text-center text-slate-500 font-medium italic"
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
                <div className="overflow-hidden border border-slate-150 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50/70">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Receiver Name
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Contact Number
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Permanent Portal URL
                          </th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {portalFilteredReceivers.map((r) => {
                          const baseUrl = window.location.origin;
                          let link =
                            r.portal_link || `/receiver-portal/${r.id}`;
                          if (!link.startsWith("http")) {
                            link = `${baseUrl}${link}`;
                          }

                          return (
                            <tr
                              key={r.id}
                              className="hover:bg-slate-50/30 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <strong className="text-slate-950 font-bold">
                                  {r.name}
                                </strong>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-semibold">
                                {r.contact_number || "—"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap max-w-xs md:max-w-sm truncate">
                                <code className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded text-xs font-mono text-indigo-700 break-all select-all">
                                  {link}
                                </code>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    alert(
                                      "Receiver Portal Link copied to clipboard!",
                                    );
                                  }}
                                >
                                  <Copy size={13} /> Copy Link
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredReceivers.length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-6 py-8 text-center text-slate-500 font-medium italic"
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
    </div>
  );
};

export default Settings;
