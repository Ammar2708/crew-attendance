import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import {
  addDaysToDateKey,
  BUSINESS_TIMEZONE,
  businessDateTimeToDate,
  calculateWorkHours,
  formatBusinessDateKey,
  getBusinessDateKey,
  getDateKeyDayOfWeek,
  isLateArrival,
  LATE_GRACE_MINUTES,
  WORK_END_HOUR,
  WORK_START_HOUR,
} from '@/lib/work-hours';
import type {
  AttendanceReport,
  ReportAttendance,
  ReportCompletedTask,
  ReportDay,
  ReportTask,
  ReportTaskPhoto,
  ReportView,
} from '@/types/reports';
import type { EmployeeProfile } from '@/types/tasks';

export { BUSINESS_TIMEZONE, LATE_GRACE_MINUTES, WORK_END_HOUR, WORK_START_HOUR };
const PHOTO_URL_EXPIRY_SECONDS = 60 * 60;

type ReportRange = {
  startDate: string;
  endDate: string;
  taskStart: string;
  taskEnd: string;
  label: string;
  key: string;
};

function getReportRange(view: ReportView): ReportRange {
  const endDate = getBusinessDateKey(new Date());
  const startDate =
    view === 'weekly' ? addDaysToDateKey(endDate, -6) : `${endDate.slice(0, 8)}01`;
  const taskStart = businessDateTimeToDate(startDate, 0);
  const taskEnd = businessDateTimeToDate(addDaysToDateKey(endDate, 1), 0);

  return {
    startDate,
    endDate,
    taskStart: taskStart.toISOString(),
    taskEnd: taskEnd.toISOString(),
    label:
      view === 'weekly'
        ? `${formatBusinessDateKey(startDate, { month: 'short', day: 'numeric' })} – ${formatBusinessDateKey(endDate, { month: 'short', day: 'numeric', year: 'numeric' })}`
        : formatBusinessDateKey(endDate, { month: 'long', year: 'numeric' }),
    key: `${view}:${startDate}:${endDate}`,
  };
}

async function fetchReportData(employeeId: string, range: ReportRange) {
  const [employeeResult, attendanceResult, tasksResult, photosResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, is_active')
      .eq('id', employeeId)
      .maybeSingle<EmployeeProfile>(),
    supabase
      .from('attendance')
      .select(`
        id,
        employee_id,
        clock_in_time,
        clock_in_lat,
        clock_in_lng,
        clock_out_time,
        clock_out_lat,
        clock_out_lng,
        date
      `)
      .eq('employee_id', employeeId)
      .gte('date', range.startDate)
      .lte('date', range.endDate)
      .order('clock_in_time', { ascending: true })
      .returns<ReportAttendance[]>(),
    supabase
      .from('tasks')
      .select('id, title, site_address, assigned_to, status, created_at')
      .eq('assigned_to', employeeId)
      .gte('created_at', range.taskStart)
      .lt('created_at', range.taskEnd)
      .order('created_at', { ascending: false })
      .returns<ReportTask[]>(),
    supabase
      .from('task_photos')
      .select(`
        id,
        task_id,
        photo_url,
        source,
        captured_at,
        uploaded_at,
        task:tasks!inner(id, title, site_address, assigned_to, status, created_at)
      `)
      .eq('task.assigned_to', employeeId)
      .eq('task.status', 'completed')
      .gte('task.created_at', range.taskStart)
      .lt('task.created_at', range.taskEnd)
      .order('captured_at', { ascending: false })
      .returns<ReportTaskPhoto[]>(),
  ]);

  const photoPaths = [...new Set((photosResult.data ?? []).map((photo) => photo.photo_url))];
  const signedPhotosResult =
    photoPaths.length > 0
      ? await supabase.storage
          .from('task-photos')
          .createSignedUrls(photoPaths, PHOTO_URL_EXPIRY_SECONDS)
      : { data: [], error: null };

  return { employeeResult, attendanceResult, tasksResult, photosResult, signedPhotosResult };
}

