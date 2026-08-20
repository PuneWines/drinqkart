// ============================================================
// CashTally.tsx - RBAC: Counter Access + Shop Filter
//
// Changes from original:
//   - hasCounterAccess() use karta hai counter check ke liye
//   - "Counter 1", "Cash Tally - Counter 1" dono formats support
//   - Shop dropdown: Admin ko sab shops, baaki ko sirf allowed shops
//   - Auto-select if user has exactly one shop
// ============================================================
import { useState, useEffect } from "react";
import Toast from "../components/Toast";
import { FaTimes, FaUser, FaShoppingCart, FaTruck, FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabase";

const RETAIL_OPTIONS = [
  { key: "retail500", label: "₹500 (Cash)", isCash: true, denom: 500 },
  { key: "retail200", label: "₹200 (Cash)", isCash: true, denom: 200 },
  { key: "retail100", label: "₹100 (Cash)", isCash: true, denom: 100 },
  { key: "retail50", label: "₹50 (Cash)", isCash: true, denom: 50 },
  { key: "retail20", label: "₹20 (Cash)", isCash: true, denom: 20 },
  { key: "retail10", label: "₹10 (Cash)", isCash: true, denom: 10 },
  { key: "retail1", label: "₹1 (Cash)", isCash: true, denom: 1 },
  { key: "retailGpay", label: "GPay/UPI (Digital)", isCash: false },
  { key: "retailCard", label: "Card Payments (Digital)", isCash: false },
  { key: "retailPhonePe", label: "PhonePe (Digital)", isCash: false },
  { key: "retailPaytm", label: "Paytm (Digital)", isCash: false },
  { key: "expense", label: "General Expense (Outflow)", isCash: false },
];

const WHOLESALE_OPTIONS = [
  { key: "ws500", label: "₹500 (Cash)", isCash: true, denom: 500 },
  { key: "ws200", label: "₹200 (Cash)", isCash: true, denom: 200 },
  { key: "ws100", label: "₹100 (Cash)", isCash: true, denom: 100 },
  { key: "ws50", label: "₹50 (Cash)", isCash: true, denom: 50 },
  { key: "ws20", label: "₹20 (Cash)", isCash: true, denom: 20 },
  { key: "ws10", label: "₹10 (Cash)", isCash: true, denom: 10 },
  { key: "ws1", label: "₹1 (Cash)", isCash: true, denom: 1 },
  { key: "wsGpayCard", label: "GPay/Card (Digital)", isCash: false },
  { key: "wsPhonePe", label: "PhonePe (Digital)", isCash: false },
  { key: "wsPaytm", label: "Paytm (Digital)", isCash: false },
  { key: "wsCard", label: "Card Payments (Digital)", isCash: false },
];

const EXPENSE_OPTIONS = [
  { key: "hd500", label: "₹500 (Cash)", isCash: true, denom: 500 },
  { key: "hd200", label: "₹200 (Cash)", isCash: true, denom: 200 },
  { key: "hd100", label: "₹100 (Cash)", isCash: true, denom: 100 },
  { key: "hd50", label: "₹50 (Cash)", isCash: true, denom: 50 },
  { key: "hd20", label: "₹20 (Cash)", isCash: true, denom: 20 },
  { key: "hd10", label: "₹10 (Cash)", isCash: true, denom: 10 },
  { key: "hd1", label: "₹1 (Cash)", isCash: true, denom: 1 },
  { key: "hdGpay", label: "GPay/UPI (Digital)", isCash: false },
  { key: "hdCard", label: "Card Payments (Digital)", isCash: false },
  { key: "hdPhonePe", label: "PhonePe (Digital)", isCash: false },
  { key: "hdPaytm", label: "Paytm (Digital)", isCash: false },
];

interface CashTallyProps {
  isOpen?: boolean;
  onClose?: () => void;
  counter?: string | number;
  initialData?: any;
}

export default function CashTally({
  isOpen = true,
  onClose = () => { },
  counter = "COUNTER-1",
  initialData,
}: CashTallyProps) {
  // ── RBAC ─────────────────────────────────────────────────
  const { hasCounterAccess, hasShopAccess, isAdmin, user, getAllowedCounters } = useAuth();

  const [allowedCounters, setAllowedCounters] = useState<string[]>([]);
  const [activeCounter, setActiveCounter] = useState<string>("COUNTER-1");
  const [userShops, setUserShops] = useState<string[]>([]);

  // Dynamic transactions sections
  const [addedTransactions, setAddedTransactions] = useState<string[]>([]);
  const [selectedTxType, setSelectedTxType] = useState("Retail Transactions");

  // Retail dynamic selector states
  const [selectedRetailKey, setSelectedRetailKey] = useState("retail500");
  const [retailValueInput, setRetailValueInput] = useState("");

  // Wholesale dynamic selector states
  const [selectedWSKey, setSelectedWSKey] = useState("ws500");
  const [wsValueInput, setWsValueInput] = useState("");

  // Expenses dynamic selector states
  const [selectedExpenseKey, setSelectedExpenseKey] = useState("hd500");
  const [expenseValueInput, setExpenseValueInput] = useState("");

  // Shared inline-edit state for all three denomination lists
  const [inlineEdit, setInlineEdit] = useState<{ key: string; value: string } | null>(null);

  const handleInlineEditDone = () => {
    if (!inlineEdit || !inlineEdit.value) { setInlineEdit(null); return; }
    setFormData(prev => ({ ...prev, [inlineEdit.key]: inlineEdit.value }));
    setInlineEdit(null);
  };
  const handleInlineEditCancel = () => setInlineEdit(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    name: "",
    shopName: "",
    retailScanAmount: "",
    retail500: "",
    retail200: "",
    retail100: "",
    retail50: "",
    retail20: "",
    retail10: "",
    retail1: "",
    retailGpay: "",
    retailCard: "",
    retailPhonePe: "",
    retailPaytm: "",
    expense: "",
    wsCashBillingAmount: "",
    wsCreditBillingAmount: "",
    wsCreditReceipt: "",
    ws500: "",
    ws200: "",
    ws100: "",
    ws50: "",
    ws20: "",
    ws10: "",
    ws1: "",
    wsGpayCard: "",
    wsPhonePe: "",
    wsPaytm: "",
    wsCard: "",
    homeDelivery: "",
    hd500: "",
    hd200: "",
    hd100: "",
    hd50: "",
    hd20: "",
    hd10: "",
    hd1: "",
    hdGpay: "",
    hdCard: "",
    hdPhonePe: "",
    hdPaytm: "",
    voidSale: "",
    status: "pending",
  });

  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<string[]>([]);
  const [fetchedShopNames, setFetchedShopNames] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchEmployees = async () => {
    try {
      let loggedInName = "";
      let loggedInShopName = "";
      try {
        const savedUserStr = localStorage.getItem('currentUser');
        if (savedUserStr) {
          const parsed = JSON.parse(savedUserStr);
          loggedInName = parsed.user_name || "";
          loggedInShopName = parsed.shop_name || parsed.shopName || parsed.shops || "";
        }
      } catch (e) { }
      if (!loggedInName) {
        loggedInName = user?.name || user?.username || "";
      }
      if (!loggedInShopName) {
        loggedInShopName = (user as any)?.shop_name || (user as any)?.shops || "";
      }
      setEmployees([loggedInName].filter(Boolean));

      let foundShops: string[] = [];
      if (loggedInShopName) {
        foundShops = Array.from(new Set(
          String(loggedInShopName).split(',').map((s: string) => s.trim()).filter(Boolean)
        ));
      }

      // Fallback to fetching shop names from users table if not in localStorage
      if (foundShops.length === 0 && loggedInName) {
        const { data, error } = await supabase
          .from('users')
          .select('shop_name')
          .or(`user_name.eq."${loggedInName}",username.eq."${loggedInName}"`);

        if (!error && data && data.length > 0) {
          const rawShopsStr = data.map((d: any) => d.shop_name).filter(Boolean).join(',');
          foundShops = Array.from(new Set(
            rawShopsStr.split(',').map((s: string) => s.trim()).filter(Boolean)
          ));
        }
      }

      setUserShops(foundShops);

      // Auto-populate initial shopName if not set
      if (foundShops.length > 0) {
        setFormData(prev => ({
          ...prev,
          shopName: prev.shopName || foundShops[0]
        }));
      }
    } catch (error) {
      console.error("[CashTally] Error fetching employees/shops:", error);
    }
  };

  const fetchShopNames = async () => {
    try {
      let uniqueShops: string[] = [];
      const { data, error } = await supabase
        .from('shop')
        .select('*')
        .order('shop_name', { ascending: true });

      if (!error && data && data.length > 0) {
        const shopNames = data.map((row: any) => row.shop_name || row.name || row.shop).filter(Boolean);
        uniqueShops = Array.from(new Set(shopNames));
      } else {
        const { data: pcData, error: pcError } = await supabase
          .from('petty_cash_shops')
          .select('*')
          .order('id', { ascending: true });

        if (!pcError && pcData) {
          const shopNames = pcData.map((row: any) => row.name || row.shop_name).filter(Boolean);
          uniqueShops = Array.from(new Set(shopNames));
        } else {
          uniqueShops = [];
        }
      }

      const isMasterOrAdmin = isAdmin() || (user?.username || user?.name || '').toLowerCase() === 'masteradmin' || (user?.role || '').toLowerCase() === 'admin' || (user?.role || '').toLowerCase() === 'masteradmin';

      if (!isMasterOrAdmin && user?.shops && user.shops !== "all") {
        const filtered = uniqueShops.filter((shop) => hasShopAccess(shop));
        if (filtered.length > 0) {
          uniqueShops = filtered;
        }
      }

      setFetchedShopNames(uniqueShops);

      if (uniqueShops.length === 1) {
        setFormData((prev) => ({ ...prev, shopName: uniqueShops[0] }));
      }
    } catch (error) {
      console.error("[CashTally] Error fetching shops:", error);
    }
  };

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    name: "",
    shopName: "",
    retailScanAmount: "",
    retail500: "",
    retail200: "",
    retail100: "",
    retail50: "",
    retail20: "",
    retail10: "",
    retail1: "",
    retailGpay: "",
    retailCard: "",
    retailPhonePe: "",
    retailPaytm: "",
    expense: "",
    wsCashBillingAmount: "",
    wsCreditBillingAmount: "",
    wsCreditReceipt: "",
    ws500: "",
    ws200: "",
    ws100: "",
    ws50: "",
    ws20: "",
    ws10: "",
    ws1: "",
    wsGpayCard: "",
    wsPhonePe: "",
    wsPaytm: "",
    wsCard: "",
    homeDelivery: "",
    hd500: "",
    hd200: "",
    hd100: "",
    hd50: "",
    hd20: "",
    hd10: "",
    hd1: "",
    hdGpay: "",
    hdCard: "",
    hdPhonePe: "",
    hdPaytm: "",
    voidSale: "",
    status: "pending",
  };

  useEffect(() => {
    const parseAllowedCounters = () => {
      try {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u && Array.isArray(u.counter_access)) {
            return u.counter_access.map((c: any) => String(c).trim().toUpperCase());
          }
          if (u && Array.isArray(u.counterAccess)) {
            return u.counterAccess.map((c: any) => String(c).trim().toUpperCase());
          }
        }
      } catch (e) {
        console.error("[CashTally] Error parsing currentUser:", e);
      }

      try {
        const hrUserStr = localStorage.getItem("hr_user");
        if (hrUserStr) {
          const hr = JSON.parse(hrUserStr);
          if (hr && Array.isArray(hr.counter_access)) {
            return hr.counter_access.map((c: any) => String(c).trim().toUpperCase());
          }
        }
      } catch (e) {
        console.error("[CashTally] Error parsing hr_user:", e);
      }

      return getAllowedCounters();
    };

    setAllowedCounters(parseAllowedCounters());
  }, []);

  useEffect(() => {
    if (isOpen) {
      let defaultUser = "";
      try {
        const savedUserStr = localStorage.getItem('currentUser');
        if (savedUserStr) {
          const parsed = JSON.parse(savedUserStr);
          defaultUser = parsed.user_name || "";
        }
      } catch (e) { }
      if (!defaultUser) {
        defaultUser = user?.name || user?.username || "";
      }
      const defaultCounter = initialData?.counter || counter || allowedCounters[0] || "COUNTER-1";
      setActiveCounter(String(defaultCounter));

      if (initialData) {
        setFormData({
          ...initialData,
          name: initialData.name || defaultUser,
          status: initialData.status || "pending",
        });

        // Determine added transaction sections based on non-zero fields
        const active: string[] = [];
        const hasRetail = initialData.retail_scan_amount || initialData.retail_500 || initialData.retail_200 || initialData.retail_100 || initialData.retail_50 || initialData.retail_20 || initialData.retail_10 || initialData.retail_1 || initialData.retail_gpay || initialData.retail_phonepe || initialData.retail_paytm || initialData.retail_card || initialData.expense;
        if (hasRetail) active.push("Retail Transactions");

        const hasWS = initialData.ws_cash_billing_amount || initialData.ws_credit_billing_amount || initialData.ws_credit_receipt || initialData.ws_500 || initialData.ws_200 || initialData.ws_100 || initialData.ws_50 || initialData.ws_20 || initialData.ws_10 || initialData.ws_1 || initialData.ws_gpay_card || initialData.ws_phonepe || initialData.ws_paytm || initialData.ws_card;
        if (hasWS) active.push("Wholesale Transactions");

        const hasOther = initialData.home_delivery || initialData.homeDelivery || initialData.void_sale || initialData.voidSale || initialData.hd500 || initialData.hd200 || initialData.hd100 || initialData.hd50 || initialData.hd20 || initialData.hd10 || initialData.hd1 || initialData.hdGpay || initialData.hdCard || initialData.hdPhonePe || initialData.hdPaytm || initialData.retail_1500 || initialData.expense_gpay_card;
        if (hasOther) active.push("Home Delivery Transactions");

        setAddedTransactions(active);
      } else {
        setFormData({
          ...emptyForm,
          name: defaultUser,
        });
        setAddedTransactions([]);
      }
      fetchEmployees();
      fetchShopNames();
    }
  }, [isOpen, initialData, user, counter, allowedCounters]);

  const handleAddTransaction = () => {
    if (selectedTxType && !addedTransactions.includes(selectedTxType)) {
      setAddedTransactions(prev => [selectedTxType, ...prev]);
    }
  };

  const handleRemoveTransaction = (type: string) => {
    setAddedTransactions(prev => prev.filter(t => t !== type));
  };

  const handleAddRetailDenom = () => {
    if (!retailValueInput) return;
    setFormData(prev => ({
      ...prev,
      [selectedRetailKey]: retailValueInput
    }));
    setRetailValueInput("");
  };

  const handleRemoveRetailDenom = (key: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: ""
    }));
  };

  const handleEditRetailDenom = (key: string, value: any) => {
    setInlineEdit({ key, value: String(value || "") });
  };

  const handleAddWSDenom = () => {
    if (!wsValueInput) return;
    setFormData(prev => ({
      ...prev,
      [selectedWSKey]: wsValueInput
    }));
    setWsValueInput("");
  };

  const handleRemoveWSDenom = (key: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: ""
    }));
  };

  const handleEditWSDenom = (key: string, value: any) => {
    setInlineEdit({ key, value: String(value || "") });
  };

  const handleAddExpenseDenom = () => {
    if (!expenseValueInput) return;
    setFormData(prev => ({
      ...prev,
      [selectedExpenseKey]: expenseValueInput
    }));
    setExpenseValueInput("");
  };

  const handleRemoveExpenseDenom = (key: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: ""
    }));
  };

  const handleEditExpenseDenom = (key: string, value: any) => {
    setInlineEdit({ key, value: String(value || "") });
  };

  const [retailActualScanAmount, setRetailActualScanAmount] = useState(0);
  const [retailActualSale, setRetailActualSale] = useState(0);
  const [retailDiff, setRetailDiff] = useState(0);
  const [wholesaleActualSale, setWholesaleActualSale] = useState(0);
  const [wholesaleTotalBilling, setWholesaleTotalBilling] = useState(0);
  const [wholesaleDiff, setWholesaleDiff] = useState(0);
  const [expensesAndOthersTotalAmount, setExpensesAndOthersTotalAmount] = useState(0);
  const [homeDeliveryDiff, setHomeDeliveryDiff] = useState(0);

  useEffect(() => {
    // 1. Retail Calculations
    const retailCashSum = [
      (Math.round(parseFloat(formData.retail500)) || 0) * 500,
      (Math.round(parseFloat(formData.retail200)) || 0) * 200,
      (Math.round(parseFloat(formData.retail100)) || 0) * 100,
      (Math.round(parseFloat(formData.retail50)) || 0) * 50,
      (Math.round(parseFloat(formData.retail20)) || 0) * 20,
      (Math.round(parseFloat(formData.retail10)) || 0) * 10,
      (Math.round(parseFloat(formData.retail1)) || 0) * 1,
    ].reduce((acc, val) => acc + val, 0);

    const retailGpay = Math.round(parseFloat(formData.retailGpay)) || 0;
    const retailCard = Math.round(parseFloat(formData.retailCard)) || 0;
    const retailPhonePe = Math.round(parseFloat(formData.retailPhonePe)) || 0;
    const retailPaytm = Math.round(parseFloat(formData.retailPaytm)) || 0;
    const retailExpense = Math.round(parseFloat(formData.expense)) || 0;

    // Actual scan amount = scan amount - void sale
    const scanAmt = Math.round(parseFloat(formData.retailScanAmount)) || 0;
    const voidSaleAmt = Math.round(parseFloat(formData.voidSale)) || 0;
    const actualScanAmt = scanAmt - voidSaleAmt;
    setRetailActualScanAmount(actualScanAmt);

    // Actual sale = sum total amount of all the denominations/payments added
    const actualSale =
      retailCashSum + retailGpay + retailCard + retailPhonePe + retailPaytm + retailExpense;
    setRetailActualSale(actualSale);

    // Diff = actual scan amount - actual sale
    setRetailDiff(actualScanAmt - actualSale);

    // 2. Wholesale Calculations
    const wholesaleCashSum = [
      (Math.round(parseFloat(formData.ws500)) || 0) * 500,
      (Math.round(parseFloat(formData.ws200)) || 0) * 200,
      (Math.round(parseFloat(formData.ws100)) || 0) * 100,
      (Math.round(parseFloat(formData.ws50)) || 0) * 50,
      (Math.round(parseFloat(formData.ws20)) || 0) * 20,
      (Math.round(parseFloat(formData.ws10)) || 0) * 10,
      (Math.round(parseFloat(formData.ws1)) || 0) * 1,
    ].reduce((acc, val) => acc + val, 0);

    const totalWhoBilling =
      (Math.round(parseFloat(formData.wsCashBillingAmount)) || 0) +
      (Math.round(parseFloat(formData.wsCreditReceipt)) || 0);
    setWholesaleTotalBilling(totalWhoBilling);

    const wsGpayCard = Math.round(parseFloat(formData.wsGpayCard)) || 0;
    const wsPhonePe = Math.round(parseFloat(formData.wsPhonePe)) || 0;
    const wsPaytm = Math.round(parseFloat(formData.wsPaytm)) || 0;
    const wsCard = Math.round(parseFloat(formData.wsCard)) || 0;

    // Wholesale actual sale
    const wholesaleActualSaleVal =
      wholesaleCashSum + wsGpayCard + wsPhonePe + wsPaytm + wsCard;
    setWholesaleActualSale(wholesaleActualSaleVal);

    // Wholesale Diff = total billing - actual sale
    setWholesaleDiff(totalWhoBilling - wholesaleActualSaleVal);

    // 3. Home Delivery Calculations
    const hdCashSum = [
      (Math.round(parseFloat(formData.hd500)) || 0) * 500,
      (Math.round(parseFloat(formData.hd200)) || 0) * 200,
      (Math.round(parseFloat(formData.hd100)) || 0) * 100,
      (Math.round(parseFloat(formData.hd50)) || 0) * 50,
      (Math.round(parseFloat(formData.hd20)) || 0) * 20,
      (Math.round(parseFloat(formData.hd10)) || 0) * 10,
      (Math.round(parseFloat(formData.hd1)) || 0) * 1,
    ].reduce((acc, val) => acc + val, 0);

    const hdGpay = Math.round(parseFloat(formData.hdGpay)) || 0;
    const hdCard = Math.round(parseFloat(formData.hdCard)) || 0;
    const hdPhonePe = Math.round(parseFloat(formData.hdPhonePe)) || 0;
    const hdPaytm = Math.round(parseFloat(formData.hdPaytm)) || 0;

    const hdDigitalSum = hdGpay + hdCard + hdPhonePe + hdPaytm;
    const expenseTotal = hdCashSum + hdDigitalSum;
    setExpensesAndOthersTotalAmount(expenseTotal);

    // Home Delivery Diff = home_delivery amount - total collected
    const hdAmount = Math.round(parseFloat(formData.homeDelivery)) || 0;
    const homeDeliveryDiffValue = hdAmount - expenseTotal;
    setHomeDeliveryDiff(homeDeliveryDiffValue);

    // 4. Bottom Total Amount: sum of the difference fields under the 3 sections (retail diff, wholesale diff, and home delivery diff)
    const bottomTotal = (actualScanAmt - actualSale) + (totalWhoBilling - wholesaleActualSaleVal) + homeDeliveryDiffValue;
    setTotalAmount(bottomTotal);
  }, [formData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // const sheetName = `Cash Tally Counter ${counter}`;

      let generatedId = "CT-01";
      try {
        const { data, error } = await supabase
          .from('petty_cash_tallies')
          .select('tally_id')
          .eq('counter', activeCounter)
          .order('id', { ascending: false })
          .limit(10);

        if (error) throw error;

        let maxNumber = 0;
        if (data && data.length > 0) {
          data.forEach(item => {
            const idStr = item.tally_id;
            if (idStr && idStr.startsWith('CT-')) {
              const num = parseInt(idStr.split('-')[1]);
              if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
              }
            }
          });
        }
        generatedId = `CT-${String(maxNumber + 1).padStart(2, "0")}`;
      } catch (error) {
        console.error("[CashTally] ID generation error:", error);
        generatedId = `CT-${Date.now()}`;
      }

      const recordToSubmit = {
        tally_id: initialData?.tally_id || generatedId,
        counter: activeCounter,
        date: formData.date,
        name: formData.name,
        shop_name: formData.shopName,
        retail_scan_amount: parseFloat(formData.retailScanAmount) || 0,
        retail_500: parseInt(formData.retail500) || 0,
        retail_200: parseInt(formData.retail200) || 0,
        retail_100: parseInt(formData.retail100) || 0,
        retail_50: parseInt(formData.retail50) || 0,
        retail_20: parseInt(formData.retail20) || 0,
        retail_10: parseInt(formData.retail10) || 0,
        retail_1: parseInt(formData.retail1) || 0,
        retail_gpay: parseFloat(formData.retailGpay) || 0,
        retail_phonepe: parseFloat(formData.retailPhonePe) || 0,
        retail_paytm: parseFloat(formData.retailPaytm) || 0,
        retail_card: parseFloat(formData.retailCard) || 0,
        ws_cash_billing_amount: parseFloat(formData.wsCashBillingAmount) || 0,
        ws_credit_billing_amount: parseFloat(formData.wsCreditBillingAmount) || 0,
        ws_credit_receipt: parseFloat(formData.wsCreditReceipt) || 0,
        ws_500: parseInt(formData.ws500) || 0,
        ws_200: parseInt(formData.ws200) || 0,
        ws_100: parseInt(formData.ws100) || 0,
        ws_50: parseInt(formData.ws50) || 0,
        ws_20: parseInt(formData.ws20) || 0,
        ws_10: parseInt(formData.ws10) || 0,
        ws_1: parseInt(formData.ws1) || 0,
        ws_gpay_card: parseFloat(formData.wsGpayCard) || 0,
        ws_phonepe: parseFloat(formData.wsPhonePe) || 0,
        ws_paytm: parseFloat(formData.wsPaytm) || 0,
        ws_card: parseFloat(formData.wsCard) || 0,
        expense: parseFloat(formData.expense) || 0,
        home_delivery: parseFloat(formData.homeDelivery) || 0,
        retail_1500: parseInt(formData.hd500) || 0,
        retail_2200: parseInt(formData.hd200) || 0,
        retail_3100: parseInt(formData.hd100) || 0,
        retail_450: parseInt(formData.hd50) || 0,
        retail_520: parseInt(formData.hd20) || 0,
        retail_610: parseInt(formData.hd10) || 0,
        retail_71: parseInt(formData.hd1) || 0,
        expense_gpay_card: parseFloat(formData.hdGpay) || 0,
        hd_gpay: parseFloat(formData.hdGpay) || 0,
        hd_card: parseFloat(formData.hdCard) || 0,
        hd_phonepe: parseFloat(formData.hdPhonePe) || 0,
        hd_paytm: parseFloat(formData.hdPaytm) || 0,
        void_sale: parseFloat(formData.voidSale) || 0,
        status: formData.status || "pending",
        retail_diff: retailDiff,
        wholesale_diff: wholesaleDiff,
        home_delivery_diff: homeDeliveryDiff,
        total_amount: totalAmount,
      };

      let response;
      if (initialData?.tally_id) {
        response = await supabase
          .from('petty_cash_tallies')
          .update(recordToSubmit)
          .eq('tally_id', initialData.tally_id)
          .eq('counter', activeCounter);
      } else {
        response = await supabase
          .from('petty_cash_tallies')
          .insert([recordToSubmit]);
      }

      if (response.error) throw response.error;

      // Update local storage backup
      const existingEntries = JSON.parse(
        localStorage.getItem("cashTallyEntries") || "[]"
      );
      if (initialData) {
        const updated = existingEntries.map((entry: any) =>
          entry.tally_id === initialData.tally_id
            ? { ...formData, tally_id: initialData.tally_id }
            : entry
        );
        localStorage.setItem("cashTallyEntries", JSON.stringify(updated));
      } else {
        const newEntry = { tally_id: generatedId, ...formData };
        localStorage.setItem(
          "cashTallyEntries",
          JSON.stringify([newEntry, ...existingEntries])
        );
      }

      setToast({ message: "Data saved successfully!", type: "success" });
      setTimeout(() => {
        onClose();
        setIsLoading(false);
      }, 1000);
    } catch (error: any) {
      console.error("[CashTally] Submit error:", error);
      setToast({
        message: "Error saving: " + (error.message || error),
        type: "error",
      });
      setIsLoading(false);
    }
  };

  if (activeCounter && !hasCounterAccess(activeCounter)) {
    console.warn(`[CashTally] User "${user?.name}" lacks access to Counter ${activeCounter}`);
    return null;
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-[#f5f7fa] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#f5f7fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            Cash Tally - {activeCounter}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaTimes className="text-gray-600 text-xl" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        >
          <div className="space-y-4">
            {/* Basic Information */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
                Basic Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
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

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Counter <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="counter"
                    value={activeCounter}
                    onChange={(e) => setActiveCounter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
                    required
                  >
                    {allowedCounters.map((cVal) => (
                      <option key={cVal} value={cVal}>
                        {cVal}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-medium text-gray-800"
                    required
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp, index) => (
                      <option key={index} value={emp}>
                        {emp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Shop Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="shopName"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-semibold text-gray-800 cursor-pointer"
                    required
                  >
                    <option value="">Select shop</option>
                    {(userShops.length > 0 ? userShops : fetchedShopNames).map((s, index) => (
                      <option key={index} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic Section Selector */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-end gap-3">
              <div className="w-full sm:w-72">
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                  Transaction Type
                </label>
                <select
                  value={selectedTxType}
                  onChange={(e) => setSelectedTxType(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-semibold text-gray-800"
                >
                  <option value="Retail Transactions">Retail Transactions</option>
                  <option value="Wholesale Transactions">Wholesale Transactions</option>
                  <option value="Home Delivery Transactions">Home Delivery Transactions</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddTransaction}
                className="px-4 py-2 bg-[#2a5298] hover:bg-[#1e3d70] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer h-[32px]"
              >
                <FaPlus size={10} /> Add Section
              </button>
            </div>

            {/* Retail Transactions Section */}
            {addedTransactions.includes("Retail Transactions") && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Retail Transactions
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveTransaction("Retail Transactions")}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors cursor-pointer"
                  >
                    Remove Section
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Scan Amount
                    </label>
                    <input
                      type="number"
                      name="retailScanAmount"
                      value={formData.retailScanAmount}
                      onChange={handleChange}
                      placeholder="0"
                      step="1"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Void Sale
                    </label>
                    <input
                      type="number"
                      name="voidSale"
                      value={formData.voidSale}
                      onChange={handleChange}
                      placeholder="0"
                      step="1"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Actual Scan Amount
                    </label>
                    <input
                      type="text"
                      value={retailActualScanAmount}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-blue-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Actual Sale
                    </label>
                    <input
                      type="text"
                      value={retailActualSale}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-emerald-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Diff.
                    </label>
                    <input
                      type="text"
                      value={retailDiff}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-red-600 font-bold"
                    />
                  </div>
                </div>

                {/* Dropdown-based cash denominations & payments */}
                <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/50">
                  <h5 className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                    Denominations & Payments Selector
                  </h5>

                  {/* List of Added Items */}
                  <div className="space-y-1.5 mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Added Items</p>
                    <div className="flex flex-col gap-2">
                      {RETAIL_OPTIONS.map((opt) => {
                        const valStr = (formData as any)[opt.key];
                        const valNum = parseFloat(valStr) || 0;
                        if (!valStr || valNum === 0) return null;

                        const totalStr = opt.isCash && opt.denom ? ` (Total: ₹${valNum * opt.denom})` : "";
                        const isEditing = inlineEdit?.key === opt.key;
                        return (
                          <div key={opt.key} className="flex flex-col bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-2xs gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{opt.label}: <span className="text-[#2a5298]">{valNum}</span>{totalStr}</span>
                              {!isEditing && (
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => handleEditRetailDenom(opt.key, valStr)} title="Edit" className="text-[#2a5298] hover:text-[#1e3d70] transition-colors p-1 cursor-pointer"><FaEdit size={11} /></button>
                                  <button type="button" onClick={() => handleRemoveRetailDenom(opt.key)} title="Remove" className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer"><FaTrash size={10} /></button>
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                  className="flex-1 px-2 py-1 text-xs border border-[#2a5298] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#2a5298]"
                                  placeholder="Enter new value"
                                />
                                <button type="button" onClick={handleInlineEditDone} className="px-2.5 py-1 text-[10px] font-bold bg-[#2a5298] text-white rounded-md hover:bg-[#1e3d70] transition-colors cursor-pointer">Done</button>
                                <button type="button" onClick={handleInlineEditCancel} className="px-2.5 py-1 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end gap-3 mt-3">
                    <div className="w-full sm:w-64">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Select Denomination / payment
                      </label>
                      <select
                        value={selectedRetailKey}
                        onChange={(e) => setSelectedRetailKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                      >
                        {RETAIL_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        {RETAIL_OPTIONS.find(o => o.key === selectedRetailKey)?.isCash ? "Count/Qty" : "Amount (₹)"}
                      </label>
                      <input
                        type="number"
                        value={retailValueInput}
                        onChange={(e) => setRetailValueInput(e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRetailDenom}
                      className="flex items-center justify-center bg-[#2a5298] text-white rounded-lg hover:bg-[#1e3d70] transition-colors cursor-pointer h-[32px] w-[32px] shrink-0"
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Wholesale Transactions Section */}
            {addedTransactions.includes("Wholesale Transactions") && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Wholesale Transactions
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveTransaction("Wholesale Transactions")}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors cursor-pointer"
                  >
                    Remove Section
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {[
                    { name: "wsCashBillingAmount", label: "Cash Billing" },
                    { name: "wsCreditBillingAmount", label: "Credit Billing" },
                    { name: "wsCreditReceipt", label: "Credit Receipt" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        name={field.name}
                        value={(formData as any)[field.name]}
                        onChange={handleChange}
                        placeholder="0"
                        step="1"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 bg-white"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Total Billing
                    </label>
                    <input
                      type="text"
                      value={wholesaleTotalBilling}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-green-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Actual Sale
                    </label>
                    <input
                      type="text"
                      value={wholesaleActualSale}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-emerald-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Diff.
                    </label>
                    <input
                      type="text"
                      value={wholesaleDiff}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-red-600 font-bold"
                    />
                  </div>
                </div>

                {/* Dropdown-based cash denominations & payments */}
                <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/50">
                  <h5 className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                    Denominations & Payments Selector
                  </h5>

                  {/* List of Added Items */}
                  <div className="space-y-1.5 mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Added Items</p>
                    <div className="flex flex-col gap-2">
                      {WHOLESALE_OPTIONS.map((opt) => {
                        const valStr = (formData as any)[opt.key];
                        const valNum = parseFloat(valStr) || 0;
                        if (!valStr || valNum === 0) return null;

                        const totalStr = opt.isCash && opt.denom ? ` (Total: ₹${valNum * opt.denom})` : "";
                        const isEditing = inlineEdit?.key === opt.key;
                        return (
                          <div key={opt.key} className="flex flex-col bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-2xs gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{opt.label}: <span className="text-green-600">{valNum}</span>{totalStr}</span>
                              {!isEditing && (
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => handleEditWSDenom(opt.key, valStr)} title="Edit" className="text-green-600 hover:text-green-800 transition-colors p-1 cursor-pointer"><FaEdit size={11} /></button>
                                  <button type="button" onClick={() => handleRemoveWSDenom(opt.key)} title="Remove" className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer"><FaTrash size={10} /></button>
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                  className="flex-1 px-2 py-1 text-xs border border-green-500 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                                  placeholder="Enter new value"
                                />
                                <button type="button" onClick={handleInlineEditDone} className="px-2.5 py-1 text-[10px] font-bold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors cursor-pointer">Done</button>
                                <button type="button" onClick={handleInlineEditCancel} className="px-2.5 py-1 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end gap-3 mt-3">
                    <div className="w-full sm:w-64">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Select Denomination / payment
                      </label>
                      <select
                        value={selectedWSKey}
                        onChange={(e) => setSelectedWSKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                      >
                        {WHOLESALE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        {WHOLESALE_OPTIONS.find(o => o.key === selectedWSKey)?.isCash ? "Count/Qty" : "Amount (₹)"}
                      </label>
                      <input
                        type="number"
                        value={wsValueInput}
                        onChange={(e) => setWsValueInput(e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddWSDenom}
                      className="flex items-center justify-center bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer h-[32px] w-[32px] shrink-0"
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Expenses & Other Transactions Section */}
            {addedTransactions.includes("Home Delivery Transactions") && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Home Delivery Transactions
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveTransaction("Home Delivery Transactions")}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors cursor-pointer"
                  >
                    Remove Section
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Home Delivery
                    </label>
                    <input
                      type="number"
                      name="homeDelivery"
                      value={formData.homeDelivery}
                      onChange={handleChange}
                      placeholder="0"
                      step="1"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Total Amount
                    </label>
                    <input
                      type="text"
                      value={expensesAndOthersTotalAmount}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-purple-600 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Home Delivery Diff.
                    </label>
                    <input
                      type="text"
                      value={homeDeliveryDiff}
                      readOnly
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 text-red-600 font-bold"
                    />
                  </div>
                </div>

                {/* Dropdown-based cash denominations & payments */}
                <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/50">
                  <h5 className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2.5">
                    Denominations & Payments Selector
                  </h5>

                  {/* List of Added Items */}
                  <div className="space-y-1.5 mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Added Items</p>
                    <div className="flex flex-col gap-2">
                      {EXPENSE_OPTIONS.map((opt) => {
                        const valStr = (formData as any)[opt.key];
                        const valNum = parseFloat(valStr) || 0;
                        if (!valStr || valNum === 0) return null;

                        const totalStr = opt.isCash && opt.denom ? ` (Total: ₹${valNum * opt.denom})` : "";
                        const isEditing = inlineEdit?.key === opt.key;
                        return (
                          <div key={opt.key} className="flex flex-col bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 shadow-2xs gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{opt.label}: <span className="text-purple-600">{valNum}</span>{totalStr}</span>
                              {!isEditing && (
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => handleEditExpenseDenom(opt.key, valStr)} title="Edit" className="text-purple-600 hover:text-purple-800 transition-colors p-1 cursor-pointer"><FaEdit size={11} /></button>
                                  <button type="button" onClick={() => handleRemoveExpenseDenom(opt.key)} title="Remove" className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer"><FaTrash size={10} /></button>
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                  className="flex-1 px-2 py-1 text-xs border border-purple-500 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  placeholder="Enter new value"
                                />
                                <button type="button" onClick={handleInlineEditDone} className="px-2.5 py-1 text-[10px] font-bold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors cursor-pointer">Done</button>
                                <button type="button" onClick={handleInlineEditCancel} className="px-2.5 py-1 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end gap-3 mt-3">
                    <div className="w-full sm:w-64">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        Select Denomination / payment
                      </label>
                      <select
                        value={selectedExpenseKey}
                        onChange={(e) => setSelectedExpenseKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white font-medium text-gray-800"
                      >
                        {EXPENSE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-36">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        {EXPENSE_OPTIONS.find(o => o.key === selectedExpenseKey)?.isCash ? "Count/Qty" : "Amount (₹)"}
                      </label>
                      <input
                        type="number"
                        value={expenseValueInput}
                        onChange={(e) => setExpenseValueInput(e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExpenseDenom}
                      className="flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer h-[32px] w-[32px] shrink-0"
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Total Amount & Actions */}
          <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-xs text-gray-500 font-medium">
                Total Amount:
              </span>
              <span className="text-xl font-bold text-[#2a5298]">
                ₹{Math.round(totalAmount)}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {Boolean(initialData) && (
                <div className="flex items-center gap-1.5 mr-2">
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Status:</label>
                  <select
                    name="status"
                    value={formData.status || "pending"}
                    onChange={handleChange}
                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] bg-white font-semibold text-gray-800 cursor-pointer"
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