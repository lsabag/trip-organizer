<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import NavDrawer from '$lib/components/NavDrawer.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import TripEditorModal from '$lib/components/TripEditorModal.svelte';
  import WaypointModal from '$lib/components/WaypointModal.svelte';
  import { creatorToken, gmapsKey } from '$lib/stores/app';
  import { loadConfig } from '$lib/api/client';

  let { children } = $props();

  let searchQuery = $state('');

  function handleSearch(query: string) {
    searchQuery = query;
    if (browser) {
      window.dispatchEvent(new CustomEvent('tripsearch', { detail: query }));
    }
  }

  onMount(async () => {
    // Generate creatorToken if not already stored
    let token = localStorage.getItem('tiyulim_creator') || '';
    if (!token) {
      token = 'ct_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('tiyulim_creator', token);
    }
    creatorToken.set(token);

    // Load gmaps key from server config if not in localStorage
    const storedKey = localStorage.getItem('tiyulim_gmaps_key') || '';
    if (!storedKey) {
      const { data } = await loadConfig();
      if (data?.gmapsKey) {
        gmapsKey.set(data.gmapsKey);
        localStorage.setItem('tiyulim_gmaps_key', data.gmapsKey);
      }
    }
  });
</script>

<Header onsearch={handleSearch} />

<NavDrawer />

{@render children()}

<BottomNav />

<Toast />

<TripEditorModal />

<WaypointModal />
