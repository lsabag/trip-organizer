<script lang="ts">
  let { participants, drivers, freeSeats, waypoints }: {
    participants: number;
    drivers: number;
    freeSeats: number;
    waypoints: number;
  } = $props();
</script>

<div class="summary-bar">
  <div class="summary-item">
    <div class="summary-icon teal"><span class="ms">group</span></div>
    <div class="summary-val">{participants}</div>
    <div class="summary-lbl">נרשמו</div>
  </div>
  <div class="summary-item">
    <div class="summary-icon orange"><span class="ms">directions_car</span></div>
    <div class="summary-val">{drivers}</div>
    <div class="summary-lbl">רכבים</div>
  </div>
  <div class="summary-item">
    <div class="summary-icon green"><span class="ms">event_seat</span></div>
    <div class="summary-val">{freeSeats}</div>
    <div class="summary-lbl">פנויים</div>
  </div>
  <div class="summary-item">
    <div class="summary-icon warm"><span class="ms">location_on</span></div>
    <div class="summary-val">{waypoints}</div>
    <div class="summary-lbl">נקודות</div>
  </div>
</div>
