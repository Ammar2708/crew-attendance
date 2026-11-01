import { Platform } from 'react-native';

import { BUSINESS_TIMEZONE } from '@/lib/work-hours';
import type { AttendanceReport } from '@/types/reports';

function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function attendanceReportCsv(report: AttendanceReport) {
  const time = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', {
    timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }) : '';
  const rows: (string | number)[][] = [
    ['Employee', report.employee.full_name], ['Period', report.periodLabel],
    ['Time zone', BUSINESS_TIMEZONE],
    ['Days present', report.daysPresent], ['Total hours', report.totalHours.toFixed(2)],
    ['Regular hours', report.regularHours.toFixed(2)], ['Overtime hours', report.overtimeHours.toFixed(2)],
    ['Late arrivals', report.lateArrivalCount], ['Absences', report.absenceCount],
    ['Tasks assigned', report.totalAssigned], ['Tasks completed', report.totalCompleted], [],
    ['Date', 'Clock in (London)', 'Clock out (London)', 'Total hours', 'Regular hours', 'Overtime hours', 'Present', 'Late'],
    ...report.days.map(day => [day.date, time(day.clockInTime), time(day.clockOutTime),
      day.totalHours.toFixed(2), day.regularHours.toFixed(2), day.overtimeHours.toFixed(2),
      day.isPresent ? 'Yes' : 'No', day.isLate ? 'Yes' : 'No']),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export async function downloadAttendanceReport(report: AttendanceReport) {
  const csv = attendanceReportCsv(report);
  const filename = `attendance-${report.employee.id}-${report.days[0]?.date}-${report.days.at(-1)?.date}.csv`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, filename);
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Save attendance report' });
}
