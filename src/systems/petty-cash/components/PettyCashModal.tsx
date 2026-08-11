import { useState, useEffect } from "react";
import Toast from "./Toast";
import {
  FaTimes,
  FaWallet,
  FaCoffee,
  FaTools,
  FaGasPump,
  FaShoppingBag,
  FaCreditCard,
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaCheck,
} from "react-icons/fa";
import { useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabase";

interface OtherExpenseEntry {
  expenseName: string;
  employeeName: string;
  fromShop: string;
  toShop: string;
  description: string;
  amount: string;
}

export interface CategoryAmounts {
  id?: string;
  username: string;
  shopName: string;
  openingQty: string;
  teaNasta: string;
  waterJar: string;
  lightBill: string;
  recharge: string;
  postOffice: string;
  customerDiscount: string;
  repairMaintenance: string;
  stationary: string;
  excisePolice: string;
  desiBhada: string;
  otherPurchaseVoucherNo: string;
  otherVendorPayment: string;
  differenceAmount: string;
  petrol: string;
  patilPetrol: string;
  roomExpense: string;
  officeExpense: string;
  personalExpense: string;
  miscExpense: string;
  closing: string;
  creditCardCharges: string;
  otherExpenses: OtherExpenseEntry[];
  miscRemarks: string;

  transactionStatus: string;
  status?: string;

  date: string;
}

interface PettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryAmounts) => void;
  initialData?: CategoryAmounts;
}

