<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { modalState } from '$lib/stores/app';

  let currentPath = $derived(page.url.pathname);
  let activeItem = $derived<'home' | 'publish' | 'search'>(
    currentPath === '/' ? 'home' : 'home'
  );

  function goHome() {
    goto('/');
  }

  function openPublish() {
    modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: null }));
  }

  function focusSearch() {
    goto('/');
    setTimeout(() => {
      const inp = document.getElementById('search-input') as HTMLInputElement | null;
      if (inp) {
        inp.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }
</script>

<nav class="bottom-nav">
  <button class="bnav-item" class:active={activeItem === 'home'} onclick={goHome}>
    <span class="bnav-icon"><span class="ms">home</span></span>
    <span class="bnav-label">דף הבית</span>
  </button>
  <button class="bnav-item" class:active={activeItem === 'publish'} onclick={openPublish}>
    <span class="bnav-icon"><span class="ms">add_circle</span></span>
    <span class="bnav-label">פרסם</span>
  </button>
  <button class="bnav-item" class:active={activeItem === 'search'} onclick={focusSearch}>
    <span class="bnav-icon"><span class="ms">search</span></span>
    <span class="bnav-label">חיפוש</span>
  </button>
</nav>
