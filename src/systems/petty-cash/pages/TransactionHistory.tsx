// import { useState, useEffect } from "react";
// import { FaHistory, FaTimes } from "react-icons/fa";
// import PettyCashModal from "../components/PettyCashModal";
// import CashTally from "./CashTally";
// import { Transaction } from "../types";

// export default function TransactionHistory() {
//   // Mock data for transaction history
//   const dummyTransactions: Transaction[] = [
//     {
//       id: "TXN-1736899200000",
//       date: "2025-01-15",
//       openingQty: "1000.00",
//       teaNasta: "50.00",
//       waterJar: "20.00",
//       lightBill: "100.00",
//       recharge: "0.00",
//       postOffice: "0.00",
//       customerDiscount: "0.00",
//       repairMaintenance: "0.00",
//       stationary: "30.00",
//       incentive: "0.00",
//       breakage: "0.00",
//       petrol: "200.00",
//       advance: "0.00",
//       excisePolice: "0.00",
//       desiBhada: "0.00",
//       otherPurchaseVoucherNo: "",
//       otherVendorPayment: "0.00",
//       differenceAmount: "0.00",
//       patilPetrol: "0.00",
//       roomExpense: "0.00",
//       officeExpense: "50.00",
//       personalExpense: "0.00",
//       miscExpense: "0.00",
//       closing: "850.00",
//       creditCardCharges: "0.00",
//       user: "John Doe",
//     },
//     {
//       id: "TXN-1736812800000",
//       date: "2025-01-14",
//       openingQty: "1200.00",
//       teaNasta: "60.00",
//       waterJar: "25.00",
//       lightBill: "0.00",
//       recharge: "50.00",
//       postOffice: "30.00",
//       customerDiscount: "100.00",
//       repairMaintenance: "0.00",
//       stationary: "0.00",
//       incentive: "0.00",
//       breakage: "0.00",
//       petrol: "0.00",
//       advance: "200.00",
//       excisePolice: "0.00",
//       desiBhada: "0.00",
//       otherPurchaseVoucherNo: "",
//       otherVendorPayment: "0.00",
//       differenceAmount: "0.00",
//       patilPetrol: "0.00",
//       roomExpense: "0.00",
//       officeExpense: "0.00",
//       personalExpense: "50.00",
//       miscExpense: "25.00",
//       closing: "660.00",
//       creditCardCharges: "0.00",
//       user: "John Doe",
//     },
//     {
//       id: "TXN-1736726400000",
//       date: "2025-01-13",
//       openingQty: "800.00",
//       teaNasta: "40.00",
//       waterJar: "15.00",
//       lightBill: "80.00",
//       recharge: "0.00",
//       postOffice: "0.00",
//       customerDiscount: "0.00",
//       repairMaintenance: "150.00",
//       stationary: "20.00",
//       incentive: "100.00",
//       breakage: "0.00",
//       petrol: "150.00",
//       advance: "0.00",
//       excisePolice: "0.00",
//       desiBhada: "0.00",
//       otherPurchaseVoucherNo: "",
//       otherVendorPayment: "0.00",
//       differenceAmount: "0.00",
//       patilPetrol: "0.00",
//       roomExpense: "0.00",
//       officeExpense: "0.00",
//       personalExpense: "0.00",
//       miscExpense: "0.00",
//       closing: "245.00",
//       creditCardCharges: "0.00",
//       user: "Jane Smith",
//     },
//     {
//       id: "TXN-1736640000000",
//       date: "2025-01-12",
//       openingQty: "1500.00",
//       teaNasta: "0.00",
//       waterJar: "0.00",
//       lightBill: "0.00",
//       recharge: "0.00",
//       postOffice: "0.00",
//       customerDiscount: "0.00",
//       repairMaintenance: "0.00",
//       stationary: "0.00",
//       incentive: "0.00",
//       breakage: "0.00",
//       petrol: "0.00",
//       advance: "0.00",
//       excisePolice: "0.00",
//       desiBhada: "0.00",
//       otherPurchaseVoucherNo: "",
//       otherVendorPayment: "500.00",
//       differenceAmount: "0.00",
//       patilPetrol: "0.00",
//       roomExpense: "0.00",
//       officeExpense: "0.00",
//       personalExpense: "0.00",
//       miscExpense: "0.00",
//       closing: "1000.00",
//       creditCardCharges: "0.00",
//       user: "John Doe",
//     },
//   ];

