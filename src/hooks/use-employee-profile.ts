import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { EmployeeProfile } from '@/types/tasks';

function fetchEmployeeProfile(userId: string) {
  return supabase
    .from('employees')
    .select('id, full_name, role, is_active')
    .eq('id', userId)
    .maybeSingle<EmployeeProfile>();
}

export function useEmployeeProfile(userId: string) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await fetchEmployeeProfile(userId);
    setProfile(data);
    setErrorMessage(error?.message ?? (data ? null : 'Employee profile not found.'));
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    let isCancelled = false;

    void fetchEmployeeProfile(userId).then(({ data, error }) => {
      if (isCancelled) return;
      setProfile(data);
      setErrorMessage(error?.message ?? (data ? null : 'Employee profile not found.'));
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return { profile, isLoading, errorMessage, reload };
}
