<script lang="ts">
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import {
    modalState,
    currentTrip,
    creatorToken,
    unlockedTrips,
    gmapsLoaded,
    showToast
  } from '$lib/stores/app';
  import { updateTrip } from '$lib/api/client';
  import type { Trip, Waypoint } from '$lib/types';

  // --- Modal visibility ---
  let open = $state(false);
  let editingTripId: string | null = $state(null);
  let editingWpId: string | null = $state(null);
  let isEdit = $derived(!!editingWpId);

  // --- Form fields ---
  let wpName = $state('');
  let wpAddress = $state('');
  let wpPhone = $state('');
  let wpTime = $state('');
  let wpNotes = $state('');

  // --- Google data pulled ---
  let googleData: {
    lat: number | null;
    lng: number | null;
    rating: number | null;
    ratingsTotal: number | null;
    placeId: string | null;
  } | null = $state(null);
  let googlePreview = $state('');

  // --- Store subscription ---
  $effect(() => {
    const unsub = modalState.subscribe((s) => {
      if (s.waypointEditor && !open) {
        open = true;
        editingTripId = s.editingTripId;
        editingWpId = s.editingWaypointId;

        if (editingWpId && editingTripId) {
          loadWaypoint(editingTripId, editingWpId);
        } else {
          resetForm();
        }
      } else if (!s.waypointEditor && open) {
        open = false;
      }
    });
    return unsub;
  });

  function loadWaypoint(tripId: string, wpId: string) {
    const trip = get(currentTrip);
    if (!trip || trip.id !== tripId) return;
    const w = trip.waypoints.find((x) => x.id === wpId);
    if (!w) return;
    wpName = w.name || '';
    wpAddress = w.address || '';
    wpPhone = w.phone || '';
    wpTime = w.time || '';
    wpNotes = w.notes || '';
    googleData = null;
    googlePreview = '';
  }

  function resetForm() {
    wpName = '';
    wpAddress = '';
    wpPhone = '';
    wpTime = '';
    wpNotes = '';
    googleData = null;
    googlePreview = '';
  }

  function closeModal() {
    open = false;
    resetForm();
    modalState.update((s) => ({
      ...s,
      waypointEditor: false,
      editingTripId: null,
      editingWaypointId: null
    }));
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      closeModal();
    }
  }

  // --- Fetch Google details ---
  async function fetchGoogleDetails() {
    if (!browser) return;
    const gLoaded = get(gmapsLoaded);
    if (
      !gLoaded ||
      !(window as any).google?.maps?.places
    ) {
      showToast('Google Maps לא נטען - בדוק מפתח API');
      return;
    }

    const q = (wpName.trim() || '') + ' ' + (wpAddress.trim() || 'ישראל');
    if (q.trim().length < 2) {
      showToast('נא להזין שם מקום');
      return;
    }
    showToast('מחפש ב-Google Maps...');

    try {
      const { Place } = (window as any).google.maps.places;
      const { places } = await Place.searchByText({
        textQuery: q,
        fields: [
          'displayName',
          'formattedAddress',
          'nationalPhoneNumber',
          'location',
          'rating',
          'userRatingCount',
          'id'
        ],
        maxResultCount: 1
      });

      if (places && places[0]) {
        const p = places[0];
        if (p.id) {
          const det = new Place({ id: p.id });
          await det.fetchFields({
            fields: [
              'displayName',
              'formattedAddress',
              'nationalPhoneNumber',
              'location',
              'rating',
              'userRatingCount'
            ]
          });
          applyDetails(det);
        } else {
          applyDetails(p);
        }
      } else {
        showToast('לא נמצא ב-Google Maps');
      }
    } catch {
      showToast('שגיאה בחיפוש');
    }
  }

  function applyDetails(p: any) {
    if (p.displayName) wpName = p.displayName;
    if (p.formattedAddress) wpAddress = p.formattedAddress;
    if (p.nationalPhoneNumber) wpPhone = p.nationalPhoneNumber;

    googleData = {
      lat: p.location?.lat() || null,
      lng: p.location?.lng() || null,
      rating: p.rating || null,
      ratingsTotal: p.userRatingCount || null,
      placeId: p.id || null
    };

    let preview = wpName;
    if (p.rating) preview += ` | דירוג: ${p.rating}`;
    if (wpAddress) preview += ` | ${wpAddress}`;
    googlePreview = preview;

    showToast('פרטים נמשכו מ-Google Maps');
  }

  // --- Save ---
  async function handleSave() {
    if (!wpName.trim()) {
      showToast('נא להזין שם מקום');
      return;
    }
    if (!editingTripId) return;

    const trip = get(currentTrip);
    if (!trip || trip.id !== editingTripId) return;

    const gd = googleData || { lat: null, lng: null, rating: null, ratingsTotal: null, placeId: null };

    if (editingWpId) {
      // Edit existing waypoint
      const idx = trip.waypoints.findIndex((w) => w.id === editingWpId);
      if (idx < 0) return;

      const updated: Waypoint = {
        ...trip.waypoints[idx],
        name: wpName.trim(),
        address: wpAddress.trim(),
        phone: wpPhone.trim(),
        time: wpTime,
        notes: wpNotes.trim()
      };
      if (gd.lat) {
        updated.lat = gd.lat;
        updated.lng = gd.lng;
      }
      if (gd.rating !== null) {
        updated.rating = gd.rating;
        updated.ratingsTotal = gd.ratingsTotal;
        updated.placeId = gd.placeId;
      }
      trip.waypoints[idx] = updated;
    } else {
      // Add new waypoint
      const newWp: Waypoint = {
        id: 'w' + Date.now(),
        name: wpName.trim(),
        address: wpAddress.trim(),
        phone: wpPhone.trim(),
        time: wpTime,
        notes: wpNotes.trim(),
        lat: gd.lat,
        lng: gd.lng,
        rating: gd.rating,
        ratingsTotal: gd.ratingsTotal,
        placeId: gd.placeId
      };
      trip.waypoints = [...trip.waypoints, newWp];
    }

    // Save to API
    const ct = get(creatorToken);
    const cached = get(unlockedTrips);
    const pw = cached[trip.id] || undefined;
    const { data: result, error } = await updateTrip(trip, ct, pw);
    if (error) {
      showToast('שגיאה בשמירה');
      return;
    }

    // Update store
    if (result) {
      currentTrip.set(result);
    } else {
      currentTrip.set({ ...trip });
    }

    const label = wpName.trim();
    showToast(isEdit ? `"${label}" עודכן` : `"${label}" נוסף למסלול`);
    closeModal();

    // Geocode if no coordinates
    if (!gd.lat && browser) {
      geocodeWaypoint(
        trip.waypoints[trip.waypoints.length - 1] || trip.waypoints.find((w) => w.name === label),
        trip
      );
    }
  }

  async function geocodeWaypoint(wp: Waypoint | undefined, trip: Trip) {
    if (!wp) return;
    const q = wp.address || wp.name + ' ישראל';
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=il`,
        { headers: { 'Accept-Language': 'he', 'User-Agent': 'TiyulimYachad/1.0' } }
      );
      const d = await r.json();
      if (d.length) {
        wp.lat = parseFloat(d[0].lat);
        wp.lng = parseFloat(d[0].lon);
        // Re-save
        const ct = get(creatorToken);
        const cached = get(unlockedTrips);
        const pw = cached[trip.id] || undefined;
        const { data: result } = await updateTrip(trip, ct, pw);
        if (result) currentTrip.set(result);
      }
    } catch {
      // ignore
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay open" onclick={handleOverlayClick}>
    <div class="modal" style="direction:rtl;">
      <div class="modal-title">
        <span>
          <span class="ms">{isEdit ? 'edit_location' : 'add_location'}</span>
          {isEdit ? 'עריכת נקודת טיול' : 'הוסף נקודת טיול'}
        </span>
        <button class="modal-close" onclick={closeModal}>
          <span class="ms">close</span>
        </button>
      </div>

      <!-- Name -->
      <div class="form-group">
        <label>שם המקום *</label>
        <input type="text" bind:value={wpName} placeholder="למשל: נחל גמלא" />
      </div>

      <!-- Address -->
      <div class="form-group">
        <label>כתובת</label>
        <input type="text" bind:value={wpAddress} placeholder="כתובת לחיפוש / ניווט" />
      </div>

      <!-- Phone + Time -->
      <div class="form-row">
        <div class="form-group">
          <label>טלפון</label>
          <input type="tel" bind:value={wpPhone} placeholder="04-1234567" />
        </div>
        <div class="form-group">
          <label>שעה</label>
          <input type="time" bind:value={wpTime} />
        </div>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label>הערות</label>
        <textarea bind:value={wpNotes} placeholder="פרטים נוספים..." rows="2"></textarea>
      </div>

      <!-- Google button -->
      <button
        class="btn btn-ghost btn-full"
        style="margin-bottom:.8rem;"
        onclick={fetchGoogleDetails}
      >
        <span class="ms">travel_explore</span> משוך פרטים מ-Google Maps
      </button>

      <!-- Google preview -->
      {#if googlePreview}
        <div
          style="background:var(--teal-pale);border-radius:10px;padding:.7rem .9rem;margin-bottom:.8rem;font-size:.82rem;color:var(--teal-dark);"
        >
          {googlePreview}
        </div>
      {/if}

      <!-- Save -->
      <div class="btn-row">
        <button class="btn btn-primary btn-full" onclick={handleSave}>
          <span class="ms">check</span>
          {isEdit ? 'עדכן נקודה' : 'שמור נקודה'}
        </button>
      </div>
    </div>
  </div>
{/if}
