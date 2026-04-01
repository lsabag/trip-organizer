<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { Trip, Waypoint } from '$lib/types';
  import { gmapsKey, gmapsLoaded, showToast } from '$lib/stores/app';
  import { get } from 'svelte/store';
  import { haversine, starsHTML, num, esc } from '$lib/utils/format';

  let { trip }: { trip: Trip } = $props();

  // Local map state
  let mapEl: HTMLDivElement | undefined = $state();
  let gmapsMap: any = $state(null);
  let leafletMap: any = $state(null);
  let userMarker: any = null;
  let directionsRenderer: any = null;
  let nextWpIndex = $state(-1);
  let nextStopText = $state('');
  let nextStopVisible = $state(false);

  // Watcher for geolocation
  let watchId: number | null = null;

  // Cleanup on destroy
  onDestroy(() => {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }
    gmapsMap = null;
    userMarker = null;
    directionsRenderer = null;
  });

  // Load and init on mount
  onMount(() => {
    if (!browser || !mapEl) return;
    initMap();
  });

  // Re-init map when trip waypoints change
  let prevWpJson = '';
  $effect(() => {
    const json = JSON.stringify(trip.waypoints.map(w => ({ lat: w.lat, lng: w.lng, id: w.id })));
    if (json !== prevWpJson && prevWpJson !== '') {
      prevWpJson = json;
      // Clean up and reinit
      if (leafletMap) { leafletMap.remove(); leafletMap = null; }
      gmapsMap = null;
      userMarker = null;
      directionsRenderer = null;
      nextWpIndex = -1;
      nextStopVisible = false;
      if (mapEl) initMap();
    } else {
      prevWpJson = json;
    }
  });

  /* ====== Wait for Google Maps (loaded by layout) ====== */
  function waitForGoogleMaps(): Promise<void> {
    return new Promise((resolve) => {
      if (get(gmapsLoaded) && (window as any).google?.maps) {
        resolve();
        return;
      }
      // Wait for layout to finish loading the script
      const unsub = gmapsLoaded.subscribe((loaded) => {
        if (loaded && (window as any).google?.maps) {
          unsub();
          resolve();
        }
      });
      // Timeout after 10s — fall back to Leaflet
      setTimeout(() => { unsub(); resolve(); }, 10000);
    });
  }

  /* ====== Map Init Dispatcher ====== */
  function initMap() {
    const key = get(gmapsKey);
    if (key && get(gmapsLoaded) && window.google?.maps) {
      initGoogleMap();
    } else if (key) {
      waitForGoogleMaps()
        .then(() => {
          if ((window as any).google?.maps) initGoogleMap();
          else initLeafletMap();
        });
    } else {
      initLeafletMap();
    }
  }

  /* ====== Google Maps Init ====== */
  function initGoogleMap() {
    if (!mapEl) return;
    const wps = trip.waypoints.filter(w => w.lat && w.lng);
    const center = wps.length ? { lat: wps[0].lat!, lng: wps[0].lng! } : { lat: 31.5, lng: 34.9 };
    const zoom = wps.length > 1 ? 10 : 14;

    gmapsMap = new google.maps.Map(mapEl, {
      center,
      zoom,
      mapTypeId: 'roadmap',
      mapId: 'trip-organizer',
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: false,
      zoomControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM }
    });

    const bounds = new google.maps.LatLngBounds();

    wps.forEach((w, i) => {
      const pos = { lat: w.lat!, lng: w.lng! };
      bounds.extend(pos);

      const isNext = i === nextWpIndex;
      const bgColor = isNext ? '#0096b7' : '#00b4d8';
      const pin = document.createElement('div');
      pin.style.cssText = `width:32px;height:32px;border-radius:50%;background:${bgColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);font-family:Heebo,sans-serif;`;
      pin.textContent = String(i + 1);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: pos,
        map: gmapsMap,
        content: pin,
        title: w.name,
        zIndex: 100 - i
      });

      // Info window content
      const ratingHTML = w.rating
        ? `<div style="margin-top:4px">${starsHTML(w.rating)} <b>${w.rating}</b> <span style="color:#888;font-size:.78rem">(${num(w.ratingsTotal)})</span></div>`
        : '';
      const gmapsLink = w.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${w.placeId}`
        : `https://www.google.com/maps/search/${encodeURIComponent(w.name + ' ' + w.address)}`;
      const infoContent = `<div style="font-family:Heebo,sans-serif;direction:rtl;min-width:200px;padding:4px;">
        <b style="font-size:.95rem;color:#1a2332">${esc(w.name)}</b>${ratingHTML}
        ${w.time ? `<div style="font-size:.8rem;color:#888;margin-top:2px">${w.time}</div>` : ''}
        ${w.notes ? `<div style="font-size:.8rem;color:#555;margin-top:3px;font-style:italic">${esc(w.notes)}</div>` : ''}
        ${w.phone ? `<div style="margin-top:6px"><a href="tel:${esc(w.phone)}" style="color:#0096b7;font-size:.82rem;font-weight:700">${esc(w.phone)}</a></div>` : ''}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}" target="_blank" style="background:#e8f5e9;color:#1b5e20;padding:3px 8px;border-radius:6px;font-size:.78rem;font-weight:700;text-decoration:none">נווט</a>
          <a href="${gmapsLink}" target="_blank" style="background:#fff8e1;color:#e65100;padding:3px 8px;border-radius:6px;font-size:.78rem;font-weight:700;text-decoration:none">ביקורות</a>
        </div></div>`;

      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addEventListener('gmp-click', () => infoWindow.open({ map: gmapsMap, anchor: marker }));

      // Fetch place rating
      fetchPlaceRating(w);
    });

    // Polyline
    if (wps.length >= 2) {
      new google.maps.Polyline({
        path: wps.map(w => ({ lat: w.lat!, lng: w.lng! })),
        geodesic: true,
        strokeColor: '#00b4d8',
        strokeOpacity: 0.85,
        strokeWeight: 3,
        map: gmapsMap
      });
    }

    if (wps.length > 1) gmapsMap.fitBounds(bounds, { padding: 50 });
  }

  /* ====== Fetch Place Rating via Google Places ====== */
  async function fetchPlaceRating(w: Waypoint) {
    if (w.rating !== null) return;
    if (!window.google?.maps?.places?.Place) return;
    const q = (w.name || '') + (w.address ? ' ' + w.address : ' ישראל');
    try {
      const { Place } = google.maps.places;
      const { places } = await Place.searchByText({
        textQuery: q,
        fields: ['rating', 'userRatingCount', 'id'],
        maxResultCount: 1
      });
      if (places && places[0]) {
        const r = places[0];
        w.rating = r.rating || null;
        w.ratingsTotal = r.userRatingCount || null;
        w.placeId = r.id || null;
        updateWaypointCardRating(w);
      }
    } catch (_e) {
      // Silently fail rating lookups
    }
  }

  /* ====== Update waypoint card rating in DOM ====== */
  function updateWaypointCardRating(w: Waypoint) {
    const el = document.getElementById('wpr-' + w.id);
    if (!el) return;
    if (w.rating) {
      el.innerHTML = `<span class="wp-stars">${starsHTML(w.rating)}</span>
        <b style="font-size:.85rem;">${w.rating.toFixed(1)}</b>
        <span class="wp-rating-count">(${num(w.ratingsTotal)})</span>`;
      const link = document.getElementById('wpa-reviews-' + w.id) as HTMLAnchorElement | null;
      if (link && w.placeId) link.href = `https://www.google.com/maps/place/?q=place_id:${w.placeId}`;
    } else {
      el.innerHTML = `<span class="wp-rating-loading">לא נמצא בגוגל מאפס</span>`;
    }
  }

  /* ====== Leaflet Fallback ====== */
  function initLeafletMap() {
    if (!mapEl) return;
    if (typeof (window as any).L === 'undefined') {
      // Load Leaflet CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      // Load Leaflet JS
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = () => buildLeaflet();
      document.head.appendChild(s);
    } else {
      buildLeaflet();
    }
  }

  function buildLeaflet() {
    if (!mapEl) return;
    const L = (window as any).L;
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }
    const wps = trip.waypoints.filter(w => w.lat && w.lng);
    leafletMap = L.map(mapEl);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(leafletMap);

    if (!wps.length) {
      leafletMap.setView([31.5, 34.9], 8);
      return;
    }

    wps.forEach((w: Waypoint, i: number) => {
      const isNext = i === nextWpIndex;
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${isNext ? '#0096b7' : '#00b4d8'};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${i + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      L.marker([w.lat, w.lng], { icon })
        .addTo(leafletMap)
        .bindPopup(`<b style="direction:rtl">${esc(w.name)}</b>${w.phone ? `<br>${esc(w.phone)}` : ''}`);
    });

    if (wps.length >= 2) {
      L.polyline(
        wps.map((w: Waypoint) => [w.lat, w.lng]),
        { color: '#00b4d8', weight: 3, dashArray: '8,6' }
      ).addTo(leafletMap);
      leafletMap.fitBounds(
        L.latLngBounds(wps.map((w: Waypoint) => [w.lat, w.lng])),
        { padding: [35, 35] }
      );
    } else {
      leafletMap.setView([wps[0].lat, wps[0].lng], 13);
    }
  }

  /* ====== Locate Me (FAB) ====== */
  function locateMe() {
    if (!navigator.geolocation) {
      showToast('גישה למיקום לא נתמכת');
      return;
    }
    showToast('מחפש מיקום...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeUserMarker(pos.coords.latitude, pos.coords.longitude, true);
      },
      () => showToast('לא ניתן לאחזר מיקום'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  /* ====== Place User Marker ====== */
  function placeUserMarker(lat: number, lng: number, pan: boolean = false) {
    if (gmapsMap && window.google) {
      const pos = { lat, lng };
      if (userMarker) {
        userMarker.position = pos;
      } else {
        const dot = document.createElement('div');
        dot.style.cssText = 'width:14px;height:14px;background:#2196F3;border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(33,150,243,.3);';
        userMarker = new google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: gmapsMap,
          content: dot,
          title: 'המיקום שלך',
          zIndex: 200
        });
      }
      if (pan) gmapsMap.setCenter(pos);
    } else if (leafletMap && typeof (window as any).L !== 'undefined') {
      const L = (window as any).L;
      if (userMarker) userMarker.remove();
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#2196F3;border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(33,150,243,.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      userMarker = L.marker([lat, lng], { icon }).addTo(leafletMap).bindPopup('המיקום שלך');
      if (pan) leafletMap.setView([lat, lng], 14);
    }
    updateNextWaypoint(lat, lng);
  }

  /* ====== Update Next Waypoint + Directions ====== */
  function updateNextWaypoint(lat: number, lng: number) {
    const wps = trip.waypoints.filter(w => w.lat && w.lng);
    if (!wps.length) return;

    let minD = Infinity;
    let ni = -1;
    wps.forEach((w, i) => {
      const d = haversine(lat, lng, w.lat!, w.lng!);
      if (d < minD) {
        minD = d;
        ni = i;
      }
    });

    nextWpIndex = ni;

    if (ni >= 0) {
      const w = wps[ni];
      const distText = minD < 1 ? Math.round(minD * 1000) + 'מ\u05F3' : minD.toFixed(1) + 'ק"מ';
      nextStopText = `הנקודה הבאה: ${w.name}  \u2022  ${distText}`;
      nextStopVisible = true;

      // Highlight the wp-num elements
      document.querySelectorAll('.wp-num').forEach((el, i) => {
        (el as HTMLElement).style.background = i === ni ? '#0096b7' : '#00b4d8';
      });
      document.querySelectorAll('.wp-card').forEach((el, i) => {
        el.classList.toggle('next-stop', i === ni);
      });

      // Draw directions route + ETA via Google Directions API
      if (gmapsMap && window.google?.maps) {
        if (!directionsRenderer) {
          directionsRenderer = new google.maps.DirectionsRenderer({
            map: gmapsMap,
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#2196F3', strokeOpacity: 0.7, strokeWeight: 4 }
          });
        }
        const svc = new google.maps.DirectionsService();
        svc.route(
          {
            origin: { lat, lng },
            destination: { lat: w.lat!, lng: w.lng! },
            travelMode: google.maps.TravelMode.DRIVING
          },
          (result: any, status: string) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
              const leg = result.routes[0]?.legs[0];
              if (leg) {
                nextStopText = `הנקודה הבאה: ${w.name}  \u2022  ${leg.distance.text}  \u2022  ${leg.duration.text}`;
              }
            }
          }
        );
      }
    }
  }
</script>

<div class="next-stop-bar" class:hidden={!nextStopVisible}>
  <span class="ms">near_me</span>
  <span>{nextStopText}</span>
</div>
<div class="map-wrapper">
  <div
    bind:this={mapEl}
    style="height:380px;border-radius:12px;background:#e8f0f5;display:flex;align-items:center;justify-content:center;color:var(--gray);font-weight:600;"
  >
    <div style="text-align:center">
      <div style="font-size:2rem;margin-bottom:.5rem"><span class="ms">map</span></div>
      טוען מפה...
    </div>
  </div>
  <button class="map-locate-fab" onclick={locateMe} title="אתר אותי">
    <span class="ms">my_location</span>
  </button>
</div>
