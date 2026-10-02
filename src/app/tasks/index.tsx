import { Redirect } from 'expo-router';

import { EmployeeTasksScreen } from '@/components/employee-tasks-screen';
import { ScreenLoading } from '@/components/screen-loading';
import { useAuth } from '@/hooks/use-auth';

export default function TasksRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <ScreenLoading />;
  if (!session) return <Redirect href="/" />;

  return <EmployeeTasksScreen userId={session.user.id} />;
}
