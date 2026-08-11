import { useState, useEffect } from "react";
import {
  FaWallet,
  FaMoneyBillWave,
  FaChartLine,
  FaCalendar,
  FaFilePdf,
  FaFileExcel,
  FaStore,
} from "react-icons/fa";
import TransactionTable from "../components/TransactionTable";
import { Transaction } from "../types";
import { useAuth } from "../contexts/AuthContext";
import ExcelJS from 'exceljs';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { supabase } from '../supabase';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const convertPettyExpensesToSheetRows = (records: any[]): any[][] => {
  const rows: any[][] = [];
  const headers = [
    "Timestamp", "Patty ID", "Date", "Opening Balance", "Closing Balance", "Shop Name",
    "Tea & Snacks", "Water Jar", "Electricity Bill", "Recharge", "Post Office",
    "Customer Discount", "Repair & Maintenance", "Stationary", "Petrol", "Patil Petrol",
    "Excise/Police", "Desi Bhada", "Room Expense", "Office Expense", "Personal Expense",
    "Misc Expense", "Misc Remarks", "Purchase Voucher No.", "Vendor Payment",
    "Difference Amount", "Credit Card Charges", "Username", "Total Exp. (Spent)",
    "Transaction Status", "Total Amount", "Expense Name", "Employee Name",
    "To Shop", "Description", "Amount"
  ];
  rows.push(headers);

  records.forEach(rec => {
    const row = [
      rec.created_at || new Date().toISOString(),
      rec.patty_id || "",
      rec.date || "",
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
      rec.expense_name || "",
      rec.employee_name || "",
      rec.to_shop || "",
      rec.description || "",
      rec.amount?.toString() || ""
    ];
    rows.push(row);
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

interface SummaryRow {
  id: number;
  date: string;
  voucherNo: string;
  balance: string | number;
  dailyExpenses: string | number;
  maintenance: string | number;
  fuel: string | number;
  otherExpenses: string | number;
  payments: string | number;
}

interface TallySummaryRow {
  id: number;
  counterName: string;
  date: string;
  retailAmt?: string | number;
  wsaleAmt?: string | number;
  homeDelivery?: string | number;
  scanAmount?: string | number;
  expenses?: string | number;
  card: string | number;
  paytm: string | number;
  gpay: string | number;
  phonePe?: string | number;
  phonePay?: string | number;
  cash: string | number;
  diff: string | number;
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Cache States (Hoisted)
  const [rawData, setRawData] = useState<Array<{ sheet: string, data: any[] }>>([]);
  const [sheetCache, setSheetCache] = useState<Record<string, any[]>>({});
  const [summaryCache, setSummaryCache] = useState<any[] | null>(null);

  // Stats from sheet row 1 (top red text row)
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [_totalExpenses, _setTotalExpenses] = useState(0);
  const [pettyPdfData, setPettyPdfData] = useState<SummaryRow[]>([]);
  const [tallyPdfData, setTallyPdfData] = useState<TallySummaryRow[]>([]);

  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    const savedBudget = localStorage.getItem("monthlyBudget");
    return savedBudget !== null ? parseFloat(savedBudget) : 0;
  });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [tempStatus, setTempStatus] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"patty" | "tally">("patty");

  const { user: currentUser, hasShopAccess, getAllowedCounters, isAdmin } = useAuth();

  // Build tallySheets dynamically based on user's counter access
  const allTallyCounters = [
    "Cash Tally Counter 1",
    "Cash Tally Counter 2",
    "Cash Tally Counter 3",
  ];
  const allowedCounterNumbers = getAllowedCounters(); // e.g. [1, 2] for non-admin
  const userTallyCounters = isAdmin()
    ? allTallyCounters
    : allTallyCounters.filter((_, idx) => (allowedCounterNumbers as any).includes(String(idx + 1)) || (allowedCounterNumbers as any).includes(idx + 1));
  const tallySheets = ["All", ...userTallyCounters];

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [selectedTallySheet, setSelectedTallySheet] = useState<string>("All");

  // --- SHOP FILTER STATE ---
  const [selectedShop, setSelectedShop] = useState<string>("All");
  const [dbShops, setDbShops] = useState<string[]>([]);

  useEffect(() => {
    const fetchDbShops = async () => {
      try {
        const { data, error } = await supabase
          .from('shop')
          .select('shop_name')
          .order('shop_name', { ascending: true });
        if (!error && data) {
          const names = data.map((s: any) => s.shop_name).filter(Boolean);
          setDbShops(names);
        }
      } catch (e) {
        console.error("Error fetching shops from public.shop:", e);
      }
    };
    fetchDbShops();
  }, []);

  // --- Get unique shops from public.shop and data ---
  const getUniqueShops = () => {
    const shopSet = new Set<string>(dbShops);
    // From Petty Cash data
    if (sheetCache["Patty Expence"]) {
      sheetCache["Patty Expence"].forEach((row: any[]) => {
        const shop = row[5]?.toString().trim() || "";
        if (shop) shopSet.add(shop);
      });
    }
    // From Tally data
    tallySheets.forEach(sheet => {
      if (sheet !== "All" && sheetCache[sheet]) {
        sheetCache[sheet].forEach((row: any[]) => {
          const shop = row[4]?.toString().trim() || "";
          if (shop) shopSet.add(shop);
        });
      }
    });
    return Array.from(shopSet).sort();
  };

  const shopOptions = getUniqueShops();

  // --- Summary Data State & Effect ---
  const [pettySummaryData, setPettySummaryData] = useState<SummaryRow[]>([]);
  const [tallySummaryData, setTallySummaryData] = useState<TallySummaryRow[]>([]);
  const [summaryStartDate, setSummaryStartDate] = useState(""); // YYYY-MM-DD
  const [summaryEndDate, setSummaryEndDate] = useState(""); // YYYY-MM-DD

  // --- Data Processing Helpers ---
  const parseNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const str = val.toString().replace(/[^0-9.-]/g, '');
    return parseFloat(str) || 0;
  };

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

    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or DD MM YYYY
    const parts = dateStr.match(/^(\d{1,2})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})/);
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

  const isRowInRange = (dateStr: string) => {
    if (!summaryStartDate && !summaryEndDate) return true;
    const isoDate = normalizeToISO(dateStr);
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return true;
    const start = summaryStartDate || "0000-00-00";
    const end = summaryEndDate || "9999-99-99";
    return isoDate >= start && isoDate <= end;
  };

  const filterDataByUserAndShop = (data: any[], sheetName: string) => {
    if (!currentUser || currentUser.role.toLowerCase() === 'admin') {
      // If shop filter is active, filter by shop
      if (selectedShop !== "All") {
        const shopColIdx = sheetName === 'Patty Expence' ? 5 : 4;
        return data.filter((row: any[]) => {
          const shopName = row[shopColIdx]?.toString().trim() || '';
          return shopName === selectedShop;
        });
      }
      return data;
    }

    if (currentUser.shops === 'all') {
      // If shop filter is active, filter by shop
      if (selectedShop !== "All") {
        const shopColIdx = sheetName === 'Patty Expence' ? 5 : 4;
        return data.filter((row: any[]) => {
          const shopName = row[shopColIdx]?.toString().trim() || '';
          return shopName === selectedShop;
        });
      }
      return data;
    }

    const shopColIdx = sheetName === 'Patty Expence' ? 5 : 4;
    return data.filter((row: any[]) => {
      const shopName = row[shopColIdx]?.toString().trim() || '';
      // If shop filter is active, also check against selectedShop
      if (selectedShop !== "All" && shopName !== selectedShop) return false;
      return hasShopAccess(shopName);
    });
  };

  const getCategoryFromRow = (row: any[]) => {
    if (parseFloat(row[6]) > 0) return "Tea & Snacks";
    if (parseFloat(row[7]) > 0) return "Water Jar";
    if (parseFloat(row[8]) > 0) return "Electricity Bill";
    if (parseFloat(row[9]) > 0) return "Recharge";
    if (parseFloat(row[10]) > 0) return "Post Office";
    if (parseFloat(row[11]) > 0) return "Customer Discount";
    if (parseFloat(row[12]) > 0) return "Repair & Maintenance";
    if (parseFloat(row[13]) > 0) return "Stationary";
    if (parseFloat(row[14]) > 0) return "Petrol";
    if (parseFloat(row[15]) > 0) return "Patil Petrol";
    if (parseFloat(row[16]) > 0) return "Incentive";
    if (parseFloat(row[17]) > 0) return "Advance";
    if (parseFloat(row[18]) > 0) return "Breakage";
    if (parseFloat(row[20]) > 0) return "Excise/Police";
    if (parseFloat(row[21]) > 0) return "Desi Bhada";
    if (parseFloat(row[22]) > 0) return "Room Expense";
    if (parseFloat(row[23]) > 0) return "Office Expense";
    if (parseFloat(row[24]) > 0) return "Personal Expense";
    if (parseFloat(row[25]) > 0) return "Miscellaneous";
    if (parseFloat(row[26]) > 0) return "Credit Card Charges";
    return "Other";
  };

  const generateDescription = (row: any[]) => {
    const category = getCategoryFromRow(row);
    const date = row[1] || "";
    return `${category} expense for ${date}`;
  };

  useEffect(() => {
    const fetchAllSummaries = async () => {
      setIsSummaryLoading(true);
      try {
        const { data: pettyData, error: pettyError } = await supabase
          .from('petty_cash_expense')
          .select('*')
          .order('date', { ascending: false });

        if (pettyError) throw pettyError;

        const { data: tallyData, error: tallyError } = await supabase
          .from('petty_cash_tallies')
          .select('*')
          .order('date', { ascending: false });

        if (tallyError) throw tallyError;

        // Group and aggregate petty expenses by date
        const pettyGrouped: { [date: string]: any } = {};
        (pettyData || []).forEach(rec => {
          const dateStr = rec.date;
          if (!pettyGrouped[dateStr]) {
            pettyGrouped[dateStr] = {
              date: dateStr,
              balance: rec.opening_qty || 0,
              dailyExpenses: 0,
              maintenance: 0,
              fuel: 0,
              otherExpenses: 0,
              payments: 0
            };
          }

          const item = pettyGrouped[dateStr];
          item.dailyExpenses += (rec.tea_nasta || 0) + (rec.water_jar || 0) + (rec.light_bill || 0) + (rec.recharge || 0) + (rec.post_office || 0) + (rec.customer_discount || 0) + (rec.stationary || 0);
          item.maintenance += (rec.repair_maintenance || 0);
          item.fuel += (rec.petrol || 0) + (rec.patil_petrol || 0);

          let otherSum = (rec.excise_police || 0) + (rec.desi_bhada || 0) + (rec.room_expense || 0) + (rec.office_expense || 0) + (rec.personal_expense || 0) + (rec.misc_expense || 0) + (rec.credit_card_charges || 0) + (rec.difference_amount || 0);

          const otherArray = Array.isArray(rec.other_expenses) ? rec.other_expenses : [];
          otherArray.forEach((o: any) => {
            otherSum += (parseFloat(o.incentiveAmount) || 0) + (parseFloat(o.advance) || 0) + (parseFloat(o.breakage) || 0) + (parseFloat(o.shopAmountOne) || 0) + (parseFloat(o.medicalAmount) || 0) + (parseFloat(o.extraExpenseAmount) || 0);
          });

          item.otherExpenses += otherSum;
          item.payments += (rec.other_vendor_payment || 0);
        });

        const pettySummaryRows = Object.values(pettyGrouped).sort((a: any, b: any) => b.date.localeCompare(a.date)).map((r: any, i: number) => ({
          id: i,
          date: formatDate(r.date),
          voucherNo: "-",
          balance: r.balance,
          dailyExpenses: r.dailyExpenses,
          maintenance: r.maintenance,
          fuel: r.fuel,
          otherExpenses: r.otherExpenses,
          payments: r.payments
        }));

        setPettySummaryData(pettySummaryRows);
        setPettyPdfData(pettySummaryRows);

        // Map tally data
        const tallySummaryRows = (tallyData || []).map((rec, i) => {
          const retailCashSum = (
            (rec.retail_500 || 0) * 500 +
            (rec.retail_200 || 0) * 200 +
            (rec.retail_100 || 0) * 100 +
            (rec.retail_50 || 0) * 50 +
            (rec.retail_20 || 0) * 20 +
            (rec.retail_10 || 0) * 10 +
            (rec.retail_1 || 0) * 1
          );

          const wholesaleCashSum = (
            (rec.ws_500 || 0) * 500 +
            (rec.ws_200 || 0) * 200 +
            (rec.ws_100 || 0) * 100 +
            (rec.ws_50 || 0) * 50 +
            (rec.ws_20 || 0) * 20 +
            (rec.ws_10 || 0) * 10 +
            (rec.ws_1 || 0) * 1
          );

          const homeDeliveryCashSum = (
            (rec.retail_1500 || 0) * 500 +
            (rec.retail_2200 || 0) * 200 +
            (rec.retail_3100 || 0) * 100 +
            (rec.retail_450 || 0) * 50 +
            (rec.retail_520 || 0) * 20 +
            (rec.retail_610 || 0) * 10 +
            (rec.retail_71 || 0) * 1
          );

          const actualSale = (rec.retail_scan_amount || 0) - (rec.void_sale || 0);
          const retailTotalPayments = retailCashSum + (rec.retail_gpay || 0) + (rec.retail_card || 0) + (rec.retail_phonepe || 0) + (rec.retail_paytm || 0) + (rec.expense || 0);
          const retailDiff = actualSale - retailTotalPayments;

          const totalWhoSale = (rec.ws_cash_billing_amount || 0) + (rec.ws_credit_receipt || 0);
          const wholesaleTotalPayments = wholesaleCashSum + (rec.ws_gpay_card || 0) + (rec.ws_phonepe || 0) + (rec.ws_paytm || 0) + (rec.ws_card || 0);
          const wholesaleDiff = totalWhoSale - wholesaleTotalPayments;

          const homeDeliveryDiffValue = (rec.home_delivery || 0) - homeDeliveryCashSum;

          const diff = retailDiff + wholesaleDiff + homeDeliveryDiffValue;
          const cash = retailCashSum + wholesaleCashSum + homeDeliveryCashSum;

          return {
            id: i,
            counterName: "Counter " + rec.counter,
            date: formatDate(rec.date),
            retailAmt: rec.retail_scan_amount || 0,
            wsaleAmt: totalWhoSale,
            homeDelivery: rec.home_delivery || 0,
            expenses: (rec.expense || 0) + (rec.expense_gpay_card || 0),
            card: (rec.retail_card || 0) + (rec.ws_card || 0),
            paytm: (rec.retail_paytm || 0) + (rec.ws_paytm || 0),
            gpay: (rec.retail_gpay || 0) + (rec.ws_gpay_card || 0),
            phonePe: (rec.retail_phonepe || 0) + (rec.ws_phonepe || 0),
            cash: cash,
            diff: diff
          };
        });

        setTallySummaryData(tallySummaryRows);
        setTallyPdfData(tallySummaryRows);

        setSummaryCache([]);
      } catch (err) {
        console.error("Summary processing error:", err);
      } finally {
        setIsSummaryLoading(false);
      }
    };

    if (summaryCache === null) {
      fetchAllSummaries();
    }
  }, [summaryCache]);

  const formatDate = (dateString: any) => {
    if (!dateString) return "";
    let date = new Date(dateString);

    // Manual parsing for DD/MM/YYYY or DD-MM-YYYY
    if (isNaN(date.getTime())) {
      const parts = dateString.toString().match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (parts) {
        date = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
      }
    }

    if (isNaN(date.getTime())) return dateString.toString();

    // Stable manual format: DD MMM YYYY
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = date.getDate().toString().padStart(2, '0');
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
  };

  const handleExportPDF = () => {
    const isPetty = activeTab === "patty";
    const sourceData = isPetty ? pettyPdfData : tallyPdfData;

    const dataToExport = isPetty
      ? (sourceData as SummaryRow[]).filter(row => isRowInRange(row.date))
      : (sourceData as TallySummaryRow[]).filter(row => {
        const rowCounter = (row.counterName || "").toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchesCounter = selectedTallySheet === "All"
          ? userTallyCounters.some(c => {
            const tc = c.toLowerCase().replace(/[^a-z0-9]/g, '');
            return tc.includes(rowCounter) || rowCounter.includes(tc);
          })
          : (() => {
            const sc = selectedTallySheet.toLowerCase().replace(/[^a-z0-9]/g, '');
            return sc.includes(rowCounter) || rowCounter.includes(sc);
          })();
        return matchesCounter && isRowInRange(row.date);
      });

    const formattedPeriodStart = summaryStartDate
      ? new Date(summaryStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : "01 November 2025";
    const formattedPeriodEnd = summaryEndDate
      ? new Date(summaryEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const title = isPetty ? "PETTY CASH REPORT" : "TALLY CASH REPORT";
    const headers = isPetty
      ? ["DATE", "Purchase Voucher No.", "Opening & Closing Balance", "Daily Expenses", "Maintenance & Repairs", "Fuel & Transport", "Other Expenses", "Payments & Vendors"]
      : ["Counter", "Date", "Retail Amt", "Wholesale Amt", "Home Delivery", "Expenses", "Card", "UPI/Paytm", "G-Pay", "PhonePe", "Cash", "Diff"];

    const printContent = `
      <style>
        @media print {
          table { border-collapse: separate; border-spacing: 0; width: 100%; border: none; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .no-border td, .no-border th { border: none !important; }
        }
        table { border-collapse: separate; border-spacing: 0; width: 100%; border: none; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        .no-border td { border: none !important; }
        .pdf-cell { border-top: 1px solid #e0e0e0; border-left: 1px solid #e0e0e0; }
        .pdf-header-cell { border-top: 1px solid #90caf9; border-left: 1px solid #90caf9; background-color: #b3e5fc; color: #01579b; }
        .last-col { border-right: 1px solid #e0e0e0 !important; }
        .last-row td { border-bottom: 1px solid #e0e0e0 !important; }
      </style>
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; width: 100%; border: none;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; border: none;">
          <!-- Repeating Page Header -->
          <thead style="display: table-header-group;">
            <!-- Branding Row -->
            <tr class="no-border">
              <td colspan="${headers.length}" style="padding: 40px 40px 10px 40px; border: none;">
                <div style="text-align: center; margin-bottom: 25px;">
                  <h1 style="color: #800000; margin: 0; font-size: 32px; font-weight: bold;">PUNE WINES</h1>
                  <p style="margin: 5px 0; color: #666; font-size: 14px;">3915 Monkhorst Road, Mld NR 38852</p>
                  <p style="margin: 5px 0; color: #666; font-size: 14px;">(123) 123-4567 | www.punewines.com</p>
                  <hr style="border: 0; height: 1px; background: #000; margin: 15px 0;" />
                </div>
                
                <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 20px; font-weight: bold; font-size: 18px;">${title}</h2>

                <div style="background-color: #f0f7ff; padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 20px; border: 1px solid #d0e5ff;">
                  <p style="margin: 0; font-size: 15px; color: #2a5298;">
                    Report Period: <strong>${formattedPeriodStart}</strong> to <strong>${formattedPeriodEnd}</strong>
                  </p>
                  ${selectedShop !== "All" ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #2a5298;">Shop: <strong>${selectedShop}</strong></p>` : ''}
                </div>

                <div style="background-color: #fcfcfc; padding: 15px; border-radius: 6px; margin-bottom: 30px; border-left: 5px solid #007bff;">
                   <p style="margin: 0 0 10px 0; font-size: 14px;"><strong>Generated On :</strong> ${generatedOn}</p>
                   <p style="margin: 0; font-size: 14px;"><strong>Managed By :</strong> ____________________</p>
                </div>
              </td>
            </tr>
            <!-- Table Sub-Header Row -->
            <tr class="no-border">
              <td colspan="${headers.length}" style="padding: 0 40px 15px 40px; border: none; text-align: center;">
                <h3 style="font-size: 20px; margin: 0; font-weight: bold; color: #333; text-transform: uppercase;">EXPENSE RECORDS</h3>
              </td>
            </tr>
            <!-- Data Column Headers Row -->
            <tr>
              ${headers.map((h, i) => `
                <th class="pdf-header-cell ${i === headers.length - 1 ? 'last-col' : ''}" style="padding: 10px 5px; text-align: center; font-size: 10px; font-weight: bold;">
                  ${h}
                </th>`).join('')}
            </tr>
          </thead>

          <!-- Table Body Content -->
          <tbody style="display: table-row-group;">
            ${dataToExport.map((row, idx) => {
      const isLastRow = idx === dataToExport.length - 1;
      if (isPetty) {
        const r = row as SummaryRow;
        return `
                  <tr style="page-break-inside: avoid; break-inside: avoid;" class="${isLastRow ? 'last-row' : ''}">
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${r.date}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">PVN - ${String(idx + 1).padStart(2, '0')}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; font-weight: bold;">${formatCurrency(parseNumber(r.balance))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #d32f2f;">${formatCurrency(parseNumber(r.dailyExpenses))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #d32f2f;">${formatCurrency(parseNumber(r.maintenance))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #d32f2f;">${formatCurrency(parseNumber(r.fuel))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #d32f2f;">${formatCurrency(parseNumber(r.otherExpenses))}</td>
                    <td class="pdf-cell last-col" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #e65100; font-weight: bold;">${formatCurrency(parseNumber(r.payments))}</td>
                  </tr>
                `;
      } else {
        const r = row as any;
        return `
                  <tr style="page-break-inside: avoid; break-inside: avoid;" class="${isLastRow ? 'last-row' : ''}">
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${r.counterName}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${r.date}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #2e7d32;">${formatCurrency(parseNumber(r.retailAmt))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #2e7d32;">${formatCurrency(parseNumber(r.wsaleAmt))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #1565c0;">${formatCurrency(parseNumber(r.homeDelivery))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; color: #c62828;">${formatCurrency(parseNumber(r.expenses))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${formatCurrency(parseNumber(r.card))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${formatCurrency(parseNumber(r.paytm))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${formatCurrency(parseNumber(r.gpay))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px;">${formatCurrency(parseNumber(r.phonePe))}</td>
                    <td class="pdf-cell" style="padding: 8px 4px; text-align: center; font-size: 10px; font-weight: bold;">${formatCurrency(parseNumber(r.cash))}</td>
                    <td class="pdf-cell last-col" style="padding: 8px 4px; text-align: center; font-size: 10px; font-weight: bold; color: ${parseNumber(r.diff) !== 0 ? '#d32f2f' : '#2e7d32'}">${formatCurrency(parseNumber(r.diff))}</td>
                  </tr>
                `;
      }
    }).join('')}
            
            <!-- Grand Total Row -->
            ${(() => {
        if (isPetty) {
          const pettyRows = dataToExport as SummaryRow[];
          // Calculate column-wise sums
          const balanceSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.balance), 0);
          const dailyExpensesSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.dailyExpenses), 0);
          const maintenanceSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.maintenance), 0);
          const fuelSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.fuel), 0);
          const otherExpensesSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.otherExpenses), 0);
          const paymentsSum = pettyRows.reduce((sum, r) => sum + parseNumber(r.payments), 0);
          // Grand Total = sum of all column sums
          const grandTotal = balanceSum + dailyExpensesSum + maintenanceSum + fuelSum + otherExpensesSum + paymentsSum;
          return `
                  <tr style="background-color: #b71c1c; font-weight: bold; page-break-inside: avoid; break-inside: avoid;" class="last-row">
                    <td colspan="7" class="pdf-cell" style="padding: 12px; text-align: center; color: #ffffff; font-size: 12px;">
                      GRAND TOTAL
                    </td>
                    <td class="pdf-cell last-col" style="padding: 12px; text-align: center; color: #ffffff; font-size: 14px; font-weight: bold;">
                      ${formatCurrency(grandTotal)}
                    </td>
                  </tr>
                `;
        } else {
          const tallyRows = dataToExport as TallySummaryRow[];
          const cashSum = tallyRows.reduce((sum, r) => sum + parseNumber(r.cash), 0);
          return `
                  <tr style="background-color: #f8f9fa; font-weight: bold; page-break-inside: avoid; break-inside: avoid;" class="last-row">
                    <td colspan="11" class="pdf-cell" style="padding: 10px; text-align: center; color: #b71c1c; font-size: 11px;">
                      GRAND TOTAL (CASH)
                    </td>
                    <td class="pdf-cell last-col" style="padding: 10px; text-align: center; color: #b71c1c; font-size: 12px;">
                      ${formatCurrency(cashSum)}
                    </td>
                  </tr>
                `;
        }
      })()}
          </tbody>

          <!-- Repeating Footer -->
          <tfoot style="display: table-footer-group;">
            <tr class="no-border">
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = printContent;

    const options = {
      margin: 10,
      filename: `${isPetty ? 'Petty_Cash' : 'Tally_Cash'}_Report_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    // Direct download
    html2pdf().from(element).set(options).save();
  };

  const handleExportExcel = async () => {
    const isPetty = activeTab === "patty";
    let worksheetData: any[][] = [];
    let sheetName = isPetty ? "Petty Cash" : "Tally Cash";

    if (isPetty) {
      // Use raw from 'Patty Expence' sheet
      const rawRows = sheetCache["Patty Expence"];
      if (!rawRows || rawRows.length === 0) {
        alert("Petty Expense data is not loaded yet. Please wait.");
        return;
      }

      let headerIdx = rawRows.findIndex(r => r && r.some((c: any) => c?.toString().trim() === "Date"));
      if (headerIdx === -1) headerIdx = 2;

      const headers = rawRows[headerIdx];
      const dateColIdx = headers.findIndex((c: any) => c?.toString().trim() === "Date") ?? 2;
      const shopColIdx = headers.findIndex((c: any) => c?.toString().trim() === "Shop Name") ?? 5;

      const filteredData = rawRows.slice(headerIdx + 1).filter(r => {
        if (!r[dateColIdx]) return false;
        if (!isRowInRange(r[dateColIdx].toString())) return false;
        // Filter by selected shop
        if (selectedShop !== "All") {
          const shop = r[shopColIdx]?.toString().trim() || "";
          return shop === selectedShop;
        }
        return true;
      });

      // Slice data to include only up to 'Credit Card Charges' (Index 36) for Petty Cash
      const END_COL_INDEX = 37;
      const slicedHeaders = headers.slice(0, END_COL_INDEX);
      const slicedFiltered = filteredData.map((r: any[]) => r.slice(0, END_COL_INDEX));

      worksheetData = [slicedHeaders, ...slicedFiltered];
    } else {
      // Tally Cash (using raw sheets)
      const sheetsToProcess = selectedTallySheet === "All"
        ? userTallyCounters
        : [selectedTallySheet];

      let combinedData: any[][] = [];
      let commonHeaders: any[] = [];

      sheetsToProcess.forEach(sName => {
        const rawRows = sheetCache[sName];
        if (!rawRows || rawRows.length === 0) return;

        let headerIdx = rawRows.findIndex(r => r && r.some((c: any) => c?.toString().trim() === "Date"));
        if (headerIdx === -1) headerIdx = 2;

        if (commonHeaders.length === 0) {
          commonHeaders = rawRows[headerIdx];
        }

        const dateColIdx = rawRows[headerIdx].findIndex((c: any) => c?.toString().trim() === "Date") ?? 2;
        const shopColIdx = rawRows[headerIdx].findIndex((c: any) => c?.toString().trim() === "Shop Name") ?? 4;

        const filtered = rawRows.slice(headerIdx + 1).filter(r => {
          if (!r[dateColIdx]) return false;
          if (!isRowInRange(r[dateColIdx].toString())) return false;
          // Filter by selected shop
          if (selectedShop !== "All") {
            const shop = r[shopColIdx]?.toString().trim() || "";
            return shop === selectedShop;
          }
          return true;
        });

        // If All Counters selected, prepend Sheet Name
        if (selectedTallySheet === "All") {
          const rowsWithSheetName = filtered.map(r => [sName, ...r]);
          combinedData.push(...rowsWithSheetName);
        } else {
          combinedData.push(...filtered);
        }
      });

      if (commonHeaders.length === 0) {
        alert("No Tally data found for selected period.");
        return;
      }

      if (selectedTallySheet === "All") {
        worksheetData = [["Sheet Name", ...commonHeaders], ...combinedData];
      } else {
        worksheetData = [commonHeaders, ...combinedData];
      }
    }

    // Calculate column sums
    const dataRows = worksheetData.slice(1);
    const colSums: (number | string)[] = [];

    let startCol, endCol;

    if (isPetty) {
      startCol = 3;
      endCol = 36;
    } else {
      if (selectedTallySheet === "All") {
        startCol = 7;
        endCol = 41;
      } else {
        startCol = 6;
        endCol = 40;
      }
    }

    for (let col = startCol; col <= endCol; col++) {
      if (isPetty && (col === 5 || col === 33)) {
        colSums.push("");
        continue;
      }

      let sum = 0;
      dataRows.forEach(row => {
        const val = parseFloat(row[col]) || 0;
        sum += val;
      });
      colSums.push(sum);
    }

    const grandTotal = colSums.reduce((a, b) => {
      const val = typeof b === 'number' ? b : 0;
      return (typeof a === 'number' ? a : 0) + val;
    }, 0);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    const maxCols = Math.max(worksheetData[0]?.length || 0, endCol + 1);

    const colSumsRowData: any[] = new Array(maxCols).fill("");
    for (let i = 0; i < colSums.length; i++) {
      colSumsRowData[startCol + i] = colSums[i];
    }
    const colSumsRow = worksheet.addRow(colSumsRowData);

    colSumsRow.eachCell({ includeEmpty: false }, (cell, _colNumber) => {
      if (cell.value !== "" && cell.value !== null && cell.value !== undefined) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    const grandTotalRowData: any[] = new Array(maxCols).fill("");
    grandTotalRowData[2] = "Grand Total";
    grandTotalRowData[4] = grandTotal;
    const grandTotalRow = worksheet.addRow(grandTotalRowData);

    grandTotalRow.eachCell({ includeEmpty: false }, (cell, _colNumber) => {
      if (cell.value !== "" && cell.value !== null && cell.value !== undefined) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFB71C1C' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    worksheet.mergeCells('C2:D2');
    worksheet.mergeCells('E2:F2');

    const headerRow = worksheet.addRow(worksheetData[0]);

    headerRow.eachCell({ includeEmpty: false }, (cell, _colNumber) => {
      if (cell.value !== "" && cell.value !== null && cell.value !== undefined) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4A90D9' }
        };
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    for (let i = 1; i < worksheetData.length; i++) {
      const processedRow = worksheetData[i].map(cell => {
        if (cell && typeof cell === 'string' && (
          /^\d{4}-\d{2}-\d{2}T/.test(cell) ||
          cell.includes('Z') ||
          /^\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}/.test(cell)
        )) {
          return normalizeToISO(cell);
        }
        return cell;
      });
      worksheet.addRow(processedRow);
    }

    for (let i = 1; i <= maxCols; i++) {
      worksheet.getColumn(i).width = 15;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheetName.replace(" ", "_")}_Summary_${summaryStartDate || 'Start'}_to_${summaryEndDate || 'End'}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const mapRowsToTransactions = (rows: any[], sheetName: string, currentTotalCount: number): Transaction[] => {
    return rows.map((row: any[], index: number) => ({
      id: row[1] ? row[1].toString() : (currentTotalCount + index + 1).toString(),
      rowIndex: index + 2,
      date: normalizeToISO(row[2] || ""),
      name: sheetName === 'Patty Expence' ? (row[37] || "") : (row[3] || ""),
      openingQty: row[3] || "",
      closing: row[4] || "",
      teaNasta: row[6] || "",
      waterJar: row[7] || "",
      lightBill: row[8] || "",
      recharge: row[9] || "",
      postOffice: row[10] || "",
      customerDiscount: row[11] || "",
      repairMaintenance: row[12] || "",
      stationary: row[13] || "",
      petrol: row[14] || "",
      patilPetrol: row[15] || "",
      incentive: row[16] || "",
      incentiveName: row[39] || "",
      advance: row[17] || "",
      breakage: row[18] || "",
      excisePolice: row[20] || "",
      desiBhada: row[21] || "",
      roomExpense: row[22] || "",
      officeExpense: row[23] || "",
      personalExpense: row[24] || "",
      miscExpense: row[25] || "",
      creditCardCharges: row[26] || "",
      transactionStatus: row[28] || "Pending",
      category: getCategoryFromRow(row),
      description: generateDescription(row),
      amount: parseFloat(row[38]) || 0,
      status: row[26] || "Pending",
      remarks: "",
      otherPurchaseVoucherNo: "",
      otherVendorPayment: "",
      differenceAmount: "",
      sheetName: sheetName,
    }));
  };

  // --- Effect 1: Fetch Data on Tab/User/Shop Change ---
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      let sheetsToFetch: string[] = [];
      if (activeTab === "patty") {
        sheetsToFetch = ["Patty Expence"];
      } else if (selectedTallySheet === "All") {
        sheetsToFetch = tallySheets.filter(s => s !== "All");
      } else {
        sheetsToFetch = [selectedTallySheet];
      }

      const missingSheets = sheetsToFetch.filter(sheet => !sheetCache[sheet]);

      if (missingSheets.length === 0) {
        const cachedResults = sheetsToFetch.map(sheet => ({
          sheet,
          data: filterDataByUserAndShop(sheetCache[sheet], sheet)
        }));
        setRawData(cachedResults);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000)
      );

      const fetchDataTask = async () => {
        try {
          const newSheetResults = await Promise.all(
            missingSheets.map(async (sheet) => {
              try {
                if (sheet === "Patty Expence") {
                  const { data, error } = await supabase
                    .from('petty_cash_expense')
                    .select('*')
                    .order('date', { ascending: false });

                  if (error) throw error;
                  const allData = convertPettyExpensesToSheetRows(data || []);
                  return { sheet, data: allData };
                } else if (sheet.startsWith("Cash Tally Counter")) {
                  const counterNum = parseInt(sheet.split(" ").pop() || "1");
                  const { data, error } = await supabase
                    .from('petty_cash_tallies')
                    .select('*')
                    .eq('counter', counterNum)
                    .order('date', { ascending: false });

                  if (error) throw error;
                  const allData = convertTallyToRows(data || []);
                  return { sheet, data: allData };
                }
                return { sheet, data: [] };
              } catch (e) {
                console.error(`Failed to load ${sheet} from Supabase`, e);
                return { sheet, data: [] };
              }
            })
          );

          setSheetCache(prev => {
            const newCache = { ...prev };
            newSheetResults.forEach(item => {
              newCache[item.sheet] = item.data;
            });
            return newCache;
          });

          const finalResults = sheetsToFetch.map(sheet => {
            const newRes = newSheetResults.find(r => r.sheet === sheet);
            const data = newRes ? newRes.data : (sheetCache[sheet] || []);
            return {
              sheet,
              data: filterDataByUserAndShop(data, sheet)
            };
          });

          setRawData(finalResults);

        } catch (error) {
          console.error("Error in fetching sequence:", error);
        }
      };

      try {
        await Promise.race([fetchDataTask(), timeoutPromise]);
      } catch (err) {
        console.error("Data loading timed out or failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Re-fetch when selectedShop changes
  }, [activeTab, selectedTallySheet, currentUser, selectedShop]);

  // --- Effect 2: Process Data on RawData or Month Change ---
  useEffect(() => {
    if (!rawData || rawData.length === 0) return;

    let accumulatedTransactions: Transaction[] = [];
    let totalOpening = 0;
    let totalClosing = 0;
    let hasPettyData = false;

    for (const { sheet, data } of rawData) {
      if (activeTab === "patty") {
        let foundTotalRow = false;
        let openingSum = 0;
        let closingSum = 0;
        let manualOpeningSum = 0;
        let manualClosingSum = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 5) continue;

          const col0 = row[0] ? row[0].toString().trim().toLowerCase() : "";
          const col1 = row[1] ? row[1].toString().trim().toLowerCase() : "";
          const col2 = row[2] ? row[2].toString().trim().toLowerCase() : "";

          if (col0 === 'total' || col1 === 'total' || col2 === 'total') {
            openingSum = parseNumber(row[3]);
            closingSum = parseNumber(row[4]);
            foundTotalRow = true;
          } else {
            const opVal = parseNumber(row[3]);
            const clVal = parseNumber(row[4]);
            manualOpeningSum += opVal;
            manualClosingSum += clVal;
          }
        }

        if (foundTotalRow) {
          totalOpening = openingSum;
          totalClosing = closingSum;
        } else {
          totalOpening = manualOpeningSum;
          totalClosing = manualClosingSum;
        }

        hasPettyData = true;
      }

      const dataForTable = data.filter(row => {
        const rowDate = normalizeToISO(row[2] ? row[2].toString() : "");
        return rowDate.startsWith(selectedMonth);
      });
      const newTransactions = mapRowsToTransactions(dataForTable, sheet, accumulatedTransactions.length);
      accumulatedTransactions.push(...newTransactions);
    }

    setTransactions(accumulatedTransactions);

    if (activeTab === "patty" && hasPettyData) {
      setOpeningBalance(totalOpening);
      _setTotalExpenses(totalOpening + totalClosing);
      setClosingBalance(totalClosing);
    } else if (activeTab === "tally") {
      setOpeningBalance(0);
      _setTotalExpenses(0);
      setClosingBalance(0);
    }

  }, [rawData, selectedMonth, activeTab]);

  const filteredTransactions = transactions.filter(t => {
    const matchesSheet = activeTab === "tally" && selectedTallySheet !== "All"
      ? t.sheetName === selectedTallySheet
      : true;
    const matchesMonth = t.date.startsWith(selectedMonth);
    return matchesSheet && matchesMonth;
  });

  const totalTransactions = filteredTransactions.length;
  const averageExpense =
    totalTransactions > 0
      ? _totalExpenses / totalTransactions
      : 0;

  const stats = [
    {
      title: "Opening Balance",
      value: openingBalance,
      icon: FaWallet,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
    },
    {
      title: "Total Expenses",
      value: _totalExpenses,
      icon: FaMoneyBillWave,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgLight: "bg-red-50",
    },
    {
      title: "Closing Balance",
      value: closingBalance,
      icon: FaChartLine,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgLight: "bg-green-50",
    },
    {
      title: "Monthly Budget",
      value: monthlyBudget,
      icon: FaCalendar,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
    },
    {
      title: "Total Transactions",
      value: totalTransactions,
      icon: FaMoneyBillWave,
      color: "bg-indigo-500",
      textColor: "text-indigo-600",
      bgLight: "bg-indigo-50",
    },
    {
      title: "Avg Expense",
      value: Math.round(averageExpense),
      icon: FaCalendar,
      color: "bg-pink-500",
      textColor: "text-pink-600",
      bgLight: "bg-pink-50",
    },
  ];

  const TALLY_SHEET_OPTIONS = [
    { label: "All Tally Counters", sheet: "All" },
    ...userTallyCounters.map(counter => ({ label: counter, sheet: counter })),
  ];

  return (
    <div className="space-y-6">
      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          if (index === 3) {
            return (
              <div
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`${stat.bgLight} p-2 rounded-lg`}>
                    <Icon className={`${stat.textColor} text-xl`} />
                  </div>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-purple-500"
                  />
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {stat.title}
                </p>

                {currentUser?.role?.toLowerCase() === 'admin' ? (
                  isEditingBudget ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={monthlyBudget}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setMonthlyBudget(value);
                        }}
                        className="text-lg md:text-xl font-bold text-gray-800 border border-blue-500 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setIsEditingBudget(false);
                            localStorage.setItem(
                              "monthlyBudget",
                              monthlyBudget.toString()
                            );
                          }
                          if (e.key === "Escape") setIsEditingBudget(false);
                        }}
                      />
                      <button
                        onClick={() => {
                          setIsEditingBudget(false);
                          localStorage.setItem(
                            "monthlyBudget",
                            monthlyBudget.toString()
                          );
                        }}
                        className="text-green-600 hover:text-green-700"
                        title="Save"
                      >✓</button>
                      <button
                        onClick={() => setIsEditingBudget(false)}
                        className="text-red-600 hover:text-red-700"
                        title="Cancel"
                      >✗</button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => setIsEditingBudget(true)}
                    >
                      <p className="text-lg md:text-xl font-bold text-gray-800">
                        {formatCurrency(stat.value)}
                      </p>
                      <span className="text-gray-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        ✏️
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-lg md:text-xl font-bold text-gray-800">
                      {stat.title === "Total Transactions" ? stat.value : formatCurrency(stat.value)}
                    </p>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`${stat.bgLight} p-2 rounded-lg`}>
                  <Icon className={`${stat.textColor} text-xl`} />
                </div>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">
                {stat.title}
              </p>
              <p className="text-lg md:text-xl font-bold text-gray-800">
                {stat.title === "Total Transactions" ? stat.value : formatCurrency(stat.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* TABS & SHOP FILTER & DROPDOWN */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === "patty"
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            onClick={() => setActiveTab("patty")}
          >
            Petty Cash
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 ${activeTab === "tally"
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            onClick={() => setActiveTab("tally")}
          >
            Tally Cash
          </button>
        </div>

        {/* SHOP FILTER - Always visible */}
        <div className="flex items-center gap-2">
          <FaStore className="text-gray-500 text-sm" />
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm min-w-[140px]"
            value={selectedShop}
            onChange={(e) => {
              setSelectedShop(e.target.value);
              // Reset rawData to trigger re-fetch with new shop filter
              setRawData([]);
            }}
          >
            <option value="All">All Shops</option>
            {shopOptions.map((shop) => (
              <option key={shop} value={shop}>
                {shop}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY TABLE (Visible only activeTab is Patty) */}
      {activeTab === "patty" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-lg font-bold text-gray-800">
              Day-wise Summary
              {selectedShop !== "All" && (
                <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Shop: {selectedShop}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Export Buttons */}
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-all shadow-sm"
                >
                  <FaFilePdf className="text-sm" /> Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 text-xs font-bold rounded-lg border border-green-200 hover:bg-green-100 transition-all shadow-sm"
                >
                  <FaFileExcel className="text-sm" /> Export Excel
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold uppercase">Start Date:</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={summaryStartDate}
                  onChange={(e) => setSummaryStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold uppercase">End Date:</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={summaryEndDate}
                  onChange={(e) => setSummaryEndDate(e.target.value)}
                />
              </div>
              {(summaryStartDate || summaryEndDate) && (
                <button
                  onClick={() => { setSummaryStartDate(""); setSummaryEndDate(""); }}
                  className="px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 transition-colors border border-red-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="overflow-auto max-h-[500px] hide-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-blue-100 text-gray-700 font-bold uppercase border-b border-gray-200 sticky top-0 z-10">
                <tr className="text-xs">
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Date</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[150px]">Opening & Closing<br />Balance</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[130px]">Daily<br />Expenses</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[140px]">Maintenance<br />& Repairs</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[130px]">Fuel &<br />Transport</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[130px]">Other<br />Expenses</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[140px]">Payments &<br />Vendors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isSummaryLoading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center">
                      <svg className="animate-spin h-8 w-8 text-[#2a5298] mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm text-gray-500">Loading summary...</p>
                    </td>
                  </tr>
                ) : pettySummaryData.filter(row => isRowInRange(row.date)).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 font-medium">
                      No Data Found
                    </td>
                  </tr>
                ) : (
                  pettySummaryData
                    .filter(row => isRowInRange(row.date))
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap text-center">{row.date}</td>
                        <td className="px-6 py-4 text-center text-gray-700 font-medium">{formatCurrency(parseFloat(row.balance.toString()))}</td>
                        <td className="px-6 py-4 text-center text-red-600">{formatCurrency(parseFloat(row.dailyExpenses.toString()))}</td>
                        <td className="px-6 py-4 text-center text-red-600">{formatCurrency(parseFloat(row.maintenance.toString()))}</td>
                        <td className="px-6 py-4 text-center text-red-600">{formatCurrency(parseFloat(row.fuel.toString()))}</td>
                        <td className="px-6 py-4 text-center text-red-600">{formatCurrency(parseFloat(row.otherExpenses.toString()))}</td>
                        <td className="px-6 py-4 text-center text-orange-600">{formatCurrency(parseFloat(row.payments.toString()))}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TALLY SUMMARY TABLE (Visible only activeTab is Tally) */}
      {activeTab === "tally" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-lg font-bold text-gray-800">
              Tally Summary
              {selectedShop !== "All" && (
                <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Shop: {selectedShop}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Export Buttons */}
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-all shadow-sm"
                >
                  <FaFilePdf className="text-sm" /> Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 text-xs font-bold rounded-lg border border-green-200 hover:bg-green-100 transition-all shadow-sm"
                >
                  <FaFileExcel className="text-sm" /> Export Excel
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold uppercase">Start Date:</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={summaryStartDate}
                  onChange={(e) => setSummaryStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-semibold uppercase">End Date:</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={summaryEndDate}
                  onChange={(e) => setSummaryEndDate(e.target.value)}
                />
              </div>
              {(summaryStartDate || summaryEndDate) && (
                <button
                  onClick={() => { setSummaryStartDate(""); setSummaryEndDate(""); }}
                  className="px-3 py-1 bg-red-50 text-red-600 text-sm font-medium rounded-md hover:bg-red-100 transition-colors border border-red-200"
                >
                  Clear
                </button>
              )}
              {/* Dropdown */}
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={selectedTallySheet}
                onChange={(e) => setSelectedTallySheet(e.target.value)}
              >
                {TALLY_SHEET_OPTIONS.map((option) => (
                  <option key={option.sheet} value={option.sheet}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-auto max-h-[500px] hide-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-blue-100 text-gray-700 font-bold uppercase border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Date</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Retail<br />Amt</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Wholesale<br />Amt</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Home<br />Delivery</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[120px]">Expenses</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">Card</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">UPI/Paytm</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">G-Pay</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">PhonePe</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">Cash</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center min-w-[100px]">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isSummaryLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <svg className="animate-spin h-8 w-8 text-[#2a5298] mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm text-gray-500">Loading tally summary...</p>
                    </td>
                  </tr>
                ) : tallySummaryData
                  .filter(row => {
                    const rowCounter = (row.counterName || "").toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (selectedTallySheet === "All") {
                      return userTallyCounters.some(c => {
                        const tc = c.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return tc.includes(rowCounter) || rowCounter.includes(tc);
                      });
                    }
                    const sc = selectedTallySheet.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return sc.includes(rowCounter) || rowCounter.includes(sc);
                  })
                  .filter(row => isRowInRange(row.date))
                  .length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500 font-medium">
                      No Data Found
                    </td>
                  </tr>
                ) : (
                  tallySummaryData
                    .filter(row => {
                      const rowCounter = (row.counterName || "").toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                      if (selectedTallySheet === "All") {
                        return userTallyCounters.some(c => {
                          const tc = c.toLowerCase().replace(/[^a-z0-9]/g, '');
                          return tc.includes(rowCounter) || rowCounter.includes(tc);
                        });
                      }
                      const sc = selectedTallySheet.toLowerCase().replace(/[^a-z0-9]/g, '');
                      return sc.includes(rowCounter) || rowCounter.includes(sc);
                    })
                    .filter(row => isRowInRange(row.date))
                    .map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap text-center">{row.date}</td>
                        <td className="px-6 py-4 text-center text-green-600 font-medium">{formatCurrency(parseFloat((row.retailAmt || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-green-600">{formatCurrency(parseFloat((row.wsaleAmt || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-blue-600">{formatCurrency(parseFloat((row.homeDelivery || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-red-600">{formatCurrency(parseFloat((row.expenses || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-gray-700">{formatCurrency(parseFloat((row.card || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-gray-700">{formatCurrency(parseFloat((row.paytm || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-gray-700">{formatCurrency(parseFloat((row.gpay || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-gray-700">{formatCurrency(parseFloat((row.phonePe || 0).toString()))}</td>
                        <td className="px-6 py-4 text-center text-gray-900 font-bold">{formatCurrency(parseFloat((row.cash || 0).toString()))}</td>
                        <td className={`px-6 py-4 text-center font-bold ${parseFloat((row.diff || 0).toString()) !== 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {formatCurrency(parseFloat((row.diff || 0).toString()))}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLE - Only shown for Patty Cash tab */}
      {activeTab === "patty" && (
        <TransactionTable
          transactions={filteredTransactions}
          editingStatusId={editingStatusId}
          tempStatus={tempStatus}
          onEditStatus={(id, status) => {
            setEditingStatusId(id);
            setTempStatus(status);
          }}
          onStatusChange={setTempStatus}
          onSaveStatus={async () => { setEditingStatusId(null); }}
          onCancelStatusEdit={() => { setEditingStatusId(null); setTempStatus(""); }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedTallyOption={""}
          onTallyOptionChange={setSelectedTallySheet}
          isLoading={isLoading}
        />
      )}
      <br />
    </div>
  );
}