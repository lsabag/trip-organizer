<script lang="ts">
  import type { Participant, Trip } from '$lib/types';
  import { ini, waNum } from '$lib/utils/format';
  import { AVC } from '$lib/utils/constants';
  import { showToast, currentTrip, unlockedTrips, adminToken } from '$lib/stores/app';
  import { removeParticipant, loadTrip, checkPassword, toggleParticipantCar } from '$lib/api/client';
  import { get } from 'svelte/store';

  let { participant, trip, index = 0 }: {
    participant: Participant;
    trip: Trip;
    index?: number;
  } = $props();

  let assignedDriver = $derived(
    participant.assignedTo
      ? trip.participants.find((x) => x.id === participant.assignedTo)
      : null
  );

  let bgColor = $derived(AVC[index % 8]);

  const waIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.236l-.44-.363-3.09 1.036 1.036-3.09-.363-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>`;

  let adminMap: Record<string,string> = $state({});
  let hasAdminToken = $state(false);
  $effect(() => { const unsub = unlockedTrips.subscribe(u => { adminMap = u; }); return unsub; });
  $effect(() => { const unsub = adminToken.subscribe(t => { hasAdminToken = !!t; }); return unsub; });
  let isAdmin = $derived(!!adminMap[trip.id] || hasAdminToken);

  async function removePax() {
    // Require password
    const cached = get(unlockedTrips);
    if (!cached[trip.id]) {
      if (!trip.hasPassword) { showToast('רק מנהל הטיול יכול להסיר משתתפים'); return; }
      const pw = prompt('הזן סיסמה לטיול');
      if (!pw) return;
      const { data } = await checkPassword(trip.id, pw);
      if (!data?.valid) { showToast('סיסמה שגויה'); return; }
      unlockedTrips.update(u => ({ ...u, [trip.id]: pw }));
    }
    if (!confirm(`להסיר את ${participant.name}?`)) return;
    const pName = participant.name;
    const { error } = await removeParticipant(trip.id, participant.id);
    if (error) { showToast('שגיאה'); return; }
    const { data: fresh } = await loadTrip(trip.id);
    if (fresh) { trip = fresh; currentTrip.set(fresh); }
    showToast(`${pName} הוסר`);
  }

  async function toggleCar() {
    const newHasCar = !participant.hasCar;
    const label = newHasCar ? 'נהג' : 'נוסע';
    if (!confirm(`לשנות את ${participant.name} ל${label}?`)) return;
    const { error } = await toggleParticipantCar(trip.id, participant.id, newHasCar);
    if (error) { showToast('שגיאה'); return; }
    const { data: fresh } = await loadTrip(trip.id);
    if (fresh) { trip = fresh; currentTrip.set(fresh); }
    showToast(`${participant.name} הפך ל${label}`);
  }
</script>

<div class="pax-row">
  <div class="pav" style="background:{bgColor}">{ini(participant.name)}</div>
  <div style="flex:1">
    <div class="p-name">{participant.name}</div>
    <div class="p-meta">
      <span class="ms">location_on</span> {participant.city}
      &nbsp;<span class="ms">phone</span> {participant.phone}
    </div>
    {#if participant.notes}
      <div class="p-meta">
        <span class="ms">chat_bubble</span> {participant.notes}
      </div>
    {/if}
    <div class="p-tags">
      {#if participant.hasCar}
        <span class="tag tag-car">
          <span class="ms">directions_car</span>
          נוהג | {participant.carFrom || participant.city} | {participant.seats} מקומות
        </span>
      {/if}
      {#if !participant.hasCar && participant.needRide && !participant.assignedTo}
        <span class="tag tag-ride">
          <span class="ms">volunteer_activism</span> ממתין
        </span>
      {/if}
      {#if !participant.hasCar && participant.needRide && participant.assignedTo}
        <span class="tag tag-assigned">
          <span class="ms">check</span>
          ברכב של {assignedDriver?.name || '?'}
        </span>
      {/if}
      {#if !participant.hasCar && !participant.needRide}
        <span class="tag tag-solo">
          <span class="ms">directions_walk</span> לבד
        </span>
      {/if}
    </div>
  </div>
  {#if participant.phone}
    <div class="pax-contacts" style="display:flex;gap:.25rem;flex-shrink:0;">
      <a
        class="pax-contact-btn"
        href="https://wa.me/{waNum(participant.phone)}"
        target="_blank"
      >
        {@html waIcon}
      </a>
      <a
        class="pax-contact-btn pax-call-btn"
        href="tel:{participant.phone}"
      >
        <span class="ms" style="font-size:.85rem">phone</span>
      </a>
    </div>
  {/if}
  {#if isAdmin}
    <button class="rm-btn" style="color:var(--teal-dark);border-color:var(--teal-light);" onclick={toggleCar} title={participant.hasCar ? 'הפוך לנוסע' : 'הפוך לנהג'}>
      <span class="ms">{participant.hasCar ? 'person' : 'directions_car'}</span>
    </button>
    <button class="rm-btn" onclick={removePax}>
      <span class="ms">close</span>
    </button>
  {/if}
</div>
