import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_EXPO_BATCH_SIZE = 100;

type JsonRecord = Record<string, unknown>;

type DatabaseWebhookPayload = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: unknown;
  old_record?: unknown;
};

type PushToken = {
  token: string;
};

type NotificationContent = {
  title: string;
  body: string;
  url: '/dashboard' | '/tasks';
};

type ExpoPushTicket = {
  status?: unknown;
  details?: {
    error?: unknown;
  };
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function secretsMatch(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function deleteUnregisteredTokens(
  admin: ReturnType<typeof createClient>,
  tokens: string[],
  tickets: ExpoPushTicket[],
) {
  const unregisteredTokens = tokens.filter(
    (_token, index) => tickets[index]?.details?.error === 'DeviceNotRegistered',
  );

  if (unregisteredTokens.length === 0) return;

  const { error } = await admin.from('push_tokens').delete().in('token', unregisteredTokens);
  if (error) {
    console.error('Unable to delete unregistered Expo push tokens:', error.message);
  }
}

async function sendNotifications(
  admin: ReturnType<typeof createClient>,
  tokens: string[],
  content: NotificationContent,
) {
  let sent = 0;

  for (const tokenBatch of chunk(tokens, MAX_EXPO_BATCH_SIZE)) {
    const messages = tokenBatch.map((to) => ({
      to,
      title: content.title,
      body: content.body,
      sound: 'default',
      channelId: 'default',
      data: { url: content.url },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo Push Service returned ${response.status}.`);
    }

    const result: unknown = await response.json();
    const tickets =
      isRecord(result) && Array.isArray(result.data)
        ? (result.data as ExpoPushTicket[])
        : [];

    if (tickets.length !== tokenBatch.length) {
      throw new Error('Expo Push Service returned an unexpected ticket response.');
    }

    await deleteUnregisteredTokens(admin, tokenBatch, tickets);
    sent += tickets.filter((ticket) => ticket.status === 'ok').length;
  }

  return sent;
}

async function getTokensForUsers(admin: ReturnType<typeof createClient>, userIds: string[]) {
  if (userIds.length === 0) return [];

  const { data, error } = await admin
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)
    .returns<PushToken[]>();

  if (error) throw error;
  return [...new Set((data ?? []).map(({ token }) => token))];
}

async function attendanceNotification(
  admin: ReturnType<typeof createClient>,
  payload: DatabaseWebhookPayload,
) {
  if (!isRecord(payload.record)) return null;

  const eventType = stringValue(payload.type);
  const employeeId = stringValue(payload.record.employee_id);
  let action: 'clocked in' | 'clocked out';
  let eventTime: string | null;

  if (eventType === 'INSERT') {
    action = 'clocked in';
    eventTime = stringValue(payload.record.clock_in_time);
  } else if (
    eventType === 'UPDATE' &&
    isRecord(payload.old_record) &&
    payload.old_record.clock_out_time == null &&
    payload.record.clock_out_time != null
  ) {
    action = 'clocked out';
    eventTime = stringValue(payload.record.clock_out_time);
  } else {
    return null;
  }

  if (!employeeId || !eventTime) return null;

  const [employeeResult, ownersResult] = await Promise.all([
    admin.from('employees').select('full_name').eq('id', employeeId).maybeSingle(),
    admin.from('employees').select('id').eq('role', 'owner').returns<{ id: string }[]>(),
  ]);

  if (employeeResult.error) throw employeeResult.error;
  if (ownersResult.error) throw ownersResult.error;
  if (!employeeResult.data) return null;

  return {
    userIds: (ownersResult.data ?? []).map(({ id }) => id),
    content: {
      title: 'Attendance update',
      body: `${employeeResult.data.full_name} ${action} at ${formatTime(eventTime)}`,
      url: '/dashboard',
    } satisfies NotificationContent,
  };
}

async function taskNotification(
  admin: ReturnType<typeof createClient>,
  payload: DatabaseWebhookPayload,
) {
  if (payload.type !== 'INSERT' || !isRecord(payload.record)) return null;

  const assignedTo = stringValue(payload.record.assigned_to);
  const assignedBy = stringValue(payload.record.assigned_by);
  const title = stringValue(payload.record.title);
  const siteAddress = stringValue(payload.record.site_address);

  if (!assignedTo || assignedTo === assignedBy || !title || !siteAddress) return null;

  const { data: assignee, error } = await admin
    .from('employees')
    .select('role')
    .eq('id', assignedTo)
    .maybeSingle();

  if (error) throw error;
  if (!assignee) return null;

  return {
    userIds: [assignedTo],
    content: {
      title: 'New task',
      body: `New task: ${title} at ${siteAddress}`,
      url: assignee.role === 'owner' ? '/dashboard' : '/tasks',
    } satisfies NotificationContent,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const suppliedSecret = request.headers.get('x-webhook-secret') ?? '';
  if (!webhookSecret || !secretsMatch(suppliedSecret, webhookSecret)) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required Supabase function environment variables.');
    return jsonResponse({ error: 'The service is not configured.' }, 500);
  }

  let payload: DatabaseWebhookPayload;
  try {
    const parsedPayload: unknown = await request.json();
    if (!isRecord(parsedPayload)) {
      return jsonResponse({ error: 'Webhook payload must be a JSON object.' }, 400);
    }
    payload = parsedPayload;
  } catch {
    return jsonResponse({ error: 'Webhook payload must be valid JSON.' }, 400);
  }

  if (payload.schema !== 'public') {
    return jsonResponse({ skipped: true, reason: 'Unsupported schema.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const notification =
      payload.table === 'attendance'
        ? await attendanceNotification(admin, payload)
        : payload.table === 'tasks'
          ? await taskNotification(admin, payload)
          : null;

    if (!notification) {
      return jsonResponse({ skipped: true, reason: 'Event does not require a notification.' });
    }

    const tokens = await getTokensForUsers(admin, notification.userIds);
    if (tokens.length === 0) {
      return jsonResponse({ sent: 0, reason: 'No registered push tokens.' });
    }

    const sent = await sendNotifications(admin, tokens, notification.content);
    return jsonResponse({ sent });
  } catch (error) {
    console.error('Unable to send notification:', error);
    return jsonResponse({ error: 'Unable to send notification.' }, 500);
  }
});
