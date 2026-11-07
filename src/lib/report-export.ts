import { Platform } from 'react-native';

import { BUSINESS_TIMEZONE, LATE_GRACE_MINUTES, WORK_START_HOUR } from '@/lib/work-hours';
import type { AttendanceReport } from '@/types/reports';

/** Searchable A4 PDF with repeated table headings and numbered pages. */
export async function attendanceReportPdf(report: AttendanceReport) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    // Use the portable build so Metro never selects jsPDF's Node-only entry.
    import('jspdf/dist/jspdf.es.min.js'), import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const ink: [number, number, number] = [26, 43, 62];
  const generated = new Date().toLocaleString('en-GB', { timeZone: BUSINESS_TIMEZONE });
  const time = (value: string | null) => value
    ? new Date(value).toLocaleTimeString('en-GB', {
      timeZone: BUSINESS_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }) : '—';
  pdf.setProperties({ title: `Attendance report - ${report.employee.full_name}`, author: 'Crew Attendance' });
  pdf.setFillColor(...ink);
  pdf.rect(0, 0, 210, 32, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text('CREW ATTENDANCE', 16, 12);
  pdf.setFontSize(22);
  pdf.text('Attendance report', 16, 24);
  autoTable(pdf, {
    startY: 39, margin: { left: 16, right: 16 }, theme: 'plain',
    styles: { fontSize: 11, textColor: ink, cellPadding: 2, overflow: 'linebreak' },
    body: [[report.employee.full_name], [report.periodLabel]],
    didParseCell: (data) => {
      if (data.row.index === 0) data.cell.styles.fontStyle = 'bold';
    },
  });
  const tableEnd = () => (pdf as typeof pdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(pdf, {
    startY: tableEnd() + 5, margin: { top: 20, left: 16, right: 16, bottom: 22 }, theme: 'grid',
    head: [['Attendance summary', 'Value', 'Task summary', 'Value']],
    body: [
      ['Days present', String(report.daysPresent), 'Tasks assigned', String(report.totalAssigned)],
      ['Total hours', report.totalHours.toFixed(2), 'Tasks completed', String(report.totalCompleted)],
      ['Regular hours', report.regularHours.toFixed(2), 'Completion rate', `${Math.round(report.completionRate)}%`],
      ['Overtime hours', report.overtimeHours.toFixed(2), '', ''],
      ['Late arrivals', String(report.lateArrivalCount), '', ''],
      ['Absences', String(report.absenceCount), '', ''],
    ],
    styles: { fontSize: 9, cellPadding: 3, textColor: ink, lineColor: [221, 227, 233] },
    headStyles: { fillColor: ink },
  });
  autoTable(pdf, {
    startY: tableEnd() + 8, margin: { top: 20, left: 16, right: 16, bottom: 22 },
    head: [['Date', 'Clock in', 'Clock out', 'Total hrs', 'Regular', 'Overtime', 'Status']],
    body: report.days.length ? report.days.map(day => [
      day.date, time(day.clockInTime), time(day.clockOutTime),
      day.totalHours.toFixed(2), day.regularHours.toFixed(2), day.overtimeHours.toFixed(2),
      day.isPresent ? (day.isLate ? 'Late' : 'On time') : (day.isWeekday ? 'Absent' : 'Weekend'),
    ]) : [['No attendance records in this period.', '', '', '', '', '', '']],
    theme: 'striped', styles: { fontSize: 8, cellPadding: 2.5, textColor: ink },
    headStyles: { fillColor: ink }, alternateRowStyles: { fillColor: [243, 246, 249] }, rowPageBreak: 'avoid',
  });
  autoTable(pdf, {
    startY: tableEnd() + 8, margin: { top: 20, left: 16, right: 16, bottom: 22 },
    head: [['Completed task', 'Site address']],
    body: report.completedTasks.length
      ? report.completedTasks.map(task => [task.title, task.siteAddress])
      : [['No tasks were completed in this period.', '—']],
    styles: { fontSize: 9, cellPadding: 3, textColor: ink, overflow: 'linebreak' },
    headStyles: { fillColor: ink }, alternateRowStyles: { fillColor: [243, 246, 249] }, rowPageBreak: 'avoid',
  });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(93, 109, 126);
    if (page > 1) pdf.text('CREW ATTENDANCE  /  ATTENDANCE REPORT', 16, 12);
    pdf.setDrawColor(221, 227, 233);
    pdf.line(16, 277, 194, 277);
    pdf.setFontSize(7);
    pdf.text(`Times: ${BUSINESS_TIMEZONE}. Late after ${WORK_START_HOUR}:00 + ${LATE_GRACE_MINUTES} min. Hours shown to 2 decimals.`, 16, 282);
    pdf.text(`Generated ${generated} (${BUSINESS_TIMEZONE})`, 16, 287);
    pdf.text(`Page ${page} of ${pages}`, 194, 287, { align: 'right' });
  }
  return pdf.output('arraybuffer');
}

export async function downloadAttendanceReport(report: AttendanceReport) {
  const data = await attendanceReportPdf(report);
  const filename = `attendance-${report.employee.id}-${report.days[0]?.date ?? 'report'}-${report.days.at(-1)?.date ?? 'summary'}.pdf`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
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
  file.write(new Uint8Array(data));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save attendance report' });
}
