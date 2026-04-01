<script lang="ts">
  import { drawerOpen, modalState } from '$lib/stores/app';
  import { goto } from '$app/navigation';

  let isOpen = $derived($drawerOpen);

  function close() {
    drawerOpen.set(false);
  }

  function goHome() {
    goto('/');
    close();
  }

  function findTrip() {
    goto('/');
    close();
    setTimeout(() => {
      const inp = document.getElementById('search-input') as HTMLInputElement | null;
      if (inp) {
        inp.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }

  function createTrip() {
    modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: null }));
    close();
  }

  function goAdmin() {
    goto('/admin');
    close();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="nav-drawer-overlay"
  class:open={isOpen}
  onclick={close}
></div>

<div class="nav-drawer" class:open={isOpen}>
  <div class="nav-drawer-header">
    <span class="ms nav-drawer-logo">hiking</span>
    <span class="nav-drawer-title">+Tiyulim</span>
    <button class="nav-drawer-close" onclick={close}>
      <span class="ms">close</span>
    </button>
  </div>
  <div class="nav-drawer-items">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="nav-drawer-item" onclick={goHome}>
      <span class="ms">home</span> דף הבית
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="nav-drawer-item" onclick={findTrip}>
      <span class="ms">explore</span> מצא טיול
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="nav-drawer-item" onclick={createTrip}>
      <span class="ms">add_circle</span> פרסם טיול
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="nav-drawer-item" onclick={goAdmin}>
      <span class="ms">admin_panel_settings</span> ניהול
    </div>
  </div>
</div>
