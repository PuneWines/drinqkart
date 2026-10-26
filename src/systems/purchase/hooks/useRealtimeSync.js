import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

/**
 * useRealtimeSync
 *
 * Subscribes to Supabase Realtime for the three core tables used across the
 * purchase-system pages. When Supabase pushes a change event the hook calls
 * `queryClient.invalidateQueries()` with only the affected cache key(s) so
 * React Query re-fetches just that data — not everything.
 *
 * Subscriptions request only the minimum columns needed to identify the
 * changed row, keeping the Realtime payload as small as possible.
 *
 * Usage:
 *   import { useRealtimeSync } from "../hooks/useRealtimeSync";
 *   // inside any component:
 *   useRealtimeSync();
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Multiplex all table change listeners on a single realtime channel
    // to minimize WebSocket channels and connection pool overhead on Supabase
    const syncChannel = supabase
      .channel("realtime:purchase_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_indent_items",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["approvalsData"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_approved_indent_items",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["approvalsData"] });
          queryClient.invalidateQueries({ queryKey: ["purchaseOrderPageData"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_purchase_orders",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pipelineOrders"] });
          queryClient.invalidateQueries({ queryKey: ["pipelineStats"] });
          queryClient.invalidateQueries({ queryKey: ["poHistory"] });
          queryClient.invalidateQueries({ queryKey: ["nextPoNumber"] });
          queryClient.invalidateQueries({ queryKey: ["purchaseOrderPageData"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_dashboard",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["purchaseDashboardLogs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [queryClient]);
}
