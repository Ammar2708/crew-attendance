import { FunctionsHttpError } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusStamp, ledgerControls } from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useEmployeeTodayAttendance } from '@/hooks/use-owner-dashboard';
import { supabase } from '@/lib/supabase';
import {
  BUSINESS_TIMEZONE,
  calculateWorkHours,
  getBusinessDateKey,
  formatBusinessDateKey,
} from '@/lib/work-hours';
import type { DashboardAttendance } from '@/types/dashboard';

type RemoveEmployeeResponse = {
  success?: boolean;
  error?: string;
};

function formatTime(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
}

async function getFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = (await error.context.json()) as RemoveEmployeeResponse;
      if (body.error) return body.error;
    } catch {
      // Fall back to the client error when the function response is not JSON.
    }
  }

  return error instanceof Error ? error.message : 'Unable to remove the employee.';
}

function AttendanceSession({ record, index }: { record: DashboardAttendance; index: number }) {
  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>Session {index + 1}</Text>
        <StatusStamp tone={record.clock_out_time ? 'neutral' : 'positive'}>
          {record.clock_out_time ? 'Completed' : 'Clocked in'}
        </StatusStamp>
      </View>
      <View style={styles.times}>
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Clock in</Text>
          <Text style={styles.timeValue}>{formatTime(record.clock_in_time)}</Text>
        </View>
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Clock out</Text>
          <Text style={styles.timeValue}>{formatTime(record.clock_out_time)}</Text>
        </View>
      </View>
    </View>
  );
}

