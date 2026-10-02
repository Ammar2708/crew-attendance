import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LedgerPressable,
  StatusStamp,
  ledgerControls,
} from '@/components/site-ledger-ui';
import { Fonts, Layout, Palette } from '@/constants/theme';
import { useEmployeeTasks } from '@/hooks/use-tasks';
import type { Task } from '@/types/tasks';

function formatDueDate(value: string | null) {
  if (!value) return 'No due date';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function TaskRow({ task }: { task: Task }) {
  const completed = task.status === 'completed';
  return (
    <LedgerPressable
      accessibilityRole="button"
      depth={1}
      onPress={() => router.push({ pathname: '/tasks/[id]', params: { id: task.id } })}
      style={styles.row}>
      <View style={styles.rowTop}>
        <Text numberOfLines={2} style={styles.title}>
          {task.title}
        </Text>
        <StatusStamp tone={completed ? 'positive' : 'warning'}>{task.status}</StatusStamp>
      </View>
      <Text style={styles.address}>{task.site_address}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.dueLabel}>Due</Text>
        <Text style={styles.due}>{formatDueDate(task.due_date)}</Text>
        <Text numberOfLines={1} style={styles.id}>
          {task.id.slice(0, 8)}
        </Text>
      </View>
    </LedgerPressable>
  );
}

export function EmployeeTasksScreen({ userId }: { userId: string }) {
  const { tasks, isLoading, errorMessage, reload } = useEmployeeTasks(userId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>My tasks</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.safety} size="large" />
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMessage}</Text>
          <Pressable onPress={() => void reload()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.list, tasks.length === 0 && styles.emptyList]}
          data={tasks}
          keyExtractor={(task) => task.id}
          ListHeaderComponent={
            tasks.length ? (
              <View style={styles.listHeading}>
                <Text style={styles.listHeadingText}>Open ledger</Text>
                <Text style={styles.count}>{tasks.length} entries</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No tasks assigned</Text>
              <Text style={styles.emptyCopy}>New tasks will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => <TaskRow task={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    backgroundColor: Palette.paper,
  },
  back: { width: 72, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  screenTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  headerSpacer: { width: 72 },
  list: {
    width: '100%',
    maxWidth: Layout.content,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 0,
  },
  emptyList: { flexGrow: 1 },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomColor: Palette.ink,
    borderBottomWidth: 2,
    paddingBottom: 10,
    marginBottom: 2,
  },
  listHeadingText: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 18 },
  count: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  row: {
    backgroundColor: Palette.surface,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  title: { flex: 1, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 17 },
  address: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, marginTop: 9 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopColor: Palette.line,
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 10,
  },
  dueLabel: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 12 },
  due: { color: Palette.ink, fontFamily: Fonts.mono, fontSize: 12 },
  id: { flex: 1, color: Palette.steel, fontFamily: Fonts.mono, fontSize: 10, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryButton: { ...ledgerControls.primary, marginTop: 16 },
  retryText: { color: Palette.ink, fontFamily: Fonts.sansBold },
  emptyTitle: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 20 },
  emptyCopy: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 15, marginTop: 6 },
  pressed: { opacity: 0.55 },
});
