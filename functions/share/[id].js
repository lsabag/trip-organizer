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
  const siteUrl = new URL(context.request.url).origin;

  // Fetch the real index.html
  const indexUrl = `${siteUrl}/index.html`;
  const indexResp = await fetch(indexUrl);
  let html = await indexResp.text();

  // Inject OG meta tags right after <head>
  const ogTags = `
<meta property="og:title" content="${name}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${siteUrl}/share/${esc(id)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tiyulim+">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${image}">`;

  html = html.replace('<head>', '<head>' + ogTags);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
