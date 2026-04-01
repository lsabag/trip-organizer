import type { RequestHandler } from './$types';

const CORS = {
  'Access-Control-Allow-Origin': 'https://trip.nextli.co.il',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: CORS });
};

// GET /api/admin/trips -- all trips including hidden (requires admin token)
export const GET: RequestHandler = async ({ request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken || adminToken !== platform?.env?.ADMIN_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  const { results } = await DB.prepare(
    'SELECT * FROM trips ORDER BY created_at DESC'
  ).all();

  const trips = results.map(t => {
    const { password, ...rest } = t;
    return {
      ...rest,
      participants: JSON.parse((t.participants as string) || '[]'),
      waypoints: JSON.parse((t.waypoints as string) || '[]'),
      hidden: !!t.hidden,
      hasPassword: !!((password as string) && (password as string).length > 0),
      desc: t.description,
    };
  });

  return Response.json(trips, { headers: CORS });
};
