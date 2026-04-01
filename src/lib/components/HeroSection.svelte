<script lang="ts">
  import { modalState } from '$lib/stores/app';

  function scrollToGrid() {
    const grid = document.getElementById('trips-grid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth' });
  }

  function openCreateTrip() {
    modalState.update((s) => ({ ...s, tripEditor: true, editingTripId: null }));
  }
</script>

<section class="hero" id="hero-section">
  <div class="hero-bg"></div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <div class="hero-title">צאו <span>לטייל!</span><br>יחד בישראל</div>
    <div class="hero-sub">מצאו טיולים, הצטרפו לנסיעות משותפות והכירו חברים חדשים</div>
    <div class="hero-btns">
      <button class="hero-btn hero-btn-primary" onclick={scrollToGrid}>
        <span class="ms">explore</span> מצא טיול והצטרף
      </button>
      <button class="hero-btn hero-btn-secondary" onclick={openCreateTrip}>
        <span class="ms">add</span> פרסם טיול חדש
      </button>
    </div>
  </div>
</section>
