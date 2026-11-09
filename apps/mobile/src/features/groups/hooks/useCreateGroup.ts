import { useCallback, useRef, useState } from "react";
import { createGroup } from "@/features/groups/services/group-create.service";
import type { CreateGroupInput, CreateGroupResult } from "@/features/groups/types/group.types";

export function useCreateGroup(): {
  submit: (input: CreateGroupInput) => Promise<CreateGroupResult | null>;
  isSubmitting: boolean;
  error: string | null;
} {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = useCallback(async (input: CreateGroupInput) => {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      return await createGroup(input);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the group.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, error };
}
