import { loadTrip } from '$lib/api/client';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const { data, error: err } = await loadTrip(params.id);
  if (err || !data) {
    throw error(404, err || 'Trip not found');
  }
  return { trip: data };
};
