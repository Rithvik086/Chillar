import { useCallback, useEffect, useState } from "react";
import { fetchGroupDetail } from "@/features/groups/services/group-detail.service";
import type { GroupDetail } from "@/features/groups/types/group-detail.types";

export function useGroupDetail(groupId: string | undefined, userId: string | undefined) {
  const [data, setData] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!groupId || !userId) {
      setError("This group link is invalid.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchGroupDetail(groupId, userId));
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load this group.");
    } finally {
      setIsLoading(false);
    }
  }, [groupId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, isLoading, refresh: load };
}
