// Shared helper: an assignment is "expired" once its end time (+ estimated duration) has passed.
// Used by Work Records (WorkDetails) and Quick Task so both derive "AVAILABLE" the same way.
export const isAssignmentExpired = (item) => {
  if (!item.end_datetime) return false;
  const str = String(item.end_datetime).trim();
  const datePart = str.split(/[T ]/)[0] || "";
  if (!datePart || datePart === "2000-01-01" || datePart.startsWith("0000") || datePart.startsWith("1970")) {
    return false;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  // If end date is in the future, it is definitely not expired
  if (datePart > todayStr) return false;

  let timePart = "";
  if (str.includes("T")) timePart = str.split("T")[1]?.substring(0, 8) || "";
  else if (str.includes(" ")) timePart = str.split(" ")[1]?.substring(0, 8) || "";
  if (!timePart || timePart.startsWith("00:00")) timePart = "23:59:59";

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);
  if (!y || !m || !d) return false;

  const endWithDuration = new Date(y, m - 1, d, hh || 23, mm || 59, ss || 59);
  const durationMins = Number(item.duration || item.estimated_minutes || 0);
  if (durationMins > 0) {
    endWithDuration.setMinutes(endWithDuration.getMinutes() + durationMins);
  }

  return now > endWithDuration;
};
