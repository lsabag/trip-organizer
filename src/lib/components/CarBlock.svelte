<script lang="ts">
  import type { Participant, Trip } from '$lib/types';
  import { ini, waNum, avc } from '$lib/utils/format';
  import { showToast, currentTrip, creatorToken } from '$lib/stores/app';
  import { saveParticipants } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { driver, trip }: { driver: Participant; trip: Trip } = $props();

  let assigned = $derived(trip.participants.filter((p) => p.assignedTo === driver.id));
  let freeCount = $derived(Math.max(0, driver.seats - assigned.length));

  // Build seats array for display
  let seatIcons = $derived.by(() => {
    const arr: Array<{ type: string }> = [{ type: 'drv' }];
    for (let i = 0; i < assigned.length; i++) arr.push({ type: 'occ' });
    for (let i = 0; i < freeCount; i++) arr.push({ type: 'free' });
    return arr;
  });

  let unassigned = $derived(
    trip.participants.filter((p) => !p.hasCar && p.needRide && !p.assignedTo)
  );

  async function unassignPax(paxId: string) {
    const p = trip.participants.find((x) => x.id === paxId);
    if (!p) return;
    p.assignedTo = null;
    const { error } = await saveParticipants(trip, get(creatorToken));
    if (error) { showToast('שגיאה בשמירה'); return; }
    currentTrip.set({ ...trip });
    showToast(`${p.name} הוסר מהרכב`);
  }

  const waIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.236l-.44-.363-3.09 1.036 1.036-3.09-.363-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>`;

  async function assignPax(paxId: string) {
    if (freeCount <= 0) { showToast('הרכב מלא!'); return; }
    const p = trip.participants.find((x) => x.id === paxId);
    if (!p) return;
    p.assignedTo = driver.id;
    const { error } = await saveParticipants(trip, get(creatorToken));
    if (error) { showToast('שגיאה בשמירה'); return; }
    currentTrip.set({ ...trip });
    showToast(`${p.name} שובץ לרכב של ${driver.name}`);
  }
</script>

<div class="car-block">
  <div class="car-top">
    <div class="car-avatar"><span class="ms">directions_car</span></div>
    <div style="flex:1;">
      <div class="car-name">{driver.name}</div>
      <div class="car-route">
        <span class="ms" style="font-size:.78rem">home</span>
        {driver.city}
        &nbsp;|&nbsp;
        {driver.carFrom || '?'} &larr; {driver.carTo || driver.carFrom || '?'}
      </div>
      {#if driver.carNotes}
        <div class="car-route">
          <span class="ms" style="font-size:.78rem">chat_bubble</span>
          {driver.carNotes}
        </div>
      {/if}
    </div>
    <div class="car-contacts">
      {#if driver.phone}
        <a
          class="car-contact wa"
          href="https://wa.me/{waNum(driver.phone)}"
          target="_blank"
          title="וואטסאפ לנהג"
        >
          {@html waIcon}
        </a>
        <a class="car-contact call" href="tel:{driver.phone}" title="חיוג לנהג">
          <span class="ms" style="font-size:.85rem">phone</span>
        </a>
      {/if}
    </div>
  </div>

  <div class="seats">
    <span class="seats-lbl">מקומות:</span>
    {#each seatIcons as s}
      <div class="seat {s.type}">
        <span class="ms">{s.type === 'free' ? 'event_seat' : 'person'}</span>
      </div>
    {/each}
  </div>

  <div class="car-passengers">
    {#if assigned.length === 0 && !(freeCount > 0 && unassigned.length > 0)}
      <div class="car-empty">אין נוסעים משובצים</div>
    {/if}

    {#each assigned as p (p.id)}
      <div class="car-pax">
        <div class="car-pax-av" style="background:{avc(p.id)}">{ini(p.name)}</div>
        <div class="car-pax-name">{p.name}</div>
        <div class="car-pax-city">{p.city}</div>
        <button class="unassign-btn" onclick={() => unassignPax(p.id)}>
          <span class="ms">close</span>
        </button>
      </div>
    {/each}

    {#if freeCount > 0}
      {#each unassigned as p (p.id)}
        <div class="suggest-row">
          <div class="pax-av" style="background:#e8f5e9;font-size:.68rem;font-weight:700;color:#2ecc71">
            {p.city.slice(0, 3)}
          </div>
          <div style="flex:1">
            <div class="pax-name2" style="color:var(--gray)">{p.name}</div>
            <div class="pax-city2">
              <span class="ms">location_on</span> {p.city}
            </div>
          </div>
          <button class="add-btn" onclick={() => assignPax(p.id)}>
            <span class="ms">add</span> שבץ
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>
