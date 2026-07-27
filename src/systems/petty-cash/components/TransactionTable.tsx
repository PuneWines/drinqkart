import { FaClock } from 'react-icons/fa';
import { Transaction } from '../types';




interface TransactionTableProps {
  transactions: Transaction[];
  editingStatusId: string | null;
  tempStatus: string;
  onEditStatus: (id: string, currentStatus: string) => void;
  onSaveStatus: (id: string) => void;
  onCancelStatusEdit: () => void;
  onStatusChange: (status: string) => void;
  // Tab & dropdown controlled from parent
  activeTab: 'patty' | 'tally';
  onTabChange: (tab: 'patty' | 'tally') => void;
  selectedTallyOption: string;
  onTallyOptionChange: (sheet: string) => void;
  isLoading: boolean;
}

export default function TransactionTable({
  transactions,
  isLoading,
}: TransactionTableProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-800">Transaction History</h3>
        <p className="text-sm text-gray-600 mt-1">
          Total Transactions: {transactions.length}
        </p>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-10">
            <svg
              className="animate-spin h-8 w-8 text-[#2a5298] mb-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-500 text-lg font-medium">Loading transactions...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Category
                </th>

                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>


              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FaClock className="text-4xl text-gray-300" />
                      <p className="text-lg font-medium">No transactions yet</p>
                      <p className="text-sm">
                        Add your first expense to get started
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      {transaction.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {transaction.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {transaction.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-800">
                      {formatCurrency(transaction.amount)}
                    </td>


                  </tr>
                ))
              )}
            </tbody>

          </table>
        )}

      </div>
      {/* Add this below the table or wherever you want to show total amount */}
      <div className="px-6 py-4 bg-gray-50 text-right text-lg font-semibold text-gray-800 border-t border-gray-200">
        Total Amount: {formatCurrency(transactions.reduce((sum, t) => sum + t.amount, 0))}
      </div>

    </div>
  );
}
