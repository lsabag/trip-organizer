<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import {
    modalState,
    creatorToken,
    unlockedTrips,
    currentTrip,
    trips as tripsStore,
    gmapsLoaded,
    showToast
  } from '$lib/stores/app';
  import {
    createTrip,
    updateTrip,
    deleteTrip as apiDeleteTrip,
    loadTrip
  } from '$lib/api/client';
  import { TRIP_IMAGES } from '$lib/utils/constants';
  import type { Trip, Waypoint } from '$lib/types';

  // --- Modal visibility ---
  let open = $state(false);
  let editingId: string | null = $state(null);
  let isEdit = $derived(!!editingId);

  // --- Form fields ---
  let name = $state('');
  let date = $state('');
  let time = $state('08:00');
  let meeting = $state('');
  let desc = $state('');
  let password = $state('');
  let isPrivate = $state(false);
  let imageUrl = $state('');
  let selectedImage = $state(TRIP_IMAGES[0]);
  let cropY = $state(50);
  let zoom = $state(100);

  // --- Waypoint editor items ---
  interface WpEditorItem {
    tempId: string;
    name: string;
    address: string;
    phone: string;
    notes: string;
    existingData: Waypoint | null;
  }
  let wpItems: WpEditorItem[] = $state([]);

  // --- Derived ---
  let finalImage = $derived(imageUrl.trim() || selectedImage);
  let zoomStyle = $derived(
    zoom > 100
      ? `transform:scale(${zoom / 100});transform-origin:center ${cropY}%;object-fit:cover;`
      : 'object-fit:cover;'
  );

  // --- Store subscription ---
  $effect(() => {
    const unsub = modalState.subscribe((s) => {
      if (s.tripEditor && !open) {
        open = true;
        editingId = s.editingTripId;
        if (editingId) {
          loadEditTrip(editingId);
        } else {
          resetForm();
        }
      } else if (!s.tripEditor && open) {
        open = false;
        editingId = null;
      }
    });
    return unsub;
  });

  // Track gmapsLoaded reactively
  let mapsReady = $state(false);
  $effect(() => {
    const unsub = gmapsLoaded.subscribe(v => { mapsReady = v; });
    return unsub;
  });

  // Attach Google Places Autocomplete to meeting field
  let meetingAcAttached = false;
  $effect(() => {
    if (open && browser && !meetingAcAttached && mapsReady) {
      if ((window as any).google?.maps?.places) {
        setTimeout(() => {
          const input = document.getElementById('trip-meeting-input') as HTMLInputElement;
          if (!input) return;
          try {
            new (window as any).google.maps.places.Autocomplete(input, {
              componentRestrictions: { country: 'il' },
              fields: ['formatted_address', 'geometry']
            });
            meetingAcAttached = true;
          } catch {}
        }, 300);
      }
    }
    if (!open) meetingAcAttached = false;
  });

  async function loadEditTrip(id: string) {
    const { data: tripData } = await loadTrip(id);
    if (!tripData) {
      showToast('שגיאה בטעינת טיול');
      closeModal();
      return;
    }
    name = tripData.name || '';
    date = tripData.date || '';
    time = tripData.time || '08:00';
    meeting = tripData.meeting || '';
    desc = tripData.desc || tripData.description || '';
    isPrivate = !!tripData.hidden;
    password = '';

    // Image
    if (tripData.image && !TRIP_IMAGES.includes(tripData.image)) {
      imageUrl = tripData.image;
    } else {
      imageUrl = '';
    }
    selectedImage = tripData.image || TRIP_IMAGES[0];
    cropY = tripData.cropY != null ? tripData.cropY : 50;
    zoom = tripData.zoom != null ? tripData.zoom : 100;

    // Waypoints
    wpItems = (tripData.waypoints || []).map((w) => ({
      tempId: 'wpe_' + Math.random().toString(36).substr(2, 8),
      name: w.name || '',
      address: w.address || '',
      phone: w.phone || '',
      notes: w.notes || '',
      existingData: w
    }));
  }

  function resetForm() {
    name = '';
    date = '';
    time = '08:00';
    meeting = '';
    desc = '';
    password = '';
    isPrivate = false;
    imageUrl = '';
    selectedImage = TRIP_IMAGES[0];
    cropY = 50;
    zoom = 100;
    wpItems = [];
  }

  function closeModal() {
    open = false;
    editingId = null;
    resetForm();
    modalState.update((s) => ({ ...s, tripEditor: false, editingTripId: null }));
  }

  function handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      closeModal();
    }
  }

  // --- Image picker ---
  function selectImage(url: string) {
    selectedImage = url;
    imageUrl = '';
  }

  function autoSelectImage() {
    if (!name.trim()) return;
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    selectedImage = TRIP_IMAGES[h % TRIP_IMAGES.length];
  }

  // --- Waypoint editor ---
  function moveWpItem(index: number, dir: number) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= wpItems.length) return;
    const arr = [...wpItems];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    wpItems = arr;
  }

  function addWpItem() {
    wpItems = [
      ...wpItems,
      {
        tempId: 'wpe_' + Math.random().toString(36).substr(2, 8),
        name: '',
        address: '',
        phone: '',
        notes: '',
        existingData: null
      }
    ];
  }

  function removeWpItem(tempId: string) {
    wpItems = wpItems.filter((w) => w.tempId !== tempId);
  }

  function collectWaypoints(): Waypoint[] {
    let nextId = Date.now();
    return wpItems
      .filter((w) => w.name.trim())
      .map((w) => {
        const ed = w.existingData;
        return {
          id: ed?.id || 'w' + nextId++,
          name: w.name.trim(),
          address: w.address.trim(),
          phone: w.phone.trim(),
          time: ed?.time || '',
          notes: w.notes.trim(),
          lat: ed?.lat || null,
          lng: ed?.lng || null,
          rating: ed?.rating || null,
          ratingsTotal: ed?.ratingsTotal || null,
          placeId: ed?.placeId || null
        };
      });
  }

  // --- Save ---
  async function handleSave() {
    if (!name.trim() || !date) {
      showToast('נא למלא שם ותאריך');
      return;
    }

    const ct = get(creatorToken);
    const waypoints = collectWaypoints();

    if (isEdit && editingId) {
      // Update existing trip
      const cached = get(unlockedTrips);
      const pw = cached[editingId] || undefined;

      const tripData: Trip = {
        id: editingId,
        name: name.trim(),
        date,
        time,
        meeting: meeting.trim(),
        desc: desc.trim(),
        image: finalImage,
        cropY,
        zoom,
        hidden: isPrivate,
        hasPassword: true,
        status: 'open',
        participants: [],
        waypoints
      };

      // Merge participants from existing trip
      const current = get(currentTrip);
      if (current && current.id === editingId) {
        tripData.participants = current.participants;
      }

      const { data: result, error } = await updateTrip(tripData, ct, pw);
      if (error) {
        showToast('שגיאה בשמירה: ' + error);
        return;
      }

      // Update stores
      if (result) {
        currentTrip.set(result);
      }

      showToast('הטיול עודכן');
      closeModal();
    } else {
      // Create new trip
      if (!password || password.length < 4) {
        showToast('נא להזין סיסמה (4-8 תווים)');
        return;
      }

      const tripData: Partial<Trip> & { password?: string } = {
        name: name.trim(),
        date,
        time,
        meeting: meeting.trim(),
        desc: desc.trim(),
        image: finalImage,
        cropY,
        zoom,
        hidden: isPrivate,
        status: 'open',
        participants: [],
        waypoints
      };

      const { data: result, error } = await createTrip(tripData, ct, password);
      if (error) {
        showToast('שגיאה ביצירת טיול: ' + error);
        return;
      }

      if (result?.id) {
        unlockedTrips.update((u) => ({ ...u, [result.id]: password }));
        showToast(isPrivate ? 'טיול פרטי נוצר! שתפו קישור ישיר' : 'הטיול פורסם!');
        closeModal();
        goto(`/trip/${result.id}`);
      }
    }
  }

  // --- Delete ---
  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('בטוח למחוק את הטיול לצמיתות?')) return;

    const ct = get(creatorToken);
    const cached = get(unlockedTrips);
    const pw = cached[editingId] || undefined;

    await apiDeleteTrip(editingId, ct, pw);
    showToast('הטיול נמחק');
    closeModal();
    goto('/');
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay open" onclick={handleOverlayClick}>
    <div class="modal" style="direction:rtl;">
      <div class="modal-title">
        <span>
          <span class="ms">{isEdit ? 'edit' : 'add'}</span>
          {isEdit ? 'עריכת טיול' : 'פרסום טיול חדש'}
        </span>
        <button class="modal-close" onclick={closeModal}>
          <span class="ms">close</span>
        </button>
      </div>

      <!-- Name -->
      <div class="form-group">
        <label>שם הטיול *</label>
        <input
          type="text"
          bind:value={name}
          placeholder="למשל: טיול בגולן"
          onblur={autoSelectImage}
        />
      </div>

      <!-- Date + Time -->
      <div class="form-row">
        <div class="form-group">
          <label>תאריך *</label>
          <input type="date" bind:value={date} />
        </div>
        <div class="form-group">
          <label>שעת יציאה</label>
          <input type="time" bind:value={time} />
        </div>
      </div>

      <!-- Meeting point -->
      <div class="form-group">
        <label>נקודת מפגש</label>
        <input id="trip-meeting-input" type="text" bind:value={meeting} placeholder="חניון, כיכר..." autocomplete="off" />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label>תיאור</label>
        <textarea bind:value={desc} placeholder="תיאור קצר של הטיול..." rows="3"></textarea>
      </div>

      <!-- Image picker -->
      <div class="form-group">
        <label>תמונת שער</label>
        <div class="img-picker">
          {#each TRIP_IMAGES as img}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="img-picker-item"
              class:selected={img === selectedImage && !imageUrl.trim()}
              onclick={() => selectImage(img)}
            >
              <img src={img} alt="trip" loading="lazy" />
            </div>
          {/each}
        </div>
      </div>

      <!-- Custom URL -->
      <div class="form-group">
        <label>או כתובת תמונה חיצונית</label>
        <input type="url" bind:value={imageUrl} placeholder="https://..." dir="ltr" />
      </div>

      <!-- Crop preview (matches trip-hero exactly) -->
      {#if finalImage}
        <div class="form-group">
          <div
            style="height:200px;border-radius:0 0 16px 16px;overflow:hidden;margin:-1.7rem -1.7rem 0.8rem;position:relative;"
          >
            <img
              src={finalImage}
              alt="תצוגה מקדימה"
              style="width:100%;height:100%;object-fit:cover;object-position:center {cropY}%;{zoomStyle}"
            />
            <div style="position:absolute;inset:0;background:linear-gradient(160deg,transparent 30%,rgba(13,27,42,.75) 100%);"></div>
            <div style="position:absolute;bottom:.8rem;right:1rem;color:white;font-family:'Fredoka','Heebo',sans-serif;font-size:1.2rem;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.3);">
              {name || 'שם הטיול'}
            </div>
          </div>
          <div style="display:flex;gap:1rem;align-items:center;">
            <div style="flex:1;">
              <label style="font-size:.75rem;"><span class="ms" style="font-size:.8rem;">crop</span> חיתוך: {cropY}%</label>
              <input
                type="range"
                min="0"
                max="100"
                bind:value={cropY}
                style="width:100%;accent-color:var(--teal);"
              />
            </div>
            <div style="flex:1;">
              <label style="font-size:.75rem;"><span class="ms" style="font-size:.8rem;">zoom_in</span> זום: {zoom}%</label>
              <input
                type="range"
                min="100"
                max="250"
                bind:value={zoom}
                style="width:100%;accent-color:var(--orange);"
              />
            </div>
          </div>
        </div>
      {/if}

      <!-- Waypoints editor -->
      <div class="form-group">
        <label><span class="ms">location_on</span> נקודות מסלול</label>

        {#each wpItems as wp, i (wp.tempId)}
          <div class="wp-editor-item">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem;">
              <span style="font-weight:700;font-size:.83rem;color:var(--dark);">
                <span class="ms">add_location</span> נקודה {i + 1}
              </span>
              <div style="display:flex;gap:.2rem;">
                {#if i > 0}
                  <button class="wp-edit-btn up" type="button" onclick={() => moveWpItem(i, -1)}>
                    <span class="ms">arrow_upward</span>
                  </button>
                {/if}
                {#if i < wpItems.length - 1}
                  <button class="wp-edit-btn down" type="button" onclick={() => moveWpItem(i, 1)}>
                    <span class="ms">arrow_downward</span>
                  </button>
                {/if}
                <button class="wp-edit-btn del" type="button" onclick={() => removeWpItem(wp.tempId)}>
                  <span class="ms">close</span>
                </button>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:.45rem">
              <input
                type="text"
                placeholder="שם המקום *"
                bind:value={wp.name}
              />
            </div>
            <div class="form-row">
              <div class="form-group" style="margin-bottom:.45rem">
                <input
                  type="text"
                  placeholder="כתובת לחיפוש"
                  bind:value={wp.address}
                />
              </div>
              <div class="form-group" style="margin-bottom:.45rem">
                <input
                  type="tel"
                  placeholder="טלפון"
                  bind:value={wp.phone}
                />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:0">
              <textarea
                placeholder="הערות"
                rows="1"
                bind:value={wp.notes}
                style="min-height:38px"
              ></textarea>
            </div>
          </div>
        {/each}

        <button class="btn btn-ghost btn-sm" type="button" style="margin-top:.5rem;" onclick={addWpItem}>
          <span class="ms">add</span> הוסף נקודה
        </button>
      </div>

      <!-- Password -->
      <div class="form-group">
        <label>{isEdit ? 'שינוי סיסמה (השאר ריק לשמירת הקיימת)' : 'סיסמת עריכה * (4-8 תווים)'}</label>
        <input
          type="password"
          bind:value={password}
          placeholder={isEdit ? 'סיסמה חדשה (אופציונלי)' : 'סיסמה לעריכת הטיול'}
          maxlength="8"
        />
      </div>

      <!-- Private toggle -->
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" bind:checked={isPrivate} />
          <span class="slider"></span>
        </label>
        <span class="toggle-label">
          <span class="ms">visibility_off</span> טיול פרטי (גלוי רק דרך קישור)
        </span>
      </div>

      <!-- Buttons -->
      <div class="btn-row">
        <button class="btn btn-primary btn-full" onclick={handleSave}>
          <span class="ms">{isEdit ? 'save' : 'send'}</span>
          {isEdit ? 'שמור שינויים' : 'פרסם טיול'}
        </button>
      </div>

      {#if isEdit}
        <div style="margin-top:1rem;padding-top:.8rem;border-top:1px solid #eef2f5;">
          <button class="btn btn-full" style="background:#ffebee;color:#c62828;" onclick={handleDelete}>
            <span class="ms">delete</span> מחק טיול
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
