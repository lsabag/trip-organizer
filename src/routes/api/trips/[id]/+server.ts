import type { RequestHandler } from './$types';

const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Admin-Token, X-Trip-Password',
};

async function hashPw(pw: string, existingSalt?: string): Promise<string> {
  const saltBytes = existingSalt
    ? new Uint8Array(existingSalt.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const salt = [...saltBytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const data = new TextEncoder().encode(salt + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  return salt + ':' + hash;
}

async function verifyPw(pw: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(':');
  if (!salt) return false;
  const hashed = await hashPw(pw, salt);
  return hashed === stored;
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
  if (!trip.password) {
    // No password set: only the creator can edit/delete
    const creatorToken = request.headers.get('X-Creator-Token');
    return !!creatorToken && creatorToken === trip.creator_token;
  }
  const pw = request.headers.get('X-Trip-Password');
  if (!pw) return false;
  return verifyPw(pw, trip.password as string);
}

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: CORS });
};

// GET /api/trips/:id -- password NEVER returned
// Hidden trips are accessible by direct link (share-by-URL design).
// The 12 hex-char ID (48 bits of entropy from crypto.randomUUID) makes enumeration infeasible.
export const GET: RequestHandler = async ({ params, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }
  return Response.json(tripRow(trip), { headers: CORS });
};

// Rate limiting helper: max 5 attempts per 15 minutes per trip
async function checkRateLimit(DB: D1Database, tripId: string): Promise<boolean> {
  const key = `pw_${tripId}`;
  const now = Math.floor(Date.now() / 1000);
  const window = 900; // 15 minutes
  const maxAttempts = 5;

  const row = await DB.prepare('SELECT attempts, window_start FROM rate_limits WHERE key = ?').bind(key).first() as {attempts: number, window_start: number} | null;

  if (!row || (now - row.window_start) > window) {
    await DB.prepare('INSERT OR REPLACE INTO rate_limits (key, attempts, window_start) VALUES (?, 1, ?)').bind(key, now).run();
    return true;
  }
  if (row.attempts >= maxAttempts) return false;
  await DB.prepare('UPDATE rate_limits SET attempts = attempts + 1 WHERE key = ?').bind(key).run();
  return true;
}

async function resetRateLimit(DB: D1Database, tripId: string) {
  await DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`pw_${tripId}`).run();
}

// PATCH /api/trips/:id -- verify or set password
export const PATCH: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json() as Record<string, unknown>;
  const trip = await DB.prepare('SELECT password, creator_token FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  // Set password if none exists
  if (!trip.password && body.setPassword) {
    // Only the creator can set a password on a password-less trip
    const creatorToken = request.headers.get('X-Creator-Token');
    if (!creatorToken || creatorToken !== trip.creator_token) {
      return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
    }
    const setPw = body.setPassword as string;
    if (setPw.length < 4 || setPw.length > 8) {
      return Response.json({ error: 'Password must be 4-8 chars' }, { status: 400, headers: CORS });
    }
    const hashed = await hashPw(setPw);
    await DB.prepare('UPDATE trips SET password = ? WHERE id = ?').bind(hashed, params.id).run();
    return Response.json({ valid: true, passwordSet: true }, { headers: CORS });
  }

  // Password already exists -- verify (with rate limiting)
  if (!body.password) {
    return Response.json({ valid: false }, { headers: CORS });
  }

  const allowed = await checkRateLimit(DB, params.id!);
  if (!allowed) {
    return Response.json({ error: 'יותר מדי ניסיונות. נסה שוב בעוד 15 דקות.', valid: false }, { status: 429, headers: CORS });
  }

  const valid = await verifyPw(body.password as string, trip.password as string);
  if (valid) await resetRateLimit(DB, params.id!);
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
  const trip = await DB.prepare('SELECT *, password as pw, creator_token FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const hasAccess = await verifyAccess(request, env, trip);

  if (hasAccess) {
    // Full update -- admin with password or creator
    let newPassword = (trip.pw as string) || '';
    if (body.password && (body.password as string).length >= 4) {
      newPassword = await hashPw(body.password as string);
    }
    const participants = Array.isArray(body.participants) ? (body.participants as unknown[]).slice(0, 100) : [];
    const waypoints = Array.isArray(body.waypoints) ? (body.waypoints as unknown[]).slice(0, 50) : [];
    await DB.prepare(`
      UPDATE trips SET name=?, date=?, time=?, meeting=?, description=?, image=?, hidden=?,
      participants=?, waypoints=?, password=?, cropY=?, zoom=?, updated_at=datetime('now') WHERE id=?
    `).bind(
      ((body.name as string) || '').slice(0, 200),
      ((body.date as string) || '').slice(0, 20),
      ((body.time as string) || '').slice(0, 10),
      ((body.meeting as string) || '').slice(0, 300),
      ((body.desc as string) || '').slice(0, 2000),
      ((body.image as string) || '').slice(0, 500),
      body.hidden ? 1 : 0,
      JSON.stringify(participants),
      JSON.stringify(waypoints),
      newPassword, body.cropY ?? 50, body.zoom ?? 100, params.id
    ).run();
    return Response.json({ success: true, full: true }, { headers: CORS });
  } else {
    // Partial update -- only participants (public actions)
    const participants = Array.isArray(body.participants) ? (body.participants as unknown[]).slice(0, 100) : [];
    await DB.prepare(`UPDATE trips SET participants=?, updated_at=datetime('now') WHERE id=?`)
      .bind(JSON.stringify(participants), params.id).run();
    return Response.json({ success: true, full: false }, { headers: CORS });
  }
};

// DELETE /api/trips/:id -- requires password or admin
export const DELETE: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  const env = platform?.env;
  if (!DB || !env) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const trip = await DB.prepare('SELECT password, creator_token FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  if (!await verifyAccess(request, env, trip)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403, headers: CORS });
  }

  await DB.prepare('DELETE FROM trips WHERE id = ?').bind(params.id).run();
  return Response.json({ success: true }, { headers: CORS });
};
