<script lang="ts">
  import type { Waypoint } from '$lib/types';
  import { starsHTML, num } from '$lib/utils/format';
  import { showToast, unlockedTrips, modalState, currentTrip, creatorToken } from '$lib/stores/app';
  import { checkPassword, saveParticipants } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { waypoint, tripId, index, total }: {
    waypoint: Waypoint;
    tripId: string;
    index: number;
    total: number;
  } = $props();

  let hasCoords = $derived(waypoint.lat != null && waypoint.lng != null);

  let navTarget = $derived(
    hasCoords
      ? `${waypoint.lat},${waypoint.lng}`
      : encodeURIComponent(waypoint.address || waypoint.name + ' ישראל')
  );
  let navUrl = $derived(
    `https://www.google.com/maps/dir/?api=1&destination=${navTarget}`
  );
  let wazeUrl = $derived(
    hasCoords
      ? `https://waze.com/ul?ll=${waypoint.lat},${waypoint.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(waypoint.address || waypoint.name + ' ישראל')}`
  );
  let reviewUrl = $derived(
    waypoint.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${waypoint.placeId}`
      : `https://www.google.com/maps/search/${encodeURIComponent((waypoint.name || '') + ' ' + (waypoint.address || ''))}`
  );

  let ratingStars = $derived(waypoint.rating ? starsHTML(waypoint.rating) : '');
  let ratingNum = $derived(waypoint.rating ? waypoint.rating.toFixed(1) : '');
  let ratingCount = $derived(waypoint.ratingsTotal ? num(waypoint.ratingsTotal) : '');

  async function requirePassword(): Promise<boolean> {
    const cached = get(unlockedTrips);
    if (cached[tripId]) return true;
    const pw = prompt('הזן סיסמה לטיול');
    if (!pw) return false;
    const { data } = await checkPassword(tripId, pw);
    if (!data?.valid) {
      showToast('סיסמה שגויה');
      return false;
    }
    unlockedTrips.update((u) => ({ ...u, [tripId]: pw }));
    return true;
  }

  async function moveWaypoint(dir: number) {
    if (!(await requirePassword())) return;
    const trip = get(currentTrip);
    if (!trip) return;
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= trip.waypoints.length) return;
    const tmp = trip.waypoints[index];
    trip.waypoints[index] = trip.waypoints[newIdx];
    trip.waypoints[newIdx] = tmp;
    const { error } = await saveParticipants(trip, get(creatorToken));
    if (error) { showToast('שגיאה בשמירה'); return; }
    currentTrip.set({ ...trip });
  }

  async function editWaypoint() {
    if (!(await requirePassword())) return;
    modalState.update((s) => ({
      ...s,
      waypointEditor: true,
      editingTripId: tripId,
      editingWaypointId: waypoint.id
    }));
  }

  async function removeWaypoint() {
    if (!(await requirePassword())) return;
    if (!confirm(`למחוק את "${waypoint.name}"?`)) return;
    const trip = get(currentTrip);
    if (!trip) return;
    const i = trip.waypoints.findIndex((w) => w.id === waypoint.id);
    if (i < 0) return;
    trip.waypoints.splice(i, 1);
    const { error } = await saveParticipants(trip, get(creatorToken));
    if (error) { showToast('שגיאה בשמירה'); return; }
    currentTrip.set({ ...trip });
    showToast(`"${waypoint.name}" הוסר`);
  }
</script>

<div class="wp-card" style="animation-delay:{index * 0.05}s;">
  <div class="wp-top">
    <div class="wp-num">{index + 1}</div>
    <div class="wp-info">
      <div class="wp-name">{waypoint.name}</div>
      {#if waypoint.address}
        <div class="wp-addr">
          <span class="ms" style="font-size:.78rem">location_on</span>
          {waypoint.address}
        </div>
      {/if}
      {#if waypoint.time}
        <div class="wp-time-tag">
          <span class="ms" style="font-size:.72rem">schedule</span>
          {waypoint.time}
        </div>
      {/if}
      {#if waypoint.notes}
        <div class="wp-notes">{waypoint.notes}</div>
      {/if}
      {#if waypoint.rating}
        <div class="wp-rating">
          <span class="wp-stars">{ratingStars}</span>
          <b style="font-size:.85rem;">{ratingNum}</b>
          <span class="wp-rating-count">({ratingCount})</span>
        </div>
      {/if}
    </div>
    <div class="wp-edit-row">
      {#if index > 0}
        <button class="wp-edit-btn up" onclick={() => moveWaypoint(-1)} title="הזז למעלה">
          <span class="ms">arrow_upward</span>
        </button>
      {/if}
      {#if index < total - 1}
        <button class="wp-edit-btn down" onclick={() => moveWaypoint(1)} title="הזז למטה">
          <span class="ms">arrow_downward</span>
        </button>
      {/if}
      <button class="wp-edit-btn edit" onclick={editWaypoint} title="ערוך">
        <span class="ms">edit</span>
      </button>
      <button class="wp-edit-btn del" onclick={removeWaypoint} title="מחק">
        <span class="ms">close</span>
      </button>
    </div>
  </div>
  <div class="wp-actions">
    <a class="wp-btn g" href={navUrl} target="_blank">
      <span class="ms" style="font-size:.78rem">location_on</span> Google
    </a>
    <a class="wp-btn w" href={wazeUrl} target="_blank">
      <span class="ms" style="font-size:.78rem">navigation</span> Waze
    </a>
    <a class="wp-btn r" href={reviewUrl} target="_blank">
      <span class="ms" style="font-size:.78rem">star</span> ביקורות
    </a>
    {#if waypoint.phone}
      <a class="wp-btn p" href="tel:{waypoint.phone}">
        <span class="ms" style="font-size:.78rem">phone</span> {waypoint.phone}
      </a>
    {/if}
  </div>
</div>
