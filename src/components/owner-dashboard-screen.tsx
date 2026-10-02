import { router, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationLink } from '@/components/location-link';
import {
  LedgerPressable,
  StatusStamp,
  ledgerControls,
} from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useOwnerDashboard } from '@/hooks/use-owner-dashboard';
import type { EmployeeDashboardRow, OwnerDashboardSummary } from '@/types/dashboard';

function formatTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Summary({ summary }: { summary: OwnerDashboardSummary }) {
  const metrics = [
    { label: 'Employees', value: summary.totalEmployees },
    { label: 'Clocked in', value: summary.clockedInCount },
    { label: 'Tasks pending', value: summary.pendingTaskCount },
    { label: 'Tasks completed', value: summary.completedTaskCount },
  ];

  return (
    <View style={styles.summaryRow}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.summaryCell}>
          <Text style={styles.summaryValue}>{metric.value}</Text>
          <Text style={styles.summaryLabel}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

function EmployeeRow({ row }: { row: EmployeeDashboardRow }) {
  return (
    <LedgerPressable
      accessibilityHint={`Shows today's attendance history for ${row.employee.full_name}`}
      accessibilityRole="button"
      depth={1}
      onPress={() =>
        router.push({ pathname: '/dashboard/[id]', params: { id: row.employee.id } })
      }
      style={styles.employeeRow}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeIdentity}>
          <Text numberOfLines={1} style={styles.employeeName}>
            {row.employee.full_name}
          </Text>
          <Text style={styles.employeeId}>{row.employee.id.slice(0, 8)}</Text>
        </View>
        <StatusStamp tone={row.isPresent ? 'positive' : 'negative'}>
          {row.isPresent ? 'Present' : 'Absent'}
        </StatusStamp>
      </View>

      <View style={styles.rowDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Clock in</Text>
          <View style={styles.timeAndLocation}>
            <Text style={styles.timeValue}>{formatTime(row.clockInTime, 'Not recorded')}</Text>
            <LocationLink
              latitude={row.clockInLocation?.latitude}
              longitude={row.clockInLocation?.longitude}
            />
          </View>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Clock out</Text>
          <View style={styles.timeAndLocation}>
            <Text style={styles.timeValue}>{formatTime(row.clockOutTime, '—')}</Text>
            <LocationLink
              latitude={row.clockOutLocation?.latitude}
              longitude={row.clockOutLocation?.longitude}
            />
          </View>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Tasks today</Text>
          <Text style={styles.detailValue}>
            {row.completedTaskCount} / {row.assignedTaskCount} completed
          </Text>
        </View>
      </View>

      <View style={styles.rowActions}>
        <Text style={styles.detailLink}>Open today&apos;s ledger →</Text>
        <Pressable
          accessibilityHint={`Shows weekly and monthly reports for ${row.employee.full_name}`}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            router.push(`/reports/${row.employee.id}` as Href);
          }}
          style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
          <Text style={styles.reportButtonText}>View report</Text>
        </Pressable>
      </View>
    </LedgerPressable>
  );
}

export function OwnerDashboardScreen() {
  const { rows, summary, isLoading, errorMessage, reload } = useOwnerDashboard();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Dashboard</Text>
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
          contentContainerStyle={[styles.list, rows.length === 0 && styles.emptyList]}
          data={rows}
          keyExtractor={(row) => row.employee.id}
          ListHeaderComponent={
            <View>
              <View style={styles.titleRow}>
                <View>
                  <Text style={styles.pageTitle}>Site ledger</Text>
                  <Text style={styles.date}>
                    {new Date().toLocaleDateString([], {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <Pressable
                  accessibilityHint="Opens the form to create a new employee account"
                  accessibilityRole="button"
                  onPress={() => router.push('/add-employee')}
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                  <Text style={styles.addButtonText}>Add employee</Text>
                </Pressable>
              </View>
              <Summary summary={summary} />
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Employees</Text>
                <Text style={styles.count}>{rows.length} entries</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No employees found.</Text>}
          renderItem={({ item }) => <EmployeeRow row={item} />}
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
  headerTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  headerSpacer: { width: 72 },
  list: {
    width: '100%',
    maxWidth: Layout.wide,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: 52,
    gap: 0,
  },
  emptyList: { flexGrow: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  pageTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 29 },
  date: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 13, marginTop: 5 },
  addButton: { ...ledgerControls.primary, minHeight: 42, paddingHorizontal: 14 },
  addButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 13 },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopColor: Palette.ink,
    borderTopWidth: 2,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    marginTop: 26,
  },
  summaryCell: { minWidth: 145, flexGrow: 1, flexBasis: '24%', padding: 16 },
  summaryValue: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 27 },
  summaryLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12, marginTop: 3 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomColor: Palette.ink,
    borderBottomWidth: 2,
    marginTop: 32,
    paddingBottom: 9,
  },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 20 },
  count: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  employeeRow: {
    backgroundColor: Palette.surface,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    padding: 18,
  },
  employeeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  employeeIdentity: { flex: 1 },
  employeeName: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 17 },
  employeeId: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 10, marginTop: 3 },
  rowDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 17 },
  detailItem: { minWidth: 150, flexGrow: 1 },
  detailLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  detailValue: { color: Palette.ink, fontFamily: Fonts.sansMedium, fontSize: 14, marginTop: 4 },
  timeAndLocation: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  timeValue: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 14 },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: Palette.line,
  },
  detailLink: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 12 },
  reportButton: { ...ledgerControls.secondary, minHeight: 36, paddingHorizontal: 12 },
  reportButtonText: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryButton: { ...ledgerControls.primary, marginTop: 16 },
  retryText: { color: Palette.ink, fontFamily: Fonts.sansBold },
  empty: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 15, textAlign: 'center', padding: 32 },
  pressed: { opacity: 0.55 },
});
