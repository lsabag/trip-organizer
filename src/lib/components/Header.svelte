<script lang="ts">
  import { drawerOpen } from '$lib/stores/app';

  let { onsearch }: { onsearch?: (query: string) => void } = $props();

  let searchValue = $state('');

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchValue = target.value;
    onsearch?.(searchValue);
  }

  function openDrawer() {
    drawerOpen.set(true);
  }
</script>

<header class="site-header">
  <div class="header-top">
    <button class="hamburger" onclick={openDrawer}>
      <span class="ms">menu</span>
    </button>
    <div class="search-bar">
      <span class="ms search-icon">search</span>
      <input
        id="search-input"
        type="search"
        placeholder="חפש טיול..."
        autocomplete="off"
        bind:value={searchValue}
        oninput={handleInput}
      />
    </div>
    <div class="logo">
      <span class="ms logo-icon">hiking</span>
      <div><span class="logo-plus">+</span>Tiyulim</div>
    </div>
  </div>
</header>
