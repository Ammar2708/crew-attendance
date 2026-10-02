import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type {
  DashboardAttendance,
  DashboardTask,
  EmployeeDashboardRow,
  OwnerDashboardSummary,
  RegisteredDevice,
} from '@/types/dashboard';
import type { EmployeeProfile } from '@/types/tasks';

const ATTENDANCE_FIELDS = `
  id,
  employee_id,
  clock_in_time,
  clock_in_lat,
  clock_in_lng,
  clock_out_time,
  clock_out_lat,
  clock_out_lng,
  date,
  employee:employees!attendance_employee_id_fkey(id, full_name, role, is_active)
`;

function getLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    date: getLocalDate(start),
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function fetchOwnerDashboardData() {
  const today = getTodayRange();

  return Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, is_active')
      .eq('role', 'employee')
      .order('full_name')
      .returns<EmployeeProfile[]>(),
    supabase
      .from('attendance')
      .select(ATTENDANCE_FIELDS)
      .eq('date', today.date)
      .order('clock_in_time', { ascending: true })
      .returns<DashboardAttendance[]>(),
    supabase
      .from('tasks')
      .select('id, assigned_to, status, created_at')
      .gte('created_at', today.start)
      .lt('created_at', today.end)
      .returns<DashboardTask[]>(),
  ]);
}

export function useOwnerDashboard() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendance, setAttendance] = useState<DashboardAttendance[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyResults = useCallback(
    ([employeesResult, attendanceResult, tasksResult]: Awaited<
      ReturnType<typeof fetchOwnerDashboardData>
    >) => {
      setEmployees(employeesResult.data ?? []);
      setAttendance(attendanceResult.data ?? []);
      setTasks(tasksResult.data ?? []);
      setErrorMessage(
        employeesResult.error?.message ??
          attendanceResult.error?.message ??
          tasksResult.error?.message ??
          null,
      );
      setIsLoading(false);
    },
    [],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    applyResults(await fetchOwnerDashboardData());
  }, [applyResults]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      void fetchOwnerDashboardData().then((results) => {
        if (!isCancelled) applyResults(results);
      });

      return () => {
        isCancelled = true;
      };
    }, [applyResults]),
  );

  const rows = useMemo<EmployeeDashboardRow[]>(() => {
    const attendanceByEmployee = new Map<string, DashboardAttendance[]>();
    const tasksByEmployee = new Map<string, DashboardTask[]>();

    for (const record of attendance) {
      const records = attendanceByEmployee.get(record.employee_id) ?? [];
      records.push(record);
      attendanceByEmployee.set(record.employee_id, records);
    }

    for (const task of tasks) {
      const employeeTasks = tasksByEmployee.get(task.assigned_to) ?? [];
      employeeTasks.push(task);
      tasksByEmployee.set(task.assigned_to, employeeTasks);
    }

    return employees.map((employee) => {
      const employeeAttendance = attendanceByEmployee.get(employee.id) ?? [];
      const employeeTasks = tasksByEmployee.get(employee.id) ?? [];
      const firstAttendance = employeeAttendance[0] ?? null;
      const latestAttendance = employeeAttendance[employeeAttendance.length - 1] ?? null;

      return {
        employee,
        attendance: employeeAttendance,
        clockInTime: firstAttendance?.clock_in_time ?? null,
        clockInLocation:
          firstAttendance?.clock_in_lat != null && firstAttendance.clock_in_lng != null
            ? {
                latitude: firstAttendance.clock_in_lat,
                longitude: firstAttendance.clock_in_lng,
              }
            : null,
        clockOutTime: latestAttendance?.clock_out_time ?? null,
        clockOutLocation:
          latestAttendance?.clock_out_lat != null && latestAttendance.clock_out_lng != null
            ? {
                latitude: latestAttendance.clock_out_lat,
                longitude: latestAttendance.clock_out_lng,
              }
            : null,
        isPresent: employeeAttendance.length > 0,
        isClockedIn: employeeAttendance.some((record) => record.clock_out_time === null),
        assignedTaskCount: employeeTasks.length,
        completedTaskCount: employeeTasks.filter((task) => task.status === 'completed').length,
      };
    });
  }, [attendance, employees, tasks]);

  const summary = useMemo<OwnerDashboardSummary>(() => {
    const activeEmployeeIds = new Set(
      employees.filter((employee) => employee.is_active).map((employee) => employee.id),
    );
    const activeTasks = tasks.filter((task) => activeEmployeeIds.has(task.assigned_to));

    return {
      totalEmployees: activeEmployeeIds.size,
      clockedInCount: rows.filter((row) => row.employee.is_active && row.isClockedIn).length,
      pendingTaskCount: activeTasks.filter((task) => task.status === 'pending').length,
      completedTaskCount: activeTasks.filter((task) => task.status === 'completed').length,
    };
  }, [employees, rows, tasks]);

  return { rows, summary, isLoading, errorMessage, reload };
}

function fetchEmployeeToday(employeeId: string) {
  const { date } = getTodayRange();

  return Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, is_active')
      .eq('id', employeeId)
      .maybeSingle<EmployeeProfile>(),
    supabase
      .from('attendance')
      .select(ATTENDANCE_FIELDS)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .order('clock_in_time', { ascending: true })
      .returns<DashboardAttendance[]>(),
    supabase
      .from('push_tokens')
      .select('id, platform, created_at, last_seen_at')
      .eq('user_id', employeeId)
      .order('last_seen_at', { ascending: false })
      .returns<RegisteredDevice[]>(),
  ]);
}

export function useEmployeeTodayAttendance(employeeId: string) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [attendance, setAttendance] = useState<DashboardAttendance[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const [employeeResult, attendanceResult, devicesResult] = await fetchEmployeeToday(employeeId);
    setEmployee(employeeResult.data);
    setAttendance(attendanceResult.data ?? []);
    setDevices(devicesResult.data ?? []);
    setErrorMessage(
      employeeResult.error?.message ??
        attendanceResult.error?.message ??
        devicesResult.error?.message ??
        (employeeResult.data ? null : 'Employee not found.'),
    );
    setIsLoading(false);
  }, [employeeId]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      void fetchEmployeeToday(employeeId).then(
        ([employeeResult, attendanceResult, devicesResult]) => {
          if (isCancelled) return;
          setEmployee(employeeResult.data);
          setAttendance(attendanceResult.data ?? []);
          setDevices(devicesResult.data ?? []);
          setErrorMessage(
            employeeResult.error?.message ??
              attendanceResult.error?.message ??
              devicesResult.error?.message ??
              (employeeResult.data ? null : 'Employee not found.'),
          );
          setIsLoading(false);
        },
      );

      return () => {
        isCancelled = true;
      };
    }, [employeeId]),
  );

  return { employee, attendance, devices, isLoading, errorMessage, reload: load };
}
