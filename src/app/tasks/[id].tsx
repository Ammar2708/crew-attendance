import { Redirect, type Href, useLocalSearchParams } from 'expo-router';

import { ScreenLoading } from '@/components/screen-loading';
import { TaskDetailScreen } from '@/components/task-detail-screen';
import { useAuth } from '@/hooks/use-auth';

const TASKS_ROUTE = '/tasks' as Href;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function TaskDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();

  if (isLoading) return <ScreenLoading />;
  if (!session) return <Redirect href="/" />;
  if (!id || !UUID_PATTERN.test(id)) return <Redirect href={TASKS_ROUTE} />;

  return <TaskDetailScreen taskId={id} userId={session.user.id} />;
}
