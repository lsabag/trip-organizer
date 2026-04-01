function esc(s) {
  return String(s || '').replace(/[<>"'&]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
}

export async function onRequestGet(context) {
  const { DB } = context.env;
  const { id } = context.params;

  const trip = await DB.prepare('SELECT * FROM trips WHERE id = ?').bind(id).first();
  if (!trip) {
    return Response.redirect(`${new URL(context.request.url).origin}/`, 302);
  }

  const name = esc(trip.name || 'טיול');
  const desc = esc(trip.description || '');
  const image = esc(trip.image || 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80');
  const date = esc(trip.date || '');
  const meeting = esc(trip.meeting || '');
  const participants = JSON.parse(trip.participants || '[]');
  const waypoints = JSON.parse(trip.waypoints || '[]');

  const subtitle = [
    date ? `${date}` : '',
    meeting ? `${meeting}` : '',
    `${participants.length} משתתפים`,
    `${waypoints.length} נקודות`,
  ].filter(Boolean).join(' | ');

  const ogDesc = desc || subtitle;
  const siteUrl = new URL(context.request.url).origin;
  const appUrl = `${siteUrl}/#trip-${esc(id)}`;

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} | Tiyulim+</title>
<meta property="og:title" content="${name}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${siteUrl}/share/${esc(id)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tiyulim+">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0;url=${appUrl}">
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0faf5;margin:0;direction:rtl;}.box{text-align:center;padding:2rem;}a{color:#00b4d8;font-weight:700;}</style>
</head>
<body><div class="box"><p>מעביר לטיול...</p><p><a href="${appUrl}">לחץ כאן</a></p></div></body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