//   const [transactions, setTransactions] = useState<Transaction[]>(dummyTransactions);

//   const [cashTallyEntries, setCashTallyEntries] = useState([]);

//   const [activeTab, setActiveTab] = useState("petty-cash");

//   const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
//   const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);

//   const [isCashTallyModalOpen, setIsCashTallyModalOpen] = useState(false);
//   const [selectedCashTallyEntry, setSelectedCashTallyEntry] = useState<any>(null);

//   const refreshCashTallyEntries = () => {
//     const entries = JSON.parse(
//       localStorage.getItem("cashTallyEntries") || "[]"
//     );
//     setCashTallyEntries(entries);
//   };

//   useEffect(() => {
//     refreshCashTallyEntries();

//     const pettyCashTxns = JSON.parse(
//       localStorage.getItem("pettyCashTransactions") || "[]"
//     );
//     if (pettyCashTxns.length > 0) {
//       setTransactions(pettyCashTxns);
//     }
//   }, []);

//   const calculateTotal = (txn: any) => {
//     return [
//       parseFloat(txn.openingQty) || 0,
//       parseFloat(txn.teaNasta) || 0,
//       parseFloat(txn.waterJar) || 0,
//       parseFloat(txn.lightBill) || 0,
//       parseFloat(txn.recharge) || 0,
//       parseFloat(txn.postOffice) || 0,
//       parseFloat(txn.customerDiscount) || 0,
//       parseFloat(txn.repairMaintenance) || 0,
//       parseFloat(txn.stationary) || 0,
//       parseFloat(txn.incentive) || 0,
//       parseFloat(txn.breakage) || 0,
//       parseFloat(txn.petrol) || 0,
//       parseFloat(txn.advance) || 0,
//       parseFloat(txn.excisePolice) || 0,
//       parseFloat(txn.desiBhada) || 0,
//       parseFloat(txn.otherVendorPayment) || 0,
//       parseFloat(txn.differenceAmount) || 0,
//       parseFloat(txn.patilPetrol) || 0,
//       parseFloat(txn.roomExpense) || 0,
//       parseFloat(txn.officeExpense) || 0,
//       parseFloat(txn.personalExpense) || 0,
//       parseFloat(txn.miscExpense) || 0,
//       parseFloat(txn.closing) || 0,
//       parseFloat(txn.creditCardCharges) || 0,
//     ].reduce((acc, val) => acc + val, 0);
//   };

//   const calculateCashTallyTotal = (entry: any) => {
//     return [
//       parseFloat(entry.retailScanAmount) || 0,
//       parseFloat(entry.retail500) || 0,
//       parseFloat(entry.retail200) || 0,
//       parseFloat(entry.retail100) || 0,
//       parseFloat(entry.retail50) || 0,
//       parseFloat(entry.retail20) || 0,
//       parseFloat(entry.retail10) || 0,
//       parseFloat(entry.retail1) || 0,
//       parseFloat(entry.retailGpay) || 0,
//       parseFloat(entry.retailCard) || 0,
//       parseFloat(entry.expense) || 0,
//       parseFloat(entry.wsCashBillingAmount) || 0,
//       parseFloat(entry.wsCreditBillingAmount) || 0,
//       parseFloat(entry.wsCreditReceipt) || 0,
//       parseFloat(entry.ws500) || 0,
//       parseFloat(entry.ws200) || 0,
//       parseFloat(entry.ws100) || 0,
//       parseFloat(entry.ws50) || 0,
//       parseFloat(entry.ws20) || 0,
//       parseFloat(entry.ws10) || 0,
//       parseFloat(entry.ws1) || 0,
//       parseFloat(entry.wsGpayCard) || 0,
//       parseFloat(entry.homeDelivery) || 0,
//       parseFloat(entry.voidSale) || 0,
//     ].reduce((acc, val) => acc + val, 0);
//   };

