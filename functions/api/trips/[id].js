const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token, X-Trip-Password',
};

function tripRow(t) {
  const { password, ...rest } = t;
  return {
    ...rest,
    participants: JSON.parse(t.participants || '[]'),
    waypoints: JSON.parse(t.waypoints || '[]'),
    hidden: !!t.hidden,
    hasPassword: !!password,
    desc: t.description,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET /api/trips/:id — get single trip (password NEVER returned)
export async function onRequestGet(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }
  return Response.json(tripRow(trip), { headers: CORS });
}

// Helper: check password or admin
async function verifyAccess(context, trip) {
  const adminToken = context.request.headers.get('X-Admin-Token');
  if (adminToken && adminToken === context.env.ADMIN_TOKEN) return true;
  if (!trip.password) return true;
  const pw = context.request.headers.get('X-Trip-Password');
  return pw === trip.password;
}

// PATCH /api/trips/:id — verify password (returns {valid:true/false})
export async function onRequestPatch(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const body = await context.request.json();

  const trip = await DB.prepare('SELECT password FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  // Set password if none exists
  if (!trip.password && body.setPassword) {
    await DB.prepare('UPDATE trips SET password = ? WHERE id = ?').bind(body.setPassword, id).run();
    return Response.json({ valid: true, passwordSet: true }, { headers: CORS });
  }

  const valid = body.password === trip.password;
  return Response.json({ valid }, { headers: CORS });
}

// PUT /api/trips/:id — update trip (requires password)
export async function onRequestPut(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const body = await context.request.json();

  const trip = await DB.prepare('SELECT id, password FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  if (!await verifyAccess(context, trip)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  // Allow updating password
  const newPassword = body.password || trip.password || '';

  await DB.prepare(`
    UPDATE trips SET name=?, date=?, time=?, meeting=?, description=?, image=?, hidden=?,
    participants=?, waypoints=?, password=?, updated_at=datetime('now') WHERE id=?
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
    newPassword,
    id
  ).run();

  return Response.json({ success: true }, { headers: CORS });
}

// DELETE /api/trips/:id — delete trip (requires password or admin)
export async function onRequestDelete(context) {
  const { DB } = context.env;
  const { id } = context.params;

  const trip = await DB.prepare('SELECT password FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  if (!await verifyAccess(context, trip)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  await DB.prepare('DELETE FROM trips WHERE id = ?').bind(id).run();
  return Response.json({ success: true }, { headers: CORS });
}
