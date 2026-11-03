import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../SupabaseClient";

const RealtimeLogoutListener = () => {
  const navigate = useNavigate();

  // ✅ Ask notification permission
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // ✅ User auto-logout listener (for current user)
  useEffect(() => {
    let subscription;
    const username = localStorage.getItem("user-name");
    const userId = localStorage.getItem("user-id");
    if (!username || !userId) return;

    subscription = supabase
      .channel("user-status-watch")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen for all changes (including DELETE)
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const isDeleted = payload.eventType === "DELETE";
          const isInactive = payload.eventType === "UPDATE" && payload.new.status === "inactive";

          if (isDeleted || isInactive) {
            // Show Chrome notification to user
            if (Notification.permission === "granted") {
              new Notification(isDeleted ? "Account Deleted" : "Account Deactivated", {
                body: isDeleted
                  ? "Your account has been removed. You have been logged out."
                  : "Your account has been deactivated. You have been logged out.",
                icon: "/logo.png",
              });
            }

            localStorage.clear();
            const masterUrl = import.meta.env.VITE_MASTER_PORTAL_URL || 
              (window.location.origin.includes('localhost') ? 'http://localhost:5173' : window.location.origin);
            if (window.parent && window.parent !== window) {
              try {
                window.parent.location.href = `${masterUrl}/login?logout=true`;
              } catch (e) {
                navigate("/login");
                window.location.reload();
              }
            } else {
              navigate("/login");
              window.location.reload();
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [navigate]);

  // ✅ Admin listener to see logout notifications
  // (Removed: unfiltered admin-wide `users` realtime listener — it was a
  // notification-only feature and loaded the Realtime pool for every admin.)


  // ✅ Check user status on refresh
  useEffect(() => {
    const checkUserStatusOnLoad = async () => {
      const username = localStorage.getItem("user-name");
      if (!username) return;

      const { data } = await supabase
        .from("users")
        .select("status")
        .eq("user_name", username)
        .limit(1);

      const userDataResult = data && data.length > 0 ? data[0] : null;

      // If user doesn't exist (deleted) or is inactive, logout
      if (!userDataResult || userDataResult.status === "inactive") {
        localStorage.clear();
        const masterUrl = import.meta.env.VITE_MASTER_PORTAL_URL || 
          (window.location.origin.includes('localhost') ? 'http://localhost:5173' : window.location.origin);
        if (window.parent && window.parent !== window) {
          try {
            window.parent.location.href = `${masterUrl}/login?logout=true`;
          } catch (e) {
            navigate("/login");
            window.location.reload();
          }
        } else {
          navigate("/login");
          window.location.reload();
        }
      }
    };

    checkUserStatusOnLoad();
  }, [navigate]);

  return null;
};

export default RealtimeLogoutListener;