export default function PettyCashModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: PettyCashModalProps) {
  const [formData, setFormData] = useState<CategoryAmounts>({
    id: "",
    username: "",
    shopName: "",
    openingQty: "",
    teaNasta: "",
    waterJar: "",
    lightBill: "",
    recharge: "",
    postOffice: "",
    customerDiscount: "",
    repairMaintenance: "",
    stationary: "",
    excisePolice: "",
    desiBhada: "",
    otherPurchaseVoucherNo: "",
    otherVendorPayment: "",
    differenceAmount: "",
    petrol: "",
    patilPetrol: "",
    roomExpense: "",
    officeExpense: "",
    personalExpense: "",
    miscExpense: "",
    closing: "",
    creditCardCharges: "",
    otherExpenses: [],
    miscRemarks: "",

    transactionStatus: "Pending",
    status: "pending",
    date: new Date().toISOString().split("T")[0],
  });

  const [totalAmount, setTotalAmount] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedUsers, setFetchedUsers] = useState<string[]>([]);
  const [fetchedUserDetails, setFetchedUserDetails] = useState<{ userName: string; shopName: any; userAccess: any }[]>([]);
  const [fetchedShopNames, setFetchedShopNames] = useState<string[]>([]);
  const [showMiscRemarks, setShowMiscRemarks] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [availableExpenses, setAvailableExpenses] = useState<string[]>([]);

  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const shopDropdownRef = useRef<HTMLDivElement>(null);
  // [RBAC] Access control helpers
  const { user, hasShopAccess, isAdmin } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(event.target as Node)) {
        setIsShopDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  useEffect(() => {
    const otherExpensesTotal = formData.otherExpenses.reduce((sum, entry) => {
      const amount = Math.round(parseFloat(entry.amount?.toString() || "0")) || 0;
      return sum + amount;
    }, 0);

    const expenseSum = [
      Math.round(parseFloat(formData.teaNasta)) || 0,
      Math.round(parseFloat(formData.waterJar)) || 0,
      Math.round(parseFloat(formData.lightBill)) || 0,
      Math.round(parseFloat(formData.recharge)) || 0,
      Math.round(parseFloat(formData.postOffice)) || 0,
      Math.round(parseFloat(formData.customerDiscount)) || 0,
      Math.round(parseFloat(formData.repairMaintenance)) || 0,
      Math.round(parseFloat(formData.stationary)) || 0,
      Math.round(parseFloat(formData.excisePolice)) || 0,
      Math.round(parseFloat(formData.desiBhada)) || 0,
      Math.round(parseFloat(formData.petrol)) || 0,
      Math.round(parseFloat(formData.patilPetrol)) || 0,
      Math.round(parseFloat(formData.roomExpense)) || 0,
      Math.round(parseFloat(formData.officeExpense)) || 0,
      Math.round(parseFloat(formData.personalExpense)) || 0,
      Math.round(parseFloat(formData.miscExpense)) || 0,
      Math.round(parseFloat(formData.creditCardCharges)) || 0,
      Math.round(parseFloat(formData.otherVendorPayment)) || 0,
      Math.round(parseFloat(formData.differenceAmount)) || 0,
      otherExpensesTotal,
    ].reduce((acc, val) => acc + val, 0);

    const grandTotal = expenseSum + (Math.round(parseFloat(formData.openingQty)) || 0);

    setTotalExpense(grandTotal);
    setTotalAmount(grandTotal);
  }, [formData]);

  const fetchUsernames = async () => {
    try {
      let loggedInName = "";
      try {
        const savedUserStr = localStorage.getItem('currentUser');
        if (savedUserStr) {
          const parsed = JSON.parse(savedUserStr);
          loggedInName = parsed.user_name || "";
        }
      } catch (e) {}
      if (!loggedInName) {
        loggedInName = user?.name || user?.username || localStorage.getItem('currentUserName') || "";
      }

      setFetchedUsers([loggedInName].filter(Boolean));
      setFetchedUserDetails([{
        userName: loggedInName,
        shopName: "All",
        userAccess: "All"
      }]);
    } catch (error) {
      console.error("Error fetching usernames:", error);
    }
  };

   const getFilteredEmployees = () => {
    const targetShop = formData.shopName;
    if (!targetShop) return fetchedUserDetails;

    const userHasShopAccess = (userShopsRaw: any, target: string): boolean => {
      if (!userShopsRaw) return false;
      const targetLower = target.trim().toLowerCase();
      
      if (Array.isArray(userShopsRaw)) {
        return userShopsRaw.some(s => {
          const sLower = String(s).trim().toLowerCase();
          return sLower === 'all' || sLower === targetLower;
        });
      }
      
      const str = String(userShopsRaw).trim().toLowerCase();
      if (str === 'all') return true;
      
      return str.split(',').map(s => s.trim().toLowerCase()).includes(targetLower);
    };

    return fetchedUserDetails.filter(u => userHasShopAccess(u.shopName, targetShop));
  };

  const fetchShopNames = async () => {
    try {
      let uniqueShops: string[] = [];
      const { data, error } = await supabase
        .from('shop')
        .select('*')
        .order('shop_name', { ascending: true });

      if (!error && data && data.length > 0) {
        const shopNames = data.map((row: any) => row.shop_name || row.name).filter(Boolean);
        uniqueShops = Array.from(new Set(shopNames));
      } else {
        const { data: pcData, error: pcError } = await supabase
          .from('petty_cash_shops')
          .select('name')
          .order('id', { ascending: true });

        if (!pcError && pcData) {
          const shopNames = pcData.map((row: any) => row.name).filter(Boolean);
          uniqueShops = Array.from(new Set(shopNames));
        } else {
          uniqueShops = [];
        }
      }

      // Restrict shop names based on the logged-in user's allowed shops, regardless of admin status.
      // (Unless they are allowed "all" shops)
      let rawShops: any = user?.shops;
      if (!rawShops) {
        try {
          const savedUserStr = localStorage.getItem('currentUser');
          if (savedUserStr) {
            const parsed = JSON.parse(savedUserStr);
            rawShops = parsed.shops;
          }
        } catch (e) {}
      }

      let userShops: string[] | 'all' = 'all';
      if (rawShops) {
        if (rawShops === 'all') {
          userShops = 'all';
        } else if (Array.isArray(rawShops)) {
          const flattened: string[] = [];
          rawShops.forEach((item: any) => {
            if (item) {
              item.toString().split(',').forEach((subItem: string) => {
                const trimmed = subItem.trim();
                if (trimmed) flattened.push(trimmed);
              });
            }
          });
          userShops = flattened;
        } else {
          userShops = rawShops.toString().split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      if (userShops && userShops !== 'all') {
        const allowedShops = Array.isArray(userShops) ? userShops : [];
        const filtered = uniqueShops.filter((shop) =>
          allowedShops.some(allowed => allowed.trim().toLowerCase() === shop.trim().toLowerCase())
        );
        uniqueShops = filtered.length > 0 ? filtered : allowedShops;
      }

      setFetchedShopNames(uniqueShops);

      if (uniqueShops.length === 1) {
        setFormData((prev) => ({ ...prev, shopName: uniqueShops[0] }));
      }
    } catch (error) {
      console.error("Error fetching shop names:", error);
    }
  };



  const fetchExpenseOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('master_expenses')
        .select('name')
        .order('name', { ascending: true });
      if (!error && data) {
        setAvailableExpenses(data.map(item => item.name));
      }
    } catch (error) {
      console.error("Error fetching expense options:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      let defaultUser = "";
      try {
        const savedUserStr = localStorage.getItem('currentUser');
        if (savedUserStr) {
          const parsed = JSON.parse(savedUserStr);
          defaultUser = parsed.user_name || "";
        }
      } catch (e) {}
      if (!defaultUser) {
        defaultUser = user?.name || user?.username || localStorage.getItem('currentUserName') || "";
      }
      if (initialData) {
        setFormData({
          ...initialData,
          username: initialData.username || defaultUser,
          status: initialData.status || "pending",
        });

        if (initialData.id) {
          supabase
            .from('petty_cash_expense')
            .select('expense_name, employee_name, from_shop, to_shop, description, amount')
            .like('patty_id', `${initialData.id}%`)
            .then(({ data: rowsData, error }) => {
              if (!error && rowsData) {
                const mappedExpenses = rowsData
                  .filter(row => row.expense_name)
                  .map(row => ({
                    expenseName: row.expense_name,
                    employeeName: row.employee_name || "",
                    fromShop: row.from_shop || "",
                    toShop: row.to_shop || "",
                    description: row.description || "",
                    amount: String(row.amount)
                  }));
                
                setFormData(prev => ({
                  ...prev,
                  otherExpenses: mappedExpenses
                }));
              }
            });
        }
      } else {
        setFormData({
          id: "",
          username: defaultUser,
          shopName: "",
          openingQty: "",
          teaNasta: "",
          waterJar: "",
          lightBill: "",
          recharge: "",
          postOffice: "",
          customerDiscount: "",
          repairMaintenance: "",
          stationary: "",
          excisePolice: "",
          desiBhada: "",
          otherPurchaseVoucherNo: "",
          otherVendorPayment: "",
          differenceAmount: "",
          petrol: "",
          patilPetrol: "",
          roomExpense: "",
          officeExpense: "",
          personalExpense: "",
          miscExpense: "",
          closing: "",
          creditCardCharges: "",
          otherExpenses: [],
          miscRemarks: "",

          transactionStatus: "Pending",
          status: "pending",
          date: new Date().toISOString().split("T")[0],
        });
      }
      fetchUsernames();
      fetchShopNames();
      fetchExpenseOptions();
    }
  }, [isOpen, initialData, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "miscExpense" && (parseFloat(value) > 0 || value.length > 0)) {
      setShowMiscRemarks(true);
    }

    setFormData({ ...formData, [name]: value });
  };


  const addOtherExpenseEntry = () => {
    setFormData({
      ...formData,
      otherExpenses: [...formData.otherExpenses, {
        expenseName: "",
        employeeName: "",
        fromShop: "",
        toShop: "",
        description: "",
        amount: ""
      }]
    });
  };

  const updateOtherExpenseEntry = (index: number, field: keyof OtherExpenseEntry, value: string) => {
    const updated = [...formData.otherExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, otherExpenses: updated });
  };

  const removeOtherExpenseEntry = (index: number) => {
    const updated = formData.otherExpenses.filter((_, i) => i !== index);
    setFormData({ ...formData, otherExpenses: updated });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Generate ID only if it's a new entry (not editing)
      let generatedId = formData.id;
      if (!initialData?.id) {
        try {
          const { data, error } = await supabase
            .from('petty_cash_expense')
            .select('patty_id')
            .order('id', { ascending: false })
            .limit(50);

          if (error) throw error;

          let maxNumber = 0;
          if (data && data.length > 0) {
            data.forEach(item => {
              const idStr = item.patty_id;
              if (idStr && idStr.startsWith('PT-')) {
                const num = parseInt(idStr.split('-')[1]);
                if (!isNaN(num) && num > maxNumber) {
                  maxNumber = num;
                }
              }
            });
          }
          generatedId = `PT-${String(maxNumber + 1).padStart(2, '0')}`;
        } catch (error) {
          console.error("Error generating next PT ID:", error);
          generatedId = `PT-${Date.now()}`;
        }
      }

      let recordsToSubmit = [];
      if (!formData.otherExpenses || formData.otherExpenses.length === 0) {
        recordsToSubmit.push({
          patty_id: `${generatedId}-01`,
          date: formData.date,
          opening_qty: parseFloat(formData.openingQty) || 0,
          closing: parseFloat(formData.closing) || 0,
          shop_name: formData.shopName,
          tea_nasta: parseFloat(formData.teaNasta) || 0,
          water_jar: parseFloat(formData.waterJar) || 0,
          light_bill: parseFloat(formData.lightBill) || 0,
          recharge: parseFloat(formData.recharge) || 0,
          post_office: parseFloat(formData.postOffice) || 0,
          customer_discount: parseFloat(formData.customerDiscount) || 0,
          repair_maintenance: parseFloat(formData.repairMaintenance) || 0,
          stationary: parseFloat(formData.stationary) || 0,
          petrol: parseFloat(formData.petrol) || 0,
          patil_petrol: parseFloat(formData.patilPetrol) || 0,
          excise_police: parseFloat(formData.excisePolice) || 0,
          desi_bhada: parseFloat(formData.desiBhada) || 0,
          room_expense: parseFloat(formData.roomExpense) || 0,
          office_expense: parseFloat(formData.officeExpense) || 0,
          personal_expense: parseFloat(formData.personalExpense) || 0,
          misc_expense: parseFloat(formData.miscExpense) || 0,
          misc_remarks: formData.miscRemarks || "",
          other_purchase_voucher_no: formData.otherPurchaseVoucherNo || "",
          other_vendor_payment: parseFloat(formData.otherVendorPayment) || 0,
          difference_amount: parseFloat(formData.differenceAmount) || 0,
          credit_card_charges: parseFloat(formData.creditCardCharges) || 0,
          username: formData.username || user?.name || "",
          total_expense: totalExpense,
          transaction_status: formData.transactionStatus || 'Pending',
          total_amount: totalAmount,
          status: formData.status || 'pending',
          expense_name: null,
          employee_name: null,
          from_shop: null,
          to_shop: null,
          description: null,
          amount: 0
        });
      } else {
        recordsToSubmit = formData.otherExpenses.map((entry, index) => ({
          patty_id: `${generatedId}-${String(index + 1).padStart(2, '0')}`,
          date: formData.date,
          opening_qty: parseFloat(formData.openingQty) || 0,
          closing: parseFloat(formData.closing) || 0,
          shop_name: formData.shopName,
          tea_nasta: parseFloat(formData.teaNasta) || 0,
          water_jar: parseFloat(formData.waterJar) || 0,
          light_bill: parseFloat(formData.lightBill) || 0,
          recharge: parseFloat(formData.recharge) || 0,
          post_office: parseFloat(formData.postOffice) || 0,
          customer_discount: parseFloat(formData.customerDiscount) || 0,
          repair_maintenance: parseFloat(formData.repairMaintenance) || 0,
          stationary: parseFloat(formData.stationary) || 0,
          petrol: parseFloat(formData.petrol) || 0,
          patil_petrol: parseFloat(formData.patilPetrol) || 0,
          excise_police: parseFloat(formData.excisePolice) || 0,
          desi_bhada: parseFloat(formData.desiBhada) || 0,
          room_expense: parseFloat(formData.roomExpense) || 0,
          office_expense: parseFloat(formData.officeExpense) || 0,
          personal_expense: parseFloat(formData.personalExpense) || 0,
          misc_expense: parseFloat(formData.miscExpense) || 0,
          misc_remarks: formData.miscRemarks || "",
          other_purchase_voucher_no: formData.otherPurchaseVoucherNo || "",
          other_vendor_payment: parseFloat(formData.otherVendorPayment) || 0,
          difference_amount: parseFloat(formData.differenceAmount) || 0,
          credit_card_charges: parseFloat(formData.creditCardCharges) || 0,
          username: formData.username || user?.name || "",
          total_expense: totalExpense,
          transaction_status: formData.transactionStatus || 'Pending',
          total_amount: totalAmount,
          status: formData.status || 'pending',
          expense_name: entry.expenseName || null,
          employee_name: (entry.expenseName !== 'Shop Name' && entry.expenseName !== 'Custom Expense Name' && entry.expenseName !== 'Incentive') ? (entry.employeeName || null) : null,
          from_shop: null,
          to_shop: entry.expenseName === 'Shop Name' ? (entry.toShop || null) : null,
          description: entry.description || null,
          amount: parseFloat(entry.amount) || 0
        }));
      }

      if (initialData?.id) {
        const { error: delError } = await supabase
          .from('petty_cash_expense')
          .delete()
          .like('patty_id', `${initialData.id}%`);
        if (delError) throw delError;
      }

      const { error: insertError } = await supabase
        .from('petty_cash_expense')
        .insert(recordsToSubmit);

      if (insertError) throw insertError;

      setToast({ message: "Data saved successfully!", type: "success" });
      setTimeout(() => {
        onSave({ ...formData, id: generatedId });
        onClose();
        setIsLoading(false);
      }, 1000);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      setToast({ message: "Error saving: " + (error.message || error), type: "error" });
      setIsLoading(false);
    }
  };



  if (!isOpen) return null;

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[#f5f7fa] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#f5f7fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            Petty Cash Entry{initialData?.id ? ` - ID: ${initialData.id}` : ""}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
          >
            <FaTimes className="text-xl text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* ── Primary Info Fields (Compact Row) ── */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* DATE */}
              <div>
                <label className="block mb-1 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block mb-1 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  User <span className="text-red-500">*</span>
                </label>
                <select
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
                  required
                >
                  <option value="">Select User</option>
                  {fetchedUsers.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shop Name */}
              <div className="relative" ref={shopDropdownRef}>
                <label className="block mb-1 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Shop Name
                </label>

                <div
                  onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-md cursor-pointer flex justify-between items-center text-xs transition-all ${isShopDropdownOpen
                    ? "border-[#2a5298] ring-1 ring-[#2a5298]"
                    : "border-gray-300 hover:border-blue-400"
                    }`}
                >
                  <span className={formData.shopName ? "text-gray-900 font-medium truncate" : "text-gray-400"}>
                    {formData.shopName || "Select Shop Name"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 text-[10px] shrink-0 transition-transform duration-200 ${isShopDropdownOpen ? "transform rotate-180" : ""
                      }`}
                  />
                </div>

                {isShopDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                    <ul className="max-h-52 overflow-y-auto hide-scrollbar text-xs">
                      {fetchedShopNames.length > 0 ? (
                        fetchedShopNames.map((shop, index) => (
                          <li
                             key={index}
                            onClick={() => {
                              setFormData({ ...formData, shopName: shop });
                              setIsShopDropdownOpen(false);
                            }}
                            className={`px-3 py-2 cursor-pointer border-b border-gray-50 last:border-none flex items-center justify-between transition-colors ${formData.shopName === shop
                              ? "bg-blue-50 text-[#2a5298] font-semibold"
                              : "text-gray-700 hover:bg-gray-50"
                              }`}
                          >
                            {shop}
                            {formData.shopName === shop && <FaCheck className="text-[10px]" />}
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-gray-500 text-center">
                          No shops found
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Opening Qty */}
              <div>
                <label className="block mb-1 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Opening Balance <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="openingQty"
                  value={formData.openingQty}
                  onChange={handleChange}
                  placeholder="0"
                  step="1"
                  min="0"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-semibold text-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* ── Expenses Inputs Grid (Compact 5-Column Layout) ── */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Tea & Snacks</label>
                <input type="number" name="teaNasta" value={formData.teaNasta} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Water Jar</label>
                <input type="number" name="waterJar" value={formData.waterJar} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Electricity Bill</label>
                <input type="number" name="lightBill" value={formData.lightBill} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Recharge</label>
                <input type="number" name="recharge" value={formData.recharge} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Post Office</label>
                <input type="number" name="postOffice" value={formData.postOffice} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Customer Discount</label>
                <input type="number" name="customerDiscount" value={formData.customerDiscount} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Repair & Maintenance</label>
                <input type="number" name="repairMaintenance" value={formData.repairMaintenance} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Stationary</label>
                <input type="number" name="stationary" value={formData.stationary} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Petrol</label>
                <input type="number" name="petrol" value={formData.petrol} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Patil Petrol</label>
                <input type="number" name="patilPetrol" value={formData.patilPetrol} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Excise/Police</label>
                <input type="number" name="excisePolice" value={formData.excisePolice} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Desi Bhada</label>
                <input type="number" name="desiBhada" value={formData.desiBhada} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Room Expense</label>
                <input type="number" name="roomExpense" value={formData.roomExpense} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Office Expense</label>
                <input type="number" name="officeExpense" value={formData.officeExpense} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Personal Expense</label>
                <input type="number" name="personalExpense" value={formData.personalExpense} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-medium text-gray-600">Miscellaneous</label>
                  <button
                    type="button"
                    onClick={() => setShowMiscRemarks(!showMiscRemarks)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showMiscRemarks ? "Hide" : "+ Remarks"}
                  </button>
                </div>
                <input type="number" name="miscExpense" value={formData.miscExpense} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white" />
                {showMiscRemarks && (
                  <input type="text" name="miscRemarks" value={formData.miscRemarks} onChange={handleChange} placeholder="Misc remarks..." className="w-full px-2.5 py-1 text-[11px] border border-gray-300 rounded-md bg-white mt-1" />
                )}
              </div>
            </div>
          </div>

          {/* ── Payments & Voucher Info Grid ── */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Purchase Voucher No.</label>
                <input type="text" name="otherPurchaseVoucherNo" value={formData.otherPurchaseVoucherNo} onChange={handleChange} placeholder="Voucher No." className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Vendor Payment</label>
                <input type="number" name="otherVendorPayment" value={formData.otherVendorPayment} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Difference Amount</label>
                <input type="number" name="differenceAmount" value={formData.differenceAmount} onChange={handleChange} placeholder="0" step="1" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white" />
              </div>

              <div>
                <label className="block mb-1 text-[11px] font-medium text-gray-600">Credit Card Charges</label>
                <input type="number" name="creditCardCharges" value={formData.creditCardCharges} onChange={handleChange} placeholder="0" step="1" min="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white" />
              </div>
            </div>
          </div>

          {/* ── Dynamic Other Expenses ── */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Additional Custom Expenses (Advance, Breakage, Medical, etc.)
              </h4>
            </div>

            {formData.otherExpenses.map((entry, index) => {
              const isShopName = entry.expenseName === "Shop Name";
              return (
                <div key={index} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {/* Expense Name */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Expense Name *</label>
                      <select
                        value={entry.expenseName}
                        onChange={(e) => updateOtherExpenseEntry(index, "expenseName", e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                        required
                      >
                        <option value="">Select Expense</option>
                        {availableExpenses.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {isShopName ? (
                      <>
                        {/* To Shop */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">To Shop</label>
                          <select
                            value={entry.toShop}
                            onChange={(e) => updateOtherExpenseEntry(index, "toShop", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                          >
                            <option value="">Select To</option>
                            {fetchedShopNames.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      (entry.expenseName !== "Custom Expense Name" && entry.expenseName !== "Incentive") && (
                        <>
                          {/* Employee Name */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Employee Name</label>
                            <select
                              value={entry.employeeName}
                              onChange={(e) => updateOtherExpenseEntry(index, "employeeName", e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                            >
                              <option value="">Select Employee</option>
                              {getFilteredEmployees().map(u => (
                                <option key={u.userName} value={u.userName}>{u.userName}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )
                    )}

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Description/Brand Name</label>
                      <input
                        type="text"
                        value={entry.description}
                        onChange={(e) => updateOtherExpenseEntry(index, "description", e.target.value)}
                        placeholder="Remarks / details..."
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Amount *</label>
                      <input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateOtherExpenseEntry(index, "amount", e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-semibold text-gray-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => removeOtherExpenseEntry(index)}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <FaTrash className="text-[10px]" />
                      <span>Remove Entry</span>
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-start pt-1">
              <button
                type="button"
                onClick={addOtherExpenseEntry}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#2a5298] text-white rounded-md hover:bg-[#1e3d70] transition-all cursor-pointer font-semibold"
              >
                <FaPlus className="text-[10px]" />
                <span>Add Entry</span>
              </button>
            </div>
          </div>

          {/* ── Summary & Actions Bar ── */}
          <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-xs text-gray-500 block font-medium">Total Expenses (Spent)</span>
                <span className="text-xl font-bold text-red-600">₹{Math.round(totalExpense)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {initialData?.id && (
                <div className="flex items-center gap-1.5 mr-2">
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Status:</label>
                  <select
                    name="status"
                    value={formData.status || "pending"}
                    onChange={handleChange}
                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-semibold text-gray-800"
                  >
                    <option value="pending">pending</option>
                    <option value="completed">completed</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-[#2a5298] text-white rounded-lg text-xs font-semibold hover:bg-[#1e3d70] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {isLoading ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </form>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
