import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
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

// Change this constant if the expected start time changes.
export const LATE_ARRIVAL_HOUR = 9;
const PHOTO_URL_EXPIRY_SECONDS = 60 * 60;

type ReportRange = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  taskStart: string;
  taskEnd: string;
  label: string;
  key: string;
};

function toLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReportRange(view: ReportView): ReportRange {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  if (view === 'weekly') {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(1);
  }

  const taskEnd = new Date(end);
  taskEnd.setDate(taskEnd.getDate() + 1);

  const startDate = toLocalDate(start);
  const endDate = toLocalDate(end);

  return {
    start,
    end,
    startDate,
    endDate,
    taskStart: start.toISOString(),
    taskEnd: taskEnd.toISOString(),
    label:
      view === 'weekly'
        ? `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
        : end.toLocaleDateString([], { month: 'long', year: 'numeric' }),
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
        uploaded_at,
        task:tasks!inner(id, title, site_address, assigned_to, status, created_at)
      `)
      .eq('task.assigned_to', employeeId)
      .eq('task.status', 'completed')
      .gte('task.created_at', range.taskStart)
      .lt('task.created_at', range.taskEnd)
      .order('uploaded_at', { ascending: false })
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

function isLateArrival(clockInTime: string) {
  const clockIn = new Date(clockInTime);
  const lateThreshold = new Date(clockIn);
  lateThreshold.setHours(LATE_ARRIVAL_HOUR, 0, 0, 0);
  return clockIn.getTime() > lateThreshold.getTime();
}

function getHoursWorked(records: ReportAttendance[]) {
  return records.reduce((total, record) => {
    if (!record.clock_out_time) return total;
    const duration = new Date(record.clock_out_time).getTime() - new Date(record.clock_in_time).getTime();
    return duration > 0 ? total + duration / 3_600_000 : total;
  }, 0);
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
  const cursor = new Date(range.start);

  while (cursor <= range.end) {
    const date = toLocalDate(cursor);
    const records = attendanceByDate.get(date) ?? [];
    const firstRecord = records[0] ?? null;
    const lastRecord = records[records.length - 1] ?? null;
    const dayOfWeek = cursor.getDay();

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
      hoursWorked: getHoursWorked(records),
      isPresent: records.length > 0,
      isLate: firstRecord ? isLateArrival(firstRecord.clock_in_time) : false,
      isWeekday: dayOfWeek >= 1 && dayOfWeek <= 5,
    });

    cursor.setDate(cursor.getDate() + 1);
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
        })),
      };
    });

  return {
    employee,
    periodLabel: range.label,
    daysPresent: days.filter((day) => day.isPresent).length,
    totalHoursWorked: days.reduce((total, day) => total + day.hoursWorked, 0),
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
