<script lang="ts">
  import type { Trip } from '$lib/types';
  import { showToast, currentTrip, creatorToken } from '$lib/stores/app';
  import { saveParticipants } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { trip }: { trip: Trip } = $props();

  let step = $state(1);

  // Step 1 fields
  let name = $state('');
  let phone = $state('');
  let city = $state('');

  // Step 2 fields
  let hasCar = $state(false);
  let seats = $state(3);
  let carFrom = $state('');
  let carTo = $state('');
  let carNotes = $state('');
  let needRide = $state(false);
  let notes = $state('');

  function goToStep(s: number) {
    if (s === 2) {
      if (!name.trim() || !city.trim()) {
        showToast('נא למלא שם ועיר');
        return;
      }
    }
    step = s;
  }

  async function joinTrip() {
    if (!name.trim() || !city.trim()) {
      showToast('נא למלא שם ועיר');
      return;
    }
    if (phone.trim() && trip.participants.find((p) => p.phone === phone.trim())) {
      showToast('כבר נרשמת!');
      return;
    }
    const newPax = {
      id: 'p' + Date.now(),
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim(),
      hasCar,
      seats: hasCar ? seats : 0,
      carFrom: hasCar ? carFrom.trim() : '',
      carTo: hasCar ? carTo.trim() : '',
      carNotes: hasCar ? carNotes.trim() : '',
      needRide: !hasCar && needRide,
      assignedTo: null,
      notes: notes.trim()
    };
    trip.participants = [...trip.participants, newPax];
    const { error } = await saveParticipants(trip, get(creatorToken));
    if (error) {
      showToast('שגיאה בשמירה');
      return;
    }
    currentTrip.set({ ...trip });
    showToast(`${newPax.name} נרשם/ה לטיול!`);

    // Reset form
    name = '';
    phone = '';
    city = '';
    hasCar = false;
    seats = 3;
    carFrom = '';
    carTo = '';
    carNotes = '';
    needRide = false;
    notes = '';
    step = 1;
  }
</script>

<div class="join-section">
  <div class="js-title">
    <span class="ms">person_add</span> הצטרפות לטיול
  </div>

  <div class="join-steps">
    <span class="join-step" class:active={step === 1} class:done={step > 1}>1</span>
    <span class="join-step-line"></span>
    <span class="join-step" class:active={step === 2}>2</span>
  </div>

  {#if step === 1}
    <div>
      <div class="form-group">
        <label>שם מלא</label>
        <input type="text" placeholder="השם שלך" bind:value={name} />
      </div>
      <div class="form-group">
        <label>טלפון</label>
        <input type="tel" placeholder="050-..." bind:value={phone} />
      </div>
      <div class="form-group">
        <label>עיר מגורים</label>
        <input type="text" placeholder="מאיפה אתה?" bind:value={city} />
      </div>
      <button class="join-submit" onclick={() => goToStep(2)}>
        <span class="ms">arrow_back</span> המשך
      </button>
    </div>
  {/if}

  {#if step === 2}
    <div>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" bind:checked={hasCar} />
          <span class="slider"></span>
        </label>
        <span class="toggle-label">
          <span class="ms">directions_car</span> אני מגיע/ה עם רכב
        </span>
      </div>

      {#if hasCar}
        <div class="inset-box">
          <div class="form-group">
            <label>מקומות פנויים (מלבדך)</label>
            <input type="number" min="1" max="8" bind:value={seats} />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
            <div class="form-group">
              <label>יוצא מ-</label>
              <input type="text" bind:value={carFrom} />
            </div>
            <div class="form-group">
              <label>חוזר ל-</label>
              <input type="text" bind:value={carTo} />
            </div>
          </div>
          <div class="form-group">
            <label>הערות לגבי הנסיעה</label>
            <textarea rows="2" bind:value={carNotes}></textarea>
          </div>
        </div>
      {:else}
        <div class="toggle-row">
          <label class="toggle">
            <input type="checkbox" bind:checked={needRide} />
            <span class="slider"></span>
          </label>
          <span class="toggle-label">
            <span class="ms">volunteer_activism</span> אני מחפש/ת הסעה
          </span>
        </div>
      {/if}

      <div class="form-group" style="margin-top:.6rem;">
        <label>הערות (אופציונלי)</label>
        <textarea rows="2" placeholder="אלרגיות, בקשות מיוחדות..." bind:value={notes}></textarea>
      </div>

      <div style="display:flex;gap:.5rem;margin-top:.3rem;">
        <button
          class="join-submit"
          style="flex:1;background:transparent;border:1.5px solid rgba(255,255,255,.3);color:white;"
          onclick={() => goToStep(1)}
        >
          <span class="ms">arrow_forward</span> חזרה
        </button>
        <button
          class="join-submit"
          style="flex:1;background:var(--orange);color:white;"
          onclick={joinTrip}
        >
          <span class="ms">check</span> אני בפנים!
        </button>
      </div>
    </div>
  {/if}
</div>
