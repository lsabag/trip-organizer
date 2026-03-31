const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token',
};

function tripRow(t) {
  return {
    ...t,
    participants: JSON.parse(t.participants || '[]'),
    waypoints: JSON.parse(t.waypoints || '[]'),
    hidden: !!t.hidden,
    desc: t.description,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET /api/trips — all public trips
export async function onRequestGet(context) {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const creatorToken = url.searchParams.get('mine');

  let stmt;
  if (creatorToken) {
    // Return public trips + all trips by this creator
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
  if (!body.name) {
    return Response.json({ error: 'Missing trip name' }, { status: 400, headers: CORS });
  }

  const id = 't' + Math.random().toString(36).substr(2, 9);

  await DB.prepare(`
    INSERT INTO trips (id, name, date, time, meeting, description, image, hidden, status, creator_token, participants, waypoints)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.date || '',
    body.time || '08:00',
    body.meeting || '',
    body.desc || '',
    body.image || '',
    body.hidden ? 1 : 0,
    'open',
    creatorToken,
    JSON.stringify(body.participants || []),
    JSON.stringify(body.waypoints || [])
  ).run();

  return Response.json({ id, success: true }, { status: 201, headers: CORS });
}
