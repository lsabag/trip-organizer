import type { PageLoad } from './$types';
import { loadTrips } from '$lib/api/client';
import type { Trip } from '$lib/types';
import { browser } from '$app/environment';

export const load: PageLoad = async ({ fetch }) => {
  // creatorToken is only available in the browser (localStorage)
  let creatorToken = '';
  if (browser) {
    creatorToken = localStorage.getItem('tiyulim_creator') || '';
  }

  const { data, error } = await loadTrips(creatorToken);

  return {
    trips: (data ?? []) as Trip[]
  };
};
