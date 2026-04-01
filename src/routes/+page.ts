import type { PageLoad } from './$types';
import type { Trip } from '$lib/types';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ fetch }) => {
  let creatorToken = '';
  if (browser) {
    creatorToken = localStorage.getItem('tiyulim_creator') || '';
  }

  const res = await fetch(`/api/trips${creatorToken ? `?mine=${encodeURIComponent(creatorToken)}` : ''}`);
  const trips: Trip[] = res.ok ? await res.json() : [];

  return { trips };
};
