import type { RequestHandler } from './$types';

const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, DELETE, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Creator-Token, X-Trip-Password',
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: CORS });
};

// POST /api/trips/:id/participants — add a single participant (atomic, no race condition)
export const POST: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json() as Record<string, unknown>;
  if (!body.name) {
    return Response.json({ error: 'Name required' }, { status: 400, headers: CORS });
  }

  const trip = await DB.prepare('SELECT participants FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) {
    return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
  }

  const participants = JSON.parse((trip.participants as string) || '[]');

  // Check duplicate phone
  if (body.phone && participants.find((p: any) => p.phone === body.phone)) {
    return Response.json({ error: 'Already registered', duplicate: true }, { status: 409, headers: CORS });
  }

  const newPax = {
    id: body.id || ('p' + Date.now()),
    name: String(body.name || '').slice(0, 100),
    phone: String(body.phone || '').slice(0, 20),
    city: String(body.city || '').slice(0, 100),
    hasCar: !!body.hasCar,
    seats: body.hasCar ? Math.min(Number(body.seats) || 0, 8) : 0,
    carFrom: String(body.carFrom || '').slice(0, 100),
    carTo: String(body.carTo || '').slice(0, 100),
    carNotes: String(body.carNotes || '').slice(0, 500),
    needRide: !!body.needRide,
    assignedTo: null,
    notes: String(body.notes || '').slice(0, 500),
  };

  participants.push(newPax);

  await DB.prepare('UPDATE trips SET participants=?, updated_at=datetime(\'now\') WHERE id=?')
    .bind(JSON.stringify(participants), params.id).run();

  return Response.json({ success: true, participant: newPax, total: participants.length }, { status: 201, headers: CORS });
};

// DELETE /api/trips/:id/participants?pid=xxx — remove a participant
export const DELETE: RequestHandler = async ({ params, request, platform, url }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const pid = url.searchParams.get('pid');
  if (!pid) return Response.json({ error: 'pid required' }, { status: 400, headers: CORS });

  const trip = await DB.prepare('SELECT participants FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });

  let participants = JSON.parse((trip.participants as string) || '[]');
  // Unassign anyone assigned to this participant
  participants = participants.map((p: any) => p.assignedTo === pid ? { ...p, assignedTo: null } : p);
  participants = participants.filter((p: any) => p.id !== pid);

  await DB.prepare('UPDATE trips SET participants=?, updated_at=datetime(\'now\') WHERE id=?')
    .bind(JSON.stringify(participants), params.id).run();

  return Response.json({ success: true, total: participants.length }, { headers: CORS });
};

// PUT /api/trips/:id/participants — update participant (assign/unassign)
export const PUT: RequestHandler = async ({ params, request, platform }) => {
  const DB = platform?.env?.DB;
  if (!DB) return Response.json({ error: 'DB unavailable' }, { status: 500, headers: CORS });

  const body = await request.json() as { pid: string; assignedTo?: string | null };
  if (!body.pid) return Response.json({ error: 'pid required' }, { status: 400, headers: CORS });

  const trip = await DB.prepare('SELECT participants FROM trips WHERE id = ?').bind(params.id).first();
  if (!trip) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });

  const participants = JSON.parse((trip.participants as string) || '[]');
  const pax = participants.find((p: any) => p.id === body.pid);
  if (!pax) return Response.json({ error: 'Participant not found' }, { status: 404, headers: CORS });

  if ('assignedTo' in body) {
    // Check seat availability if assigning
    if (body.assignedTo) {
      const driver = participants.find((p: any) => p.id === body.assignedTo);
      if (!driver || !driver.hasCar) return Response.json({ error: 'Driver not found' }, { status: 400, headers: CORS });
      const taken = participants.filter((p: any) => p.assignedTo === body.assignedTo).length;
      if (taken >= driver.seats) return Response.json({ error: 'Car full' }, { status: 409, headers: CORS });
    }
    pax.assignedTo = body.assignedTo || null;
  }

  await DB.prepare('UPDATE trips SET participants=?, updated_at=datetime(\'now\') WHERE id=?')
    .bind(JSON.stringify(participants), params.id).run();

  return Response.json({ success: true, participants }, { headers: CORS });
};
