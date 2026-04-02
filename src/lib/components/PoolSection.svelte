<script lang="ts">
  import type { Participant, Trip } from '$lib/types';
  import { ini, avc } from '$lib/utils/format';
  import { showToast, currentTrip, unlockedTrips } from '$lib/stores/app';
  import { assignParticipant, loadTrip, checkPassword } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { trip, unassigned, drivers }: {
    trip: Trip;
    unassigned: Participant[];
    drivers: Participant[];
  } = $props();

  // Track selected driver per passenger
  let selections: Record<string, string> = $state({});

  // Build driver options with free seats
  let driverOptions = $derived(
    drivers.map((d) => {
      const taken = trip.participants.filter((p) => p.assignedTo === d.id).length;
      const free = Math.max(0, d.seats - taken);
      return { id: d.id, name: d.name, free, disabled: free === 0 };
    })
  );

  // Determine empty-state scenario
  let emptyScenario = $derived.by(() => {
    if (unassigned.length > 0) return null; // not empty
    const nonDrivers = trip.participants.filter((p) => !p.hasCar);
    if (!nonDrivers.length) return 'no-passengers';
    if (!drivers.length) return 'no-drivers';
    return 'all-assigned';
  });

  let adminMap: Record<string,string> = $state({});
  $effect(() => { const unsub = unlockedTrips.subscribe(u => { adminMap = u; }); return unsub; });
  let isAdmin = $derived(!!adminMap[trip.id]);

  async function ensureAdmin(): Promise<boolean> {
    const cached = get(unlockedTrips);
    if (cached[trip.id]) return true;
    if (!trip.hasPassword) { showToast('רק מנהל הטיול יכול לשבץ'); return false; }
    const pw = prompt('הזן סיסמה לטיול');
    if (!pw) return false;
    const { data } = await checkPassword(trip.id, pw);
    if (!data?.valid) { showToast('סיסמה שגויה'); return false; }
    unlockedTrips.update(u => ({ ...u, [trip.id]: pw }));
    return true;
  }

  async function assignFromSelect(paxId: string) {
    const driverId = selections[paxId];
    if (!driverId) { showToast('בחר רכב'); return; }
    if (!await ensureAdmin()) return;
    const p = trip.participants.find((x) => x.id === paxId);
    const d = trip.participants.find((x) => x.id === driverId);
    if (!p || !d) return;
    const { data, error } = await assignParticipant(trip.id, paxId, driverId);
    if (error) {
      if (error.includes('full')) showToast('הרכב מלא!');
      else showToast('שגיאה');
      return;
    }
    const { data: fresh } = await loadTrip(trip.id);
    if (fresh) { trip = fresh; currentTrip.set(fresh); }
    showToast(`${p.name} שובץ לרכב של ${d.name}`);
  }
</script>

{#if emptyScenario}
  {#if emptyScenario === 'no-passengers'}
    <div class="empty-state">
      <div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--gray)">group</span></div>
      <p>ממתין למשתתפים ללא רכב</p>
    </div>
  {:else if emptyScenario === 'no-drivers'}
    <div class="empty-state">
      <div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--gray)">no_transfer</span></div>
      <p>אין ממתינים לשיבוץ</p>
    </div>
  {:else}
    <div class="empty-state">
      <div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--green)">done_all</span></div>
      <p>כולם שובצו לרכב!</p>
    </div>
  {/if}
{:else}
  <div class="pool-list">
    {#each unassigned as p (p.id)}
      <div class="pool-row">
        <div class="pax-av" style="background:{avc(p.id)}">{ini(p.name)}</div>
        <div class="pool-info">
          <div class="pool-name">{p.name}</div>
          <div class="pool-city">
            <span class="ms">location_on</span> {p.city}
            &nbsp;<span class="ms">phone</span> {p.phone}
          </div>
        </div>
        {#if drivers.length}
          <select
            class="assign-select"
            bind:value={selections[p.id]}
          >
            <option value="">בחר רכב...</option>
            {#each driverOptions as opt (opt.id)}
              <option value={opt.id} disabled={opt.disabled}>
                {opt.name} - {opt.free} מקומות
              </option>
            {/each}
          </select>
          <button class="assign-btn" onclick={() => assignFromSelect(p.id)}>שבץ</button>
        {:else}
          <span style="font-size:.76rem;color:var(--gray)">אין רכבים</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}
