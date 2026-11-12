// Single source of truth for whether an approved leave counts as payable.
// Loss of Pay / Unpaid / Non Payable leaves are not payable.
export const isLeavePayable = (leave) => {
  const isPayableVal = String(leave?.is_payable ?? '').trim().toLowerCase();
  const leaveTypeVal = String(leave?.leave_type ?? leave?.leaveType ?? '').trim().toLowerCase();
  const nonPayable = isPayableVal.includes('non') || isPayableVal.includes('unpaid') || isPayableVal.includes('loss');
  const payable = isPayableVal.includes('payable') || isPayableVal.includes('paid') || isPayableVal === 'yes' || isPayableVal === 'true';
  if (nonPayable) return false;
  if (!payable && (leaveTypeVal.includes('unpaid') || leaveTypeVal.includes('loss of pay'))) return false;
  return true;
};
