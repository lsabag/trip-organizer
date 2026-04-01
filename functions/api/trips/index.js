const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token',
};

async function hashPw(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function tripRow(t) {
  const { password, ...rest } = t;
  return {
    ...rest,
    participants: JSON.parse(t.participants || '[]'),
    waypoints: JSON.parse(t.waypoints || '[]'),
    hidden: !!t.hidden,
    hasPassword: !!(password && password.length > 0),
    desc: t.description,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET /api/trips — all public trips (password NEVER returned)
export async function onRequestGet(context) {
  const { DB } = context.env;
  const url = new URL(context.request.url);
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
}

// POST /api/trips — create a trip
export async function onRequestPost(context) {
  const { DB } = context.env;
  const body = await context.request.json();
  const creatorToken = context.request.headers.get('X-Creator-Token');

  if (!creatorToken) {
    return Response.json({ error: 'Missing creator token' }, { status: 401, headers: CORS });
  }
  if (!body.name || body.name.length > 200) {
    return Response.json({ error: 'Invalid trip name' }, { status: 400, headers: CORS });
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const pw = body.password ? await hashPw(body.password) : '';

  await DB.prepare(`
    INSERT INTO trips (id, name, date, time, meeting, description, image, hidden, status, creator_token, participants, waypoints, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    pw
  ).run();

  return Response.json({ id, success: true }, { status: 201, headers: CORS });
}
