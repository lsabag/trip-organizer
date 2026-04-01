import { AVC } from './constants';

/** HTML-escape a string (for any remaining innerHTML usage) */
export function esc(s: string | undefined | null): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format date as Hebrew: "5 במרץ 2025" */
export function fmtDate(d: string | undefined | null): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const mo = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return `${parseInt(day)} ב${mo[parseInt(m) - 1]} ${y}`;
}

/** Short date: "5.03 | יום ד" */
export function fmtShortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const [y, m, day] = dateStr.split('-');
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `${parseInt(day)}.${m.padStart(2, '0')} | ${days[dt.getDay()]}`;
}

/** Initials from a name: "דני כהן" -> "דכ" */
export function ini(name: string | undefined | null): string {
  return (name || '')
    .split(' ')
    .map((x) => x[0] || '')
    .join('')
    .slice(0, 2);
}

/** Avatar color from the AVC palette, based on ID */
export function avc(id: string | undefined | null): string {
  return AVC[(parseInt((id || '').replace(/\D/g, '')) || 0) % 8];
}

/** Star rating HTML string */
export function starsHTML(rating: number | null | undefined): string {
  if (!rating) return '';
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
}

/** Number formatter: 1200 -> "1.2k" */
export function num(n: number | null | undefined): string {
  if (!n) return '0';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

/** Convert Israeli phone to WhatsApp format: "050-1234567" -> "97250..." */
export function waNum(phone: string | undefined | null): string {
  return '972' + String(phone || '').replace(/[-\s+]/g, '').replace(/^0/, '');
}

/** Haversine distance between two lat/lng points, in km */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
