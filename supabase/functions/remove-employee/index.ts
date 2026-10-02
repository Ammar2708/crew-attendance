import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type RemoveEmployeeBody = {
  employee_id?: unknown;
};

type EmployeeRecord = {
  id: string;
  full_name: string;
  role: 'employee' | 'owner';
  is_active: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required Supabase function secrets.');
    return jsonResponse({ error: 'The service is not configured.' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await admin.auth.getUser(accessToken);

  if (callerError || !caller) {
    return jsonResponse({ error: 'Invalid or expired authentication token.' }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await admin
    .from('employees')
    .select('role, is_active')
    .eq('id', caller.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (callerProfileError) {
    console.error('Unable to verify caller role:', callerProfileError.message);
    return jsonResponse({ error: 'Unable to verify permissions.' }, 500);
  }

  if (callerProfile?.role !== 'owner' || !callerProfile.is_active) {
    return jsonResponse({ error: 'Only active owners can remove employees.' }, 403);
  }

  let body: RemoveEmployeeBody;
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return jsonResponse({ error: 'Request body must be a JSON object.' }, 400);
    }
    body = parsedBody as RemoveEmployeeBody;
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  const employeeId = typeof body.employee_id === 'string' ? body.employee_id.trim() : '';
  if (!UUID_PATTERN.test(employeeId)) {
    return jsonResponse({ error: 'A valid employee ID is required.' }, 400);
  }

  if (employeeId === caller.id) {
    return jsonResponse({ error: 'Owners cannot remove their own account.' }, 400);
  }

  const { data: employee, error: employeeError } = await admin
    .from('employees')
    .select('id, full_name, role, is_active')
    .eq('id', employeeId)
    .maybeSingle<EmployeeRecord>();

  if (employeeError) {
    console.error('Unable to load employee:', employeeError.message);
    return jsonResponse({ error: 'Unable to load the employee.' }, 500);
  }

  if (!employee) {
    return jsonResponse({ error: 'Employee not found.' }, 404);
  }

  if (employee.role !== 'employee') {
    return jsonResponse({ error: 'Owner accounts cannot be removed here.' }, 400);
  }

  const { error: banError } = await admin.auth.admin.updateUserById(employeeId, {
    ban_duration: '876000h',
  });

  if (banError) {
    console.error('Unable to disable employee Auth user:', banError.message);
    return jsonResponse({ error: 'Unable to disable the employee login.' }, 500);
  }

  const { error: deactivateError } = await admin
    .from('employees')
    .update({ is_active: false })
    .eq('id', employeeId)
    .eq('role', 'employee');

  if (deactivateError) {
    console.error('Unable to deactivate employee profile:', deactivateError.message);
    const { error: rollbackError } = await admin.auth.admin.updateUserById(employeeId, {
      ban_duration: 'none',
    });
    if (rollbackError) {
      console.error('Unable to roll back employee Auth ban:', rollbackError.message);
    }
    return jsonResponse({ error: 'Unable to remove the employee.' }, 500);
  }

  return jsonResponse(
    {
      success: true,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        is_active: false,
      },
    },
    200,
  );
});