export function EmployeeAttendanceDetailScreen({ employeeId }: { employeeId: string }) {
  const { employee, attendance, devices, isLoading, errorMessage, reload } =
    useEmployeeTodayAttendance(employeeId);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const todayHours = calculateWorkHours(attendance);

  async function removeEmployee() {
    if (!employee || !employee.is_active || isRemoving) return;

    setIsRemoving(true);
    setRemoveError(null);
    const { data, error } = await supabase.functions.invoke<RemoveEmployeeResponse>(
      'remove-employee',
      { body: { employee_id: employee.id } },
    );

    if (error) {
      setRemoveError(await getFunctionErrorMessage(error));
      setIsRemoving(false);
      return;
    }

    if (!data?.success) {
      setRemoveError(data?.error ?? 'Unable to remove the employee.');
      setIsRemoving(false);
      return;
    }

    setIsConfirmingRemoval(false);
    router.replace('/dashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Attendance
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.safety} size="large" />
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
          <Pressable onPress={() => void reload()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.list, attendance.length === 0 && styles.emptyList]}
          data={attendance}
          keyExtractor={(record) => record.id}
          ListHeaderComponent={
            <View>
              <View style={styles.employeeSummary}>
                <View style={styles.employeeTitleRow}>
                  <View style={styles.employeeIdentity}>
                    <Text style={styles.employeeName}>{employee?.full_name}</Text>
                    <StatusStamp tone={employee?.is_active ? 'positive' : 'neutral'}>
                      {employee?.is_active ? 'Active' : 'Inactive'}
                    </StatusStamp>
                  </View>
                  {employee?.is_active ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setRemoveError(null);
                        setIsConfirmingRemoval(true);
                      }}
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                      <Text style={styles.removeButtonText}>Remove employee</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.date}>
                  {formatBusinessDateKey(getBusinessDateKey(new Date()), {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.hoursSummary}>
                <View style={styles.hoursCard}>
                  <Text style={styles.hoursValue}>{todayHours.totalHours.toFixed(1)}</Text>
                  <Text style={styles.hoursLabel}>Today&apos;s total hours</Text>
                </View>
                <View style={styles.hoursCard}>
                  <Text style={styles.hoursValue}>{todayHours.overtimeHours.toFixed(1)}</Text>
                  <Text style={styles.hoursLabel}>Today&apos;s overtime hours</Text>
                </View>
              </View>

              <View style={styles.devicesSection}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionTitle}>Registered devices</Text>
                  <Text style={styles.deviceCount}>
                    {devices.length} {devices.length === 1 ? 'device' : 'devices'}
                  </Text>
                </View>
                {devices.length === 0 ? (
                  <Text style={styles.noDevices}>No registered mobile devices.</Text>
                ) : (
                  devices.map((device) => (
                    <View key={device.id} style={styles.deviceCard}>
                      <Text style={styles.devicePlatform}>{device.platform.toUpperCase()}</Text>
                      <Text style={styles.deviceMeta}>
                        Last active {formatDateTime(device.last_seen_at)}
                      </Text>
                      <Text style={styles.deviceMeta}>
                        Registered {formatDateTime(device.created_at)}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.attendanceTitle}>Today&apos;s attendance</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Not clocked in</Text>
              <Text style={styles.emptyCopy}>There are no attendance records for today.</Text>
            </View>
          }
          renderItem={({ item, index }) => <AttendanceSession index={index} record={item} />}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => !isRemoving && setIsConfirmingRemoval(false)}
        transparent
        visible={isConfirmingRemoval}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Remove employee?</Text>
            <Text style={styles.confirmCopy}>
              Are you sure you want to remove {employee?.full_name}? This cannot be undone.
            </Text>
            {removeError ? (
              <Text accessibilityRole="alert" style={styles.removeError}>
                {removeError}
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                disabled={isRemoving}
                onPress={() => setIsConfirmingRemoval(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isRemoving}
                onPress={() => void removeEmployee()}
                style={({ pressed }) => [
                  styles.confirmRemoveButton,
                  pressed && styles.pressed,
                  isRemoving && styles.disabled,
                ]}>
                {isRemoving ? (
                  <ActivityIndicator color={Palette.surface} />
                ) : (
                  <Text style={styles.confirmRemoveText}>Remove employee</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { flex: 1, color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18, textAlign: 'center' },
  headerSpacer: { width: 72 },
  list: {
    width: '100%',
    maxWidth: Layout.content,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 0,
  },
  emptyList: { flexGrow: 1 },
  employeeSummary: { borderBottomColor: Palette.ink, borderBottomWidth: 2, paddingBottom: 16 },
  employeeTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  employeeIdentity: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  employeeName: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 26 },
  date: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 13, marginTop: 5 },
  hoursSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopColor: Palette.line,
    borderTopWidth: 1,
    marginTop: 24,
  },
  hoursCard: {
    minWidth: 150,
    flex: 1,
    backgroundColor: Palette.surface,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    padding: 15,
  },
  hoursValue: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 24 },
  hoursLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12, marginTop: 4 },
  removeButton: {
    ...ledgerControls.secondary,
    minHeight: 40,
    borderColor: Palette.alert,
    paddingHorizontal: 13,
  },
  removeButtonText: { color: Palette.alert, fontFamily: Fonts.sansSemiBold, fontSize: 13 },
  devicesSection: { marginTop: 28 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomColor: Palette.ink,
    borderBottomWidth: 2,
    paddingBottom: 9,
  },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 19 },
  deviceCount: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  deviceCard: {
    backgroundColor: Palette.surface,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    padding: 15,
  },
  devicePlatform: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 14 },
  deviceMeta: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, marginTop: 4 },
  noDevices: {
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 14,
    backgroundColor: Palette.surface,
    padding: 15,
  },
  attendanceTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 19,
    borderBottomColor: Palette.ink,
    borderBottomWidth: 2,
    marginTop: 28,
    paddingBottom: 9,
  },
  sessionCard: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    padding: 17,
  },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  times: { flexDirection: 'row', gap: 18, marginTop: 18 },
  timeItem: { flex: 1 },
  timeLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  timeValue: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 18, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 20 },
  emptyCopy: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 15, marginTop: 6, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryButton: {
    ...ledgerControls.primary,
    marginTop: 16,
  },
  retryText: { color: Palette.ink, fontFamily: Fonts.sansBold },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 32, 41, 0.58)',
    padding: 24,
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Palette.surface,
    borderTopColor: Palette.alert,
    borderTopWidth: 4,
    padding: 24,
  },
  confirmTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 22 },
  confirmCopy: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, marginTop: 10 },
  removeError: { color: Palette.alert, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20, marginTop: 14 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  cancelButton: { ...ledgerControls.secondary, minHeight: 44, paddingHorizontal: 16 },
  cancelButtonText: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 14 },
  confirmRemoveButton: {
    minHeight: 44,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.alert,
    paddingHorizontal: 16,
  },
  confirmRemoveText: { color: Palette.surface, fontFamily: Fonts.sansBold, fontSize: 14 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.65 },
});
