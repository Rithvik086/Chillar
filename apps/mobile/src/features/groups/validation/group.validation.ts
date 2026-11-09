import type { CreateGroupInput } from "@/features/groups/types/group.types";

export interface GroupValidationErrors {
  name?: string;
  description?: string;
}

export function validateGroupInput(input: CreateGroupInput): GroupValidationErrors {
  const errors: GroupValidationErrors = {};
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";

  if (name.length === 0) errors.name = "Enter a group name.";
  else if (name.length > 60) errors.name = "Group names can be up to 60 characters.";
  if (description.length > 200) errors.description = "Descriptions can be up to 200 characters.";
  return errors;
}
