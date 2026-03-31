export async function onRequestGet(context) {
  return Response.json({
    gmapsKey: context.env.GOOGLE_MAPS_API_KEY || '',
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
