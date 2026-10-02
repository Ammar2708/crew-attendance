import { Redirect, type Href, useLocalSearchParams } from 'expo-router';

import { AttendanceReportScreen } from '@/components/attendance-report-screen';
import { ScreenLoading } from '@/components/screen-loading';
import { useAuth } from '@/hooks/use-auth';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOME_ROUTE = '/' as Href;

function AuthorizedReport({ employeeId, userId }: { employeeId: string; userId: string }) {
  const { profile, isLoading } = useEmployeeProfile(userId);

  if (isLoading) return <ScreenLoading />;
  if (!profile || (profile.role !== 'owner' && employeeId !== userId)) {
    return <Redirect href={HOME_ROUTE} />;
  }

  return <AttendanceReportScreen employeeId={employeeId} />;
}

export default function ReportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();

  if (isLoading) return <ScreenLoading />;
  if (!session) return <Redirect href={HOME_ROUTE} />;
  if (!id || !UUID_PATTERN.test(id)) return <Redirect href={HOME_ROUTE} />;

  return <AuthorizedReport employeeId={id} userId={session.user.id} />;
}