function buildReport(
  employee: EmployeeProfile,
  attendance: ReportAttendance[],
  tasks: ReportTask[],
  photos: ReportTaskPhoto[],
  signedPhotoUrls: Map<string, string>,
  range: ReportRange,
): AttendanceReport {
  const attendanceByDate = new Map<string, ReportAttendance[]>();

  for (const record of attendance) {
    const records = attendanceByDate.get(record.date) ?? [];
    records.push(record);
    attendanceByDate.set(record.date, records);
  }

  const days: ReportDay[] = [];
  let date = range.startDate;

  while (date <= range.endDate) {
    const records = attendanceByDate.get(date) ?? [];
    const firstRecord = records[0] ?? null;
    const lastRecord = records[records.length - 1] ?? null;
    const dayOfWeek = getDateKeyDayOfWeek(date);
    const hours = calculateWorkHours(records);

    days.push({
      date,
      clockInTime: firstRecord?.clock_in_time ?? null,
      clockInLocation:
        firstRecord?.clock_in_lat != null && firstRecord.clock_in_lng != null
          ? { latitude: firstRecord.clock_in_lat, longitude: firstRecord.clock_in_lng }
          : null,
      clockOutTime: lastRecord?.clock_out_time ?? null,
      clockOutLocation:
        lastRecord?.clock_out_lat != null && lastRecord.clock_out_lng != null
          ? { latitude: lastRecord.clock_out_lat, longitude: lastRecord.clock_out_lng }
          : null,
      ...hours,
      isPresent: records.length > 0,
      isLate: firstRecord ? isLateArrival(firstRecord.clock_in_time) : false,
      isWeekday: dayOfWeek >= 1 && dayOfWeek <= 5,
    });

    date = addDaysToDateKey(date, 1);
  }

  const totalCompleted = tasks.filter((task) => task.status === 'completed').length;
  const photosByTask = new Map<string, ReportTaskPhoto[]>();

  for (const photo of photos) {
    const taskPhotos = photosByTask.get(photo.task_id) ?? [];
    taskPhotos.push(photo);
    photosByTask.set(photo.task_id, taskPhotos);
  }

  const completedTasks: ReportCompletedTask[] = tasks
    .filter((task) => task.status === 'completed')
    .map((task) => {
      const taskPhotos = photosByTask.get(task.id) ?? [];
      const firstPhoto = taskPhotos[0];
      return {
        id: task.id,
        title: firstPhoto?.task.title ?? task.title,
        siteAddress: firstPhoto?.task.site_address ?? task.site_address,
        photos: taskPhotos.map((photo) => ({
          id: photo.id,
          url: signedPhotoUrls.get(photo.photo_url) ?? null,
          source: photo.source,
          capturedAt: photo.captured_at,
        })),
      };
    });

  return {
    employee,
    periodLabel: range.label,
    daysPresent: days.filter((day) => day.isPresent).length,
    totalHours: days.reduce((total, day) => total + day.totalHours, 0),
    regularHours: days.reduce((total, day) => total + day.regularHours, 0),
    overtimeHours: days.reduce((total, day) => total + day.overtimeHours, 0),
    lateArrivalCount: days.filter((day) => day.isLate).length,
    absenceCount: days.filter((day) => day.isWeekday && !day.isPresent).length,
    totalAssigned: tasks.length,
    totalCompleted,
    completionRate: tasks.length === 0 ? 0 : (totalCompleted / tasks.length) * 100,
    completedTasks,
    days,
  };
}

export function useAttendanceReport(employeeId: string, view: ReportView) {
  const range = useMemo(() => getReportRange(view), [view]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyResults = useCallback(
    ({
      employeeResult,
      attendanceResult,
      tasksResult,
      photosResult,
      signedPhotosResult,
    }: Awaited<ReturnType<typeof fetchReportData>>) => {
      const error =
        employeeResult.error?.message ??
        attendanceResult.error?.message ??
        tasksResult.error?.message ??
        photosResult.error?.message ??
        signedPhotosResult.error?.message ??
        (employeeResult.data ? null : 'Employee not found.');

      const signedPhotoUrls = new Map<string, string>();
      for (const signedPhoto of signedPhotosResult.data ?? []) {
        if (signedPhoto.path && signedPhoto.signedUrl) {
          signedPhotoUrls.set(signedPhoto.path, signedPhoto.signedUrl);
        }
      }

      setErrorMessage(error);
      setReport(
        employeeResult.data && !error
          ? buildReport(
              employeeResult.data,
              attendanceResult.data ?? [],
              tasksResult.data ?? [],
              photosResult.data ?? [],
              signedPhotoUrls,
              range,
            )
          : null,
      );
      setLoadedRangeKey(range.key);
      setIsReloading(false);
    },
    [range],
  );

  const reload = useCallback(async () => {
    setIsReloading(true);
    setErrorMessage(null);
    applyResults(await fetchReportData(employeeId, range));
  }, [applyResults, employeeId, range]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      void fetchReportData(employeeId, range).then((results) => {
        if (!isCancelled) applyResults(results);
      });

      return () => {
        isCancelled = true;
      };
    }, [applyResults, employeeId, range]),
  );

  return {
    report,
    isLoading: isReloading || loadedRangeKey !== range.key,
    errorMessage,
    reload,
  };
}
