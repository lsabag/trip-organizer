import type { RequestHandler } from './$types';

const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token, X-Trip-Password',
};

async function hashPw(pw: string): Promise<string> {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
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

async function verifyAccess(request: Request, env: App.Platform['env'], trip: Record<string, unknown>): Promise<boolean> {
  const adminToken = request.headers.get('X-Admin-Token');
  if (adminToken && adminToken === env.ADMIN_TOKEN) return true;
  if (!trip.password) return true;
  const pw = request.headers.get('X-Trip-Password');
  if (!pw) return false;
  const hashed = await hashPw(pw);
  return hashed === trip.password;
}

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: CORS });
};

// GET /api/trips/:id -- password NEVER returned
export const GET: RequestHandler = async ({ params, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }
  return Response.json(tripRow(trip), { headers: CORS });
};

// PATCH /api/trips/:id -- verify or set password
export const PATCH: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json() as Record<string, unknown>;
  const trip = await DB.prepare('SELECT password FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  // Set password if none exists
  if (!trip.password && body.setPassword) {
    const setPw = body.setPassword as string;
    if (setPw.length < 4 || setPw.length > 8) {
      return Response.json({ error: 'Password must be 4-8 chars' }, { status: 400, headers: CORS });
    }
    const hashed = await hashPw(setPw);
    await DB.prepare('UPDATE trips SET password = ? WHERE id = ?').bind(hashed, params.id).run();
    return Response.json({ valid: true, passwordSet: true }, { headers: CORS });
  }

  // Password already exists -- verify
  if (!body.password) {
    return Response.json({ valid: false }, { headers: CORS });
  }
  const hashed = await hashPw(body.password as string);
  const valid = hashed === trip.password;
  return Response.json({ valid }, { headers: CORS });
};

// PUT /api/trips/:id
// With password: full update (admin)
// Without password: only participants (public -- join, assign)
export const PUT: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  const env = platform?.env;
  if (!DB || !env) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json() as Record<string, unknown>;
  const trip = await DB.prepare('SELECT *, password as pw FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const hasAccess = await verifyAccess(request, env, trip);

  if (hasAccess) {
    // Full update -- admin with password
    let newPassword = (trip.pw as string) || '';
    if (body.password && (body.password as string).length >= 4) {
      newPassword = await hashPw(body.password as string);
    }
    await DB.prepare(`
      UPDATE trips SET name=?, date=?, time=?, meeting=?, description=?, image=?, hidden=?,
      participants=?, waypoints=?, password=?, cropY=?, zoom=?, updated_at=datetime('now') WHERE id=?
    `).bind(
      body.name || '', body.date || '', body.time || '', body.meeting || '',
      body.desc || '', body.image || '', body.hidden ? 1 : 0,
      JSON.stringify(body.participants || []),
      JSON.stringify(body.waypoints || []),
      newPassword, body.cropY ?? 50, body.zoom ?? 100, params.id
    ).run();
    return Response.json({ success: true, full: true }, { headers: CORS });
  } else {
    // Partial update -- only participants (public actions)
    await DB.prepare(`UPDATE trips SET participants=?, updated_at=datetime('now') WHERE id=?`)
      .bind(JSON.stringify(body.participants || []), params.id).run();
    return Response.json({ success: true, full: false }, { headers: CORS });
  }
};

// DELETE /api/trips/:id -- requires password or admin
export const DELETE: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  const env = platform?.env;
  if (!DB || !env) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const trip = await DB.prepare('SELECT password FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  if (!await verifyAccess(request, env, trip)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  await DB.prepare('DELETE FROM trips WHERE id = ?').bind(params.id).run();
  return Response.json({ success: true }, { headers: CORS });
};
