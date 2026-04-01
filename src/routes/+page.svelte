<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onMount } from 'svelte';
  import HeroSection from '$lib/components/HeroSection.svelte';
  import TripCard from '$lib/components/TripCard.svelte';
  import { trips as tripsStore, modalState } from '$lib/stores/app';
  import type { Trip } from '$lib/types';

  let { data } = $props();

  let searchQuery = $state('');
  let allTrips: Trip[] = $state([]);

  // Sync loaded data into the store and local state
  $effect(() => {
    if (data.trips) {
      allTrips = data.trips;
      tripsStore.set(data.trips);
    }
  });

  // Filter: only visible (non-hidden) trips, then apply search
  let visibleTrips = $derived(
    allTrips
      .filter((t) => !t.hidden)
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const term = searchQuery.trim().toLowerCase();
        const text = `${t.name} ${t.meeting} ${t.desc || ''} ${t.description || ''}`.toLowerCase();
        return text.includes(term);
      })
  );

  function openCreateTrip() {
    modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: null }));
  }

  onMount(() => {
    // Listen for search events dispatched by the layout header
    function onSearch(e: Event) {
      searchQuery = (e as CustomEvent<string>).detail;
    }
    window.addEventListener('tripsearch', onSearch);
    return () => window.removeEventListener('tripsearch', onSearch);
  });
</script>

<HeroSection />

<div class="container">
  <h2 class="section-heading">טיולים מובילים השבוע</h2>

  <div class="trips-grid" id="trips-grid">
    {#each visibleTrips as trip, i (trip.id)}
      <TripCard {trip} index={i} />
    {/each}

    <!-- Add trip card -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="add-trip-card"
      onclick={openCreateTrip}
      in:fly={{ y: 24, duration: 500, delay: visibleTrips.length * 80 }}
    >
      <div class="plus"><span class="ms">add</span></div>
      <div>פרסם טיול חדש</div>
    </div>
  </div>
</div>
