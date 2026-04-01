<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { loadAdminTrips, deleteTrip as apiDeleteTrip } from '$lib/api/client';
  import { adminToken as adminTokenStore, showToast } from '$lib/stores/app';
  import type { Trip } from '$lib/types';
  import { get } from 'svelte/store';
  import { esc } from '$lib/utils/format';

  let tokenInput = $state('');
  let loggedIn = $state(false);
  let trips: Trip[] = $state([]);
  let loading = $state(false);

  // Stats
  let totalPax = $derived(trips.reduce((s, t) => s + t.participants.length, 0));
  let publicCount = $derived(trips.filter((t) => !t.hidden).length);

  onMount(() => {
    const stored = get(adminTokenStore);
    if (stored) {
      tokenInput = stored;
      doLogin(stored);
    }
  });

  async function doLogin(token: string) {
    if (!token.trim()) {
      showToast('נא להזין טוקן');
      return;
    }
    loading = true;
    const { data, error } = await loadAdminTrips(token);
    loading = false;

    if (error || !data) {
      loggedIn = false;
      adminTokenStore.set('');
      if (browser) localStorage.removeItem('tiyulim_admin_token');
      showToast('טוקן שגוי');
      return;
    }

    loggedIn = true;
    trips = data;
    adminTokenStore.set(token);
    if (browser) localStorage.setItem('tiyulim_admin_token', token);
  }

  function handleLogin() {
    doLogin(tokenInput.trim());
  }

  async function refresh() {
    const token = get(adminTokenStore);
    loading = true;
    const { data } = await loadAdminTrips(token);
    loading = false;
    if (data) trips = data;
  }

  async function handleDeleteTrip(id: string) {
    if (!confirm('למחוק טיול זה?')) return;
    const token = get(adminTokenStore);
    await apiDeleteTrip(id, '', token);
    refresh();
    showToast('הטיול נמחק');
  }

  function viewTrip(id: string) {
    goto(`/trip/${id}`);
  }

  function goBack() {
    goto('/');
  }

  function handleLogout() {
    loggedIn = false;
    trips = [];
    tokenInput = '';
    adminTokenStore.set('');
    if (browser) localStorage.removeItem('tiyulim_admin_token');
  }
</script>

<div class="container" style="direction:rtl;">
  {#if !loggedIn}
    <!-- Login -->
    <div style="max-width:400px;margin:3rem auto;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:1rem;"><span class="ms">admin_panel_settings</span></div>
      <h2 class="section-heading" style="text-align:center;margin-bottom:1.5rem;">ניהול טיולים</h2>
      <div class="form-group">
        <label>טוקן מנהל</label>
        <input
          type="password"
          bind:value={tokenInput}
          placeholder="הזן טוקן מנהל..."
          onkeydown={(e) => { if (e.key === 'Enter') handleLogin(); }}
        />
      </div>
      <button class="btn btn-primary btn-full" onclick={handleLogin} disabled={loading}>
        {#if loading}טוען...{:else}<span class="ms">login</span> כניסה{/if}
      </button>
      <button class="btn btn-ghost" style="margin-top:.8rem;" onclick={goBack}>
        <span class="ms">arrow_forward</span> חזרה
      </button>
    </div>
  {:else}
    <!-- Admin Content -->
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem;">
      <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
        <div style="font-size:1.5rem;font-weight:900;color:var(--teal);">{trips.length}</div>
        <div style="font-size:.78rem;color:var(--gray);">טיולים</div>
      </div>
      <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
        <div style="font-size:1.5rem;font-weight:900;color:var(--orange);">{totalPax}</div>
        <div style="font-size:.78rem;color:var(--gray);">משתתפים</div>
      </div>
      <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
        <div style="font-size:1.5rem;font-weight:900;color:var(--green);">{publicCount}</div>
        <div style="font-size:.78rem;color:var(--gray);">ציבוריים</div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;">
      <span style="font-weight:700;color:var(--dark);">כל הטיולים</span>
      <div style="display:flex;gap:.5rem;">
        <button class="btn btn-ghost btn-sm" onclick={refresh}>
          <span class="ms">refresh</span> רענן
        </button>
        <button class="btn btn-ghost btn-sm" onclick={handleLogout}>
          <span class="ms">logout</span> יציאה
        </button>
        <button class="btn btn-ghost btn-sm" onclick={goBack}>
          <span class="ms">arrow_forward</span> חזרה
        </button>
      </div>
    </div>

    {#if trips.length === 0}
      <div style="text-align:center;padding:2rem;color:var(--gray);">אין טיולים עדיין</div>
    {:else}
      {#each trips as t (t.id)}
        <div style="background:white;border-radius:12px;padding:.8rem 1rem;margin-bottom:.65rem;box-shadow:var(--card-shadow);display:flex;align-items:center;gap:.8rem;">
          <div style="width:55px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;">
            {#if t.image}
              <img src={t.image} alt={t.name} style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
            {:else}
              <div style="width:100%;height:100%;background:#eef2f5;"></div>
            {/if}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:.9rem;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {t.name}
              {#if t.hidden}
                <span style="background:#fff3e0;color:var(--orange-dark);font-size:.68rem;padding:.1rem .4rem;border-radius:4px;font-weight:600;">פרטי</span>
              {/if}
            </div>
            <div style="font-size:.75rem;color:var(--gray);">
              {t.date || '—'} | {t.participants.length} משתתפים | {t.waypoints.length} נקודות
            </div>
          </div>
          <div style="display:flex;gap:.3rem;flex-shrink:0;">
            <button
              style="background:var(--teal-pale);border:none;border-radius:8px;padding:.35rem .5rem;cursor:pointer;color:var(--teal-dark);"
              onclick={() => viewTrip(t.id)}
            >
              <span class="ms" style="font-size:1rem;">visibility</span>
            </button>
            <button
              style="background:#ffebee;border:none;border-radius:8px;padding:.35rem .5rem;cursor:pointer;color:#c62828;"
              onclick={() => handleDeleteTrip(t.id)}
            >
              <span class="ms" style="font-size:1rem;">delete</span>
            </button>
          </div>
        </div>
      {/each}
    {/if}
  {/if}
</div>
