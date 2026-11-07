import type { ReportCompletedTask } from '../types/reports';

export function groupCompletedTasksByDate(tasks: ReportCompletedTask[], timeZone: string) {
  const groups = new Map<string, ReportCompletedTask[]>();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const sorted = [...tasks].sort((a, b) =>
    (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.title.localeCompare(b.title));
  for (const task of sorted) {
    const date = task.completedAt ? formatter.format(new Date(task.completedAt)) : 'unknown';
    const group = groups.get(date) ?? [];
    group.push(task);
    groups.set(date, group);
  }
  return Array.from(groups, ([date, tasks]) => ({ date, tasks }));
}
