import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmployeePicker } from '@/components/employee-picker';
import { StatusStamp, ledgerControls } from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useOwnerTasks } from '@/hooks/use-tasks';
import { supabase } from '@/lib/supabase';

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function OwnerAssignTaskScreen({ ownerId }: { ownerId: string }) {
  const { employees, tasks, isLoading, errorMessage: loadError, reload } = useOwnerTasks();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const employeeNames = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.full_name])),
    [employees],
  );
  const effectiveEmployeeId = selectedEmployeeId || employees[0]?.id || '';

  async function submitTask() {
    if (!effectiveEmployeeId || !title.trim() || !siteAddress.trim()) {
      setFormError('Select an employee and enter a title and site address.');
      return;
    }

    const normalizedDueDate = dueDate.trim();
    if (normalizedDueDate && !isValidDate(normalizedDueDate)) {
      setFormError('Enter the due date as YYYY-MM-DD.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    const { error } = await supabase.from('tasks').insert({
      assigned_to: effectiveEmployeeId,
      assigned_by: ownerId,
      title: title.trim(),
      site_address: siteAddress.trim(),
      due_date: normalizedDueDate || null,
      status: 'pending',
    });

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    setTitle('');
    setSiteAddress('');
    setDueDate('');
    setSuccessMessage('Task assigned successfully.');
    setIsSubmitting(false);
    await reload();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Assign task</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>New task</Text>

          <Text style={styles.label}>Employee</Text>
          <EmployeePicker
            employees={employees}
            onChange={setSelectedEmployeeId}
            value={effectiveEmployeeId}
          />

          <Text style={styles.label}>Task title</Text>
          <TextInput
            editable={!isSubmitting}
            onChangeText={setTitle}
            placeholder="Install replacement unit"
            placeholderTextColor={Palette.steel}
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>Site address</Text>
          <TextInput
            editable={!isSubmitting}
            multiline
            onChangeText={setSiteAddress}
            placeholder="123 Main Street"
            placeholderTextColor={Palette.steel}
            style={[styles.input, styles.multilineInput]}
            value={siteAddress}
          />

          <Text style={styles.label}>Due date (optional)</Text>
          <TextInput
            autoCapitalize="none"
            editable={!isSubmitting}
            maxLength={10}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Palette.steel}
            style={[styles.input, styles.dateInput]}
            value={dueDate}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          <Pressable
            disabled={isSubmitting || employees.length === 0}
            onPress={() => void submitTask()}
            style={[styles.submitButton, (isSubmitting || employees.length === 0) && styles.disabled]}>
            {isSubmitting ? (
              <ActivityIndicator color={Palette.ink} />
            ) : (
              <Text style={styles.submitButtonText}>Assign task</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.tasksSection}>
          <View style={styles.tasksHeader}>
            <Text style={styles.sectionTitle}>All tasks</Text>
            <Text style={styles.taskCount}>{tasks.length}</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Palette.safety} style={styles.listLoader} />
          ) : loadError ? (
            <View style={styles.loadError}>
              <Text style={styles.error}>{loadError}</Text>
              <Pressable onPress={() => void reload()}>
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          ) : tasks.length === 0 ? (
            <Text style={styles.empty}>No tasks have been assigned yet.</Text>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskCardHeader}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <StatusStamp tone={task.status === 'completed' ? 'positive' : 'warning'}>
                    {task.status}
                  </StatusStamp>
                </View>
                <Text style={styles.taskMeta}>
                  {employeeNames.get(task.assigned_to) ?? 'Unknown employee'}
                </Text>
                <Text style={styles.taskAddress}>{task.site_address}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    backgroundColor: Palette.paper,
  },
  back: { width: 72, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  headerTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  headerSpacer: { width: 72 },
  content: { width: '100%', maxWidth: Layout.content, alignSelf: 'center', padding: 24, paddingBottom: 52 },
  formCard: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: Palette.surface, borderTopColor: Palette.ink, borderTopWidth: 2, borderBottomColor: Palette.line, borderBottomWidth: 1, padding: 22 },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 22 },
  label: { color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 14, marginTop: 18, marginBottom: 8 },
  input: { ...ledgerControls.input },
  dateInput: { fontFamily: Fonts.mono },
  multilineInput: { minHeight: 88, paddingTop: 13, textAlignVertical: 'top' },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, marginTop: 14 },
  success: { color: Palette.onSite, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20, marginTop: 14 },
  submitButton: { ...ledgerControls.primary, marginTop: 22 },
  submitButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  disabled: { opacity: 0.6 },
  tasksSection: { marginTop: 28 },
  tasksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: Palette.ink, borderBottomWidth: 2, paddingBottom: 10 },
  taskCount: { color: Palette.steel, fontFamily: Fonts.sansSemiBold, fontSize: 13 },
  taskCard: { backgroundColor: Palette.surface, borderBottomWidth: 1, borderBottomColor: Palette.line, padding: 16 },
  taskCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskTitle: { flex: 1, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  taskMeta: { color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 13, marginTop: 8 },
  taskAddress: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, marginTop: 4 },
  listLoader: { marginTop: 28 },
  loadError: { alignItems: 'center', padding: 20 },
  retry: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 14, marginTop: 8 },
  empty: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 15, textAlign: 'center', padding: 24 },
  pressed: { opacity: 0.65 },
});
