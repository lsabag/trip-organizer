<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data } = $props();

  onMount(() => {
    if (data.trip) {
      goto(`/trip/${data.trip.id}`, { replaceState: true });
    } else {
      goto('/');
    }
  });
</script>

<svelte:head>
  {#if data.trip}
    <meta property="og:title" content={data.trip.name} />
    <meta property="og:description" content={data.trip.desc || data.trip.description || ''} />
    <meta property="og:image" content={data.trip.image || ''} />
    <meta property="og:url" content={`https://trip.nextli.co.il/share/${data.trip.id}`} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tiyulim+" />
    <meta name="twitter:card" content="summary_large_image" />
  {/if}
</svelte:head>

<div style="text-align:center;padding:3rem;font-family:Heebo,sans-serif;">
  <p>...</p>
</div>
