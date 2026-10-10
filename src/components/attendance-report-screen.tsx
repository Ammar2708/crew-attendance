import { Image } from 'expo-image';
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

import { LocationLink } from '@/components/location-link';
import {
  FolderToggle,
  LedgerPressable,
  StatusStamp,
  ledgerControls,
} from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette, Radius } from '@/constants/theme';
import { useAttendanceReport } from '@/hooks/use-attendance-report';
import {
  BUSINESS_TIMEZONE,
  formatBusinessDateKey,
  LATE_GRACE_MINUTES,
  WORK_START_HOUR,
} from '@/lib/work-hours';
import type {
  AttendanceReport,
  ReportCompletedTask,
  ReportCompletedTaskPhoto,
  ReportDay,
  ReportView,
} from '@/types/reports';

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
}

function formatPhotoTime(value: string, includeDate: boolean) {
  return new Date(value).toLocaleString([], {
    ...(includeDate ? { month: 'short' as const, day: 'numeric' as const } : {}),
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
}

function ViewToggle({ value, onChange }: { value: ReportView; onChange: (view: ReportView) => void }) {
  return (
    <FolderToggle
      onChange={onChange}
      options={[
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]}
      value={value}
    />
  );
}

function Summary({ report }: { report: AttendanceReport }) {
  const attendanceMetrics = [
    { label: 'Days present', value: String(report.daysPresent) },
    { label: 'Total hours', value: report.totalHours.toFixed(1) },
    { label: 'Regular hours', value: report.regularHours.toFixed(1) },
    { label: 'Overtime hours', value: report.overtimeHours.toFixed(1) },
    { label: 'Late arrivals', value: String(report.lateArrivalCount) },
    { label: 'Absences', value: String(report.absenceCount) },
  ];
  const taskMetrics = [
    { label: 'Assigned', value: String(report.totalAssigned) },
    { label: 'Completed', value: String(report.totalCompleted) },
    { label: 'Completion rate', value: `${Math.round(report.completionRate)}%` },
  ];

  return (
    <>
      <Text style={styles.sectionTitle}>Attendance summary</Text>
      <View style={styles.summaryGrid}>
        {attendanceMetrics.map((metric) => (
          <View key={metric.label} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{metric.value}</Text>
            <Text style={styles.summaryLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Tasks</Text>
      <View style={styles.summaryGrid}>
        {taskMetrics.map((metric) => (
          <View key={metric.label} style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{metric.value}</Text>
            <Text style={styles.summaryLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

    </>
  );
}

function CompletedTasksSection({
  tasks,
  view,
  onOpenPhoto,
}: {
  tasks: ReportCompletedTask[];
  view: ReportView;
  onOpenPhoto: (task: ReportCompletedTask, photo: ReportCompletedTaskPhoto) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Completed tasks</Text>
      {tasks.length === 0 ? (
        <Text style={styles.noCompletedTasks}>No tasks were completed in this period.</Text>
      ) : (
        <View style={styles.completedTaskList}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.completedTaskCard}>
              <View>
                <Text style={styles.completedTaskTitle}>{task.title}</Text>
                <Text style={styles.completedTaskAddress}>{task.siteAddress}</Text>
              </View>
              {task.photos.length > 0 ? (
                <View style={styles.taskPhotoGrid}>
                  {task.photos.map((photo, index) => (
                    <View key={photo.id} style={styles.thumbnailColumn}>
                      {photo.url ? (
                        <LedgerPressable
                          accessibilityHint={`Opens completion photo ${index + 1} for ${task.title}`}
                          accessibilityRole="button"
                          onPress={() => onOpenPhoto(task, photo)}
                          style={styles.thumbnailButton}>
                          <Image
                            accessibilityLabel={`Completion photo ${index + 1} for ${task.title}`}
                            contentFit="cover"
                            source={{ uri: photo.url }}
                            style={styles.thumbnail}
                            transition={150}
                          />
                        </LedgerPressable>
                      ) : (
                        <View style={styles.photoUnavailable}>
                          <Text style={styles.photoUnavailableText}>Photo unavailable</Text>
                        </View>
                      )}
                      <Text style={styles.photoTimeLabel}>
                        {formatPhotoTime(photo.capturedAt, view === 'monthly')}
                      </Text>
                      {photo.source === 'gallery' ? (
                        <Text style={styles.photoSourceLabel}>Gallery</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noTaskPhotos}>No completion photos</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type ActivePhoto = {
  taskTitle: string;
  photo: ReportCompletedTaskPhoto;
};

function PhotoLightbox({
  activePhoto,
  onClose,
}: {
  activePhoto: ActivePhoto | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={Boolean(activePhoto?.photo.url)}>
      <View style={styles.lightboxBackdrop}>
        <SafeAreaView style={styles.lightboxSafeArea}>
          <View style={styles.lightboxHeader}>
            <Text numberOfLines={1} style={styles.lightboxTitle}>
              {activePhoto?.taskTitle}
            </Text>
            <Pressable
              accessibilityLabel="Close photo"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          {activePhoto?.photo.url ? (
            <>
              <Image
                accessibilityLabel={`Completion photo for ${activePhoto.taskTitle}`}
                contentFit="contain"
                source={{ uri: activePhoto.photo.url }}
                style={styles.lightboxImage}
                transition={150}
              />
              <Text style={styles.lightboxPhotoTime}>
                {formatPhotoTime(activePhoto.photo.capturedAt, true)}
              </Text>
            </>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function getDayStatus(day: ReportDay) {
  if (day.isPresent) return day.isLate ? 'Late' : 'On time';
  return day.isWeekday ? 'Absent' : 'Weekend';
}

function DayRow({ day }: { day: ReportDay }) {
  const status = getDayStatus(day);
  const isNegative = status === 'Late' || status === 'Absent';
  const isPositive = status === 'On time';

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.dayName}>
            {formatBusinessDateKey(day.date, { weekday: 'long' })}
          </Text>
          <Text style={styles.dayDate}>
            {formatBusinessDateKey(day.date, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <StatusStamp tone={isNegative ? 'negative' : isPositive ? 'positive' : 'neutral'}>
          {status}
        </StatusStamp>
      </View>

      <View style={styles.dayDetails}>
        <View style={styles.dayDetail}>
          <Text style={styles.detailLabel}>Clock in</Text>
          <View style={styles.timeAndLocation}>
            <Text style={styles.timeValue}>{formatTime(day.clockInTime)}</Text>
            <LocationLink
              latitude={day.clockInLocation?.latitude}
              longitude={day.clockInLocation?.longitude}
            />
          </View>
        </View>
        <View style={styles.dayDetail}>
          <Text style={styles.detailLabel}>Clock out</Text>
          <View style={styles.timeAndLocation}>
            <Text style={styles.timeValue}>{formatTime(day.clockOutTime)}</Text>
            <LocationLink
              latitude={day.clockOutLocation?.latitude}
              longitude={day.clockOutLocation?.longitude}
            />
          </View>
        </View>
        <View style={styles.dayDetail}>
          <Text style={styles.detailLabel}>Total hours</Text>
          <Text style={styles.detailValue}>{day.totalHours.toFixed(1)}</Text>
        </View>
        <View style={styles.dayDetail}>
          <Text style={styles.detailLabel}>Regular hours</Text>
          <Text style={styles.detailValue}>{day.regularHours.toFixed(1)}</Text>
        </View>
        <View style={styles.dayDetail}>
          <Text style={styles.detailLabel}>Overtime hours</Text>
          <Text style={styles.detailValue}>{day.overtimeHours.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
}

export function AttendanceReportScreen({ employeeId }: { employeeId: string }) {
  const [view, setView] = useState<ReportView>('weekly');
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);
  const { report, isLoading, errorMessage, reload } = useAttendanceReport(employeeId, view);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.safety} size="large" />
        </View>
      ) : errorMessage || !report ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage ?? 'Unable to load this report.'}
          </Text>
          <Pressable onPress={() => void reload()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={report.days}
          keyExtractor={(day) => day.date}
          ListHeaderComponent={
            <View>
              <Text style={styles.employeeName}>{report.employee.full_name}</Text>
              <Text style={styles.period}>{report.periodLabel}</Text>
              <Text style={styles.reportNote}>
                Late means after {WORK_START_HOUR}:00 AM
                {LATE_GRACE_MINUTES > 0 ? ` plus ${LATE_GRACE_MINUTES} minutes` : ''}. Monthly
                reports are month to date. Times use {BUSINESS_TIMEZONE}.
              </Text>
              <ViewToggle onChange={setView} value={view} />
              <Summary report={report} />
              <CompletedTasksSection
                onOpenPhoto={(task, photo) => setActivePhoto({ taskTitle: task.title, photo })}
                tasks={report.completedTasks}
                view={view}
              />
              <Text style={styles.breakdownTitle}>Day-by-day</Text>
            </View>
          }
          renderItem={({ item }) => <DayRow day={item} />}
        />
      )}
      <PhotoLightbox activePhoto={activePhoto} onClose={() => setActivePhoto(null)} />
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
    maxWidth: Layout.content,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 0,
  },
  employeeName: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 27 },
  period: { color: Palette.ink, fontFamily: Fonts.mono, fontSize: 13, marginTop: 5 },
  reportNote: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 8 },
  sectionTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 19, marginTop: 28, marginBottom: 10 },
  breakdownTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 19, marginTop: 30, marginBottom: 2, borderBottomColor: Palette.ink, borderBottomWidth: 2, paddingBottom: 9 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopColor: Palette.line, borderTopWidth: 1 },
  summaryCard: {
    minWidth: 136,
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    padding: 15,
  },
  summaryValue: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 24 },
  summaryLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12, marginTop: 4 },
  noCompletedTasks: {
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.line,
    padding: 16,
  },
  completedTaskList: { borderTopColor: Palette.line, borderTopWidth: 1 },
  completedTaskCard: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    padding: 12,
  },
  taskPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  thumbnailButton: { borderRadius: Radius.control, overflow: 'hidden' },
  thumbnailColumn: { alignItems: 'center', gap: 5 },
  thumbnail: { width: 84, height: 84, backgroundColor: Palette.line },
  photoTimeLabel: { color: Palette.ink, fontFamily: Fonts.mono, fontSize: 10 },
  photoSourceLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 10 },
  photoUnavailable: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
    backgroundColor: Palette.paper,
    padding: 8,
  },
  photoUnavailableText: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  noTaskPhotos: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 12, marginTop: 10 },
  completedTaskTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  completedTaskAddress: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, marginTop: 5 },
  dayCard: {
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    padding: 16,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dayName: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  dayDate: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 12, marginTop: 3 },
  dayDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  dayDetail: { minWidth: 110, flexGrow: 1, flexBasis: '17%' },
  detailLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 11 },
  detailValue: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 14, marginTop: 4 },
  timeAndLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  timeValue: { color: Palette.ink, fontFamily: Fonts.monoSemiBold, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryButton: {
    ...ledgerControls.primary,
    marginTop: 16,
  },
  retryText: { color: Palette.ink, fontFamily: Fonts.sansBold },
  lightboxBackdrop: { flex: 1, backgroundColor: `${Palette.ink}F5` },
  lightboxSafeArea: { flex: 1 },
  lightboxHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  lightboxTitle: { flex: 1, color: Palette.surface, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  closeButton: { ...ledgerControls.secondary, minHeight: 38, paddingHorizontal: 14 },
  closeButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 14 },
  lightboxImage: { flex: 1, margin: 20 },
  lightboxPhotoTime: {
    color: Palette.surface,
    fontFamily: Fonts.mono,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 20,
  },
  pressed: { opacity: 0.65 },
});
