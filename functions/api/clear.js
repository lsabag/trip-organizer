export async function onRequestGet() {
  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ניקוי נתונים</title>
<script>
localStorage.clear();
sessionStorage.clear();
document.cookie.split(';').forEach(c=>{document.cookie=c.trim().split('=')[0]+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';});
document.write('<div style="font-family:sans-serif;text-align:center;padding:3rem;direction:rtl;"><h2>הנתונים נוקו</h2><p>localStorage, cookies, sessionStorage</p><a href="/" style="color:#00b4d8;font-weight:bold;">חזרה לאתר</a></div>');
</script></head><body></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
