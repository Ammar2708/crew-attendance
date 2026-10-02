import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { EmployeeProfile, Task } from '@/types/tasks';

const TASK_FIELDS =
  'id, title, site_address, assigned_to, assigned_by, status, due_date, created_at';

function fetchEmployeeTasks(userId: string) {
  return supabase
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('assigned_to', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<Task[]>();
}

export function useEmployeeTasks(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await fetchEmployeeTasks(userId);
    setTasks(data ?? []);
    setErrorMessage(error?.message ?? null);
    setIsLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      void fetchEmployeeTasks(userId).then(({ data, error }) => {
        if (isCancelled) return;
        setTasks(data ?? []);
        setErrorMessage(error?.message ?? null);
        setIsLoading(false);
      });

      return () => {
        isCancelled = true;
      };
    }, [userId]),
  );

  return { tasks, isLoading, errorMessage, reload };
}

function fetchTask(taskId: string, userId: string) {
  return supabase
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('id', taskId)
    .eq('assigned_to', userId)
    .maybeSingle<Task>();
}

export function useTask(taskId: string, userId: string) {
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void fetchTask(taskId, userId).then(({ data, error }) => {
      if (isCancelled) return;
      setTask(data);
      setErrorMessage(error?.message ?? (data ? null : 'Task not found.'));
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [taskId, userId]);

  const markCompleted = useCallback(() => {
    setTask((current) => (current ? { ...current, status: 'completed' } : current));
  }, []);

  return { task, isLoading, errorMessage, markCompleted };
}

function fetchOwnerData() {
  return Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, role, is_active')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name')
      .returns<EmployeeProfile[]>(),
    supabase.from('tasks').select(TASK_FIELDS).order('created_at', { ascending: false }).returns<Task[]>(),
  ]);
}

export function useOwnerTasks() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyResults = useCallback(
    ([employeesResult, tasksResult]: Awaited<ReturnType<typeof fetchOwnerData>>) => {
      setEmployees(employeesResult.data ?? []);
      setTasks(tasksResult.data ?? []);
      setErrorMessage(employeesResult.error?.message ?? tasksResult.error?.message ?? null);
      setIsLoading(false);
    },
    [],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    applyResults(await fetchOwnerData());
  }, [applyResults]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      void fetchOwnerData().then((results) => {
        if (!isCancelled) applyResults(results);
      });

      return () => {
        isCancelled = true;
      };
    }, [applyResults]),
  );

  return { employees, tasks, isLoading, errorMessage, reload };
}
