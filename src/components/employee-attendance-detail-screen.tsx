import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusStamp, ledgerControls } from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useEmployeeTodayAttendance } from '@/hooks/use-owner-dashboard';
import type { DashboardAttendance } from '@/types/dashboard';

function formatTime(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
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
  const { employee, attendance, isLoading, errorMessage, reload } =
    useEmployeeTodayAttendance(employeeId);

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
            <View style={styles.employeeSummary}>
              <Text style={styles.employeeName}>{employee?.full_name}</Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.sectionTitle}>Today&apos;s attendance</Text>
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
  employeeSummary: { borderBottomColor: Palette.ink, borderBottomWidth: 2, marginBottom: 2, paddingBottom: 12 },
  employeeName: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 26 },
  date: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 13, marginTop: 5 },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 19, marginTop: 28 },
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
  pressed: { opacity: 0.65 },
});
