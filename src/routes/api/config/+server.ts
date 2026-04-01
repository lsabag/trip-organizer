import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  return Response.json({
    gmapsKey: platform?.env?.GOOGLE_MAPS_API_KEY || '',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
