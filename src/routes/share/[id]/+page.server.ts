import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/trips/${params.id}`);
  if (!res.ok) return { trip: null };
  const trip = await res.json();
  return { trip };
};