//   const totalPettyCashAmount = transactions.reduce(
//     (sum, txn) => sum + calculateTotal(txn),
//     0
//   );

//   const totalCashTallyAmount = cashTallyEntries.reduce(
//     (sum, entry: any) => sum + calculateCashTallyTotal(entry),
//     0
//   );

//   return (
//     <div>
//       <div className="space-y-6">
//         <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//           <div className="flex border-b border-gray-200 mb-6">
//             <button
//               onClick={() => setActiveTab("petty-cash")}
//               className={`px-6 py-3 font-medium text-sm transition-colors ${
//                 activeTab === "petty-cash"
//                   ? "border-b-2 border-[#2a5298] text-[#2a5298]"
//                   : "text-gray-500 hover:text-gray-700"
//               }`}
//             >
//               Petty Cash History
//             </button>
//             <button
//               onClick={() => setActiveTab("cash-tally")}
//               className={`px-6 py-3 font-medium text-sm transition-colors ${
//                 activeTab === "cash-tally"
//                   ? "border-b-2 border-[#2a5298] text-[#2a5298]"
//                   : "text-gray-500 hover:text-gray-700"
//               }`}
//             >
//               Cash Tally History
//             </button>
//           </div>

//           {/* Tab Content */}
//           {activeTab === "petty-cash" && (
//             <>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead>
//                     <tr className="border-b border-gray-200">
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         Transaction ID
//                       </th>
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         Date
//                       </th>
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         Total Amount
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {transactions.map((transaction) => (
//                       <tr
//                         key={transaction.id}
//                         className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
//                         onClick={() => {
//                           setSelectedTransaction(transaction);
//                           setIsDetailModalOpen(true);
//                         }}
//                       >
//                         <td className="py-3 px-4 text-gray-600 font-mono text-sm">
//                           {transaction.id}
//                         </td>
//                         <td className="py-3 px-4 text-gray-800">
//                           {transaction.date}
//                         </td>
//                         <td className="py-3 px-4 text-gray-800">
//                           ₹{calculateTotal(transaction).toFixed(2)}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
//                 <div className="flex items-center justify-between">
//                   <span className="text-lg font-semibold text-gray-700">
//                     Total Petty Cash Amount:
//                   </span>
//                   <span className="text-2xl font-bold text-[#2a5298]">
//                     ₹{totalPettyCashAmount.toFixed(2)}
//                   </span>
//                 </div>
//               </div>
//             </>
//           )}

//           {activeTab === "cash-tally" && cashTallyEntries.length > 0 && (
//             <>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead>
//                     <tr className="border-b border-gray-200">
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         ID
//                       </th>
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         Date
//                       </th>
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                       Employee name 
//                       </th>
//                       <th className="text-left py-3 px-4 font-semibold text-gray-700">
//                         TotalAmount
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {cashTallyEntries.map((entry: any) => (
//                       <tr
//                         key={entry.id}
//                         className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
//                         onClick={() => {
//                           setSelectedCashTallyEntry(entry);
//                           setIsCashTallyModalOpen(true);
//                         }}
//                       >
//                         <td className="py-3 px-4 text-gray-600 font-mono text-sm">
//                           {entry.id}
//                         </td>
//                         <td className="py-3 px-4 text-gray-800">{entry.date}</td>
//                         <td className="py-3 px-4 text-gray-800">{entry.name}</td>
//                         <td className="py-3 px-4 text-gray-800">
//                           ₹{calculateCashTallyTotal(entry).toFixed(2)}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
//                 <div className="flex items-center justify-between">
//                   <span className="text-lg font-semibold text-gray-700">
//                     Total Cash Tally Amount:
//                   </span>
//                   <span className="text-2xl font-bold text-[#2a5298]">
//                     ₹{totalCashTallyAmount.toFixed(2)}
//                   </span>
//                 </div>
//               </div>
//             </>
//           )}

//           {activeTab === "cash-tally" && cashTallyEntries.length === 0 && (
//             <div className="text-center py-12">
//               <p className="text-gray-500">No cash tally entries found.</p>
//             </div>
//           )}
//         </div>
//       </div>
//       <PettyCashModal
//         isOpen={isDetailModalOpen}
//         onClose={() => setIsDetailModalOpen(false)}
//         onSave={(data) => {
//           if (!selectedTransaction) return;
//           const updatedTransactions = transactions.map(txn =>
//             txn.id === selectedTransaction.id ? { ...txn, ...data } : txn
//           );
//           setTransactions(updatedTransactions);
//           localStorage.setItem("pettyCashTransactions", JSON.stringify(updatedTransactions));
//           setIsDetailModalOpen(false);
//         }}
//         initialData={selectedTransaction}
//       />
//       <CashTally
//         isOpen={isCashTallyModalOpen}
//         onClose={() => {
//           setIsCashTallyModalOpen(false);
//           refreshCashTallyEntries();
//         }}
//         initialData={selectedCashTallyEntry}
//       />
//     </div>
//   );
// }


import { useState, useEffect } from "react";
// import { FaHistory, FaTimes } from "react-icons/fa";
import PettyCashModal, { CategoryAmounts } from "../components/PettyCashModal";
import CashTally from "./CashTally";
import { Transaction } from "../types";
import { supabase } from '../supabase';



export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTallyEntries, setCashTallyEntries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("petty-cash");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);
  const [isCashTallyModalOpen, setIsCashTallyModalOpen] = useState(false);
  const [selectedCashTallyEntry, setSelectedCashTallyEntry] = useState<any>(null);



  const fetchPettyCashTransactions = async () => {
    try {
      console.log("Fetching petty cash transactions from Supabase...");
      const { data, error } = await supabase
        .from('petty_cash_expense')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      
      const mapped: Transaction[] = (data || []).map(rec => ({
        id: rec.patty_id,
        date: rec.date,
        openingQty: rec.opening_qty?.toString() || "0",
        closing: rec.closing?.toString() || "0",
        teaNasta: rec.tea_nasta?.toString() || "0",
        waterJar: rec.water_jar?.toString() || "0",
        lightBill: rec.light_bill?.toString() || "0",
        recharge: rec.recharge?.toString() || "0",
        postOffice: rec.post_office?.toString() || "0",
        customerDiscount: rec.customer_discount?.toString() || "0",
        repairMaintenance: rec.repair_maintenance?.toString() || "0",
        stationary: rec.stationary?.toString() || "0",
        petrol: rec.petrol?.toString() || "0",
        patilPetrol: rec.patil_petrol?.toString() || "0",
        incentive: "0",
        incentiveName: "",
        advance: "0",
        breakage: "0",
        excisePolice: rec.excise_police?.toString() || "0",
        desiBhada: rec.desi_bhada?.toString() || "0",
        roomExpense: rec.room_expense?.toString() || "0",
        officeExpense: rec.office_expense?.toString() || "0",
        personalExpense: rec.personal_expense?.toString() || "0",
        miscExpense: rec.misc_expense?.toString() || "0",
        creditCardCharges: rec.credit_card_charges?.toString() || "0",
        otherPurchaseVoucherNo: rec.other_purchase_voucher_no || "",
        otherVendorPayment: rec.other_vendor_payment?.toString() || "0",
        differenceAmount: rec.difference_amount?.toString() || "0",
        transactionStatus: rec.transaction_status || "Pending",
        amount: rec.total_expense || 0,
        sheetName: "Patty Expence",
        remarks: rec.misc_remarks || "",
        description: `Petty Cash log for ${rec.date}`,
        category: "Petty Cash",
        name: rec.username || ""
      }));

      setTransactions(mapped);
      localStorage.setItem("pettyCashTransactions", JSON.stringify(mapped));
    } catch (error) {
      console.error("Error fetching petty cash transactions:", error);
      setTransactions([]);
    }
  };

  const fetchCashTallyEntries = async () => {
    try {
      console.log("Fetching cash tally entries from all counters via Supabase...");
      const { data, error } = await supabase
        .from('petty_cash_tallies')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(rec => ({
        id: rec.tally_id,
        date: rec.date,
        name: rec.name,
        shopName: rec.shop_name,
        retailScanAmount: rec.retail_scan_amount?.toString() || "0",
        retail500: rec.retail_500?.toString() || "0",
        retail200: rec.retail_200?.toString() || "0",
        retail100: rec.retail_100?.toString() || "0",
        retail50: rec.retail_50?.toString() || "0",
        retail20: rec.retail_20?.toString() || "0",
        retail10: rec.retail_10?.toString() || "0",
        retail1: rec.retail_1?.toString() || "0",
        retailGpay: rec.retail_gpay?.toString() || "0",
        retailPhonePe: rec.retail_phonepe?.toString() || "0",
        retailPaytm: rec.retail_paytm?.toString() || "0",
        retailCard: rec.retail_card?.toString() || "0",
        wsCashBillingAmount: rec.ws_cash_billing_amount?.toString() || "0",
        wsCreditBillingAmount: rec.ws_credit_billing_amount?.toString() || "0",
        wsCreditReceipt: rec.ws_credit_receipt?.toString() || "0",
        ws500: rec.ws_500?.toString() || "0",
        ws200: rec.ws_200?.toString() || "0",
        ws100: rec.ws_100?.toString() || "0",
        ws50: rec.ws_50?.toString() || "0",
        ws20: rec.ws_20?.toString() || "0",
        ws10: rec.ws_10?.toString() || "0",
        ws1: rec.ws_1?.toString() || "0",
        wsGpayCard: rec.ws_gpay_card?.toString() || "0",
        wsPhonePe: rec.ws_phonepe?.toString() || "0",
        wsPaytm: rec.ws_paytm?.toString() || "0",
        wsCard: rec.ws_card?.toString() || "0",
        expense: rec.expense?.toString() || "0",
        homeDelivery: rec.home_delivery?.toString() || "0",
        retail1500: rec.retail_1500?.toString() || "0",
        retail2200: rec.retail_2200?.toString() || "0",
        retail3100: rec.retail_3100?.toString() || "0",
        retail450: rec.retail_450?.toString() || "0",
        retail520: rec.retail_520?.toString() || "0",
        retail610: rec.retail_610?.toString() || "0",
        retail71: rec.retail_71?.toString() || "0",
        voidSale: rec.void_sale?.toString() || "0",
        expenseGpayCard: rec.expense_gpay_card?.toString() || "0",
        counter: rec.counter
      }));

      setCashTallyEntries(mapped);
      localStorage.setItem("cashTallyEntries", JSON.stringify(mapped));
    } catch (error) {
      console.error("Error fetching cash tally entries:", error);
      setCashTallyEntries([]);
    }
  };



  useEffect(() => {
    if (activeTab === "petty-cash") {
      fetchPettyCashTransactions();
    } else if (activeTab === "cash-tally") {
      fetchCashTallyEntries();
    }
  }, [activeTab]);

  // On mount, load initial data as petty cash
  useEffect(() => {
    fetchPettyCashTransactions();
  }, []);

  const calculateTotal = (txn: any) => {
    return [
      parseFloat(txn.openingQty) || 0,
      parseFloat(txn.teaNasta) || 0,
      parseFloat(txn.waterJar) || 0,
      parseFloat(txn.lightBill) || 0,
      parseFloat(txn.recharge) || 0,
      parseFloat(txn.postOffice) || 0,
      parseFloat(txn.customerDiscount) || 0,
      parseFloat(txn.repairMaintenance) || 0,
      parseFloat(txn.stationary) || 0,
      parseFloat(txn.incentive) || 0,
      parseFloat(txn.breakage) || 0,
      parseFloat(txn.petrol) || 0,
      parseFloat(txn.advance) || 0,
      parseFloat(txn.excisePolice) || 0,
      parseFloat(txn.desiBhada) || 0,
      parseFloat(txn.otherVendorPayment) || 0,
      parseFloat(txn.differenceAmount) || 0,
      parseFloat(txn.patilPetrol) || 0,
      parseFloat(txn.roomExpense) || 0,
      parseFloat(txn.officeExpense) || 0,
      parseFloat(txn.personalExpense) || 0,
      parseFloat(txn.miscExpense) || 0,
      parseFloat(txn.closing) || 0,
      parseFloat(txn.creditCardCharges) || 0,
    ].reduce((acc, val) => acc + val, 0);
  };

  const calculateCashTallyTotal = (entry: any) => {
    return [
      parseFloat(entry.retailScanAmount) || 0,
      parseFloat(entry.retail500) || 0,
      parseFloat(entry.retail200) || 0,
      parseFloat(entry.retail100) || 0,
      parseFloat(entry.retail50) || 0,
      parseFloat(entry.retail20) || 0,
      parseFloat(entry.retail10) || 0,
      parseFloat(entry.retail1) || 0,
      parseFloat(entry.retailGpay) || 0,
      parseFloat(entry.retailCard) || 0,
      parseFloat(entry.expense) || 0,
      parseFloat(entry.wsCashBillingAmount) || 0,
      parseFloat(entry.wsCreditBillingAmount) || 0,
      parseFloat(entry.wsCreditReceipt) || 0,
      parseFloat(entry.ws500) || 0,
      parseFloat(entry.ws200) || 0,
      parseFloat(entry.ws100) || 0,
      parseFloat(entry.ws50) || 0,
      parseFloat(entry.ws20) || 0,
      parseFloat(entry.ws10) || 0,
      parseFloat(entry.ws1) || 0,
      parseFloat(entry.wsGpayCard) || 0,
      parseFloat(entry.homeDelivery) || 0,
      parseFloat(entry.voidSale) || 0,
    ].reduce((acc, val) => acc + val, 0);
  };

  const totalPettyCashAmount = transactions.reduce(
    (sum, txn) => sum + calculateTotal(txn),
    0
  );

  const totalCashTallyAmount = cashTallyEntries.reduce(
    (sum, entry: any) => sum + calculateCashTallyTotal(entry),
    0
  );

  return (
    <div>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab("petty-cash")}
              className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === "petty-cash"
                ? "border-b-2 border-[#2a5298] text-[#2a5298]"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Petty Cash History
            </button>
            <button
              onClick={() => setActiveTab("cash-tally")}
              className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === "cash-tally"
                ? "border-b-2 border-[#2a5298] text-[#2a5298]"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Cash Tally History
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "petty-cash" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Transaction ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Total Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                          {transaction.id}
                        </td>
                        <td className="py-3 px-4 text-gray-800">
                          {transaction.date}
                        </td>
                        <td className="py-3 px-4 text-gray-800">
                          ₹{calculateTotal(transaction).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-700">
                    Total Petty Cash Amount:
                  </span>
                  <span className="text-2xl font-bold text-[#2a5298]">
                    ₹{totalPettyCashAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === "cash-tally" && cashTallyEntries.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        Employee name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        TotalAmount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTallyEntries.map((entry: any) => (
                      <tr
                        key={entry.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedCashTallyEntry(entry);
                          setIsCashTallyModalOpen(true);
                        }}
                      >
                        <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                          {entry.id}
                        </td>
                        <td className="py-3 px-4 text-gray-800">{entry.date}</td>
                        <td className="py-3 px-4 text-gray-800">{entry.name}</td>
                        <td className="py-3 px-4 text-gray-800">
                          ₹{calculateCashTallyTotal(entry).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-700">
                    Total Cash Tally Amount:
                  </span>
                  <span className="text-2xl font-bold text-[#2a5298]">
                    ₹{totalCashTallyAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === "cash-tally" && cashTallyEntries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No cash tally entries found.</p>
            </div>
          )}
        </div>
      </div>
      <PettyCashModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onSave={(data) => {
          if (!selectedTransaction) return;
          const updatedTransactions = transactions.map(txn =>
            txn.id === selectedTransaction.id ? { ...txn, ...data } : txn
          );
          setTransactions(updatedTransactions);
          localStorage.setItem("pettyCashTransactions", JSON.stringify(updatedTransactions));
          setIsDetailModalOpen(false);
        }}
        initialData={selectedTransaction as unknown as CategoryAmounts}
      />
      <CashTally
        isOpen={isCashTallyModalOpen}
        onClose={() => {
          setIsCashTallyModalOpen(false);
          fetchCashTallyEntries();
        }}
        initialData={selectedCashTallyEntry}
      />
    </div>
  );
}
