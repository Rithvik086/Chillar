import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState, type ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import { useCreateGroup } from "@/features/groups/hooks/useCreateGroup";
import { validateGroupInput } from "@/features/groups/validation/group.validation";
import type { CreateGroupInput, GroupType } from "@/features/groups/types/group.types";
import { GroupTypeSelector } from "@/features/groups/components/GroupTypeSelector";

export function CreateGroupForm({ onSuccess, onCancel }: { onSuccess: (groupId: string) => void; onCancel: () => void }): ReactElement {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<GroupType>("Friends");
  const [validationErrors, setValidationErrors] = useState<{ name?: string; description?: string }>({});
  const { submit, isSubmitting, error } = useCreateGroup();

  async function handleSubmit(): Promise<void> {
    const input: CreateGroupInput = { name, description, type };
    const errors = validateGroupInput(input);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const result = await submit(input);
    if (result) onSuccess(result.group.id);
  }

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.label}>Group name</Text>
        <TextInput value={name} onChangeText={(value) => { setName(value); setValidationErrors((current) => ({ ...current, name: undefined })); }} placeholder="e.g. Goa Trip" placeholderTextColor={dashboardColors.muted} maxLength={60} style={[styles.input, validationErrors.name && styles.invalid]} />
        <Text style={styles.counter}>{name.length}/60</Text>
        {validationErrors.name ? <Text style={styles.fieldError}>{validationErrors.name}</Text> : null}
      </View>
      <View>
        <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput value={description} onChangeText={(value) => { setDescription(value); setValidationErrors((current) => ({ ...current, description: undefined })); }} placeholder="What is this group for?" placeholderTextColor={dashboardColors.muted} maxLength={200} multiline style={[styles.input, styles.description, validationErrors.description && styles.invalid]} />
        <Text style={styles.counter}>{description.length}/200</Text>
        {validationErrors.description ? <Text style={styles.fieldError}>{validationErrors.description}</Text> : null}
      </View>
      <View>
        <Text style={styles.label}>Group type</Text>
        <GroupTypeSelector value={type} onChange={setType} />
      </View>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onCancel} disabled={isSubmitting} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void handleSubmit()} disabled={isSubmitting} style={[styles.submit, isSubmitting && styles.disabled]}><Text style={styles.submitText}>{isSubmitting ? "Creating..." : "Create Group"}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  label: { color: dashboardColors.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  optional: { color: dashboardColors.muted, fontWeight: "400" },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: dashboardColors.border, borderRadius: 8, color: dashboardColors.text, backgroundColor: dashboardColors.surface, fontSize: 15 },
  description: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  invalid: { borderColor: dashboardColors.negative },
  counter: { color: dashboardColors.muted, fontSize: 11, textAlign: "right", marginTop: 4 },
  fieldError: { color: dashboardColors.negative, fontSize: 12, marginTop: 4 },
  error: { padding: 12, borderWidth: 1, borderColor: "#FECACA", borderRadius: 8, backgroundColor: "#FEF2F2" },
  errorText: { color: dashboardColors.negative, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancel: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: dashboardColors.border, borderRadius: 8, backgroundColor: dashboardColors.surface },
  cancelText: { color: dashboardColors.secondary, fontWeight: "700" },
  submit: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: dashboardColors.primary },
  disabled: { opacity: 0.6 },
  submitText: { color: dashboardColors.surface, fontWeight: "700" },
});
