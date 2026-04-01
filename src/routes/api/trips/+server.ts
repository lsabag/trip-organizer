import type { RequestHandler } from './$types';

const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token',
};

async function hashPw(pw: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = [...saltBytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const data = new TextEncoder().encode(salt + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return salt + ':' + hash;
}

function tripRow(t: Record<string, unknown>) {
  const { password, ...rest } = t;
  return {
    ...rest,
    participants: JSON.parse((t.participants as string) || '[]'),
    waypoints: JSON.parse((t.waypoints as string) || '[]'),
    hidden: !!t.hidden,
    hasPassword: !!((password as string) && (password as string).length > 0),
    desc: t.description,
  };
}

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: CORS });
};

// GET /api/trips -- all public trips (password NEVER returned)
export const GET: RequestHandler = async ({ url, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const creatorToken = url.searchParams.get('mine');

  let stmt;
  if (creatorToken) {
    stmt = DB.prepare(
      'SELECT * FROM trips WHERE hidden = 0 OR creator_token = ? ORDER BY created_at DESC'
    ).bind(creatorToken);
  } else {
    stmt = DB.prepare('SELECT * FROM trips WHERE hidden = 0 ORDER BY created_at DESC');
  }

  const { results } = await stmt.all();
  return Response.json(results.map(tripRow), { headers: CORS });
};

// POST /api/trips -- create a trip
export const POST: RequestHandler = async ({ request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json();
  const creatorToken = request.headers.get('X-Creator-Token');

  if (!creatorToken) {
    return Response.json({ error: 'Missing creator token' }, { status: 401, headers: CORS });
  }
  if (!body.name || body.name.length > 200) {
    return Response.json({ error: 'Invalid trip name' }, { status: 400, headers: CORS });
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const pw = body.password ? await hashPw(body.password) : '';

  await DB.prepare(`
    INSERT INTO trips (id, name, date, time, meeting, description, image, hidden, status, creator_token, participants, waypoints, password, cropY, zoom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name.slice(0, 200),
    (body.date || '').slice(0, 20),
    (body.time || '08:00').slice(0, 10),
    (body.meeting || '').slice(0, 300),
    (body.desc || '').slice(0, 2000),
    (body.image || '').slice(0, 500),
    body.hidden ? 1 : 0,
    'open',
    creatorToken,
    JSON.stringify((body.participants || []).slice(0, 100)),
    JSON.stringify((body.waypoints || []).slice(0, 50)),
    pw,
    body.cropY ?? 50,
    body.zoom ?? 100
  ).run();

  return Response.json({ id, success: true }, { status: 201, headers: CORS });
};
