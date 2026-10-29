const MAX_CACHE_ENTRIES = 200;
const MIN_REQUEST_INTERVAL_MS = 1100;
const { createClient } = require('@supabase/supabase-js');

const resultCache = new Map();
const suggestionCache = new Map();
let nextUpstreamRequestAt = 0;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = async function geocode(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const rawQuery = Array.isArray(request.query.q) ? request.query.q[0] : request.query.q;
  const address = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  const wantsSuggestions = request.query.suggest === '1';
  if (address.length < 3 || address.length > 250) {
    return response.status(400).json({ error: 'Enter a valid site address.' });
  }

  const authorization = request.headers.authorization;
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken) return response.status(401).json({ error: 'Sign in to look up an address.' });
  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(500).json({ error: 'Address lookup is not configured.' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);
  if (authError || !user) return response.status(401).json({ error: 'Your session has expired.' });

  const { data: profile, error: profileError } = await supabase
    .from('employees')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'owner' || !profile.is_active) {
    return response.status(403).json({ error: 'Only an active owner can look up task addresses.' });
  }

  const cacheKey = address.toLocaleLowerCase();
  if (wantsSuggestions) {
    const cachedSuggestions = suggestionCache.get(cacheKey);
    if (cachedSuggestions) return response.status(200).json({ suggestions: cachedSuggestions });

    try {
      const upstreamUrl = new URL('/api/', 'https://photon.komoot.io');
      upstreamUrl.search = new URLSearchParams({ q: address, limit: '5', lang: 'en' });
      const upstreamResponse = await fetch(upstreamUrl, {
        headers: { Accept: 'application/json' },
      });
      if (!upstreamResponse.ok) {
        return response.status(502).json({ error: 'Address suggestions are temporarily unavailable.' });
      }

      const payload = await upstreamResponse.json();
      const seenLabels = new Set();
      const suggestions = (Array.isArray(payload.features) ? payload.features : []).flatMap((feature) => {
        const properties = feature?.properties ?? {};
        const coordinates = feature?.geometry?.coordinates;
        const longitude = Number(coordinates?.[0]);
        const latitude = Number(coordinates?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

        const streetName = [properties.housenumber, properties.street].filter(Boolean).join(' ');
        const labelParts = [
          properties.name,
          streetName && streetName !== properties.name ? streetName : null,
          properties.district,
          properties.locality,
          properties.city,
          properties.county,
          properties.state,
          properties.postcode,
          properties.country,
        ].filter((part, index, parts) => part && parts.indexOf(part) === index);
        const label = labelParts.join(', ');
        if (!label || seenLabels.has(label)) return [];
        seenLabels.add(label);
        return [{ label, latitude, longitude }];
      });

      if (suggestionCache.size >= MAX_CACHE_ENTRIES) {
        suggestionCache.delete(suggestionCache.keys().next().value);
      }
      suggestionCache.set(cacheKey, suggestions);
      return response.status(200).json({ suggestions });
    } catch {
      return response.status(502).json({ error: 'Address suggestions are temporarily unavailable.' });
    }
  }

  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) return response.status(200).json(cachedResult);

  // Keep this endpoint within the public Nominatim service's one-request-per-second limit.
  const requestAt = Math.max(Date.now(), nextUpstreamRequestAt);
  nextUpstreamRequestAt = requestAt + MIN_REQUEST_INTERVAL_MS;
  await wait(Math.max(0, requestAt - Date.now()));

  try {
    const baseUrl = process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';
    const upstreamUrl = new URL('/search', baseUrl);
    upstreamUrl.search = new URLSearchParams({ format: 'jsonv2', limit: '1', q: address });

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'CrewAttendance/1.0 (task address lookup)',
      },
    });
    if (!upstreamResponse.ok) {
      return response.status(502).json({ error: 'Address lookup is temporarily unavailable.' });
    }

    const [result] = await upstreamResponse.json();
    if (!result) return response.status(404).json({ error: 'Address not found.' });

    const coordinate = { latitude: Number(result.lat), longitude: Number(result.lon) };
    if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
      return response.status(502).json({ error: 'The address service returned an invalid location.' });
    }

    if (resultCache.size >= MAX_CACHE_ENTRIES) {
      resultCache.delete(resultCache.keys().next().value);
    }
    resultCache.set(cacheKey, coordinate);
    return response.status(200).json(coordinate);
  } catch {
    return response.status(502).json({ error: 'Address lookup is temporarily unavailable.' });
  }
};
