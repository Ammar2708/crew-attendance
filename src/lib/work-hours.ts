export const WORK_START_HOUR = 8;
export const WORK_END_HOUR = 17;
export const BUSINESS_TIMEZONE = 'Asia/Karachi';
export const LATE_GRACE_MINUTES = 0;

const MILLISECONDS_PER_HOUR = 3_600_000;

type CompletedAttendanceRecord = {
  clock_in_time: string;
  clock_out_time: string | null;
};

export type WorkHourTotals = {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
};

const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateTimePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function getNumericParts(formatter: Intl.DateTimeFormat, date: Date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

export function getBusinessDateKey(date: Date) {
  const parts = getNumericParts(datePartsFormatter, date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function getDateKeyDayOfWeek(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

export function formatBusinessDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions,
) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString([], {
    ...options,
    timeZone: 'UTC',
  });
}

function getTimeZoneOffset(date: Date) {
  const parts = getNumericParts(dateTimePartsFormatter, date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function businessDateTimeToDate(dateKey: string, hour: number, minute = 0) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = wallClockAsUtc;

  // Re-evaluate the offset to remain correct for time zones with DST changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjustedTimestamp = wallClockAsUtc - getTimeZoneOffset(new Date(timestamp));
    if (adjustedTimestamp === timestamp) break;
    timestamp = adjustedTimestamp;
  }

  return new Date(timestamp);
}

function getOverlapMilliseconds(
  start: number,
  end: number,
  windowStart: number,
  windowEnd: number,
) {
  return Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
}

export function calculateWorkHours(records: CompletedAttendanceRecord[]): WorkHourTotals {
  let totalMilliseconds = 0;
  let regularMilliseconds = 0;
  let overtimeMilliseconds = 0;

  for (const record of records) {
    if (!record.clock_out_time) continue;

    const clockIn = new Date(record.clock_in_time).getTime();
    const clockOut = new Date(record.clock_out_time).getTime();
    if (!Number.isFinite(clockIn) || !Number.isFinite(clockOut) || clockOut <= clockIn) continue;

    totalMilliseconds += clockOut - clockIn;
    let dateKey = getBusinessDateKey(new Date(clockIn));
    const finalDateKey = getBusinessDateKey(new Date(clockOut - 1));

    while (dateKey <= finalDateKey) {
      const nextDateKey = addDaysToDateKey(dateKey, 1);
      const regularStart = businessDateTimeToDate(dateKey, WORK_START_HOUR).getTime();
      const regularEnd = businessDateTimeToDate(dateKey, WORK_END_HOUR).getTime();
      const dayEnd = businessDateTimeToDate(nextDateKey, 0).getTime();

      regularMilliseconds += getOverlapMilliseconds(
        clockIn,
        clockOut,
        regularStart,
        regularEnd,
      );
      overtimeMilliseconds += getOverlapMilliseconds(clockIn, clockOut, regularEnd, dayEnd);
      dateKey = nextDateKey;
    }
  }

  return {
    totalHours: totalMilliseconds / MILLISECONDS_PER_HOUR,
    regularHours: regularMilliseconds / MILLISECONDS_PER_HOUR,
    overtimeHours: overtimeMilliseconds / MILLISECONDS_PER_HOUR,
  };
}

export function isLateArrival(clockInTime: string) {
  const clockIn = new Date(clockInTime);
  const threshold = businessDateTimeToDate(
    getBusinessDateKey(clockIn),
    WORK_START_HOUR,
  ).getTime() + LATE_GRACE_MINUTES * 60_000;
  return clockIn.getTime() > threshold;
}

export function getBusinessDayRange(dateKey: string) {
  return {
    start: businessDateTimeToDate(dateKey, 0),
    end: businessDateTimeToDate(addDaysToDateKey(dateKey, 1), 0),
  };
}

