<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toastMessage } from '$lib/stores/app';

  let msg = $derived($toastMessage);
</script>

{#if msg}
  <div class="toast show" transition:fly={{ y: 30, duration: 300 }}>
    {msg}
  </div>
{/if}
