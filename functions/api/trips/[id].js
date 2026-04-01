const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token, X-Trip-Password',
};

function esc(s) { return String(s || '').replace(/[<>"'&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c])); }

async function hashPw(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskPhone(p) { return p ? p.replace(/^(.{3}).*(.{2})$/, '$1-***-$2') : ''; }

function tripRow(t, showFullPhones = false) {
  const { password, ...rest } = t;
  const participants = JSON.parse(t.participants || '[]').map(p => {
    if (showFullPhones) return p;
    return { ...p, phone: maskPhone(p.phone) };
  });
  const waypoints = JSON.parse(t.waypoints || '[]').map(w => {
    if (showFullPhones) return w;
    return { ...w, phone: maskPhone(w.phone) };
  });
  return {
    ...rest,
    participants,
    waypoints,
    hidden: !!t.hidden,
    hasPassword: !!(password && password.length > 0),
    desc: t.description,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET /api/trips/:id — password NEVER returned, phones masked unless admin
export async function onRequestGet(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }
  const showFull = await verifyAccess(context, trip);
  return Response.json(tripRow(trip, showFull), { headers: CORS });
}

// Helper: check password or admin
async function verifyAccess(context, trip) {
  const adminToken = context.request.headers.get('X-Admin-Token');
  if (adminToken && adminToken === context.env.ADMIN_TOKEN) return true;
  if (!trip.password) return true;
  const pw = context.request.headers.get('X-Trip-Password');
  if (!pw) return false;
  const hashed = await hashPw(pw);
  return hashed === trip.password;
}

// PATCH /api/trips/:id — verify or set password
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
    if (body.setPassword.length < 4 || body.setPassword.length > 8) {
      return Response.json({ error: 'Password must be 4-8 chars' }, { status: 400, headers: CORS });
    }
    const hashed = await hashPw(body.setPassword);
    await DB.prepare('UPDATE trips SET password = ? WHERE id = ?').bind(hashed, id).run();
    return Response.json({ valid: true, passwordSet: true }, { headers: CORS });
  }

  // Password already exists — verify
  if (!body.password) {
    return Response.json({ valid: false }, { headers: CORS });
  }
  const hashed = await hashPw(body.password);
  const valid = hashed === trip.password;
  return Response.json({ valid }, { headers: CORS });
}

// PUT /api/trips/:id
// With password: full update (admin)
// Without password: only participants (public — join, assign)
export async function onRequestPut(context) {
  const { DB } = context.env;
  const { id } = context.params;
  const body = await context.request.json();

  const trip = await DB.prepare('SELECT *, password as pw FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const hasAccess = await verifyAccess(context, trip);

  if (hasAccess) {
    // Full update — admin with password
    let newPassword = trip.pw || '';
    if (body.password && body.password.length >= 4) {
      newPassword = await hashPw(body.password);
    }
    await DB.prepare(`
      UPDATE trips SET name=?, date=?, time=?, meeting=?, description=?, image=?, hidden=?,
      participants=?, waypoints=?, password=?, updated_at=datetime('now') WHERE id=?
    `).bind(
      body.name || '', body.date || '', body.time || '', body.meeting || '',
      body.desc || '', body.image || '', body.hidden ? 1 : 0,
      JSON.stringify(body.participants || []),
      JSON.stringify(body.waypoints || []),
      newPassword, id
    ).run();
    return Response.json({ success: true, full: true }, { headers: CORS });
  } else {
    // Partial update — only participants (public actions)
    await DB.prepare(`UPDATE trips SET participants=?, updated_at=datetime('now') WHERE id=?`)
      .bind(JSON.stringify(body.participants || []), id).run();
    return Response.json({ success: true, full: false }, { headers: CORS });
  }
}

// DELETE /api/trips/:id — requires password or admin
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
