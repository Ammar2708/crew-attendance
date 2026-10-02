import { Redirect, type Href, useLocalSearchParams } from 'expo-router';

import { EmployeeAttendanceDetailScreen } from '@/components/employee-attendance-detail-screen';
import { ScreenLoading } from '@/components/screen-loading';
import { useAuth } from '@/hooks/use-auth';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';

const DASHBOARD_ROUTE = '/dashboard' as Href;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function OwnerRoute({ employeeId, userId }: { employeeId: string; userId: string }) {
  const { profile, isLoading } = useEmployeeProfile(userId);

  if (isLoading) return <ScreenLoading />;
  if (profile?.role !== 'owner') return <Redirect href="/" />;

  return <EmployeeAttendanceDetailScreen employeeId={employeeId} />;
}

export default function EmployeeAttendanceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();

  if (isLoading) return <ScreenLoading />;
  if (!session) return <Redirect href="/" />;
  if (!id || !UUID_PATTERN.test(id)) return <Redirect href={DASHBOARD_ROUTE} />;

  return <OwnerRoute employeeId={id} userId={session.user.id} />;
}
