// Reports.tsx - RBAC: use AuthContext user, shop-based data filtering
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";
import {
  FaChartPie,
  FaChartLine,
  FaUndo,
  FaDownload,
  FaFileCsv,
  FaTable,
} from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from '../supabase';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
); const convertPettyExpensesToSheetRows = (records: any[]): any[][] => {
  const rows: any[][] = [];
  const headers = [
    "Timestamp", "Patty Id", "Date", "Opening Qty", "Closing Balance", "Shop Name",
    "Tea & Snacks", "Water Jar", "Electricity Bill", "Recharge", "Post Office",
    "Customer Discount", "Repair & Maintenance", "Stationary", "Petrol", "Patil Petrol",
    "Incentive Amount", "Incentive Name", "Advance Amount", "Advance Name",
    "Breakage Amount", "Breakage Name", "Shop Name One", "Shop Amount One",
    "Medical Person", "Medical Amount", "Extra Expense Name", "Extra Expense Amount",
    "Excise/Police", "Desi Bhada", "Room Expense", "Office Expense", "Personal Expense",
    "Misc Expense", "Misc Remarks", "Purchase Voucher No.", "Vendor Payment",
    "Difference Amount", "Credit Card Charges", "Username", "Total Exp. (Spent)",
    "Transaction Status", "Total Amount"
  ];
  rows.push(headers);

  records.forEach(rec => {
    const baseData = [
      rec.created_at || new Date().toISOString(),
      rec.patty_id,
      rec.date,
      rec.opening_qty?.toString() || "",
      rec.closing?.toString() || "",
      rec.shop_name || "",
      rec.tea_nasta?.toString() || "",
      rec.water_jar?.toString() || "",
      rec.light_bill?.toString() || "",
      rec.recharge?.toString() || "",
      rec.post_office?.toString() || "",
      rec.customer_discount?.toString() || "",
      rec.repair_maintenance?.toString() || "",
      rec.stationary?.toString() || "",
      rec.petrol?.toString() || "",
      rec.patil_petrol?.toString() || "",
    ];

    const otherExpenses = Array.isArray(rec.other_expenses) ? rec.other_expenses : [];

    if (otherExpenses.length > 0) {
      otherExpenses.forEach((entry: any, idx: number) => {
        const isFirst = idx === 0;
        const emptyBase = new Array(baseData.length).fill("");
        const row = [
          ...(isFirst ? baseData : emptyBase),
          entry.incentiveAmount || "",
          entry.incentiveName || "",
          entry.advance || "",
          entry.advanceName || "",
          entry.breakage || "",
          entry.breakageName || "",
          entry.shopNameOne || "",
          entry.shopAmountOne || "",
          entry.medicalPersonName || "",
          entry.medicalAmount || "",
          entry.extraExpenseName || "",
          entry.extraExpenseAmount || "",
          isFirst ? (rec.excise_police?.toString() || "") : "",
          isFirst ? (rec.desi_bhada?.toString() || "") : "",
          isFirst ? (rec.room_expense?.toString() || "") : "",
          isFirst ? (rec.office_expense?.toString() || "") : "",
          isFirst ? (rec.personal_expense?.toString() || "") : "",
          isFirst ? (rec.misc_expense?.toString() || "") : "",
          isFirst ? (rec.misc_remarks || "") : "",
          isFirst ? (rec.other_purchase_voucher_no || "") : "",
          isFirst ? (rec.other_vendor_payment?.toString() || "") : "",
          isFirst ? (rec.difference_amount?.toString() || "") : "",
          isFirst ? (rec.credit_card_charges?.toString() || "") : "",
          isFirst ? (rec.username || "") : "",
          isFirst ? (rec.total_expense?.toString() || "") : "",
          isFirst ? (rec.transaction_status || "") : "",
          isFirst ? (rec.total_amount?.toString() || "") : "",
        ];
        rows.push(row);
      });
    } else {
      const row = [
        ...baseData,
        "", "", "", "", "", "", "", "", "", "", "", "",
        rec.excise_police?.toString() || "",
        rec.desi_bhada?.toString() || "",
        rec.room_expense?.toString() || "",
        rec.office_expense?.toString() || "",
        rec.personal_expense?.toString() || "",
        rec.misc_expense?.toString() || "",
        rec.misc_remarks || "",
        rec.other_purchase_voucher_no || "",
        rec.other_vendor_payment?.toString() || "",
        rec.difference_amount?.toString() || "",
        rec.credit_card_charges?.toString() || "",
        rec.username || "",
        rec.total_expense?.toString() || "",
        rec.transaction_status || "",
        rec.total_amount?.toString() || "",
      ];
      rows.push(row);
    }
  });

  return rows;
};

