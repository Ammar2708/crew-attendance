import type { AttendanceCoordinates } from '@/types/attendance';
import type { EmployeeProfile } from '@/types/tasks';

export type ReportView = 'weekly' | 'monthly';

export type ReportAttendance = {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_time: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  date: string;
};

export type ReportTask = {
  id: string;
  title: string;
  site_address: string;
  assigned_to: string;
  status: string;
  created_at: string;
};

export type ReportTaskPhoto = {
  id: string;
  task_id: string;
  photo_url: string;
  source: 'camera' | 'gallery';
  captured_at: string;
  uploaded_at: string;
  task: ReportTask;
};

export type ReportCompletedTask = {
  id: string;
  title: string;
  siteAddress: string;
  photos: ReportCompletedTaskPhoto[];
};

export type ReportCompletedTaskPhoto = {
  id: string;
  url: string | null;
  source: 'camera' | 'gallery';
  capturedAt: string;
};

export type ReportDay = {
  date: string;
  clockInTime: string | null;
  clockInLocation: AttendanceCoordinates | null;
  clockOutTime: string | null;
  clockOutLocation: AttendanceCoordinates | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  isPresent: boolean;
  isLate: boolean;
  isWeekday: boolean;
};

export type AttendanceReport = {
  employee: EmployeeProfile;
  periodLabel: string;
  daysPresent: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  lateArrivalCount: number;
  absenceCount: number;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  completedTasks: ReportCompletedTask[];
  days: ReportDay[];
};
