import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type CreateEmployeeBody = {
  full_name?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();

  if (callerProfileError) {
    console.error('Unable to verify caller role:', callerProfileError.message);
    return jsonResponse({ error: 'Unable to verify permissions.' }, 500);
  }

  if (callerProfile?.role !== 'owner') {
    return jsonResponse({ error: 'Only owners can add employees.' }, 403);
  }

  let body: CreateEmployeeBody;
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return jsonResponse({ error: 'Request body must be a JSON object.' }, 400);
    }
    body = parsedBody as CreateEmployeeBody;
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  const fullName = requiredString(body.full_name);
  const phone = requiredString(body.phone);
  const email = requiredString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!fullName || !phone || !email || !password) {
    return jsonResponse({ error: 'Full name, phone, email, and password are required.' }, 400);
  }

  if (fullName.length > 200 || phone.length > 50 || email.length > 320) {
    return jsonResponse({ error: 'One or more fields are too long.' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  }

  if (password.length < 8 || password.length > 72) {
    return jsonResponse({ error: 'Password must be between 8 and 72 characters.' }, 400);
  }

  const { data: createUserData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });

  if (createUserError || !createUserData.user) {
    console.error('Unable to create employee Auth user:', createUserError?.message);
    return jsonResponse(
      { error: createUserError?.message ?? 'Unable to create the employee account.' },
      400,
    );
  }

  const { error: employeeError } = await admin.from('employees').insert({
    id: createUserData.user.id,
    full_name: fullName,
    phone,
    role: 'employee',
  });

  if (employeeError) {
    console.error('Unable to create employee profile:', employeeError.message);

    const { error: rollbackError } = await admin.auth.admin.deleteUser(createUserData.user.id);
    if (rollbackError) {
      console.error('Unable to roll back employee Auth user:', rollbackError.message);
    }

    return jsonResponse({ error: 'Unable to create the employee profile.' }, 500);
  }

  return jsonResponse(
    {
      success: true,
      employee: {
        id: createUserData.user.id,
        full_name: fullName,
        phone,
        email,
        role: 'employee',
      },
    },
    201,
  );
});
