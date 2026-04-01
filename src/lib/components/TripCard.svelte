<script lang="ts">
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import type { Trip } from '$lib/types';
  import { TRIP_IMAGES } from '$lib/utils/constants';
  import { fmtShortDate } from '$lib/utils/format';

  let { trip, index = 0 }: { trip: Trip; index?: number } = $props();

  let img = $derived(trip.image || TRIP_IMAGES[index % TRIP_IMAGES.length]);
  let cropY = $derived(trip.cropY != null ? trip.cropY : 50);
  let zoom = $derived(trip.zoom != null ? trip.zoom : 100);
  let zoomStyle = $derived(
    zoom > 100
      ? `transform:scale(${zoom / 100});transform-origin:center ${cropY}%`
      : ''
  );

  let shortDate = $derived(fmtShortDate(trip.date));

  let drivers = $derived(trip.participants.filter((p) => p.hasCar));
  let freeSeats = $derived(
    drivers.reduce((s, d) => {
      const taken = trip.participants.filter((p) => p.assignedTo === d.id).length;
      return s + Math.max(0, d.seats - taken);
    }, 0)
  );
  let spotsText = $derived(freeSeats > 0 ? `${freeSeats} מקומות פנויים` : 'מלא!');
  let spotsClass = $derived(freeSeats > 0 ? 'available' : 'full');

  let locationLabel = $derived(trip.name.split(' ').slice(-2).join(' '));

  function handleClick() {
    goto(`/trip/${trip.id}`);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="trip-card"
  onclick={handleClick}
  in:fly={{ y: 24, duration: 500, delay: index * 80 }}
>
  <div class="trip-card-img">
    <img
      src={img}
      alt={trip.name}
      loading="lazy"
      style="object-position:center {cropY}%;{zoomStyle}"
    />
    <div class="location-badge">
      <span class="ms" style="font-size:.85rem">location_on</span>
      {locationLabel}
    </div>
    {#if shortDate}
      <div class="date-badge">{shortDate}</div>
    {/if}
  </div>
  <div class="trip-card-body">
    <div class="tc-title">{trip.name}</div>
    <div class="tc-meta">
      <span class="ms">schedule</span> {trip.time}
      &nbsp;|&nbsp;
      <span class="ms">location_on</span> {trip.meeting}
    </div>
    <div class="tc-divider"></div>
    <div class="tc-footer">
      <div class="tc-pax">
        <span class="ms">group</span>
        {trip.participants.length} נרשמו
      </div>
      <div class="tc-spots {spotsClass}">{spotsText}</div>
    </div>
  </div>
</div>
