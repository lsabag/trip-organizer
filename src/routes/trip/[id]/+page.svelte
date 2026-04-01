<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { Trip } from '$lib/types';
  import { currentTrip, modalState, unlockedTrips, showToast } from '$lib/stores/app';
  import { checkPassword } from '$lib/api/client';
  import { get } from 'svelte/store';

  import TripHero from '$lib/components/TripHero.svelte';
  import ActionRow from '$lib/components/ActionRow.svelte';
  import SummaryBar from '$lib/components/SummaryBar.svelte';
  import WaypointCard from '$lib/components/WaypointCard.svelte';
  import JoinWizard from '$lib/components/JoinWizard.svelte';
  import CarBlock from '$lib/components/CarBlock.svelte';
  import PoolSection from '$lib/components/PoolSection.svelte';
  import ParticipantRow from '$lib/components/ParticipantRow.svelte';

  let { data } = $props();

  // Reactive trip: keep in sync with store updates
  let trip: Trip = $state(data.trip);

  // Computed values
  let drivers = $derived(trip.participants.filter((p) => p.hasCar));
  let unassigned = $derived(
    trip.participants.filter((p) => !p.hasCar && p.needRide && !p.assignedTo)
  );
  let freeSeats = $derived(
    drivers.reduce((s, d) => {
      const taken = trip.participants.filter((p) => p.assignedTo === d.id).length;
      return s + Math.max(0, d.seats - taken);
    }, 0)
  );

  // Set currentTrip store on mount
  onMount(() => {
    currentTrip.set(trip);
  });

  // Re-sync when store changes (from child components saving)
  $effect(() => {
    const unsub = currentTrip.subscribe((t) => {
      if (t && t.id === trip.id) {
        trip = t;
      }
    });
    return unsub;
  });

  // Also sync if data changes (e.g. route param change)
  $effect(() => {
    if (data.trip) {
      trip = data.trip;
      currentTrip.set(data.trip);
    }
  });

  function goBack() {
    goto('/');
  }

  async function addWaypoint() {
    const cached = get(unlockedTrips);
    if (trip.hasPassword && !cached[trip.id]) {
      const pw = prompt('הזן סיסמה לטיול');
      if (!pw) return;
      const { data: res } = await checkPassword(trip.id, pw);
      if (!res?.valid) {
        showToast('סיסמה שגויה');
        return;
      }
      unlockedTrips.update((u) => ({ ...u, [trip.id]: pw }));
    }
    modalState.update((s) => ({
      ...s,
      waypointEditor: true,
      editingTripId: trip.id,
      editingWaypointId: null
    }));
  }
</script>

<div class="container">
  <button class="back-btn" onclick={goBack}>
    <span class="ms">arrow_forward</span> חזרה לטיולים
  </button>

  <TripHero {trip} />

  <ActionRow {trip} />

  {#if trip.desc || trip.description}
    <div style="font-size:.88rem;color:var(--gray);line-height:1.65;margin-bottom:1rem;padding:0 .2rem;">
      {trip.desc || trip.description}
    </div>
  {/if}

  <SummaryBar
    participants={trip.participants.length}
    drivers={drivers.length}
    {freeSeats}
    waypoints={trip.waypoints.length}
  />

  <!-- Map Section (placeholder) -->
  <div class="sec scroll-reveal" style="animation-delay:.1s;">
    <div class="sec-title"><span class="ms">map</span> מפת המסלול</div>
    <div class="map-wrapper">
      <div
        id="trip-map"
        style="height:380px;border-radius:12px;background:#e8f0f5;display:flex;align-items:center;justify-content:center;color:var(--gray);font-weight:600;"
      >
        <div style="text-align:center">
          <div style="font-size:2rem;margin-bottom:.5rem"><span class="ms">map</span></div>
          טוען מפה...
        </div>
      </div>
    </div>
  </div>

  <!-- Waypoints Section -->
  <div class="sec scroll-reveal" style="animation-delay:.15s;">
    <div class="sec-title" style="justify-content:space-between;">
      <span><span class="ms">location_on</span> נקודות הטיול ({trip.waypoints.length})</span>
      <button class="map-btn" onclick={addWaypoint}>
        <span class="ms" style="font-size:.85rem">add</span> הוסף
      </button>
    </div>
    <div class="waypoints-list">
      {#if trip.waypoints.length}
        {#each trip.waypoints as wp, i (wp.id + '-' + i)}
          <WaypointCard
            waypoint={wp}
            tripId={trip.id}
            index={i}
            total={trip.waypoints.length}
          />
        {/each}
      {:else}
        <div class="empty-state">
          <div class="ei"><span class="ms" style="font-size:2.3rem">map</span></div>
          <p>הוסף נקודות מסלול</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Join Wizard -->
  <JoinWizard {trip} />

  <!-- Cars Section -->
  <div class="sec scroll-reveal" style="animation-delay:.2s;">
    <div class="sec-title"><span class="ms">directions_car</span> רכבים ושיבוץ נוסעים</div>
    {#if drivers.length}
      {#each drivers as d (d.id)}
        <CarBlock driver={d} {trip} />
      {/each}
    {:else}
      <div class="empty-state">
        <div class="ei"><span class="ms" style="font-size:2.3rem">directions_car</span></div>
        <p>אין רכבים עדיין</p>
      </div>
    {/if}
  </div>

  <!-- Pool Section -->
  <div class="sec scroll-reveal" style="animation-delay:.25s;">
    <div class="sec-title">
      <span class="ms">schedule</span> ממתינים לשיבוץ ({unassigned.length})
    </div>
    <PoolSection {trip} {unassigned} {drivers} />
  </div>

  <!-- Participants Section -->
  <div class="sec scroll-reveal" style="animation-delay:.3s;">
    <div class="sec-title">
      <span class="ms">group</span> כל המשתתפים ({trip.participants.length})
    </div>
    {#if trip.participants.length}
      <div class="participants-list">
        {#each trip.participants as p, i (p.id)}
          <ParticipantRow participant={p} {trip} index={i} />
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <div class="ei"><span class="ms" style="font-size:2.3rem">manage_search</span></div>
        <p>עדיין אין נרשמים</p>
      </div>
    {/if}
  </div>
</div>
