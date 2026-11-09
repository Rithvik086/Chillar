import { supabase } from "@/utils/supabase";
import { validateGroupInput } from "@/features/groups/validation/group.validation";
import type { CreateGroupInput, CreateGroupResult } from "@/features/groups/types/group.types";

export async function createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  const errors = validateGroupInput(input);
  if (Object.keys(errors).length > 0) throw new TypeError(Object.values(errors).join(" "));

  const { data: groupId, error } = await supabase.rpc("create_group", {
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
  });
  if (error) throw mapGroupCreationError(error);
  if (typeof groupId !== "string") throw new Error("Group creation did not return a group ID.");

  const { data, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (groupError) throw mapGroupCreationError(groupError);

  return {
    group: data,
    groupType: input.type,
  };
}

interface SupabaseGroupError {
  code?: string;
  message?: string;
  details?: string;
}

function mapGroupCreationError(error: SupabaseGroupError): Error {
  if (error.code === "28000" || error.code === "401") {
    return new Error("Your session has expired. Please sign in again.");
  }
  if (error.code === "42501") {
    const message = error.message?.toLowerCase() ?? "";
    if (message.includes("group_members")) {
      return new Error(
        "The creator could not be added to this group. The deployed group-membership permissions are incomplete.",
      );
    }
    if (message.includes("groups")) {
      return new Error(
        "The database rejected the group row. The authenticated user does not match the group creator.",
      );
    }
    return new Error(
      "The database denied group creation. Please share the Supabase error details with the developer.",
    );
  }
  if (error.code === "23503") {
    return new Error("Your profile is not ready yet. Please sign out and sign in again.");
  }
  if (error.code === "23505") {
    return new Error("This group membership already exists. Please try again.");
  }
  if (error.code === "23514" || error.message?.toLowerCase().includes("20 active members")) {
    return new Error("This group has reached the maximum of 20 active members.");
  }
  return new Error(error.message?.trim() || error.details?.trim() || "The group could not be created. Please try again.");
}
