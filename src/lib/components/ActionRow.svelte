<script lang="ts">
  import type { Trip } from '$lib/types';
  import { showToast, unlockedTrips, modalState } from '$lib/stores/app';
  import { checkPassword } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { trip }: { trip: Trip } = $props();

  async function share() {
    const url = `${location.origin}/share/${trip.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      showToast('הקישור הועתק');
    }
  }

  async function edit() {
    const cached = get(unlockedTrips);
    if (trip.hasPassword && !cached[trip.id]) {
      const pw = prompt('הזן סיסמה לטיול');
      if (!pw) return;
      const { data } = await checkPassword(trip.id, pw);
      if (!data?.valid) {
        showToast('סיסמה שגויה');
        return;
      }
      unlockedTrips.update((u) => ({ ...u, [trip.id]: pw }));
    }
    modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: trip.id }));
  }
</script>

<div class="action-row">
  <button class="action-btn btn-share" onclick={share}>
    <span class="ms">share</span> שתף
  </button>
  <button class="action-btn btn-edit" onclick={edit}>
    <span class="ms">edit</span> ערוך
  </button>
</div>