const convertTallyToRows = (records: any[]): any[][] => {
  const rows: any[][] = [];
  const headers = [
    "Timestamp", "Tally ID", "Date", "Employee Name", "Shop Name",
    "Retail Scan", "Retail 500", "Retail 200", "Retail 100", "Retail 50", "Retail 20", "Retail 10", "Retail 1",
    "Retail Gpay", "Retail PhonePe", "Retail Paytm", "Retail Card",
    "WS Cash Billing", "WS Credit Billing", "WS Credit Receipt",
    "WS 500", "WS 200", "WS 100", "WS 50", "WS 20", "WS 10", "WS 1",
    "WS Gpay Card", "WS PhonePe", "WS Paytm", "WS Card",
    "Expense", "Home Delivery",
    "Retail 1500", "Retail 2200", "Retail 3100", "Retail 450", "Retail 520", "Retail 610", "Retail 71",
    "Void Sale", "Expense Gpay Card"
  ];
  rows.push(headers);

  records.forEach(rec => {
    const row = [
      rec.created_at || new Date().toISOString(),
      rec.tally_id,
      rec.date,
      rec.name || "",
      rec.shop_name || "",
      rec.retail_scan_amount?.toString() || "",
      rec.retail_500?.toString() || "",
      rec.retail_200?.toString() || "",
      rec.retail_100?.toString() || "",
      rec.retail_50?.toString() || "",
      rec.retail_20?.toString() || "",
      rec.retail_10?.toString() || "",
      rec.retail_1?.toString() || "",
      rec.retail_gpay?.toString() || "",
      rec.retail_phonepe?.toString() || "",
      rec.retail_paytm?.toString() || "",
      rec.retail_card?.toString() || "",
      rec.ws_cash_billing_amount?.toString() || "",
      rec.ws_credit_billing_amount?.toString() || "",
      rec.ws_credit_receipt?.toString() || "",
      rec.ws_500?.toString() || "",
      rec.ws_200?.toString() || "",
      rec.ws_100?.toString() || "",
      rec.ws_50?.toString() || "",
      rec.ws_20?.toString() || "",
      rec.ws_10?.toString() || "",
      rec.ws_1?.toString() || "",
      rec.ws_gpay_card?.toString() || "",
      rec.ws_phonepe?.toString() || "",
      rec.ws_paytm?.toString() || "",
      rec.ws_card?.toString() || "",
      rec.expense?.toString() || "",
      rec.home_delivery?.toString() || "",
      rec.retail_1500?.toString() || "",
      rec.retail_2200?.toString() || "",
      rec.retail_3100?.toString() || "",
      rec.retail_450?.toString() || "",
      rec.retail_520?.toString() || "",
      rec.retail_610?.toString() || "",
      rec.retail_71?.toString() || "",
      rec.void_sale?.toString() || "",
      rec.expense_gpay_card?.toString() || "",
    ];
    rows.push(row);
  });

  return rows;
};


interface ExpenseData {
  date: string;
  category: string;
  amount: number;
  type: "petty" | "tally";
  description: string;
  sheetName?: string;
}

interface Category {
  id: string;
  name: string;
  type: "petty" | "tally";
}

