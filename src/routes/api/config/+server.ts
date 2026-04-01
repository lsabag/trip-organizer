import type { RequestHandler } from './$types';

const ALLOWED_ORIGIN = 'https://trip.nextli.co.il';

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

export const GET: RequestHandler = async ({ platform }) => {
  return Response.json({
    gmapsKey: platform?.env?.GOOGLE_MAPS_API_KEY || '',
  }, {
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
