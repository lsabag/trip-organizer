<script lang="ts">
  import type { Trip } from '$lib/types';
  import { showToast, unlockedTrips, modalState, creatorToken } from '$lib/stores/app';
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
    if (cached[trip.id]) {
      // Already unlocked this session
      modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: trip.id }));
      return;
    }
    if (trip.hasPassword) {
      const pw = prompt('הזן סיסמה לטיול');
      if (!pw) return;
      const { data } = await checkPassword(trip.id, pw);
      if (!data?.valid) {
        showToast(data?.error || 'סיסמה שגויה');
        return;
      }
      unlockedTrips.update((u) => ({ ...u, [trip.id]: pw }));
    } else {
      // No password yet — require setting one
      const pw = prompt('טיול זה עדיין ללא סיסמה.\nהגדר סיסמה (4-8 תווים):');
      if (!pw || pw.length < 4) { showToast('נדרשת סיסמה של 4-8 תווים'); return; }
      const ct = get(creatorToken);
      const { data } = await import('$lib/api/client').then(m => m.setPassword(trip.id, pw, ct));
      if (!data?.valid) { showToast('שגיאה בהגדרת סיסמה'); return; }
      trip.hasPassword = true;
      unlockedTrips.update((u) => ({ ...u, [trip.id]: pw }));
      showToast('סיסמה הוגדרה');
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
