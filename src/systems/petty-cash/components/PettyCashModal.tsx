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
  advance: string;
  advanceName: string;
  breakage: string;
  breakageName: string;
  shopNameOne: string;
  shopAmountOne: string;
  medicalPersonName: string;
  medicalAmount: string;
  incentiveAmount: string;
  incentiveName: string;
  extraExpenseName: string;
  extraExpenseAmount: string;
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
    date: new Date().toISOString().split("T")[0],
  });

  const [totalAmount, setTotalAmount] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedUsers, setFetchedUsers] = useState<string[]>([]);
  const [fetchedShopNames, setFetchedShopNames] = useState<string[]>([]);
  const [showMiscRemarks, setShowMiscRemarks] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const shopDropdownRef = useRef<HTMLDivElement>(null);
  // [RBAC] Access control helpers
  const { user, hasShopAccess } = useAuth();

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
      const advance = Math.round(parseFloat(entry.advance?.toString() || "0")) || 0;
      const breakage = Math.round(parseFloat(entry.breakage?.toString() || "0")) || 0;
      const shopAmount = Math.round(parseFloat(entry.shopAmountOne?.toString() || "0")) || 0;
      const medical = Math.round(parseFloat(entry.medicalAmount?.toString() || "0")) || 0;
      const incentive = Math.round(parseFloat(entry.incentiveAmount?.toString() || "0")) || 0;
      const extraExpense = Math.round(parseFloat(entry.extraExpenseAmount?.toString() || "0")) || 0;
      return sum + advance + breakage + shopAmount + medical + incentive + extraExpense;
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
      otherExpensesTotal,
    ].reduce((acc, val) => acc + val, 0);

    const grandTotal = expenseSum +
      (Math.round(parseFloat(formData.openingQty)) || 0) +
      (Math.round(parseFloat(formData.closing)) || 0) +
      (Math.round(parseFloat(formData.otherVendorPayment)) || 0) +
      (Math.round(parseFloat(formData.differenceAmount)) || 0);

    setTotalExpense(expenseSum);
    setTotalAmount(grandTotal);
  }, [formData]);

  const fetchUsernames = async () => {
    try {
      const { data, error } = await supabase
        .from('petty_cash_user')
        .select('name');

      if (error) throw error;
      if (data) {
        const usernames = data.map((row: any) => row.name).filter(Boolean);
        setFetchedUsers(usernames);
      }
    } catch (error) {
      console.error("Error fetching usernames:", error);
    }
  };

  const fetchShopNames = async () => {
    try {
      let uniqueShops: string[] = [];
      const { data, error } = await supabase
        .from('petty_cash_shops')
        .select('name')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        const shopNames = data.map((row: any) => row.name).filter(Boolean);
        uniqueShops = Array.from(new Set(shopNames));
      } else {
        uniqueShops = [];
      }

      // [RBAC] Filter by user's allowed shops for non-admin users
      if (user && user.role?.toLowerCase() !== 'admin' && user.shops !== 'all') {
        uniqueShops = uniqueShops.filter((shop) => hasShopAccess(shop));
        console.log('[PettyCashModal] Shops after RBAC filter:', uniqueShops);
      }

      setFetchedShopNames(uniqueShops);

      // [RBAC] Auto-select if user has exactly one allowed shop
      if (uniqueShops.length === 1) {
        setFormData((prev) => ({ ...prev, shopName: uniqueShops[0] }));
      }
    } catch (error) {
      console.error("Error fetching shop names:", error);
    }
  };



  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
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
          date: new Date().toISOString().split("T")[0],
        });
      }
      fetchUsernames();
      fetchShopNames();
    }
  }, [isOpen, initialData]);

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
        advance: "",
        advanceName: "",
        breakage: "",
        breakageName: "",
        shopNameOne: "",
        shopAmountOne: "",
        medicalPersonName: "",
        medicalAmount: "",
        incentiveAmount: "",
        incentiveName: "",
        extraExpenseName: "",
        extraExpenseAmount: ""
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

      const recordToSubmit = {
        patty_id: generatedId,
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
        other_expenses: formData.otherExpenses || []
      };

      let response;
      if (initialData?.id) {
        response = await supabase
          .from('petty_cash_expense')
          .update(recordToSubmit)
          .eq('patty_id', initialData.id);
      } else {
        response = await supabase
          .from('petty_cash_expense')
          .insert([recordToSubmit]);
      }

      if (response.error) throw response.error;

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

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-8">
            {/* Opening/Closing Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="bg-[#2a5298] p-2 rounded-lg">
                  <FaWallet className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Opening & Closing Balance
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* DATE */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent transition-all bg-white"
                    required
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent transition-all bg-white"
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
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Shop Name
                  </label>

                  <div
                    onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                    className={`w-full px-4 py-3 bg-white border rounded-lg cursor-pointer flex justify-between items-center transition-all ${isShopDropdownOpen
                      ? "border-[#2a5298] ring-2 ring-[#2a5298] ring-opacity-20"
                      : "border-gray-300 hover:border-blue-400"
                      }`}
                  >
                    <span className={formData.shopName ? "text-gray-900" : "text-gray-400"}>
                      {formData.shopName || "Select Shop Name"}
                    </span>
                    <FaChevronDown
                      className={`text-gray-400 text-sm transition-transform duration-200 ${isShopDropdownOpen ? "transform rotate-180" : ""
                        }`}
                    />
                  </div>

                  {isShopDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-fadeIn">
                      <ul className="max-h-60 overflow-y-auto hide-scrollbar">
                        {fetchedShopNames.length > 0 ? (
                          fetchedShopNames.map((shop, index) => (
                            <li
                              key={index}
                              onClick={() => {
                                setFormData({ ...formData, shopName: shop });
                                setIsShopDropdownOpen(false);
                              }}
                              className={`px-4 py-3 text-sm cursor-pointer border-b border-gray-50 last:border-none flex items-center justify-between transition-colors ${formData.shopName === shop
                                ? "bg-blue-50 text-[#2a5298] font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                              {shop}
                              {formData.shopName === shop && <FaCheck className="text-xs" />}
                            </li>
                          ))
                        ) : (
                          <li className="px-4 py-3 text-sm text-gray-500 text-center">
                            No shops found
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Opening Qty */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent transition-all bg-white"
                  />
                </div>

                {/* Closing */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Closing Balance <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="closing"
                    value={formData.closing}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent transition-all bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Daily Expenses Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <FaCoffee className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Daily Expenses
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Tea + Nasta */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Tea & Snacks
                  </label>
                  <input
                    type="number"
                    name="teaNasta"
                    value={formData.teaNasta}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Water Jar */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Water Jar
                  </label>
                  <input
                    type="number"
                    name="waterJar"
                    value={formData.waterJar}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Light Bill */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Electricity Bill
                  </label>
                  <input
                    type="number"
                    name="lightBill"
                    value={formData.lightBill}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Recharge */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Recharge
                  </label>
                  <input
                    type="number"
                    name="recharge"
                    value={formData.recharge}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Post Office */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Post Office
                  </label>
                  <input
                    type="number"
                    name="postOffice"
                    value={formData.postOffice}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Customer Discount */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Customer Discount
                  </label>
                  <input
                    type="number"
                    name="customerDiscount"
                    value={formData.customerDiscount}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Maintenance & Repairs Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="p-2 bg-green-600 rounded-lg">
                  <FaTools className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Maintenance & Repairs
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Repair/Maintenance */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Repair & Maintenance
                  </label>
                  <input
                    type="number"
                    name="repairMaintenance"
                    value={formData.repairMaintenance}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Stationary */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Stationary
                  </label>
                  <input
                    type="number"
                    name="stationary"
                    value={formData.stationary}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Fuel & Transport Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="p-2 bg-orange-600 rounded-lg">
                  <FaGasPump className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Fuel & Transport
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Petrol */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Petrol
                  </label>
                  <input
                    type="number"
                    name="petrol"
                    value={formData.petrol}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Patil Petrol */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Patil Petrol
                  </label>
                  <input
                    type="number"
                    name="patilPetrol"
                    value={formData.patilPetrol}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Other Expenses Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <FaShoppingBag className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Other Expenses
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Incentive */}

                {/* Excise/Police */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Excise/Police
                  </label>
                  <input
                    type="number"
                    name="excisePolice"
                    value={formData.excisePolice}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Desi Bhada */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Desi Bhada
                  </label>
                  <input
                    type="number"
                    name="desiBhada"
                    value={formData.desiBhada}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Room Expense */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Room Expense
                  </label>
                  <input
                    type="number"
                    name="roomExpense"
                    value={formData.roomExpense}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Office Expense */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Office Expense
                  </label>
                  <input
                    type="number"
                    name="officeExpense"
                    value={formData.officeExpense}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Personal Expense */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Personal Expense
                  </label>
                  <input
                    type="number"
                    name="personalExpense"
                    value={formData.personalExpense}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Misc. Expense */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Miscellaneous
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMiscRemarks(!showMiscRemarks)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showMiscRemarks ? "Hide Remarks" : "Add Remarks"}
                    </button>
                  </div>
                  <input
                    type="number"
                    name="miscExpense"
                    value={formData.miscExpense}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
                  />
                  {showMiscRemarks && (
                    <input
                      type="text"
                      name="miscRemarks"
                      value={formData.miscRemarks}
                      onChange={handleChange}
                      placeholder="Enter miscellaneous remarks"
                      className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  )}
                </div>

                {/* Dynamic Other Expenses */}
                <div className="col-span-full">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-semibold text-gray-700">
                      Other Expenses (Advance, Breakage, Shop, Medical, Incentive, Extra)
                    </label>
                    <button
                      type="button"
                      onClick={addOtherExpenseEntry}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                    >
                      <FaPlus className="text-xs" />
                      Add Entry
                    </button>
                  </div>

                  {formData.otherExpenses.map((entry, index) => (
                    <div key={index} className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                        {/* Advance */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Advance
                          </label>
                          <input
                            type="number"
                            value={entry.advance}
                            onChange={(e) => updateOtherExpenseEntry(index, "advance", e.target.value)}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Advance Name */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Advance Name
                          </label>
                          <input
                            type="text"
                            value={entry.advanceName}
                            onChange={(e) => updateOtherExpenseEntry(index, "advanceName", e.target.value)}
                            placeholder="Enter name"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Breakage */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Breakage
                          </label>
                          <input
                            type="number"
                            value={entry.breakage}
                            onChange={(e) => updateOtherExpenseEntry(index, "breakage", e.target.value)}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Breakage Name */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Breakage Name
                          </label>
                          <input
                            type="text"
                            value={entry.breakageName}
                            onChange={(e) => updateOtherExpenseEntry(index, "breakageName", e.target.value)}
                            placeholder="Enter name"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Shop Name One */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Shop Name One
                          </label>
                          <input
                            type="text"
                            value={entry.shopNameOne}
                            onChange={(e) => updateOtherExpenseEntry(index, "shopNameOne", e.target.value)}
                            placeholder="Enter shop name"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Shop Amount One */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Shop Amount
                          </label>
                          <input
                            type="number"
                            value={entry.shopAmountOne}
                            onChange={(e) => updateOtherExpenseEntry(index, "shopAmountOne", e.target.value)}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Medical Person Name */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Medical Person Name
                          </label>
                          <input
                            type="text"
                            value={entry.medicalPersonName}
                            onChange={(e) => updateOtherExpenseEntry(index, "medicalPersonName", e.target.value)}
                            placeholder="Enter person name"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Medical Amount */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Medical Amount
                          </label>
                          <input
                            type="number"
                            value={entry.medicalAmount}
                            onChange={(e) => updateOtherExpenseEntry(index, "medicalAmount", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Incentive Amount */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Incentive Amount
                          </label>
                          <input
                            type="number"
                            value={entry.incentiveAmount}
                            onChange={(e) => updateOtherExpenseEntry(index, "incentiveAmount", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Incentive Name */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Incentive Name
                          </label>
                          <input
                            type="text"
                            value={entry.incentiveName}
                            onChange={(e) => updateOtherExpenseEntry(index, "incentiveName", e.target.value)}
                            placeholder="Reason"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Extra Expense Name */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Extra Expense Name
                          </label>
                          <input
                            type="text"
                            value={entry.extraExpenseName}
                            onChange={(e) => updateOtherExpenseEntry(index, "extraExpenseName", e.target.value)}
                            placeholder="Expense Name"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        {/* Extra Expense Amount */}
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-600">
                            Expense Amount
                          </label>
                          <input
                            type="number"
                            value={entry.extraExpenseAmount}
                            onChange={(e) => updateOtherExpenseEntry(index, "extraExpenseAmount", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            placeholder="0"
                            step="1"
                            min="0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Delete Button */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeOtherExpenseEntry(index)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove entry"
                        >
                          <FaTrash />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {formData.otherExpenses.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      No other expenses added. Click "Add Entry" to add expenses like Advance, Breakage, Shop, Medical, Incentive, or Extra Expenses.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payments & Vendors Section */}
            <div className="bg-[#f5f7fa] rounded-lg p-6">
              <div className="flex gap-3 items-center mb-4">
                <div className="p-2 bg-red-600 rounded-lg">
                  <FaCreditCard className="text-lg text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Payments & Vendors
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Other Purchase Voucher No. */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Purchase Voucher No.
                  </label>
                  <input
                    type="text"
                    name="otherPurchaseVoucherNo"
                    value={formData.otherPurchaseVoucherNo}
                    onChange={handleChange}
                    placeholder="Enter voucher number"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Other Vendor Payment */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Vendor Payment
                  </label>
                  <input
                    type="number"
                    name="otherVendorPayment"
                    value={formData.otherVendorPayment}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Difference Amount */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Difference Amount
                  </label>
                  <input
                    type="number"
                    name="differenceAmount"
                    value={formData.differenceAmount}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Credit Card Charges */}
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Credit Card Charges
                  </label>
                  <input
                    type="number"
                    name="creditCardCharges"
                    value={formData.creditCardCharges}
                    onChange={handleChange}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="px-4 py-3 w-full bg-white rounded-lg border border-gray-300 transition-all focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>





          <div className="mt-6 p-4 bg-[#f5f7fa] rounded-lg border border-gray-200 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-lg font-semibold text-gray-600">
                Total Exp. (Spent):
              </span>
              <span className="text-2xl font-bold text-red-600">
                ₹{Math.round(totalExpense)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">
                Total Amount (Grand Total):
              </span>
              <span className="text-2xl font-bold text-[#2a5298]">
                ₹{Math.round(totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-6 mt-6 border-t border-gray-200 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 font-semibold text-gray-700 rounded-lg border border-gray-300 transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-[#2a5298] text-white rounded-lg font-semibold hover:bg-[#1e3d70] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Entry"
              )}
            </button>

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
