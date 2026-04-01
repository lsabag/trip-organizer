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
  import { creatorToken, gmapsKey, gmapsLoaded } from '$lib/stores/app';
  import { loadConfig } from '$lib/api/client';
  import { get } from 'svelte/store';

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
    let key = localStorage.getItem('tiyulim_gmaps_key') || '';
    if (!key) {
      const { data } = await loadConfig();
      if (data?.gmapsKey) {
        key = data.gmapsKey;
        gmapsKey.set(key);
        localStorage.setItem('tiyulim_gmaps_key', key);
      }
    } else {
      gmapsKey.set(key);
    }

    // Pre-load Google Maps script globally (for autocomplete in modals)
    if (key && !get(gmapsLoaded) && !(window as any).google?.maps) {
      (window as any)._gmapsReady = () => { gmapsLoaded.set(true); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,marker&language=he&loading=async&callback=_gmapsReady`;
      s.async = true;
      document.head.appendChild(s);
    } else if ((window as any).google?.maps) {
      gmapsLoaded.set(true);
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
