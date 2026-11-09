import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboard } from "@/features/dashboard/services/dashboard.service";
import type { DashboardData } from "@/features/dashboard/types/dashboard.types";

export function useDashboard(userId: string | undefined): {
  data: DashboardData | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(() => {
    if (!userId) return;
    const currentRequest = ++requestId.current;
    setError(null);
    void fetchDashboard(userId)
      .then((nextData) => { if (currentRequest === requestId.current) setData(nextData); })
      .catch((loadError: unknown) => {
        if (currentRequest === requestId.current) setError(loadError instanceof Error ? loadError.message : "Unable to load your dashboard.");
      })
      .finally(() => {
        if (currentRequest === requestId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
  }, [userId]);

  useEffect(() => {
    setData(null);
    setIsLoading(true);
    refresh();
  }, [refresh]);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh: () => {
      setIsRefreshing(true);
      refresh();
    },
  };
}
