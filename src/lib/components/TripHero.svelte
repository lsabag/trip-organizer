<script lang="ts">
  import type { Trip } from '$lib/types';
  import { TRIP_IMAGES } from '$lib/utils/constants';
  import { fmtDate } from '$lib/utils/format';
  import { unlockedTrips, showToast } from '$lib/stores/app';
  import { checkPassword } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { trip }: { trip: Trip } = $props();

  let img = $derived(trip.image || TRIP_IMAGES[0]);
  let cropPos = $derived(trip.cropY != null ? trip.cropY : 50);
  let zoomVal = $derived(trip.zoom != null ? trip.zoom : 100);
  let zoomStyle = $derived(
    zoomVal > 100
      ? `transform:scale(${zoomVal / 100});transform-origin:center ${cropPos}%;`
      : ''
  );

  async function toggleHidden() {
    const cached = get(unlockedTrips);
    if (!cached[trip.id]) {
      const pw = prompt('הזן סיסמה לטיול');
      if (!pw) return;
      const { data } = await checkPassword(trip.id, pw);
      if (!data?.valid) {
        showToast('סיסמה שגויה');
        return;
      }
      unlockedTrips.update((u) => ({ ...u, [trip.id]: pw }));
    }
    trip.hidden = !trip.hidden;
    showToast(trip.hidden ? 'הטיול הוגדר כפרטי' : 'הטיול הוגדר כציבורי');
  }
</script>

<div class="trip-hero">
  <img
    src={img}
    alt={trip.name}
    loading="lazy"
    style="object-position:center {cropPos}%;{zoomStyle}"
  />
  <div class="trip-hero-overlay"></div>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="trip-hero-badge"
    onclick={toggleHidden}
    style="cursor:pointer;"
    title="לחץ לשינוי"
  >
    <span class="ms" style="font-size:.85rem">
      {trip.hidden ? 'visibility_off' : 'visibility'}
    </span>
    {trip.hidden ? 'פרטי' : 'ציבורי'}
  </div>
  <div class="trip-hero-content">
    <div class="trip-hero-title">{trip.name}</div>
    <div class="trip-hero-meta">
      <span>
        <span class="ms" style="font-size:.9rem">calendar_today</span>
        {fmtDate(trip.date)}
      </span>
      <span>
        <span class="ms" style="font-size:.9rem">schedule</span>
        {trip.time}
      </span>
      <span>
        <span class="ms" style="font-size:.9rem">location_on</span>
        {trip.meeting}
      </span>
    </div>
  </div>
</div>
