import { Redirect } from 'expo-router';

import { OwnerAddEmployeeScreen } from '@/components/owner-add-employee-screen';
import { ScreenLoading } from '@/components/screen-loading';
import { useAuth } from '@/hooks/use-auth';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';

function OwnerRoute({ userId }: { userId: string }) {
  const { profile, isLoading } = useEmployeeProfile(userId);

  if (isLoading) return <ScreenLoading />;
  if (profile?.role !== 'owner') return <Redirect href="/" />;

  return <OwnerAddEmployeeScreen />;
}

export default function AddEmployeeRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <ScreenLoading />;
  if (!session) return <Redirect href="/" />;

  return <OwnerRoute userId={session.user.id} />;
}
