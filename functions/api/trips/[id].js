const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

// GET /api/trips/:id — get single trip (even if hidden, for direct links)
export async function onRequestGet(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }
  return Response.json(tripRow(trip), { headers: CORS });
}

// PUT /api/trips/:id — update trip
export async function onRequestPut(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const body = await context.request.json();
  const creatorToken = context.request.headers.get('X-Creator-Token');
  const adminToken = context.request.headers.get('X-Admin-Token');

  const trip = await DB.prepare('SELECT creator_token FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const isAdmin = adminToken && adminToken === context.env.ADMIN_TOKEN;
  if (trip.creator_token !== creatorToken && !isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  await DB.prepare(`
    UPDATE trips SET name=?, date=?, time=?, meeting=?, description=?, image=?, hidden=?,
    participants=?, waypoints=?, updated_at=datetime('now') WHERE id=?
  `).bind(
    body.name || '',
    body.date || '',
    body.time || '',
    body.meeting || '',
    body.desc || '',
    body.image || '',
    body.hidden ? 1 : 0,
    JSON.stringify(body.participants || []),
    JSON.stringify(body.waypoints || []),
    id
  ).run();

  return Response.json({ success: true }, { headers: CORS });
}

// DELETE /api/trips/:id — delete trip
export async function onRequestDelete(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const creatorToken = context.request.headers.get('X-Creator-Token');
  const adminToken = context.request.headers.get('X-Admin-Token');

  const trip = await DB.prepare('SELECT creator_token FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const isAdmin = adminToken && adminToken === context.env.ADMIN_TOKEN;
  if (trip.creator_token !== creatorToken && !isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  await DB.prepare('DELETE FROM trips WHERE id = ?').bind(id).run();
  return Response.json({ success: true }, { headers: CORS });
}
