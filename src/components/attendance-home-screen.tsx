import type { Session } from '@supabase/supabase-js';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LedgerPressable,
  StatusStamp,
  ledgerControls,
} from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useAttendance } from '@/hooks/use-attendance';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { supabase } from '@/lib/supabase';

type AttendanceHomeScreenProps = { session: Session };

const TASKS_ROUTE = '/tasks' as Href;
const DASHBOARD_ROUTE = '/dashboard' as Href;

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatShortTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AttendanceHomeScreen({ session }: AttendanceHomeScreenProps) {
  const [now, setNow] = useState(() => new Date());
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [stampRun, setStampRun] = useState(0);
  const hasLoadedStatus = useRef(false);
  const previousAttendanceId = useRef<string | null>(null);
  const { width } = useWindowDimensions();
  const {
    openAttendance,
    isLoading,
    isSubmitting,
    errorMessage,
    hasLoadError,
    clockIn,
    clockOut,
    retry,
  } = useAttendance(session.user.id);
  const { profile } = useEmployeeProfile(session.user.id);
  const { unregister } = usePushNotifications(session.user.id);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (hasLoadedStatus.current && openAttendance?.id && !previousAttendanceId.current) {
      setStampRun((run) => run + 1);
    }
    previousAttendanceId.current = openAttendance?.id ?? null;
    hasLoadedStatus.current = true;
  }, [isLoading, openAttendance?.id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await unregister();
    await supabase.auth.signOut();
    setIsSigningOut(false);
  }

  const isBusy = isLoading || isSubmitting || hasLoadError;
  const isWide = width >= 820;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>Crew attendance</Text>
            <Text numberOfLines={1} style={styles.email}>
              {session.user.email}
            </Text>
          </View>
          <Pressable
            disabled={isSigningOut}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => pressed && styles.textPressed}>
            <Text style={styles.signOut}>{isSigningOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
          <View style={[styles.main, isWide && styles.mainWide]}>
            <View style={[styles.ledgerPanel, isWide && styles.ledgerPanelWide]}>
              <Text style={styles.date}>
                {now.toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Text accessibilityLabel={`Current time ${formatTime(now)}`} style={styles.time}>
                {formatTime(now)}
              </Text>
              <View style={styles.rule} />
              {isLoading ? (
                <StatusStamp>Checking status</StatusStamp>
              ) : openAttendance ? (
                <StatusStamp animate={stampRun > 0} key={`on-${stampRun}`} tone="positive">
                  {`On site · ${formatShortTime(openAttendance.clock_in_time)}`}
                </StatusStamp>
              ) : (
                <StatusStamp>Off site</StatusStamp>
              )}

              {errorMessage ? (
                <View style={styles.errorRow}>
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {errorMessage}
                  </Text>
                  {hasLoadError ? (
                    <Pressable onPress={() => void retry()}>
                      <Text style={styles.retry}>Try again</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={[styles.punchPanel, isWide && styles.punchPanelWide]}>
              <LedgerPressable
                accessibilityHint="Captures your current location once and saves your attendance"
                accessibilityRole="button"
                containerStyle={styles.clockButtonContainer}
                depth={7}
                disabled={isBusy}
                onPress={() => void (openAttendance ? clockOut() : clockIn())}
                pressedScale={0.985}
                shadowColor={Palette.ink}
                style={styles.clockButton}>
                {isBusy ? (
                  <ActivityIndicator color={Palette.ink} size="large" />
                ) : (
                  <>
                    <Text style={styles.clockButtonText}>
                      {openAttendance ? 'Clock out' : 'Clock in'}
                    </Text>
                    <Text style={styles.clockButtonHint}>Record location and time</Text>
                  </>
                )}
              </LedgerPressable>
              <Text style={styles.locationNote}>
                Your location is captured only when you clock in or out.
              </Text>
            </View>
          </View>

          <View style={styles.navigation}>
            <LedgerPressable onPress={() => router.push(TASKS_ROUTE)} style={styles.navButton}>
              <Text style={styles.navButtonText}>My tasks</Text>
            </LedgerPressable>
            {profile?.role === 'employee' ? (
              <LedgerPressable
                onPress={() => router.push(`/reports/${session.user.id}` as Href)}
                style={styles.navButton}>
                <Text style={styles.navButtonText}>My reports</Text>
              </LedgerPressable>
            ) : null}
            {profile?.role === 'owner' ? (
              <>
                <LedgerPressable
                  onPress={() => router.push(DASHBOARD_ROUTE)}
                  style={styles.navButton}>
                  <Text style={styles.navButtonText}>Dashboard</Text>
                </LedgerPressable>
                <LedgerPressable
                  onPress={() => router.push('/assign-task')}
                  style={styles.navButton}>
                  <Text style={styles.navButtonText}>Assign task</Text>
                </LedgerPressable>
              </>
            ) : null}
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  shell: { flex: 1 },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 24,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    backgroundColor: Palette.paper,
  },
  headerCopy: { flex: 1 },
  brand: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  email: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  signOut: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Layout.wide,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 54,
  },
  main: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  mainWide: { maxWidth: Layout.content, flexDirection: 'row', alignItems: 'stretch' },
  ledgerPanel: {
    minHeight: 240,
    justifyContent: 'center',
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    padding: 28,
  },
  ledgerPanelWide: { flex: 1.2, paddingHorizontal: 40 },
  date: { color: Palette.steel, fontFamily: Fonts.mono, fontSize: 14 },
  time: {
    color: Palette.ink,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 47,
    letterSpacing: -2,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  rule: { height: 1, backgroundColor: Palette.line, marginVertical: 22 },
  errorRow: { marginTop: 18, borderTopColor: Palette.line, borderTopWidth: 1, paddingTop: 14 },
  errorText: { color: Palette.alert, fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19 },
  retry: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 13, marginTop: 8 },
  punchPanel: { alignItems: 'center', justifyContent: 'center', paddingTop: 34 },
  punchPanelWide: {
    flex: 0.8,
    borderLeftColor: Palette.line,
    borderLeftWidth: 1,
    paddingTop: 0,
    paddingHorizontal: 30,
  },
  clockButtonContainer: { width: '100%', maxWidth: 310 },
  clockButton: {
    ...ledgerControls.primary,
    minHeight: 132,
    width: '100%',
    paddingHorizontal: 28,
  },
  clockButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 27 },
  clockButtonHint: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 12, marginTop: 6 },
  locationNote: {
    maxWidth: 300,
    color: Palette.steel,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  navigation: {
    width: '100%',
    maxWidth: Layout.content,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 38,
    paddingTop: 22,
    borderTopColor: Palette.line,
    borderTopWidth: 1,
  },
  navButton: {
    ...ledgerControls.secondary,
    minWidth: 150,
  },
  navButtonText: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 14 },
  textPressed: { opacity: 0.55 },
});
