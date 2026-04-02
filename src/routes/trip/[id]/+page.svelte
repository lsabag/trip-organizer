<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type { Trip } from '$lib/types';
  import { currentTrip, modalState, unlockedTrips, showToast } from '$lib/stores/app';
  import { checkPassword } from '$lib/api/client';
  import { esc } from '$lib/utils/format';
  import { get } from 'svelte/store';

  function formatDesc(text: string): string {
    let safe = esc(text);
    safe = safe.replace(/\*([^*]+)\*/g, '<b>$1</b>');
    return safe;
  }

  import TripHero from '$lib/components/TripHero.svelte';
  import ActionRow from '$lib/components/ActionRow.svelte';
  import SummaryBar from '$lib/components/SummaryBar.svelte';
  import WaypointCard from '$lib/components/WaypointCard.svelte';
  import JoinWizard from '$lib/components/JoinWizard.svelte';
  import CarBlock from '$lib/components/CarBlock.svelte';
  import PoolSection from '$lib/components/PoolSection.svelte';
  import ParticipantRow from '$lib/components/ParticipantRow.svelte';
  import MapSection from '$lib/components/MapSection.svelte';

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

  // Listen to currentTrip store changes from child components
  $effect(() => {
    const unsub = currentTrip.subscribe((t) => {
      if (t && t.id === trip.id && t !== trip) {
        trip = t;
      }
    });
    return unsub;
  });

  // Sync trip data on mount + auto-refresh every 15s
  let pollInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    currentTrip.set(trip);

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${trip.id}`);
        if (!res.ok) return;
        const fresh = await res.json();
        // Only update if participants changed (avoid disrupting user interaction)
        if (JSON.stringify(fresh.participants) !== JSON.stringify(trip.participants)) {
          trip.participants = fresh.participants;
          currentTrip.set({ ...trip, participants: fresh.participants });
        }
        // Also sync waypoints if changed
        if (JSON.stringify(fresh.waypoints) !== JSON.stringify(trip.waypoints)) {
          trip.waypoints = fresh.waypoints;
          currentTrip.set({ ...trip });
        }
      } catch {}
    }, 15000);

    return () => clearInterval(pollInterval);
  });

  // Re-sync when data changes (route param change)
  let prevDataId = data.trip?.id;
  $effect(() => {
    if (data.trip && data.trip.id !== prevDataId) {
      prevDataId = data.trip.id;
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

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
  <title>{trip.name} | Tiyulim+</title>
</svelte:head>

<div class="container">
  <button class="back-btn" onclick={goBack}>
    <span class="ms">arrow_forward</span> חזרה לטיולים
  </button>

  <TripHero {trip} />

  <ActionRow {trip} />

  {#if trip.desc || trip.description}
    <div style="font-size:.88rem;color:var(--gray);line-height:1.65;margin-bottom:1rem;padding:0 .2rem;white-space:pre-line;">
      {@html formatDesc(trip.desc || trip.description || '')}
    </div>
  {/if}

  <SummaryBar
    participants={trip.participants.length}
    drivers={drivers.length}
    {freeSeats}
    waypoints={trip.waypoints.length}
  />

  <!-- Map Section -->
  <div class="sec scroll-reveal" style="animation-delay:.1s;">
    <div class="sec-title"><span class="ms">map</span> מפת המסלול</div>
    <MapSection {trip} />
  </div>

  <!-- Waypoints Section -->
  <div class="sec scroll-reveal" style="animation-delay:.15s;">
    <div class="sec-title" style="justify-content:space-between;">
      <span><span class="ms">location_on</span> נקודות הטיול ({trip.waypoints.length})</span>
      <button class="map-btn" onclick={addWaypoint}>
        <span class="ms" style="font-size:.85rem">add</span> הוסף נקודה
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
