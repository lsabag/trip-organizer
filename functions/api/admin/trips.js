const CORS = {
  'Access-Control-Allow-Origin': 'https://trip.nextli.co.il',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET /api/admin/trips — all trips including hidden (requires admin token)
export async function onRequestGet(context) {
  const { DB } = context.env;
  const adminToken = context.request.headers.get('X-Admin-Token');

  if (!adminToken || adminToken !== context.env.ADMIN_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const { results } = await DB.prepare(
    'SELECT * FROM trips ORDER BY created_at DESC'
  ).all();

  const trips = results.map(t => {
    const { password, ...rest } = t;
    return {
      ...rest,
      participants: JSON.parse(t.participants || '[]'),
      waypoints: JSON.parse(t.waypoints || '[]'),
      hidden: !!t.hidden,
      hasPassword: !!(password && password.length > 0),
      desc: t.description,
    };
  });

  return Response.json(trips, { headers: CORS });
}
