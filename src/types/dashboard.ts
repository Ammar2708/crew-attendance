import type { AttendanceCoordinates } from '@/types/attendance';
import type { EmployeeProfile } from '@/types/tasks';

export type DashboardAttendance = {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_time: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  date: string;
  employee: EmployeeProfile;
};

export type DashboardTask = {
  id: string;
  assigned_to: string;
  status: string;
  created_at: string;
};

export type EmployeeDashboardRow = {
  employee: EmployeeProfile;
  attendance: DashboardAttendance[];
  clockInTime: string | null;
  clockInLocation: AttendanceCoordinates | null;
  clockOutTime: string | null;
  clockOutLocation: AttendanceCoordinates | null;
  isPresent: boolean;
  isClockedIn: boolean;
  assignedTaskCount: number;
  completedTaskCount: number;
};

export type OwnerDashboardSummary = {
  totalEmployees: number;
  clockedInCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
};

export type RegisteredDevice = {
  id: string;
  platform: 'android' | 'ios';
  created_at: string;
  last_seen_at: string;
};