export default function Reports() {


  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [cashType, setCashType] = useState<"petty" | "tally">("petty");
  const [viewType, setViewType] = useState<"default" | "daily" | "weekly" | "monthly">("default");
  const [expenseData, setExpenseData] = useState<ExpenseData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Dashboard Total Amount state for default values
  const [dashboardTotalAmount, setDashboardTotalAmount] = useState<number>(0);
  const [dashboardTotalTransactions, setDashboardTotalTransactions] = useState<number>(0);
  const [dashboardHighestAmount, setDashboardHighestAmount] = useState<number>(0);

  // [RBAC] Use AuthContext user data stablely
  const { user: authUser, hasPageAccess, hasShopAccess } = useAuth();
  const loginUser = useMemo(() =>
    authUser ? { name: authUser.username, role: authUser.role } : null,
    [authUser?.username, authUser?.role]
  );
  const [selectedTallySheet, setSelectedTallySheet] = useState<string>("All");

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Table view state
  const [activeTableTab, setActiveTableTab] = useState<'petty' | 'tally' | null>(null);
  const [tablePettyRows, setTablePettyRows] = useState<any[]>([]);
  const [tableTallyRows, setTableTallyRows] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const fetchTableData = async (type: 'petty' | 'tally') => {
    setActiveTableTab(type);
    setTableLoading(true);
    try {
      if (type === 'petty') {
        let query = supabase.from('petty_cash_expense').select('*').order('date', { ascending: false });
        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        const { data, error } = await query;
        if (!error && data) {
          setTablePettyRows(data);
        }
      } else {
        let query = supabase.from('petty_cash_tallies').select('*').order('date', { ascending: false });
        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        const { data, error } = await query;
        if (!error && data) {
          setTableTallyRows(data);
        }
      }
    } catch (err) {
      console.error('Error fetching table data:', err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    const handleExportClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousedown', handleExportClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousedown', handleExportClickOutside);
    };
  }, []);


  // [RBAC] Filter tally sheets to only those the user has page access to
  const tallySheets = useMemo(() => {
    const sheets = [];
    // Only include "All" for Admin role
    if (loginUser?.role?.toLowerCase() === 'admin') {
      sheets.push("All");
    }
    if (hasPageAccess("Cash Tally - Counter 1")) sheets.push("Cash Tally Counter 1");
    if (hasPageAccess("Cash Tally - Counter 2")) sheets.push("Cash Tally Counter 2");
    if (hasPageAccess("Cash Tally - Counter 3")) sheets.push("Cash Tally Counter 3");
    return sheets;
  }, [loginUser?.role, hasPageAccess]);

  const SHEET_URL = "https://script.google.com/macros/s/AKfycbx5dryxS1R5zp6myFfUlP1QPimufTqh5hcPcFMNcAJ-FiC-hyQL9mCkgHSbLkOiWTibeg/exec";
  const SHEET_ID = "1-NTfh3VGrhEImrxNVSbDdBmFxTESegykHslL-t3Nf8I";

  // Debounce utility
  const debounce = (func: Function, delay: number) => {
    let timeoutId: any;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Auto-select Tally Sheet based on permissions
  useEffect(() => {
    if (cashType === "tally" && tallySheets.length > 0) {
      // If "All" is selected but not available (non-admin), or current selection is invalid
      if (!tallySheets.includes(selectedTallySheet)) {
        setSelectedTallySheet(tallySheets[0]);
      }
    }
  }, [cashType, tallySheets, selectedTallySheet]);


  // [RBAC] User now comes from AuthContext - no need for localStorage effect
  // (loginUser is derived directly from authUser above)

  // Column mapping
  const columnMapping: { [key: string]: string } = {
    "Tea & Snacks": "G",
    "Water Jar": "H",
    "Light Bill": "I",
    "Recharge": "J",
    "Post Office": "K",
    "Customer Discount": "L",
    "Repair & Maintenance": "M",
    "Stationary": "N",
    "Petrol": "O",
    "Patil Petrol": "P",
    "Incentive": "Q",
    "Advance": "S",
    "Breakage": "U",
    "Shop Amount": "X",
    "Medical Amount": "Z",
    "Expense Amount": "AB",
    "Excise/Police": "AC",
    "Desi Bhada": "AD",
    "Room Expense": "AE",
    "Office Expense": "AF",
    "Personal Expense": "AG",
    "Miscellaneous": "AH",
    "Credit Card": "AM"
  };





  // Fetch expense data
  const fetchExpenseData = useCallback(async () => {
    if (!loginUser || loading) return;

    setLoading(true);

    try {
      if (cashType === "petty") {
        const { data, error } = await supabase
          .from('petty_cash_expense')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;

        const allData = convertPettyExpensesToSheetRows(data || []);
        const dataRows = allData.slice(1);

        let filteredRows = dataRows.filter((row: any) => {
          if (!row || row.length < 5) return false;
          const col1 = row[1] ? row[1].toString().trim().toLowerCase() : "";
          const col2 = row[2] ? row[2].toString().trim().toLowerCase() : "";
          return col1 !== 'total' && col2 !== 'total';
        });

        if (loginUser.role.toLowerCase() !== 'admin') {
          filteredRows = filteredRows.filter(
            (row: any) => hasShopAccess(row[5]?.toString().trim() || '')
          );
        }

        const expenses: ExpenseData[] = [];

        filteredRows.forEach((row: any) => {
          const date = normalizeToISO(row[2] || "");
          if (!date) return;

          Object.entries(columnMapping).forEach(([categoryName, columnLetter]) => {
            const colIdx = columnLetter.length === 1
              ? columnLetter.charCodeAt(0) - 65
              : (columnLetter.charCodeAt(0) - 64) * 26 + (columnLetter.charCodeAt(1) - 65);

            const amount = parseFloat(row[colIdx]) || 0;
            if (amount > 0) {
              expenses.push({
                date,
                category: categoryName,
                amount,
                type: "petty",
                description: `${categoryName} expense`,
              });
            }
          });
        });
        setExpenseData(expenses);
      } else {
        const sheetsToFetch = selectedTallySheet === "All"
          ? tallySheets.filter(sheet => sheet !== "All")
          : [selectedTallySheet];

        const allExpenses: ExpenseData[] = [];
        for (const sheet of sheetsToFetch) {
          const counterNum = parseInt(sheet.split(" ").pop() || "1");
          const { data, error } = await supabase
            .from('petty_cash_tallies')
            .select('*')
            .eq('counter', counterNum)
            .order('date', { ascending: false });

          if (error) throw error;

          const allData = convertTallyToRows(data || []);
          const dataRows = allData.slice(1);

          let filteredRows = dataRows;
          if (loginUser.role.toLowerCase() !== 'admin') {
            filteredRows = dataRows.filter(
              (row: any) => hasShopAccess(row[4]?.toString().trim() || '')
            );
          }

          filteredRows.forEach((row: any) => {
            const date = normalizeToISO(row[2] || "");
            if (!date) return;

            const scanAmount = parseFloat(row[5]) || 0;
            if (scanAmount > 0) {
              allExpenses.push({
                date,
                category: "Scan Amount",
                amount: scanAmount,
                type: "tally",
                description: `Scan Amount - ${sheet}`,
                sheetName: sheet,
              });
            }

            const cashBilling = parseFloat(row[17]) || 0;
            if (cashBilling > 0) {
              allExpenses.push({
                date,
                category: "Cash Billing",
                amount: cashBilling,
                type: "tally",
                description: `Cash Billing - ${sheet}`,
                sheetName: sheet,
              });
            }

            const generalExpense = parseFloat(row[31]) || 0;
            if (generalExpense > 0) {
              allExpenses.push({
                date,
                category: "General Expense",
                amount: generalExpense,
                type: "tally",
                description: `General Expense - ${sheet}`,
                sheetName: sheet,
              });
            }

            const homeDelivery = parseFloat(row[32]) || 0;
            if (homeDelivery > 0) {
              allExpenses.push({
                date,
                category: "Home Dilivery",
                amount: homeDelivery,
                type: "tally",
                description: `Home Dilivery - ${sheet}`,
                sheetName: sheet,
              });
            }
          });
        }
        setExpenseData(allExpenses);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setExpenseData([]);
    } finally {
      setLoading(false);
    }
  }, [cashType, loginUser, selectedTallySheet]);

  // Helper to normalize dates to YYYY-MM-DD
  const normalizeToISO = (dateString: string) => {
    if (!dateString) return "";
    let dateStr = dateString.toString().trim();

    // Check for ISO strings with time/timezone to avoid UTC shift
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr) || dateStr.includes('Z')) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (parts) {
      let day = parseInt(parts[1]);
      let month = parseInt(parts[2]);
      let year = parseInt(parts[3]);
      if (year < 100) year += 2000;
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    const monthMap: { [key: string]: string } = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const monthParts = dateStr.match(/^(\d{1,2})[\s\-]+([A-Za-z]+)[\s\-,\.]+?(\d{4})/);
    if (monthParts) {
      const day = monthParts[1].padStart(2, '0');
      const monthName = monthParts[2].substring(0, 3).toLowerCase();
      const month = monthMap[monthName] || '01';
      const year = monthParts[3];
      return `${year}-${month}-${day}`;
    }
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };




  const debouncedFetchExpenseData = useMemo(
    () => debounce(fetchExpenseData, 500),
    [fetchExpenseData]
  );

  useEffect(() => {
    debouncedFetchExpenseData();
  }, [debouncedFetchExpenseData]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${SHEET_URL}?action=getCategories&sheetId=${SHEET_ID}`);
        const data = await response.json();
        if (data.success && data.categories) {
          setCategories(data.categories);
        } else {
          setCategories([
            { id: "1", name: "Tea & Snacks", type: "petty" },
            { id: "2", name: "Light Bill", type: "petty" },
            { id: "3", name: "Repair & Maintenance", type: "petty" },
            { id: "4", name: "Water Jar", type: "petty" },
            { id: "5", name: "Recharge", type: "petty" },
            { id: "6", name: "Incentive", type: "petty" },
            { id: "7", name: "Stationary", type: "petty" },
            { id: "8", name: "Petrol", type: "petty" },
            { id: "9", name: "Breakage", type: "petty" },
            { id: "10", name: "Advance", type: "petty" },
            { id: "11", name: "Shop Amount", type: "petty" },
            { id: "12", name: "Expense Amount", type: "petty" },
            { id: "13", name: "Medical Amount", type: "petty" },
            { id: "14", name: "Excise/Police", type: "petty" },
            { id: "15", name: "Desi Bhada", type: "petty" },
            { id: "16", name: "Room Expense", type: "petty" },
            { id: "17", name: "Office Expense", type: "petty" },
            { id: "18", name: "Personal Expense", type: "petty" },
            { id: "19", name: "Credit Card", type: "petty" },
            //{ id: "20", name: "Audit", type: "petty" },
            //{ id: "21", name: "Consulting", type: "petty" },
            //{ id: "22", name: "Professional Fees", type: "petty" },
            //{ id: "23", name: "Taxes", type: "petty" },
            //{ id: "24", name: "Insurance", type: "petty" },
            { id: "25", name: "Miscellaneous", type: "petty" },
            { id: "26", name: "Home Dilivery", type: "tally" },
            { id: "27", name: "Scan Amount", type: "tally" },
            { id: "28", name: "Cash Billing", type: "tally" },
            { id: "29", name: "General Expense", type: "tally" },
          ]);
        }
      } catch {
        setCategories([
          { id: "1", name: "Tea & Snacks", type: "petty" },
          { id: "2", name: "Light Bill", type: "petty" },
          { id: "3", name: "Repair & Maintenance", type: "petty" },
          { id: "4", name: "Water Jar", type: "petty" },
          { id: "5", name: "Recharge", type: "petty" },
          { id: "6", name: "Incentive", type: "petty" },
          { id: "7", name: "Stationary", type: "petty" },
          { id: "8", name: "Petrol", type: "petty" },
          { id: "9", name: "Breakage", type: "petty" },
          { id: "10", name: "Advance", type: "petty" },
          { id: "11", name: "Shop Amount", type: "petty" },
          { id: "12", name: "Expense Amount", type: "petty" },
          { id: "13", name: "Medical Amount", type: "petty" },
          { id: "14", name: "Excise/Police", type: "petty" },
          { id: "15", name: "Desi Bhada", type: "petty" },
          { id: "16", name: "Room Expense", type: "petty" },
          { id: "17", name: "Office Expense", type: "petty" },
          { id: "18", name: "Personal Expense", type: "petty" },
          { id: "19", name: "Credit Card", type: "petty" },
          { id: "20", name: "Audit", type: "petty" },
          { id: "21", name: "Consulting", type: "petty" },
          { id: "22", name: "Professional Fees", type: "petty" },
          { id: "23", name: "Taxes", type: "petty" },
          { id: "24", name: "Insurance", type: "petty" },
          { id: "25", name: "Miscellaneous", type: "petty" },
          { id: "26", name: "Home Dilivery", type: "tally" },
          { id: "27", name: "Scan Amount", type: "tally" },
          { id: "28", name: "Cash Billing", type: "tally" },
          { id: "29", name: "General Expense", type: "tally" },
        ]);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Dashboard Total Amount on mount
  useEffect(() => {
    const fetchDashboardTotals = async () => {
      try {
        const response = await fetch(
          `${SHEET_URL}?action=fetch&sheet=${encodeURIComponent("Patty Expence")}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          const dataRows = data.data;
          const currentMonth = new Date().toISOString().slice(0, 7);

          let totalAmount = 0;
          let transactionCount = 0;
          let highestAmount = 0;

          dataRows.forEach((row: any[]) => {
            if (!row || row.length < 5) return;

            // Skip total rows and header
            const col1 = row[1] ? row[1].toString().trim().toLowerCase() : "";
            const col2 = row[2] ? row[2].toString().trim().toLowerCase() : "";
            if (col1 === 'total' || col2 === 'total' || col2 === 'date') return;

            const normalizedDate = normalizeToISO(col2);
            if (!normalizedDate || !normalizedDate.startsWith(currentMonth)) return;

            // Sum columns G to AE (indices 6-30) + AJ (index 35)

            let rowSum = 0;
            for (let i = 6; i <= 30; i++) {
              rowSum += parseFloat(row[i]) || 0;
            }
            rowSum += parseFloat(row[35]) || 0;

            if (rowSum > 0) {
              totalAmount += rowSum;
              transactionCount++;
              if (rowSum > highestAmount) {
                highestAmount = rowSum;
              }
            }
          });

          setDashboardTotalAmount(totalAmount);
          setDashboardTotalTransactions(transactionCount);
          setDashboardHighestAmount(highestAmount);
        }
      } catch (err) {
        console.error("Error fetching dashboard totals:", err);
      }
    };

    fetchDashboardTotals();
  }, []);



  useEffect(() => {
    if (cashType === "petty") {
      setSelectedCategories(["Tea & Snacks", "Light Bill", "Stationary", "Petrol"]);
    } else {
      setSelectedCategories(["all"]);
    }
  }, [cashType]);



  // Category handlers
  const handleCategoryCheckboxChange = (categoryName: string) => {
    if (categoryName === "all") {
      if (selectedCategories.includes("all")) {
        setSelectedCategories([]);
      } else {
        const allCategories = categories
          .filter(cat => cat.type === cashType)
          .map(cat => cat.name);
        setSelectedCategories(["all", ...allCategories]);
      }
    } else {
      let newSelected: string[];
      if (selectedCategories.includes(categoryName)) {
        newSelected = selectedCategories.filter(cat => cat !== categoryName && cat !== "all");
      } else {
        newSelected = selectedCategories
          .filter(cat => cat !== "all")
          .concat(categoryName);
      }
      setSelectedCategories(newSelected);
    }
  };

  const handleSelectAll = () => {
    const allCategories = categories
      .filter(cat => cat.type === cashType)
      .map(cat => cat.name);
    setSelectedCategories(["all", ...allCategories]);
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
  };



  const filteredData = expenseData.filter(expense => {
    const matchesType = expense.type === cashType;

    let matchesDate = true;
    if (dateFrom && dateTo) {
      matchesDate = expense.date >= dateFrom && expense.date <= dateTo;
    } else if (dateFrom) {
      matchesDate = expense.date >= dateFrom;
    } else if (dateTo) {
      matchesDate = expense.date <= dateTo;
    } else {
      const currentMonth = new Date().toISOString().slice(0, 7);
      matchesDate = expense.date.startsWith(currentMonth);
    }

    const matchesCategory = selectedCategories.length === 0 ||
      selectedCategories.includes("all") ||
      selectedCategories.includes(expense.category);

    return matchesType && matchesDate && matchesCategory;
  });

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCashType("petty");
    setSelectedTallySheet("All");
    setSelectedCategories(["Tea & Snacks", "Light Bill", "Stationary", "Petrol"]);
    setViewType("default");
  };

  // ── CSV Export helpers ──────────────────────────────────────────────────────
  const downloadCSV = (rows: string[][], filename: string) => {
    const escape = (val: any) => {
      const s = val == null ? "" : String(val);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csv = rows.map(row => row.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  /** Export the currently-filtered summary data (date + category + amount) */
  const exportSummaryCSV = () => {
    const dateLabel = dateFrom && dateTo
      ? `${dateFrom}_to_${dateTo}`
      : dateFrom ? `from_${dateFrom}`
        : dateTo ? `to_${dateTo}`
          : new Date().toISOString().slice(0, 7);

    const headers = ["Date", "Category", "Amount (₹)", "Type", "Description"];
    const dataRows = filteredData.map(e => [
      e.date,
      e.category,
      String(e.amount),
      e.type === "petty" ? "Petty Cash" : "Tally Cash",
      e.description,
    ]);

    downloadCSV(
      [headers, ...dataRows],
      `reports_summary_${cashType}_${dateLabel}.csv`
    );
  };

  /** Export full raw records from Supabase matching current filters */
  const exportFullCSV = async () => {
    setShowExportMenu(false);
    try {
      if (cashType === "petty") {
        let query = supabase.from('petty_cash_expense').select('*').order('date', { ascending: false });
        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        const { data, error } = await query;
        if (error) throw error;
        const rows = convertPettyExpensesToSheetRows(data || []);
        const dateLabel = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0, 7);
        downloadCSV(rows, `petty_cash_full_${dateLabel}.csv`);
      } else {
        const sheetsToFetch = selectedTallySheet === "All"
          ? tallySheets.filter(s => s !== "All")
          : [selectedTallySheet];
        const allRows: any[][] = [];
        let headersAdded = false;
        for (const sheet of sheetsToFetch) {
          const counterNum = parseInt(sheet.split(" ").pop() || "1");
          let query = supabase.from('petty_cash_tallies').select('*').eq('counter', counterNum).order('date', { ascending: false });
          if (dateFrom) query = query.gte('date', dateFrom);
          if (dateTo) query = query.lte('date', dateTo);
          const { data, error } = await query;
          if (error) throw error;
          const rows = convertTallyToRows(data || []);
          if (!headersAdded) { allRows.push(rows[0]); headersAdded = true; }
          allRows.push(...rows.slice(1));
        }
        const dateLabel = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0, 7);
        downloadCSV(allRows, `tally_cash_full_${dateLabel}.csv`);
      }
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };




  // Chart data functions
  const getWeekNumber = (dateString: string): string => {
    const date = new Date(dateString);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return `Week ${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
  };

  const getMonthFromDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getCategoryColors = () => ({
    "Tea & Snacks": { bg: "rgba(107, 114, 128, 0.8)", border: "rgba(107, 114, 128, 1)" }, // Gray
    "Light Bill": { bg: "rgba(52, 211, 153, 0.8)", border: "rgba(52, 211, 153, 1)" }, // Emerald
    "Stationary": { bg: "rgba(251, 191, 36, 0.8)", border: "rgba(251, 191, 36, 1)" }, // Amber
    "Petrol": { bg: "rgba(59, 130, 246, 0.8)", border: "rgba(59, 130, 246, 1)" }, // Blue
    "Repair & Maintenance": { bg: "rgba(248, 113, 113, 0.8)", border: "rgba(248, 113, 113, 1)" }, // Red
    "Water Jar": { bg: "rgba(34, 211, 238, 0.8)", border: "rgba(34, 211, 238, 1)" }, // Cyan
    "Incentive": { bg: "rgba(167, 139, 250, 0.8)", border: "rgba(167, 139, 250, 1)" }, // Violet
    "Advance": { bg: "rgba(251, 113, 133, 0.8)", border: "rgba(251, 113, 133, 1)" }, // Rose
    "Scanning": { bg: "rgba(42, 82, 152, 0.8)", border: "rgba(42, 82, 152, 1)" }, // Brand Blue
    "Scan Amount": { bg: "rgba(42, 82, 152, 0.8)", border: "rgba(42, 82, 152, 1)" },
    "Cash Billing": { bg: "rgba(236, 72, 153, 0.8)", border: "rgba(236, 72, 153, 1)" },
    "General Expense": { bg: "rgba(34, 197, 94, 0.8)", border: "rgba(34, 197, 94, 1)" },
    "Home Delivery": { bg: "rgba(59, 130, 246, 0.8)", border: "rgba(59, 130, 246, 1)" },
    "Miscellaneous": { bg: "rgba(148, 163, 184, 0.8)", border: "rgba(148, 163, 184, 1)" },
  });

  const getPieChartData = () => {
    const categoryTotals: { [key: string]: number } = {};
    filteredData.forEach(expense => {
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    // Sort categories by amount descending
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a);

    const labels = sortedCategories.map(([cat]) => cat);
    const dataValues = sortedCategories.map(([, amt]) => amt);

    const categoryColors = getCategoryColors();
    const backgroundColors = labels.map(category =>
      categoryColors[category as keyof ReturnType<typeof getCategoryColors>]?.bg ||
      `hsla(${Math.random() * 360}, 60%, 60%, 0.8)`
    );
    const borderColors = labels.map(category =>
      categoryColors[category as keyof ReturnType<typeof getCategoryColors>]?.border ||
      `hsla(${Math.random() * 360}, 60%, 50%, 1)`
    );

    return {
      labels,
      datasets: [{
        label: "Expenses by Category",
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
      }],
    };
  };


  const getLineChartData = () => {
    let groupedData: { [key: string]: { amount: number, sortKey: string } } = {};

    filteredData.forEach(expense => {
      let label = "";
      let sortKey = "";

      if (viewType === "daily") {
        label = expense.date; // already YYYY-MM-DD
        sortKey = expense.date;
      } else if (viewType === "weekly") {
        label = getWeekNumber(expense.date);
        // Use year + week for sort key
        const date = new Date(expense.date);
        const weekNum = getWeekNumber(expense.date).replace("Week ", "").padStart(2, '0');
        sortKey = `${date.getFullYear()}-${weekNum}`;
      } else {
        label = getMonthFromDate(expense.date);
        // Use year + month index for sort key
        const date = new Date(expense.date);
        sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (!groupedData[label]) {
        groupedData[label] = { amount: 0, sortKey };
      }
      groupedData[label].amount += expense.amount;
    });

    // Sort labels chronologically using the sortKey
    const sortedEntries = Object.entries(groupedData).sort((a, b) =>
      a[1].sortKey.localeCompare(b[1].sortKey)
    );

    const labels = sortedEntries.map(entry => entry[0]);
    const values = sortedEntries.map(entry => entry[1].amount);

    return {
      labels,
      datasets: [{
        label: `Expenses (${viewType})`,
        data: values,
        borderColor: "rgba(42, 82, 152, 1)",
        backgroundColor: "rgba(42, 82, 152, 0.1)",
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: "rgba(42, 82, 152, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      }],
    };
  };

  const getSummaryData = () => {
    // 1. Calculate Period Totals for Average calculation
    const dailyTotals: { [key: string]: number } = {};
    filteredData.forEach(expense => {
      dailyTotals[expense.date] = (dailyTotals[expense.date] || 0) + expense.amount;
    });

    const totalSum = filteredData.reduce((sum, item) => sum + item.amount, 0);

    // 2. Fast-path for Dashboard Default state
    const isDateFiltered = dateFrom !== "" || dateTo !== "";
    const isViewFiltered = viewType !== "default";
    const defaultCategories = ["Tea & Snacks", "Light Bill", "Stationary", "Petrol"];
    const isCategoryFiltered = !(
      selectedCategories.length === 0 ||
      selectedCategories.includes("all") ||
      (selectedCategories.length === defaultCategories.length && defaultCategories.every(c => selectedCategories.includes(c)))
    );

    if (!isDateFiltered && !isViewFiltered && !isCategoryFiltered && cashType === "petty" && dashboardTotalAmount > 0) {
      const avgExpense = dashboardTotalTransactions > 0 ? dashboardTotalAmount / dashboardTotalTransactions : 0;
      return {
        total: dashboardTotalAmount,
        avgPeriod: avgExpense,
        highest: dashboardHighestAmount,
        categories: categories.filter(c => c.type === "petty").length || 5,
        periods: dashboardTotalTransactions
      };
    }

    // 3. Exact Range Calculation
    let highestRecord = 0;
    const uniqueCategories = new Set<string>();

    // Find highest daily total within the filtered set
    Object.values(dailyTotals).forEach(amt => {
      if (amt > highestRecord) highestRecord = amt;
    });

    filteredData.forEach(item => {
      uniqueCategories.add(item.category);
    });

    // Determine how many 'periods' are in the filtered set for the average
    const periodTotals: { [key: string]: number } = {};
    filteredData.forEach(expense => {
      let periodKey = "";
      if (viewType === "daily" || viewType === "default") {
        periodKey = expense.date;
      } else if (viewType === "weekly") {
        periodKey = getWeekNumber(expense.date);
      } else {
        periodKey = getMonthFromDate(expense.date);
      }
      periodTotals[periodKey] = (periodTotals[periodKey] || 0) + expense.amount;
    });
    const periodsCount = Object.keys(periodTotals).length;

    return {
      total: totalSum,
      avgPeriod: periodsCount > 0 ? totalSum / periodsCount : 0,
      highest: highestRecord,
      categories: uniqueCategories.size,
      periods: periodsCount
    };
  };






  const pieOptions = {

    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { padding: 20, font: { size: 12, family: "'Segoe UI', sans-serif" } },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            return `${label}: ₹${value.toLocaleString("en-IN")}`;
          },
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `Expenses: ₹${context.parsed.y.toLocaleString("en-IN")}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => "₹" + value.toLocaleString("en-IN"),
        },
      },
    },
  };


  const pieChartData = getPieChartData();
  const lineChartData = getLineChartData();
  const summaryData = getSummaryData();
  const currentTypeCategories = categories.filter(cat => cat.type === cashType);


  return (
    <div className="space-y-6 relative pb-32">

      {/* 2. Summary Statistics Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Summary Statistics - {cashType === "petty" ? "Petty Cash" : "Tally Cash"}
          {cashType === "tally" && selectedTallySheet !== "All" && ` - ${selectedTallySheet}`}
        </h3>

        {filteredData.length === 0 && viewType !== "default" ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-lg font-medium">No data found for the selected filters</p>
            <p className="text-sm">Try adjusting your date range or categories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-blue-700">
                ₹{Math.round(summaryData.total).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 mb-1">Avg. Transaction</p>
              <p className="text-2xl font-bold text-green-700">
                ₹{Math.round(summaryData.avgPeriod).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-600 mb-1">Highest Record</p>
              <p className="text-2xl font-bold text-yellow-700">
                ₹{Math.round(summaryData.highest).toLocaleString("en-IN")}
              </p>
            </div>


            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Categories</p>
              <p className="text-2xl font-bold text-purple-700">
                {summaryData.categories}
              </p>
            </div>
          </div>
        )}
      </div>
      {/* 1. Reports & Analytics Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>
          <div className="flex flex-wrap items-center gap-2">
            {viewType !== "default" && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all border border-red-200 shadow-sm hover:shadow-md active:scale-95"
              >
                <FaUndo className="w-3 h-3" /> Clear Filters
              </button>
            )}

            {/* Export CSV dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#2a5298] bg-blue-50 hover:bg-blue-100 rounded-lg transition-all border border-blue-200 shadow-sm hover:shadow-md active:scale-95"
              >
                <FaDownload className="w-3 h-3" />
                Export CSV
                <svg className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Export Options</p>
                  </div>
                  <button
                    onClick={exportSummaryCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#2a5298] transition-colors text-left"
                  >
                    <FaFileCsv className="text-green-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Summary CSV</p>
                      <p className="text-xs text-gray-400">Filtered category data</p>
                    </div>
                  </button>
                  <button
                    onClick={exportFullCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#2a5298] transition-colors text-left border-t border-gray-100"
                  >
                    <FaFileCsv className="text-blue-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Full Records CSV</p>
                      <p className="text-xs text-gray-400">All raw DB columns</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${cashType === "tally" ? "lg:grid-cols-6" : "lg:grid-cols-5"} gap-4`}>
          <div className="flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cash Type</label>
            <select
              value={cashType}
              onChange={(e) => setCashType(e.target.value as "petty" | "tally")}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent font-medium bg-white h-[46px] shadow-sm transition-all"
            >
              <option value="petty">Petty Cash</option>
              <option value="tally">Cash Tally</option>
            </select>
          </div>

          {cashType === "tally" && (
            <div className="flex flex-col">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tally Sheet</label>
              <select
                value={selectedTallySheet}
                onChange={(e) => setSelectedTallySheet(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent font-medium bg-white h-[46px] shadow-sm transition-all"
              >
                {tallySheets.map(sheet => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent font-medium bg-white h-[46px] shadow-sm transition-all"
            />
          </div>
          <div className="flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent font-medium bg-white h-[46px] shadow-sm transition-all"
            />
          </div>
          <div className="flex flex-col relative" ref={categoryDropdownRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Category {selectedCategories.length > 0 && !selectedCategories.includes("all") && `(${selectedCategories.length})`}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent text-left bg-white flex justify-between items-center shadow-sm hover:shadow-md transition-all font-medium h-[46px]"
              >
                <span className="truncate mr-2">
                  {selectedCategories.length === 0
                    ? "Select Category"
                    : selectedCategories.includes("all")
                      ? "All Categories"
                      : `${selectedCategories.length} selected`}
                </span>
                <svg className={`shrink-0 w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCategoryDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-800">Filter</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSelectAll}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-200 font-medium transition-colors"
                        >
                          All
                        </button>
                        <button
                          onClick={handleClearAll}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-md hover:bg-red-200 font-medium transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <label className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes("all")}
                        onChange={() => handleCategoryCheckboxChange("all")}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-700">All Categories</span>
                    </label>
                    {currentTypeCategories.map(category => (
                      <label key={category.id} className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.name)}
                          onChange={() => handleCategoryCheckboxChange(category.name)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-3 text-sm text-gray-700">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="block text-sm font-semibold text-gray-700 mb-2">View Type</label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as "default" | "daily" | "weekly" | "monthly")}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2a5298] focus:border-transparent font-medium bg-white h-[46px] shadow-sm transition-all"
            >
              <option value="default">Select View Type</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>



      {/* 3. Charts Section */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-xl">
            <div className="flex items-center gap-3 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2a5298]"></div>
              <span className="font-semibold text-gray-700">Loading charts...</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FaChartPie className="text-[#2a5298] text-2xl" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Expense by Category</h3>

                <p className="text-sm text-gray-600">
                  {cashType === "petty" ? "Petty Cash" : "Tally Cash"} Distribution
                  {cashType === "tally" && selectedTallySheet !== "All" && ` - ${selectedTallySheet}`}
                </p>
              </div>

            </div>
            <div className="h-[300px] md:h-[350px] bg-gray-50 rounded-lg flex items-center justify-center p-4">
              {pieChartData.labels.length > 0 ? (
                <Pie data={pieChartData} options={pieOptions} />
              ) : (
                <div className="text-center text-gray-500">
                  <FaChartPie className="mx-auto text-4xl mb-2 opacity-40" />
                  <p>
                    {(!dateFrom || !dateTo) && expenseData.length === 0
                      ? "Loading data..."
                      : "No data available for selected filters"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-3 rounded-xl">
                <FaChartLine className="text-green-600 text-2xl" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Expense Trend</h3>

                <p className="text-sm text-gray-600">
                  {cashType === "petty" ? "Petty Cash" : "Tally Cash"} over time
                  {cashType === "tally" && selectedTallySheet !== "All" && ` - ${selectedTallySheet}`}
                </p>
              </div>
            </div>
            <div className="h-[300px] md:h-[350px] bg-gray-50 rounded-lg flex items-center justify-center p-4">
              {lineChartData.labels.length > 0 ? (
                <Line data={lineChartData} options={lineOptions} />
              ) : (
                <div className="text-center text-gray-500">
                  <FaChartLine className="mx-auto text-4xl mb-2 opacity-40" />
                  <p>
                    {!dateFrom || !dateTo
                      ? "Select date range to filter data"
                      : "No data available for selected filters"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Data Tables Control & View Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FaTable className="text-[#2a5298]" />
              Database Records Tables
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select a table below to view detailed database records.
            </p>
          </div>

          {/* Table Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTableData('petty')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                activeTableTab === 'petty'
                  ? 'bg-[#2a5298] text-white border-[#2a5298] shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              }`}
            >
              <FaTable className="text-xs" />
              <span>Petty Cash Table</span>
            </button>

            <button
              onClick={() => fetchTableData('tally')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                activeTableTab === 'tally'
                  ? 'bg-[#2a5298] text-white border-[#2a5298] shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              }`}
            >
              <FaTable className="text-xs" />
              <span>Cash Tally Table</span>
            </button>

            {activeTableTab && (
              <button
                onClick={() => setActiveTableTab(null)}
                className="px-3.5 py-2.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-all font-semibold cursor-pointer"
              >
                Hide Table
              </button>
            )}
          </div>
        </div>

        {/* Table Content when activeTableTab is set */}
        {activeTableTab && (
          <div className="space-y-4">
            {/* Search Bar for Table */}
            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder={`Search ${activeTableTab === 'petty' ? 'Petty Cash' : 'Cash Tally'} records...`}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pl-3 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298]"
                />
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {tableLoading ? 'Loading records...' : `Showing ${
                  activeTableTab === 'petty'
                    ? tablePettyRows.filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase())).length
                    : tableTallyRows.filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase())).length
                } records`}
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              {tableLoading ? (
                <div className="py-12 text-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-[#2a5298] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Loading table records...</span>
                </div>
              ) : activeTableTab === 'petty' ? (
                /* Petty Cash Expenses Table */
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2a5298] text-white uppercase font-bold">
                    <tr>
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Shop Name</th>
                      <th className="px-4 py-2.5">User</th>
                      <th className="px-4 py-2.5">Opening (₹)</th>
                      <th className="px-4 py-2.5">Total Expense (₹)</th>
                      <th className="px-4 py-2.5">Closing (₹)</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-800">
                    {tablePettyRows.filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-400">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      tablePettyRows
                        .filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase()))
                        .map((row) => (
                          <tr key={row.patty_id || row.id} className="hover:bg-blue-50/40">
                            <td className="px-4 py-2 font-mono font-semibold text-[#2a5298]">{row.patty_id || row.id}</td>
                            <td className="px-4 py-2">{row.date}</td>
                            <td className="px-4 py-2">{row.shop_name || '—'}</td>
                            <td className="px-4 py-2">{row.username || '—'}</td>
                            <td className="px-4 py-2 font-normal">₹{Number(row.opening_qty || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-rose-600 font-normal">₹{Number(row.total_expense || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-emerald-700 font-normal">₹{Number(row.closing || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#2a5298] border border-blue-200">
                                {row.transaction_status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* Cash Tallies Table */
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2a5298] text-white uppercase font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Tally ID</th>
                      <th className="px-4 py-2.5">Counter</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Shop Name</th>
                      <th className="px-4 py-2.5">Staff Name</th>
                      <th className="px-4 py-2.5">Retail Scan (₹)</th>
                      <th className="px-4 py-2.5">Expense (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-800">
                    {tableTallyRows.filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase())).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      tableTallyRows
                        .filter(r => !tableSearch || JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase()))
                        .map((row) => (
                          <tr key={row.tally_id || row.id} className="hover:bg-blue-50/40">
                            <td className="px-4 py-2 font-mono font-semibold text-[#2a5298]">{row.tally_id || row.id}</td>
                            <td className="px-4 py-2 font-semibold text-gray-700">Counter {row.counter || 1}</td>
                            <td className="px-4 py-2">{row.date}</td>
                            <td className="px-4 py-2">{row.shop_name || '—'}</td>
                            <td className="px-4 py-2">{row.name || '—'}</td>
                            <td className="px-4 py-2 font-normal text-slate-800">₹{Number(row.retail_scan_amount || 0).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-rose-600 font-normal">₹{Number(row.expense || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
