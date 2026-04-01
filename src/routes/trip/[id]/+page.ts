import type { PageLoad } from './$types';
import type { Trip } from '$lib/types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/trips/${params.id}`);
  if (!res.ok) throw error(404, 'Trip not found');
  const trip: Trip = await res.json();
  return { trip };
};
