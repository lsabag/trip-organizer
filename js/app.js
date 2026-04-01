const AVC=['#a8d5ba','#f9d8a8','#b0d4e8','#f5b8b8','#d4b8f5','#c8e6c9','#ffe0b2','#b2dfdb'];
const TRIP_IMAGES=[
  'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80',
  'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&q=80',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
  'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=600&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  'https://images.unsplash.com/photo-1502136969935-8d8eef54d77b?w=600&q=80'
];
let selectedImage=TRIP_IMAGES[0];
let selectedCropY=50;
let selectedZoom=100;
let gmapsKey=localStorage.getItem('tiyulim_gmaps_key')||'';
let gmapsScriptLoaded=false;
let gmapsMap=null;
let userMarkerG=null;
let watchId=null;
let nextWpIndex=-1;
let currentTripId=null;
let isDirectLink=false;
let wpEditorItems=[];
let nextPaxId=100,nextWpId=10;

// ===================== PERSISTENCE (API) =====================
const API='/api';
let creatorToken=localStorage.getItem('tiyulim_creator')||'';
if(!creatorToken){creatorToken='ct_'+Math.random().toString(36).substr(2,12);localStorage.setItem('tiyulim_creator',creatorToken);}

async function loadTripsFromAPI(){
  try{
    const r=await fetch(`${API}/trips?mine=${encodeURIComponent(creatorToken)}`);
    if(r.ok) return await r.json();
  }catch(e){}
  return [];
}
function saveTrips(){
  if(currentTripId){
    const t=trips.find(x=>String(x.id)===String(currentTripId));
    if(t){
      const hdrs={'Content-Type':'application/json','X-Creator-Token':creatorToken};
      if(unlockedTrips[t.id]) hdrs['X-Trip-Password']=unlockedTrips[t.id];
      fetch(`${API}/trips/${t.id}`,{method:'PUT',headers:hdrs,body:JSON.stringify(t)}).catch(()=>{});
    }
  }
}
function syncIds(){
  let maxPid=0,maxWid=0;
  trips.forEach(t=>{
    t.waypoints.forEach(w=>{const wid=parseInt(String(w.id).replace(/\D/g,''))||0;if(wid>=maxWid)maxWid=wid;});
    t.participants.forEach(p=>{const pid=parseInt(String(p.id).replace(/\D/g,''))||0;if(pid>=maxPid)maxPid=pid;});
  });
  nextPaxId=maxPid+1;nextWpId=maxWid+1;
}
let trips=[];

// ===================== API KEY =====================
function saveApiKey(){
  const k=document.getElementById('api-key-input').value.trim();
  if(!k){showToast('נא להזין מפתח API');return;}
  gmapsKey=k;
  try{localStorage.setItem('tiyulim_gmaps_key',k);}catch(e){}
  closeModal('modal-api-key');
  loadGoogleMapsScript(k).then(()=>{
    showToast('גוגל מאפס הופעל!');
    const t=trips.find(x=>x.id===currentTripId);
    if(t) initMap(t);
  }).catch(()=>showToast('שגיאה בטעינת גוגל מאפס – בדוק את המפתח'));
}
function clearApiKey(){
  gmapsKey='';gmapsScriptLoaded=false;
  try{localStorage.removeItem('tiyulim_gmaps_key');}catch(e){}
  closeModal('modal-api-key');
  showToast('חזרה למפה רגילה');
  const t=trips.find(x=>x.id===currentTripId);
  if(t) initMap(t);
}

function loadGoogleMapsScript(key){
  return new Promise((resolve,reject)=>{
    if(gmapsScriptLoaded&&window.google&&window.google.maps){resolve();return;}
    const old=document.getElementById('gmaps-script');
    if(old)old.remove();
    window._gmapsReady=()=>{gmapsScriptLoaded=true;resolve();};
    const s=document.createElement('script');
    s.id='gmaps-script';
    s.src=`https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,marker&language=he&loading=async&callback=_gmapsReady`;s.async=true;
    s.onerror=()=>{gmapsScriptLoaded=false;reject();};
    document.head.appendChild(s);
  });
}

// ===================== NAV DRAWER =====================
function openDrawer(){
  document.getElementById('nav-drawer-overlay').classList.add('open');
  document.getElementById('nav-drawer').classList.add('open');
}
function closeDrawer(){
  document.getElementById('nav-drawer-overlay').classList.remove('open');
  document.getElementById('nav-drawer').classList.remove('open');
}

// ===================== ROUTING =====================
function initRouter(){
  if(location.hash==='#admin'){showAdmin();return;}
  const m=location.hash.match(/^#trip-([a-zA-Z0-9]+)$/);
  if(m){
    const id=m[1];
    let t=trips.find(x=>String(x.id)===id);
    if(t){
      isDirectLink=true;
      document.getElementById('back-to-list-btn').style.display='none';
      showTrip(t.id);
    }else{
      // Try fetching from API (trip might be hidden/not in local list)
      fetch(`${API}/trips/${id}`).then(r=>r.ok?r.json():null).then(trip=>{
        if(trip){trips.push(trip);isDirectLink=true;
          document.getElementById('back-to-list-btn').style.display='none';
          showTrip(trip.id);}
        else showList();
      }).catch(()=>showList());
      return;
    }
  }else showList();
}
window.addEventListener('hashchange',initRouter);

function copyShareLink(tripId){
  const base=location.href.split('#')[0].replace(/\/$/,'');
  const url=base+'/share/'+tripId;
  const t=trips.find(x=>String(x.id)===String(tripId));
  const title=t?t.name:'טיול';
  if(navigator.share){
    navigator.share({title,text:`הצטרפו לטיול: ${title}`,url}).catch(()=>{});
  }else{
    navigator.clipboard.writeText(url).then(()=>showToast('הקישור הועתק!')).catch(()=>prompt('העתיקו:',url));
  }
}

// ===================== LIST =====================
function renderList(){
  document.getElementById('hero-section').style.display='';
  const g=document.getElementById('trips-grid');
  const visibleTrips=trips.filter(t=>!t.hidden);
  let h=visibleTrips.map((t,idx)=>{
    const drivers=t.participants.filter(p=>p.hasCar);
    const fs=drivers.reduce((s,d)=>{const tk=t.participants.filter(p=>p.assignedTo===d.id).length;return s+Math.max(0,parseInt(d.seats)-tk);},0);
    const img=t.image||TRIP_IMAGES[idx%TRIP_IMAGES.length];
    const paxAvatars=t.participants.slice(0,3).map((p,i)=>
      `<div class="tc-avatar-mini" style="background:${AVC[i%8]}">${ini(p.name)}</div>`).join('');
    const paxNames=t.participants.slice(0,2).map(p=>p.name.split(' ')[0]).join(', ');
    return`<div class="trip-card" onclick="showTrip('${t.id}')">
      <div class="trip-card-img">
        <img src="${img}" alt="${t.name}" loading="lazy" style="object-position:center ${t.cropY!=null?t.cropY:50}%;${t.zoom>100?`transform:scale(${t.zoom/100});transform-origin:center ${t.cropY||50}%`:''}">
        <div class="location-badge"><span class="ms">location_on</span> ${t.name.split(' ').slice(-2).join(' ')}</div>
      </div>
      <div class="trip-card-body">
        <div class="tc-title">${t.name}</div>
        <div class="tc-meta"><span class="ms">calendar_today</span> ${fmtDate(t.date)} &nbsp;|&nbsp; <span class="ms">schedule</span> ${t.time}</div>
        <div class="tc-meta"><span class="ms">location_on</span> ${t.meeting}</div>
        <div class="tc-divider"></div>
        <div class="tc-carpool">
          <div class="tc-carpool-status">
            <span class="tc-carpool-icon"><span class="ms">directions_car</span></span>
            <span>Carpool: ${drivers.length} רכבים | ${fs} פנויים</span>
          </div>
          <div class="tc-pax-count"><span class="ms">group</span> ${t.participants.length}</div>
        </div>
        <div class="tc-footer">
          <button class="tc-join-btn" onclick="event.stopPropagation();joinFromCard('${t.id}')"><span class="ms">person_add</span> הצטרף</button>
          <div style="display:flex;align-items:center;gap:.3rem;">
            ${paxNames?`<span class="tc-avatar-name">${paxNames}</span>`:''}
            <div class="tc-avatars">${paxAvatars}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  h+=`<div class="add-trip-card" onclick="openModal('modal-add-trip')"><div class="plus"><span class="ms">add</span></div><div>פרסם טיול חדש</div></div>`;
  g.innerHTML=h;
}

// ===================== DETAIL =====================
function showTrip(id){
  currentTripId=id;
  location.hash='trip-'+id;
  if(!isDirectLink) document.getElementById('back-to-list-btn').style.display='flex';
  document.getElementById('hero-section').style.display='none';
  cleanupMap();
  renderDetail(trips.find(x=>String(x.id)===String(id)));
  document.getElementById('view-list').classList.remove('active');
  document.getElementById('view-admin').classList.remove('active');
  document.getElementById('view-detail').classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderDetail(t){
  const drivers=t.participants.filter(p=>p.hasCar);
  const unassigned=t.participants.filter(p=>!p.hasCar&&p.needRide&&!p.assignedTo);
  const fs=drivers.reduce((s,d)=>{const tk=t.participants.filter(p=>p.assignedTo===d.id).length;return s+Math.max(0,parseInt(d.seats)-tk);},0);
  const directNotice=isDirectLink?`<div class="direct-link-notice"><span class="ms">link</span> אתה צופה בטיול זה דרך קישור ישיר</div>`:'';
  const sumH=`<div class="summary-bar">
    <div class="summary-item"><div class="summary-icon"><span class="ms" style="font-size:1.4rem;color:var(--teal)">group</span></div><div><div class="summary-val">${t.participants.length}</div><div class="summary-lbl">נרשמו</div></div></div>
    <div class="summary-item"><div class="summary-icon"><span class="ms" style="font-size:1.4rem;color:var(--orange)">directions_car</span></div><div><div class="summary-val">${drivers.length}</div><div class="summary-lbl">רכבים</div></div></div>
    <div class="summary-item"><div class="summary-icon"><span class="ms" style="font-size:1.4rem;color:var(--green)">event_seat</span></div><div><div class="summary-val">${fs}</div><div class="summary-lbl">מקומות פנויים</div></div></div>
    <div class="summary-item"><div class="summary-icon"><span class="ms" style="font-size:1.4rem;color:#e65100">location_on</span></div><div><div class="summary-val">${t.waypoints.length}</div><div class="summary-lbl">נקודות מסלול</div></div></div>
  </div>`;

  const mapKeyBanner=!gmapsKey?`
    <div class="map-key-banner">
      <h3><span class="ms">map</span> הפעל מפת גוגל עם ציוני ביקורות</h3>
      <p>הזן מפתח API של Google Maps כדי להציג מפה אינטראקטיבית עם דירוגים, ביקורות ותמונות של כל נקודה.</p>
      <div class="key-input-row">
        <input type="text" id="inline-key-input" placeholder="AIzaSy..." dir="ltr">
        <button class="btn-activate" onclick="activateInlineKey()">הפעל</button>
      </div>
      <a href="javascript:openModal('modal-api-key')">איך מקבלים מפתח? לחצו כאן</a>
    </div>`:'';

  const mapControlsHTML=`<div class="map-controls">
    <button class="map-ctrl-btn" onclick="locateMe()"><span class="ms">my_location</span> מיקום שלי</button>
  </div>`;

  const headerImg=t.image||TRIP_IMAGES[0];
  const cropPos=t.cropY!=null?t.cropY:50;
  const zoomVal=t.zoom!=null?t.zoom:100;
  const zoomStyle=zoomVal>100?`transform:scale(${zoomVal/100});transform-origin:center ${cropPos}%;`:'';
  document.getElementById('detail-content').innerHTML=`
    ${directNotice?`<div class="direct-link-notice" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;"><span><span class="ms">link</span> צפייה דרך קישור ישיר</span><button class="privacy-toggle-btn${t.hidden?' is-private':''}" onclick="toggleTripHidden('${t.id}')" style="margin:0;"><span class="ms">${t.hidden?'visibility_off':'visibility'}</span> ${t.hidden?'פרטי':'ציבורי'}</button></div>`:`<div class="privacy-bar"><button class="privacy-toggle-btn${t.hidden?' is-private':''}" onclick="toggleTripHidden('${t.id}')"><span class="ms">${t.hidden?'visibility_off':'visibility'}</span> ${t.hidden?'טיול פרטי':'ציבורי — גלוי לכולם'}</button></div>`}
    <div style="position:relative;border-radius:var(--radius);overflow:hidden;margin-bottom:1rem;">
      <img src="${headerImg}" style="width:100%;height:180px;object-fit:cover;object-position:center ${cropPos}%;display:block;${zoomStyle}" loading="lazy">
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 50%);"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:1rem 1.2rem;color:white;">
        <div style="font-size:1.4rem;font-weight:900;text-shadow:0 2px 8px rgba(0,0,0,.4);">${t.name}</div>
        <div style="font-size:.82rem;opacity:.9;margin-top:.2rem;"><span class="ms" style="font-size:.85rem;">calendar_today</span> ${fmtDate(t.date)} &nbsp;<span class="ms" style="font-size:.85rem;">schedule</span> ${t.time} &nbsp;<span class="ms" style="font-size:.85rem;">location_on</span> ${t.meeting}</div>
      </div>
    </div>
    <div class="trip-header-card">
      ${t.desc?`<div class="trip-header-desc">${t.desc}</div>`:''}
      <div style="display:flex;gap:.4rem;">
        <button class="share-btn" style="flex:1;padding:.45rem .8rem;font-size:.82rem;" onclick="copyShareLink('${t.id}')"><span class="ms">share</span> שתף</button>
        <button class="share-btn" style="flex:1;padding:.45rem .8rem;font-size:.82rem;background:var(--teal-pale);color:var(--teal-dark);" onclick="editTrip('${t.id}')"><span class="ms">edit</span> ערוך</button>
      </div>
    </div>
    ${sumH}
    <div class="section-card">
      <div class="section-title"><span><span class="ms">map</span> מפת המסלול</span></div>
      ${mapKeyBanner}
      <div id="next-stop-bar" class="next-stop-bar hidden"><span><span class="ms">navigation</span></span><span id="next-stop-text"></span></div>
      ${mapControlsHTML}
      <div id="trip-map" style="height:380px;border-radius:12px;background:#e8f0f5;display:flex;align-items:center;justify-content:center;color:var(--gray);font-weight:600;">
        <div style="text-align:center"><div style="font-size:2rem;margin-bottom:.5rem"><span class="ms">map</span></div>טוען מפה...</div>
      </div>
    </div>
    <div class="section-card">
      <div class="section-title">
        <span><span class="ms">location_on</span> נקודות הטיול (${t.waypoints.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="openModal('modal-add-wp')">+ הוסף נקודה</button>
      </div>
      <div class="waypoints-list" id="waypoints-list">
        ${buildWaypointsHTML(t)||`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem">map</span></div><p>הוסף נקודות מסלול</p></div>`}
      </div>
    </div>
    ${buildJoinHTML()}
    <div class="section-card">
      <div class="section-title"><span class="ms">directions_car</span> רכבים ושיבוץ נוסעים</div>
      ${buildCarsHTML(t,drivers,unassigned)}
    </div>
    <div class="section-card">
      <div class="section-title"><span class="ms">schedule</span> ממתינים לשיבוץ (${unassigned.length})</div>
      <div class="pool-list">${buildPoolHTML(t,unassigned,drivers)}</div>
    </div>
    <div class="section-card">
      <div class="section-title"><span class="ms">group</span> כל המשתתפים (${t.participants.length})</div>
      <div class="participants-list">${buildPaxHTML(t)}</div>
    </div>
    `;

  setTimeout(()=>initMap(t),100);
}

function activateInlineKey(){
  const k=document.getElementById('inline-key-input')?.value.trim();
  if(!k){showToast('נא להזין מפתח');return;}
  gmapsKey=k;
  try{localStorage.setItem('tiyulim_gmaps_key',k);}catch(e){}
  document.getElementById('api-key-input').value=k;
  showToast('טוען גוגל מאפס...');
  loadGoogleMapsScript(k).then(()=>{
    showToast('גוגל מאפס הופעל!');
    const t=trips.find(x=>x.id===currentTripId);
    if(t) renderDetail(t);
  }).catch(()=>showToast('שגיאה – בדוק את המפתח'));
}

// ===================== MAP =====================
function cleanupMap(){
  if(directionsRenderer){directionsRenderer.setMap(null);directionsRenderer=null;}
  if(gmapsMap){gmapsMap=null;}
  if(watchId){navigator.geolocation.clearWatch(watchId);watchId=null;}
  userMarkerG=null;nextWpIndex=-1;
}

function initMap(t){
  const el=document.getElementById('trip-map');
  if(!el)return;
  if(gmapsKey&&gmapsScriptLoaded&&window.google&&window.google.maps){
    initGoogleMap(t,el);
  } else if(gmapsKey&&!gmapsScriptLoaded){
    loadGoogleMapsScript(gmapsKey).then(()=>initGoogleMap(t,el)).catch(()=>initLeafletMap(t,el));
  } else {
    initLeafletMap(t,el);
  }
}

function initGoogleMap(t,el){
  const wps=t.waypoints.filter(w=>w.lat&&w.lng);
  const center=wps.length?{lat:wps[0].lat,lng:wps[0].lng}:{lat:31.5,lng:34.9};
  const zoom=wps.length>1?10:14;
  gmapsMap=new google.maps.Map(el,{
    center,zoom,mapTypeId:'roadmap',mapId:'trip-organizer',streetViewControl:false,fullscreenControl:true,
    mapTypeControl:false,zoomControlOptions:{position:google.maps.ControlPosition.LEFT_BOTTOM}
  });
  const bounds=new google.maps.LatLngBounds();
  wps.forEach((w,i)=>{
    const pos={lat:w.lat,lng:w.lng};bounds.extend(pos);
    const isNext=(i===nextWpIndex);
    const bgColor=isNext?'#0096b7':'#00b4d8';
    const pin=document.createElement('div');
    pin.style.cssText=`width:32px;height:32px;border-radius:50%;background:${bgColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);font-family:Heebo,sans-serif;`;
    pin.textContent=String(i+1);
    const marker=new google.maps.marker.AdvancedMarkerElement({
      position:pos,map:gmapsMap,content:pin,title:w.name,zIndex:100-i
    });
    const ratingHTML=w.rating?`<div style="margin-top:4px">${starsHTML(w.rating)} <b>${w.rating}</b> <span style="color:#888;font-size:.78rem">(${num(w.ratingsTotal)})</span></div>`:'';
    const gmapsLink=w.placeId?`https://www.google.com/maps/place/?q=place_id:${w.placeId}`:`https://www.google.com/maps/search/${encodeURIComponent(w.name+' '+w.address)}`;
    const infoContent=`<div style="font-family:Heebo,sans-serif;direction:rtl;min-width:200px;padding:4px;">
      <b style="font-size:.95rem;color:#1a2332">${w.name}</b>${ratingHTML}
      ${w.time?`<div style="font-size:.8rem;color:#888;margin-top:2px">${w.time}</div>`:''}
      ${w.notes?`<div style="font-size:.8rem;color:#555;margin-top:3px;font-style:italic">${w.notes}</div>`:''}
      ${w.phone?`<div style="margin-top:6px"><a href="tel:${w.phone}" style="color:#0096b7;font-size:.82rem;font-weight:700">${w.phone}</a></div>`:''}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}" target="_blank" style="background:#e8f5e9;color:#1b5e20;padding:3px 8px;border-radius:6px;font-size:.78rem;font-weight:700;text-decoration:none">נווט</a>
        <a href="${gmapsLink}" target="_blank" style="background:#fff8e1;color:#e65100;padding:3px 8px;border-radius:6px;font-size:.78rem;font-weight:700;text-decoration:none">ביקורות</a>
      </div></div>`;
    const infoWindow=new google.maps.InfoWindow({content:infoContent});
    marker.addEventListener('gmp-click',()=>infoWindow.open({map:gmapsMap,anchor:marker}));
    fetchPlaceRating(w,()=>updateWaypointCardRating(w));
  });
  if(wps.length>=2){
    new google.maps.Polyline({
      path:wps.map(w=>({lat:w.lat,lng:w.lng})),geodesic:true,
      strokeColor:'#00b4d8',strokeOpacity:.85,strokeWeight:3,map:gmapsMap
    });
  }
  if(wps.length>1) gmapsMap.fitBounds(bounds,{padding:50});
}

async function fetchPlaceRating(w,cb){
  if(w.rating!==null){cb&&cb();return;}
  const q=(w.name||'')+(w.address?' '+w.address:' ישראל');
  try{
    const {Place}=google.maps.places;
    const {places}=await Place.searchByText({textQuery:q,fields:['rating','userRatingCount','id'],maxResultCount:1});
    if(places&&places[0]){
      const r=places[0];w.rating=r.rating||null;w.ratingsTotal=r.userRatingCount||null;w.placeId=r.id||null;cb&&cb();
    }
  }catch(e){}
}
function refreshRatings(){
  if(!gmapsScriptLoaded||!window.google||!gmapsMap)return;
  const t=trips.find(x=>x.id===currentTripId);if(!t)return;
  t.waypoints.forEach(w=>{w.rating=null;w.ratingsTotal=null;w.placeId=null;fetchPlaceRating(w,()=>updateWaypointCardRating(w));});
  showToast('מרענן ביקורות...');
}
function updateWaypointCardRating(w){
  const el=document.getElementById('wpr-'+w.id);if(!el)return;
  if(w.rating){
    el.innerHTML=`<span class="wp-stars">${starsHTML(w.rating)}</span>
      <span class="wp-rating-num">${w.rating.toFixed(1)}</span>
      <span class="wp-rating-count">(${num(w.ratingsTotal)} ביקורות)</span>`;
    const link=document.getElementById('wpa-reviews-'+w.id);
    if(link&&w.placeId) link.href=`https://www.google.com/maps/place/?q=place_id:${w.placeId}`;
  } else {
    el.innerHTML=`<span class="wp-rating-loading">לא נמצא בגוגל מאפס</span>`;
  }
}

/* ---- LEAFLET FALLBACK ---- */
function initLeafletMap(t,el){
  if(typeof L==='undefined'){
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=()=>_initLeaflet(t,el);document.head.appendChild(s);
  } else { _initLeaflet(t,el); }
}
let leafletMapObj=null;
let directionsRenderer=null;
function _initLeaflet(t,el){
  if(leafletMapObj){leafletMapObj.remove();leafletMapObj=null;}
  const wps=t.waypoints.filter(w=>w.lat&&w.lng);
  leafletMapObj=L.map(el);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(leafletMapObj);
  if(!wps.length){leafletMapObj.setView([31.5,34.9],8);return;}
  wps.forEach((w,i)=>{
    const icon=L.divIcon({className:'',
      html:`<div style="background:${i===nextWpIndex?'#0096b7':'#00b4d8'};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${i+1}</div>`,
      iconSize:[30,30],iconAnchor:[15,15]});
    L.marker([w.lat,w.lng],{icon}).addTo(leafletMapObj)
      .bindPopup(`<b style="direction:rtl">${w.name}</b>${w.phone?`<br>${w.phone}`:''}`);
  });
  if(wps.length>=2){
    L.polyline(wps.map(w=>[w.lat,w.lng]),{color:'#00b4d8',weight:3,dashArray:'8,6'}).addTo(leafletMapObj);
    leafletMapObj.fitBounds(L.latLngBounds(wps.map(w=>[w.lat,w.lng])),{padding:[35,35]});
  } else { leafletMapObj.setView([wps[0].lat,wps[0].lng],13); }
}

/* ---- GEOLOCATION ---- */
function tryGeolocation(t){
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(pos=>{placeUserMarker(pos.coords.latitude,pos.coords.longitude,t);},null,{enableHighAccuracy:true,timeout:6000});
}
function locateMe(){
  if(!navigator.geolocation){showToast('גישה למיקום לא נתמכת');return;}
  showToast('מחפש מיקום...');
  navigator.geolocation.getCurrentPosition(pos=>{
    const t=trips.find(x=>x.id===currentTripId);placeUserMarker(pos.coords.latitude,pos.coords.longitude,t,true);
  },()=>showToast('לא ניתן לאחזר מיקום'),{enableHighAccuracy:true,timeout:8000});
}
function placeUserMarker(lat,lng,t,pan){
  if(gmapsMap&&window.google){
    const pos={lat,lng};
    if(userMarkerG){userMarkerG.position=pos;}
    else{
      const dot=document.createElement('div');
      dot.style.cssText='width:14px;height:14px;background:#2196F3;border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(33,150,243,.3);';
      userMarkerG=new google.maps.marker.AdvancedMarkerElement({position:pos,map:gmapsMap,content:dot,title:'המיקום שלך',zIndex:200});
    }
    if(pan) gmapsMap.setCenter(pos);
  } else if(leafletMapObj&&typeof L!=='undefined'){
    if(userMarkerG){userMarkerG.remove();}
    const icon=L.divIcon({className:'',html:`<div style="width:14px;height:14px;background:#2196F3;border:2.5px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(33,150,243,.3)"></div>`,iconSize:[14,14],iconAnchor:[7,7]});
    userMarkerG=L.marker([lat,lng],{icon}).addTo(leafletMapObj).bindPopup('המיקום שלך');
    if(pan) leafletMapObj.setView([lat,lng],14);
  }
  updateNextWaypoint(lat,lng,t);
}
function updateNextWaypoint(lat,lng,t){
  const wps=t.waypoints.filter(w=>w.lat&&w.lng);if(!wps.length)return;
  let minD=Infinity,ni=-1;
  wps.forEach((w,i)=>{const d=haversine(lat,lng,w.lat,w.lng);if(d<minD){minD=d;ni=i;}});
  nextWpIndex=ni;
  const bar=document.getElementById('next-stop-bar'),txt=document.getElementById('next-stop-text');
  if(bar&&txt&&ni>=0){
    const w=wps[ni];
    const distText=minD<1?Math.round(minD*1000)+'מ׳':minD.toFixed(1)+'ק"מ';
    txt.textContent=`הנקודה הבאה: ${w.name}  •  ${distText}`;
    bar.classList.remove('hidden');
    document.querySelectorAll('.wp-card').forEach((el,i)=>el.classList.toggle('next-stop',i===ni));
    document.querySelectorAll('.wp-num').forEach((el,i)=>el.style.background=i===ni?'#0096b7':'#00b4d8');
    // Draw route + get ETA via Directions API
    if(gmapsMap&&window.google&&window.google.maps){
      if(!directionsRenderer){
        directionsRenderer=new google.maps.DirectionsRenderer({
          map:gmapsMap,suppressMarkers:true,
          polylineOptions:{strokeColor:'#2196F3',strokeOpacity:.7,strokeWeight:4}
        });
      }
      const svc=new google.maps.DirectionsService();
      svc.route({origin:{lat,lng},destination:{lat:w.lat,lng:w.lng},travelMode:google.maps.TravelMode.DRIVING},
        (result,status)=>{
          if(status==='OK'){
            directionsRenderer.setDirections(result);
            const leg=result.routes[0]?.legs[0];
            if(leg){
              txt.textContent=`הנקודה הבאה: ${w.name}  •  ${leg.distance.text}  •  ${leg.duration.text}`;
            }
          }
        });
    }
  }
}

// ===================== WAYPOINTS HTML =====================
function buildWaypointsHTML(t){
  if(!t.waypoints.length)return'';
  return t.waypoints.map((w,i)=>{
    const hasCoords=w.lat&&w.lng;
    const navTarget=hasCoords?`${w.lat},${w.lng}`:encodeURIComponent(w.address||w.name+' ישראל');
    const navUrl=`https://www.google.com/maps/dir/?api=1&destination=${navTarget}`;
    const wazeUrl=hasCoords?`https://waze.com/ul?ll=${w.lat},${w.lng}&navigate=yes`:`https://waze.com/ul?q=${encodeURIComponent(w.address||w.name+' ישראל')}`;
    const reviewUrl=w.placeId?`https://www.google.com/maps/place/?q=place_id:${w.placeId}`:`https://www.google.com/maps/search/${encodeURIComponent((w.name||'')+' '+(w.address||''))}`;
    const ratingContent=w.rating?
      `<span class="wp-stars">${starsHTML(w.rating)}</span>
       <span class="wp-rating-num">${w.rating.toFixed(1)}</span>
       <span class="wp-rating-count">(${num(w.ratingsTotal)} ביקורות)</span>`:
      (gmapsKey?`<span class="wp-rating-loading">טוען ביקורות...</span>`:'<span class="wp-rating-loading">הפעל גוגל מאפס לביקורות</span>');
    return`<div class="wp-card" id="wpc-${w.id}">
      <div class="wp-card-header">
        <div class="wp-num" id="wpn-${w.id}">${i+1}</div>
        <div class="wp-info">
          <div class="wp-name">${w.name}</div>
          ${w.address?`<div class="wp-address"><span class="ms">location_on</span> ${w.address}</div>`:''}
          ${w.time?`<div class="wp-time-badge"><span class="ms">schedule</span> ${w.time}</div>`:''}
          ${w.notes?`<div class="wp-notes">${w.notes}</div>`:''}
          <div class="wp-rating-row" id="wpr-${w.id}">${ratingContent}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.2rem;align-items:center;">
          <div style="display:flex;gap:.2rem;">
            ${i>0?`<button class="wp-move" onclick="moveWaypoint('${t.id}',${i},-1)" title="הזז למעלה"><span class="ms">arrow_upward</span></button>`:''}
            ${i<t.waypoints.length-1?`<button class="wp-move" onclick="moveWaypoint('${t.id}',${i},1)" title="הזז למטה"><span class="ms">arrow_downward</span></button>`:''}
          </div>
          <div style="display:flex;gap:.2rem;">
            <button class="wp-edit" onclick="editWaypoint('${t.id}','${w.id}')" title="ערוך"><span class="ms">edit</span></button>
            <button class="wp-rm" onclick="removeWaypoint('${t.id}','${w.id}')" title="מחק"><span class="ms">close</span></button>
          </div>
        </div>
      </div>
      <div class="wp-actions">
        <a class="wp-action-btn wp-nav" href="${navUrl}" target="_blank"><span class="ms">location_on</span> Google</a>
        <a class="wp-action-btn wp-waze" href="${wazeUrl}" target="_blank"><span class="ms">navigation</span> Waze</a>
        <a class="wp-action-btn wp-reviews" id="wpa-reviews-${w.id}" href="${reviewUrl}" target="_blank"><span class="ms">star</span> ביקורות</a>
        ${w.phone?`<a class="wp-action-btn wp-phone-btn" href="tel:${w.phone}"><span class="ms">phone</span> ${w.phone}</a>`:''}
      </div>
    </div>`;
  }).join('');
}

async function editWaypoint(tripId,wpId){
  const t=trips.find(x=>String(x.id)===String(tripId));if(!t)return;
  if(!await checkTripPassword(t))return;
  const w=t.waypoints.find(x=>x.id===wpId);if(!w)return;
  document.getElementById('wp-edit-id').value=wpId;
  document.getElementById('wp-name').value=w.name||'';
  document.getElementById('wp-address').value=w.address||'';
  document.getElementById('wp-phone').value=w.phone||'';
  document.getElementById('wp-time').value=w.time||'';
  document.getElementById('wp-notes').value=w.notes||'';
  document.getElementById('wp-modal-icon').textContent='edit_location';
  document.getElementById('wp-modal-title').textContent='עריכת נקודת טיול';
  document.getElementById('wp-save-label').textContent='עדכן נקודה';
  document.getElementById('wp-google-preview').style.display='none';
  openModal('modal-add-wp');
}
function resetWpModal(){
  document.getElementById('wp-edit-id').value='';
  const wpNameEl=document.getElementById('wp-name');if(wpNameEl)wpNameEl._wpAcAttached=false;
  ['wp-name','wp-address','wp-phone','wp-notes'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('wp-time').value='';
  document.getElementById('wp-modal-icon').textContent='add_location';
  document.getElementById('wp-modal-title').textContent='הוסף נקודת טיול';
  document.getElementById('wp-save-label').textContent='שמור נקודה';
  document.getElementById('wp-google-preview').style.display='none';
}
async function fetchGoogleDetails(){
  if(!gmapsScriptLoaded||!window.google||!window.google.maps||!window.google.maps.places){
    showToast('Google Maps לא נטען — בדוק מפתח API');return;}
  const q=(document.getElementById('wp-name').value.trim()||'')+' '+(document.getElementById('wp-address').value.trim()||'ישראל');
  if(q.trim().length<2){showToast('נא להזין שם מקום');return;}
  showToast('מחפש ב-Google Maps...');
  try{
    const {Place}=google.maps.places;
    const {places}=await Place.searchByText({textQuery:q,
      fields:['displayName','formattedAddress','location','rating','userRatingCount','id'],maxResultCount:1});
    if(places&&places[0]){
      const p=places[0];
      if(p.id){
        const det=new Place({id:p.id});
        await det.fetchFields({fields:['displayName','formattedAddress','nationalPhoneNumber','location','rating','userRatingCount','websiteURI']});
        applyGoogleDetails(det);
      } else applyGoogleDetails(p);
    } else showToast('לא נמצא ב-Google Maps');
  }catch(e){showToast('שגיאה בחיפוש');}
}
function applyGoogleDetails(p){
  if(p.displayName) document.getElementById('wp-name').value=p.displayName;
  if(p.formattedAddress) document.getElementById('wp-address').value=p.formattedAddress;
  if(p.nationalPhoneNumber) document.getElementById('wp-phone').value=p.nationalPhoneNumber;
  window._wpGoogleData={
    lat:p.location?.lat()||null,
    lng:p.location?.lng()||null,
    rating:p.rating||null,
    ratingsTotal:p.userRatingCount||null,
    placeId:p.id||null
  };
  const prev=document.getElementById('wp-google-preview');
  let info=`<b>${p.name||''}</b>`;
  if(p.rating) info+=` | ${starsHTML(p.rating)} ${p.rating} (${num(p.user_ratings_total)} ביקורות)`;
  if(p.formatted_address) info+=`<br><span class="ms" style="font-size:.8rem;">location_on</span> ${p.formatted_address}`;
  if(p.formatted_phone_number) info+=` | <span class="ms" style="font-size:.8rem;">phone</span> ${p.formatted_phone_number}`;
  prev.innerHTML=info;prev.style.display='block';
  showToast('פרטים נמשכו מ-Google Maps');
}
function saveWaypoint(){
  const name=document.getElementById('wp-name').value.trim();
  if(!name){showToast('נא להזין שם מקום');return;}
  const t=trips.find(x=>x.id===currentTripId);
  const editId=document.getElementById('wp-edit-id').value;
  const gd=window._wpGoogleData||{};

  if(editId){
    // Edit existing waypoint
    const w=t.waypoints.find(x=>x.id===editId);if(!w)return;
    w.name=name;
    w.address=document.getElementById('wp-address').value.trim();
    w.phone=document.getElementById('wp-phone').value.trim();
    w.time=document.getElementById('wp-time').value;
    w.notes=document.getElementById('wp-notes').value.trim();
    if(gd.lat){w.lat=gd.lat;w.lng=gd.lng;}
    if(gd.rating!==null&&gd.rating!==undefined){w.rating=gd.rating;w.ratingsTotal=gd.ratingsTotal;w.placeId=gd.placeId;}
    saveTrips();closeModal('modal-add-wp');resetWpModal();window._wpGoogleData=null;
    if(!w.lat) geocodeWaypoint(w,()=>{saveTrips();renderDetail(t);});
    renderDetail(t);showToast(`"${name}" עודכן`);
  } else {
    // Add new waypoint
    const wp={id:'w'+(nextWpId++),name,address:document.getElementById('wp-address').value.trim(),
      phone:document.getElementById('wp-phone').value.trim(),time:document.getElementById('wp-time').value,
      notes:document.getElementById('wp-notes').value.trim(),
      lat:gd.lat||null,lng:gd.lng||null,
      rating:gd.rating||null,ratingsTotal:gd.ratingsTotal||null,placeId:gd.placeId||null};
    t.waypoints.push(wp);saveTrips();
    closeModal('modal-add-wp');resetWpModal();window._wpGoogleData=null;
    if(!wp.lat) geocodeWaypoint(wp,()=>{saveTrips();renderDetail(t);});
    renderDetail(t);showToast(`"${name}" נוסף למסלול`);
  }
}

async function moveWaypoint(tripId,idx,dir){
  const t=trips.find(x=>String(x.id)===String(tripId));if(!t)return;
  if(!await checkTripPassword(t))return;
  const newIdx=idx+dir;if(newIdx<0||newIdx>=t.waypoints.length)return;
  const tmp=t.waypoints[idx];t.waypoints[idx]=t.waypoints[newIdx];t.waypoints[newIdx]=tmp;
  saveTrips();renderDetail(t);
}
async function removeWaypoint(tripId,wpId){
  const t=trips.find(x=>String(x.id)===String(tripId));if(!t)return;
  if(!await checkTripPassword(t))return;
  const i=t.waypoints.findIndex(x=>x.id===wpId);if(i<0)return;
  if(!confirm(`למחוק את "${t.waypoints[i].name}"?`))return;
  const name=t.waypoints[i].name;t.waypoints.splice(i,1);saveTrips();showToast(`"${name}" הוסר`);renderDetail(t);
}

async function geocodeWaypoint(wp,cb){
  const q=wp.address||wp.name+' ישראל';
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=il`,
      {headers:{'Accept-Language':'he','User-Agent':'TiyulimYachad/1.0'}});
    const d=await r.json();
    if(d.length){wp.lat=parseFloat(d[0].lat);wp.lng=parseFloat(d[0].lon);if(cb)cb();}
  }catch(e){}
}

// ===================== WAYPOINT EDITOR =====================
function addWpEditorItem(){
  const id='wpe'+Date.now();wpEditorItems.push({id});
  const list=document.getElementById('wp-editor-list');const div=document.createElement('div');
  div.className='wp-editor-item';div.id=id;
  div.innerHTML=`<div style="font-weight:700;font-size:.83rem;color:var(--dark);margin-bottom:.45rem;"><span class="ms">add_location</span> נקודה ${wpEditorItems.length}</div>
    <button class="wp-editor-remove" onclick="removeWpEditorItem('${id}')">✕</button>
    <div class="form-group" style="margin-bottom:.45rem"><input type="text" placeholder="שם המקום *" class="wpe-name" data-id="${id}"></div>
    <div class="form-row">
      <div class="form-group" style="margin-bottom:.45rem"><input type="text" placeholder="כתובת לחיפוש" class="wpe-addr" id="wpe-addr-${id}" data-id="${id}"></div>
      <div class="form-group" style="margin-bottom:.45rem"><input type="tel" placeholder="טלפון" class="wpe-phone" data-id="${id}"></div>
    </div>
    <div class="form-group" style="margin-bottom:0"><textarea placeholder="הערות" rows="1" class="wpe-notes" data-id="${id}" style="min-height:38px"></textarea></div>`;
  list.appendChild(div);
  setTimeout(()=>tryAttachAutocomplete('wpe-addr-'+id),100);
}
function removeWpEditorItem(id){wpEditorItems=wpEditorItems.filter(x=>x.id!==id);const el=document.getElementById(id);if(el)el.remove();}
function collectWpEditorItems(){
  return wpEditorItems.map(({id})=>({
    id:'w'+(nextWpId++),name:document.querySelector(`.wpe-name[data-id="${id}"]`)?.value.trim()||'',
    address:document.querySelector(`.wpe-addr[data-id="${id}"]`)?.value.trim()||'',
    phone:document.querySelector(`.wpe-phone[data-id="${id}"]`)?.value.trim()||'',
    notes:document.querySelector(`.wpe-notes[data-id="${id}"]`)?.value.trim()||'',
    time:'',lat:null,lng:null,rating:null,ratingsTotal:null,placeId:null
  })).filter(w=>w.name);
}

// ===================== JOIN =====================
function buildJoinHTML(){
  return`<div class="join-section">
    <div class="js-title"><span class="ms">person_add</span> הצטרפות לטיול</div>
    <div class="join-steps">
      <span class="join-step active" id="jstep-1">1</span>
      <span class="join-step-line"></span>
      <span class="join-step" id="jstep-2">2</span>
    </div>
    <div id="join-step-1">
      <div class="form-group"><label>שם מלא</label><input id="j-name" type="text" placeholder="השם שלך"></div>
      <div class="form-group"><label>טלפון</label><input id="j-phone" type="tel" placeholder="050-..."></div>
      <div class="form-group"><label><span class="ms">location_on</span> עיר מגורים</label><input id="j-city" type="text" placeholder="מאיפה אתה?"></div>
      <button class="btn btn-primary btn-full" onclick="joinNext(2)"><span class="ms">arrow_back</span> המשך</button>
    </div>
    <div id="join-step-2" style="display:none;">
      <div class="toggle-row">
        <label class="toggle"><input type="checkbox" id="j-has-car" onchange="toggleJoinCar()"><span class="slider"></span></label>
        <span class="toggle-label"><span class="ms">directions_car</span> אני מגיע/ה עם רכב</span>
      </div>
      <div id="j-car-fields" class="inset-box" style="display:none;">
        <div class="form-group"><label>מקומות פנויים (מלבדך)</label><input id="j-seats" type="number" min="1" max="8" value="3"></div>
        <div class="form-row">
          <div class="form-group"><label>יוצא מ־</label><input id="j-car-from" type="text"></div>
          <div class="form-group"><label>חוזר ל־</label><input id="j-car-to" type="text"></div>
        </div>
        <div class="form-group" style="margin-bottom:0"><label>הערות לגבי הנסיעה</label><textarea id="j-car-notes" rows="2"></textarea></div>
      </div>
      <div id="j-no-car-sec">
        <div class="toggle-row">
          <label class="toggle"><input type="checkbox" id="j-need-ride"><span class="slider"></span></label>
          <span class="toggle-label"><span class="ms">volunteer_activism</span> אני מחפש/ת הסעה</span>
        </div>
      </div>
      <div class="form-group" style="margin-top:.6rem;"><label>הערות (אופציונלי)</label><textarea id="j-notes" rows="2" placeholder="אלרגיות, בקשות מיוחדות..."></textarea></div>
      <div style="display:flex;gap:.5rem;">
        <button class="btn btn-ghost" style="flex:1;" onclick="joinNext(1)"><span class="ms">arrow_forward</span> חזרה</button>
        <button class="btn btn-clay" style="flex:1;" onclick="joinTrip()"><span class="ms">check</span> אני בפנים!</button>
      </div>
    </div>
  </div>`;
}
function joinNext(step){
  if(step===2){
    const name=document.getElementById('j-name').value.trim();
    const phone=document.getElementById('j-phone').value.trim();
    const city=document.getElementById('j-city').value.trim();
    if(!name||!phone||!city){showToast('נא למלא שם, טלפון ועיר');return;}
  }
  for(let i=1;i<=2;i++){
    document.getElementById('join-step-'+i).style.display=i===step?'block':'none';
    document.getElementById('jstep-'+i).className='join-step'+(i===step?' active':'')+(i<step?' done':'');
  }
  setTimeout(()=>{
    const sec=document.querySelector('.join-section');
    if(sec) sec.scrollIntoView({behavior:'smooth',block:'start'});
  },100);
}
function toggleJoinCar(){
  const on=document.getElementById('j-has-car').checked;
  document.getElementById('j-car-fields').style.display=on?'block':'none';
  document.getElementById('j-no-car-sec').style.display=on?'none':'block';
}
function joinTrip(){
  const name=document.getElementById('j-name').value.trim();
  const phone=document.getElementById('j-phone').value.trim();
  const city=document.getElementById('j-city').value.trim();
  if(!name||!phone||!city){showToast('נא למלא שם, טלפון ועיר');return;}
  const t=trips.find(x=>x.id===currentTripId);
  if(t.participants.find(x=>x.phone===phone)){showToast('כבר נרשמת!');return;}
  const hasCar=document.getElementById('j-has-car').checked;
  const needRide=!hasCar&&document.getElementById('j-need-ride').checked;
  t.participants.push({id:'p'+(nextPaxId++),name,phone,city,hasCar,
    seats:hasCar?(parseInt(document.getElementById('j-seats').value)||3):0,
    carFrom:hasCar?document.getElementById('j-car-from').value.trim():'',
    carTo:hasCar?document.getElementById('j-car-to').value.trim():'',
    carNotes:hasCar?document.getElementById('j-car-notes').value.trim():'',
    needRide,assignedTo:null,notes:document.getElementById('j-notes').value.trim()});
  saveTrips();showToast(`${name} נרשם/ה לטיול!`);renderDetail(t);
}

function waNum(p){return'972'+String(p||'').replace(/[-\s+]/g,'').replace(/^0/,'');}

// ===================== CARS =====================
function buildCarsHTML(t,drivers,unassigned){
  if(!drivers.length)return`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem">directions_car</span></div><p>אין רכבים עדיין</p></div>`;
  return drivers.map(d=>{
    const assigned=t.participants.filter(p=>p.assignedTo===d.id);
    const freeC=Math.max(0,parseInt(d.seats)-assigned.length);
    let seatsH=`<span class="seats-lbl">מקומות:</span><span class="seat driver-seat"><span class="ms">person</span></span>`;
    assigned.forEach(()=>seatsH+=`<span class="seat taken"><span class="ms">person</span></span>`);
    for(let i=0;i<freeC;i++) seatsH+=`<span class="seat free"><span class="ms">event_seat</span></span>`;
    let paxH=assigned.map(p=>{
      const wa=p.phone?`<a class="pax-contact-btn" href="https://wa.me/${waNum(p.phone)}" target="_blank" title="וואטסאפ"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.236l-.44-.363-3.09 1.036 1.036-3.09-.363-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg> WA</a>`:'';
      const call=p.phone?`<a class="pax-contact-btn pax-call-btn" href="tel:${p.phone}" title="חיוג"><span class="ms">phone</span></a>`:'';
      return`<div class="car-pax-row">
      <div class="pax-av" style="background:${avc(p.id)}">${ini(p.name)}</div>
      <div style="flex:1"><div class="pax-name2">${p.name}</div><div class="pax-city2"><span class="ms">location_on</span> ${p.city}</div></div>
      ${wa}${call}<button class="unassign-btn" onclick="unassignPax('${t.id}','${p.id}')"><span class="ms">close</span></button></div>`;}).join('');
    let sugH='';
    if(freeC>0&&unassigned.length>0){
      sugH=unassigned.map(p=>`<div class="suggest-row">
        <div class="pax-av" style="background:#e8f5e9;font-size:.68rem;font-weight:700;color:#2ecc71">${p.city.slice(0,3)}</div>
        <div style="flex:1"><div class="pax-name2" style="color:var(--gray)">${p.name}</div><div class="pax-city2"><span class="ms">location_on</span> ${p.city}</div></div>
        <button class="add-btn" onclick="assignPax('${t.id}','${p.id}','${d.id}')"><span class="ms">add</span> שבץ</button></div>`).join('');
    }
    return`<div class="car-block">
      <div class="car-block-header">
        <div style="font-size:1.5rem;color:var(--orange)"><span class="ms">directions_car</span></div>
        <div style="flex:1">
          <div class="car-driver-name">${d.name}</div>
          <div class="car-driver-meta"><span class="ms">home</span> ${d.city} &nbsp;|&nbsp; ${d.carFrom||'?'} → ${d.carTo||d.carFrom||'?'}</div>
          ${d.carNotes?`<div class="car-driver-meta"><span class="ms">chat_bubble</span> ${d.carNotes}</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0;">
          ${d.phone?`<a class="pax-contact-btn" href="https://wa.me/${waNum(d.phone)}" target="_blank" title="וואטסאפ לנהג"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.313-2.236l-.44-.363-3.09 1.036 1.036-3.09-.363-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg></a>`:''}
          ${d.phone?`<a class="pax-contact-btn pax-call-btn" href="tel:${d.phone}" title="חיוג לנהג"><span class="ms">phone</span></a>`:''}
        </div>
      </div>
      <div class="seats-row">${seatsH}</div>
      <div class="car-passengers">${!paxH&&!sugH?`<div class="car-empty">אין נוסעים משובצים</div>`:''}${paxH}${sugH}</div>
    </div>`;
  }).join('');
}
function buildPoolHTML(t,unassigned,drivers){
  if(!unassigned.length){
    const nonDrivers=t.participants.filter(p=>!p.hasCar);
    if(!nonDrivers.length) return`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--gray)">group</span></div><p>ממתין למשתתפים ללא רכב</p></div>`;
    if(!drivers.length) return`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--gray)">no_transfer</span></div><p>אין ממתינים לשיבוץ</p></div>`;
    return`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem;color:var(--green)">done_all</span></div><p>כולם שובצו לרכב!</p></div>`;
  }
  const opts=drivers.map(d=>{const tk=t.participants.filter(p=>p.assignedTo===d.id).length;const fr=Math.max(0,parseInt(d.seats)-tk);return`<option value="${d.id}" ${fr===0?'disabled':''}>${d.name} – ${fr} מקומות</option>`;}).join('');
  return unassigned.map(p=>`<div class="pool-row">
    <div class="pax-av" style="background:${avc(p.id)}">${ini(p.name)}</div>
    <div class="pool-info"><div class="pool-name">${p.name}</div><div class="pool-city"><span class="ms">location_on</span> ${p.city} &nbsp;<span class="ms">phone</span> ${p.phone}</div></div>
    ${drivers.length?`<select class="assign-select" id="sel-${p.id}"><option value="">בחר רכב...</option>${opts}</select>
    <button class="assign-btn" onclick="assignFromSelect('${t.id}','${p.id}')">שבץ</button>`:`<span style="font-size:.76rem;color:var(--gray)">אין רכבים</span>`}
  </div>`).join('');
}
function buildPaxHTML(t){
  if(!t.participants.length)return`<div class="empty-state"><div class="ei"><span class="ms" style="font-size:2.3rem">manage_search</span></div><p>עדיין אין נרשמים</p></div>`;
  return t.participants.map((p,i)=>{
    const dr=p.assignedTo?t.participants.find(x=>x.id===p.assignedTo):null;
    return`<div class="pax-row">
      <div class="pav" style="background:${AVC[i%8]}">${ini(p.name)}</div>
      <div style="flex:1">
        <div class="p-name">${p.name}</div>
        <div class="p-meta"><span class="ms">location_on</span> ${p.city} &nbsp;<span class="ms">phone</span> ${p.phone}</div>
        ${p.notes?`<div class="p-meta"><span class="ms">chat_bubble</span> ${p.notes}</div>`:''}
        <div class="p-tags">
          ${p.hasCar?`<span class="tag tag-car"><span class="ms">directions_car</span> נוהג | ${p.carFrom||p.city} | ${p.seats} מקומות</span>`:''}
          ${!p.hasCar&&p.needRide&&!p.assignedTo?`<span class="tag tag-ride"><span class="ms">volunteer_activism</span> ממתין</span>`:''}
          ${!p.hasCar&&p.needRide&&p.assignedTo?`<span class="tag tag-assigned"><span class="ms">check</span> ברכב של ${dr?dr.name:'?'}</span>`:''}
          ${!p.hasCar&&!p.needRide?`<span class="tag tag-solo"><span class="ms">directions_walk</span> לבד</span>`:''}
        </div>
      </div>
      <button class="rm-btn" onclick="removePax('${t.id}','${p.id}')"><span class="ms">close</span></button>
    </div>`;
  }).join('');
}

// ===================== ASSIGN =====================
function assignPax(tid,pid,did){
  const t=trips.find(x=>String(x.id)===String(tid)),d=t.participants.find(x=>x.id===did);
  const tk=t.participants.filter(p=>p.assignedTo===did).length;
  if(tk>=parseInt(d.seats)){showToast('הרכב מלא!');return;}
  const p=t.participants.find(x=>x.id===pid);p.assignedTo=did;
  saveTrips();showToast(`${p.name} → רכב של ${d.name}`);renderDetail(t);
}
function assignFromSelect(tid,pid){
  const sel=document.getElementById('sel-'+pid);if(!sel||!sel.value){showToast('בחר רכב');return;}
  assignPax(tid,pid,sel.value);
}
function unassignPax(tid,pid){
  const t=trips.find(x=>String(x.id)===String(tid)),p=t.participants.find(x=>x.id===pid);
  p.assignedTo=null;saveTrips();showToast(`${p.name} הוסר`);renderDetail(t);
}
function removePax(tid,pid){
  const t=trips.find(x=>String(x.id)===String(tid)),idx=t.participants.findIndex(x=>x.id===pid);if(idx<0)return;
  t.participants.forEach(p=>{if(p.assignedTo===pid)p.assignedTo=null;});
  const name=t.participants[idx].name;t.participants.splice(idx,1);
  saveTrips();showToast(`${name} הוסר`);renderDetail(t);
}

// ===================== ADD TRIP =====================
let editingTripId=null;
const unlockedTrips={};
async function checkTripPassword(t){
  if(unlockedTrips[t.id])return true;
  if(!t.hasPassword){
    const pw=prompt('טיול זה עדיין ללא סיסמה.\nהגדר סיסמת עריכה (4-8 תווים):');
    if(!pw||pw.length<4){showToast('נדרשת סיסמה של 4-8 תווים');return false;}
    try{
      const r=await fetch(`${API}/trips/${t.id}`,{method:'PATCH',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({setPassword:pw})});
      const d=await r.json();
      if(d.valid){t.hasPassword=true;unlockedTrips[t.id]=pw;showToast('סיסמה הוגדרה');return true;}
    }catch(e){}
    showToast('שגיאה');return false;
  }
  const pw=prompt('הזן סיסמת עריכה:');
  if(!pw){return false;}
  try{
    const r=await fetch(`${API}/trips/${t.id}`,{method:'PATCH',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const d=await r.json();
    if(d.valid){unlockedTrips[t.id]=pw;return true;}
  }catch(e){}
  showToast('סיסמה שגויה');return false;
}
async function editTrip(id){
  const t=trips.find(x=>String(x.id)===String(id));if(!t)return;
  if(!await checkTripPassword(t))return;
  editingTripId=id;
  document.getElementById('trip-name').value=t.name||'';
  document.getElementById('trip-date').value=t.date||'';
  document.getElementById('trip-time').value=t.time||'08:00';
  document.getElementById('trip-meeting').value=t.meeting||'';
  document.getElementById('trip-desc').value=t.desc||t.description||'';
  document.getElementById('trip-private').checked=!!t.hidden;
  document.getElementById('trip-image-url').value=t.image&&!TRIP_IMAGES.includes(t.image)?t.image:'';
  selectedImage=t.image||TRIP_IMAGES[0];
  selectedCropY=t.cropY!=null?t.cropY:50;
  selectedZoom=t.zoom!=null?t.zoom:100;
  document.getElementById('crop-slider').value=selectedCropY;
  document.getElementById('crop-val').textContent=selectedCropY+'%';
  document.getElementById('zoom-slider').value=selectedZoom;
  document.getElementById('zoom-val').textContent=selectedZoom+'%';
  openModal('modal-add-trip');
  renderImagePicker();
  updateCropPreview();
  // Update modal title for edit mode
  document.querySelector('#modal-add-trip .modal-title span:first-child').innerHTML='<span class="ms">edit</span> עריכת טיול';
  document.querySelector('#modal-add-trip .btn-primary').innerHTML='<span class="ms">save</span> שמור שינויים';
  document.getElementById('trip-delete-row').style.display='block';
}
async function addTrip(){
  const name=document.getElementById('trip-name').value.trim();
  const date=document.getElementById('trip-date').value;
  if(!name||!date){showToast('נא למלא שם ותאריך');return;}
  const tripPw=document.getElementById('trip-password').value.trim();
  const isPrivate=document.getElementById('trip-private').checked;
  const imgUrl=document.getElementById('trip-image-url').value.trim();
  const finalImage=imgUrl||selectedImage;

  if(editingTripId){
    // EDIT existing trip
    const t=trips.find(x=>String(x.id)===String(editingTripId));if(!t)return;
    t.name=name;t.date=date;
    if(tripPw) t.hasPassword=true;
    t.time=document.getElementById('trip-time').value;
    t.meeting=document.getElementById('trip-meeting').value.trim();
    t.desc=document.getElementById('trip-desc').value.trim();
    t.image=finalImage;t.cropY=selectedCropY;t.zoom=selectedZoom;t.hidden=isPrivate;
    currentTripId=t.id;saveTrips();
    closeModal('modal-add-trip');resetTripModal();
    renderDetail(t);showToast('הטיול עודכן');
    return;
  }

  // ADD new trip
  if(!tripPw||tripPw.length<4){showToast('נא להזין סיסמה (4-8 תווים)');return;}
  const newWps=collectWpEditorItems();
  const t={id:'t'+Math.random().toString(36).substr(2,9),name,date,time:document.getElementById('trip-time').value,
    meeting:document.getElementById('trip-meeting').value.trim(),
    desc:document.getElementById('trip-desc').value.trim(),
    image:finalImage,cropY:selectedCropY,zoom:selectedZoom,status:'open',hidden:isPrivate,participants:[],waypoints:newWps};
  try{
    const postBody={...t,password:tripPw};
    const r=await fetch(`${API}/trips`,{method:'POST',
      headers:{'Content-Type':'application/json','X-Creator-Token':creatorToken},
      body:JSON.stringify(postBody)});
    const d=await r.json();
    if(d.id){t.id=d.id;t.hasPassword=!!tripPw;unlockedTrips[t.id]=tripPw;}
  }catch(e){}
  trips.push(t);
  newWps.forEach(w=>geocodeWaypoint(w,()=>{currentTripId=t.id;saveTrips();}));
  closeModal('modal-add-trip');resetTripModal();
  showTrip(t.id);showToast(isPrivate?'טיול פרטי נוצר! שתפו קישור ישיר':'הטיול פורסם!');
}
function resetTripModal(){
  editingTripId=null;
  ['trip-name','trip-date','trip-meeting','trip-desc'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('trip-time').value='08:00';
  document.getElementById('trip-private').checked=false;
  document.getElementById('trip-password').value='';
  document.getElementById('trip-image-url').value='';
  document.getElementById('wp-editor-list').innerHTML='';wpEditorItems=[];
  selectedImage=TRIP_IMAGES[0];selectedCropY=50;selectedZoom=100;renderImagePicker();
  document.getElementById('crop-slider').value=50;
  document.getElementById('zoom-slider').value=100;
  document.getElementById('zoom-val').textContent='100%';
  document.getElementById('crop-val').textContent='50%';
  document.getElementById('crop-preview').style.display='none';
  document.getElementById('crop-slider-row').style.display='none';
  document.querySelector('#modal-add-trip .modal-title span:first-child').innerHTML='<span class="ms">edit</span> פרסום טיול חדש';
  document.querySelector('#modal-add-trip .btn-primary').innerHTML='<span class="ms">send</span> פרסם טיול';
  document.getElementById('trip-delete-row').style.display='none';
}
async function toggleTripHidden(id){
  const t=trips.find(x=>String(x.id)===String(id));if(!t)return;
  if(!await checkTripPassword(t))return;
  t.hidden=!t.hidden;saveTrips();
  showToast(t.hidden?'הטיול הוסתר — גלוי רק דרך קישור':'הטיול גלוי לכולם');
  renderDetail(t);
}
async function deleteTrip(id){
  if(!confirm('בטוח למחוק את הטיול לצמיתות?'))return;
  closeModal('modal-add-trip');
  const hdrs={'X-Creator-Token':creatorToken};
  if(unlockedTrips[id]) hdrs['X-Trip-Password']=unlockedTrips[id];
  try{await fetch(`${API}/trips/${id}`,{method:'DELETE',headers:hdrs});}catch(e){}
  const idx=trips.findIndex(x=>String(x.id)===String(id));if(idx<0)return;
  trips.splice(idx,1);showList();showToast('הטיול נמחק');
}
function autoTripImage(name){
  if(!name.trim())return;
  let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))&0xffff;
  selectedImage=TRIP_IMAGES[h%TRIP_IMAGES.length];
  renderImagePicker();
}
function renderImagePicker(){
  const el=document.getElementById('img-picker');if(!el)return;
  el.innerHTML=TRIP_IMAGES.map((url,i)=>`<div class="img-picker-item${url===selectedImage?' selected':''}" onclick="setTripImage(this,'${url}')"><img src="${url}" loading="lazy"></div>`).join('');
}
function setTripImage(el,url){
  selectedImage=url;
  document.querySelectorAll('.img-picker-item').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('trip-image-url').value='';
  updateCropPreview();
}
function updateCropPreview(){
  const img=document.getElementById('crop-preview-img');
  const wrap=document.getElementById('crop-preview');
  const row=document.getElementById('crop-slider-row');
  if(selectedImage){
    img.src=selectedImage;
    applyCropPreviewStyle();
    wrap.style.display='block';
    row.style.display='block';
  }else{wrap.style.display='none';row.style.display='none';}
}
function updateCropPosition(val){
  selectedCropY=parseInt(val);
  document.getElementById('crop-val').textContent=val+'%';
  applyCropPreviewStyle();
}
function updateZoom(val){
  selectedZoom=parseInt(val);
  document.getElementById('zoom-val').textContent=val+'%';
  applyCropPreviewStyle();
}
function applyCropPreviewStyle(){
  const img=document.getElementById('crop-preview-img');
  if(!img)return;
  if(selectedZoom>100){
    img.style.objectFit='none';
    img.style.objectPosition=`center ${selectedCropY}%`;
    img.style.transform=`scale(${selectedZoom/100})`;
  }else{
    img.style.objectFit='cover';
    img.style.objectPosition=`center ${selectedCropY}%`;
    img.style.transform='none';
  }
}

// ===================== NAV =====================
function showList(){
  cleanupMap();
  if(leafletMapObj){leafletMapObj.remove();leafletMapObj=null;}
  location.hash='';isDirectLink=false;
  document.getElementById('back-to-list-btn').style.display='none';
  document.getElementById('view-detail').classList.remove('active');
  document.getElementById('view-admin').classList.remove('active');
  document.getElementById('view-list').classList.add('active');
  document.getElementById('hero-section').style.display='';
  renderList();
}
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='modal-add-trip'){if(!editingTripId)resetTripModal();renderImagePicker();updateCropPreview();setTimeout(()=>tryAttachAutocomplete('trip-meeting'),200);}
  if(id==='modal-add-wp'){if(!document.getElementById('wp-edit-id').value)resetWpModal();setTimeout(()=>{tryAttachAutocomplete('wp-address');tryAttachWpAutocomplete();},200);}
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function tryAttachWpAutocomplete(){
  if(!gmapsScriptLoaded||!window.google||!window.google.maps||!window.google.maps.places)return;
  const input=document.getElementById('wp-name');if(!input||input._wpAcAttached)return;
  input._wpAcAttached=true;
  const ac=new google.maps.places.Autocomplete(input,{componentRestrictions:{country:'il'},fields:['name','formatted_address','geometry','place_id']});
  ac.addListener('place_changed',async()=>{
    const raw=ac.getPlace();if(!raw||!raw.place_id)return;
    // Use new Place API to get full details
    try{
      const {Place}=google.maps.places;
      const det=new Place({id:raw.place_id});
      await det.fetchFields({fields:['displayName','formattedAddress','nationalPhoneNumber','location','rating','userRatingCount','websiteURI']});
      applyGoogleDetails(det);
    }catch(e){
      // Fallback: use what Autocomplete returned
      if(raw.formatted_address) document.getElementById('wp-address').value=raw.formatted_address;
      window._wpGoogleData={lat:raw.geometry?.location?.lat()||null,lng:raw.geometry?.location?.lng()||null,
        rating:null,ratingsTotal:null,placeId:raw.place_id||null};
    }
  });
}
function tryAttachAutocomplete(inputId){
  if(!gmapsScriptLoaded||!window.google||!window.google.maps||!window.google.maps.places)return;
  const input=document.getElementById(inputId);if(!input||input._acAttached)return;
  input._acAttached=true;
  const ac=new google.maps.places.Autocomplete(input,{componentRestrictions:{country:'il'},fields:['name','geometry','formatted_address']});
  ac.addListener('place_changed',()=>{const p=ac.getPlace();if(p&&p.formatted_address)input.value=p.formatted_address;});
}
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});

// ===================== UTILS =====================
function starsHTML(r){
  if(!r)return'';const full=Math.floor(r),half=r-full>=0.5?1:0,empty=5-full-half;
  return'★'.repeat(full)+(half?'½':'')+'☆'.repeat(empty);
}
function num(n){if(!n)return'0';return n>=1000?(n/1000).toFixed(1)+'k':String(n);}
function fmtDate(d){
  if(!d)return'';const[y,m,day]=d.split('-');
  const mo=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return`${parseInt(day)} ב${mo[parseInt(m)-1]} ${y}`;
}
function ini(n){return(n||'').split(' ').map(x=>x[0]||'').join('').slice(0,2);}
function avc(id){return AVC[(parseInt((id||'').replace(/\D/g,''))||0)%8];}
function haversine(a,b,c,d){
  const R=6371,dL=(c-a)*Math.PI/180,dG=(d-b)*Math.PI/180;
  const x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);
}

// ===================== SEARCH =====================
function filterTrips(q){
  showList();
  const term=q.trim().toLowerCase();
  document.querySelectorAll('.trip-card').forEach(card=>{
    const text=card.textContent.toLowerCase();
    card.style.display=(!term||text.includes(term))?'':'none';
  });
}
function focusSearch(){
  showList();
  const inp=document.getElementById('search-input');
  if(inp){inp.focus();window.scrollTo({top:0,behavior:'smooth'});}
}
function joinFromCard(id){
  showTrip(id);
  setTimeout(()=>{
    const el=document.querySelector('.join-section');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  },350);
}

// ===================== ADMIN =====================
let adminToken=localStorage.getItem('tiyulim_admin_token')||'';
function showAdmin(){
  location.hash='admin';
  document.getElementById('hero-section').style.display='none';
  document.getElementById('view-list').classList.remove('active');
  document.getElementById('view-detail').classList.remove('active');
  document.getElementById('view-admin').classList.add('active');
  if(adminToken){loadAdminTrips();}
  else{document.getElementById('admin-login').style.display='';document.getElementById('admin-content').style.display='none';}
}
function adminLogin(){
  const t=document.getElementById('admin-token-input').value.trim();
  if(!t){showToast('נא להזין טוקן');return;}
  adminToken=t;localStorage.setItem('tiyulim_admin_token',t);
  loadAdminTrips();
}
async function loadAdminTrips(){
  try{
    const r=await fetch(`${API}/admin/trips`,{headers:{'X-Admin-Token':adminToken}});
    if(!r.ok){adminToken='';localStorage.removeItem('tiyulim_admin_token');showToast('טוקן שגוי');
      document.getElementById('admin-login').style.display='';document.getElementById('admin-content').style.display='none';return;}
    renderAdminTrips(await r.json());
  }catch(e){showToast('שגיאה בטעינה');}
}
function renderAdminTrips(all){
  document.getElementById('admin-login').style.display='none';
  const el=document.getElementById('admin-content');el.style.display='block';
  const totalPax=all.reduce((s,t)=>s+t.participants.length,0);
  let h=`<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem;">
    <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
      <div style="font-size:1.5rem;font-weight:900;color:var(--teal);">${all.length}</div><div style="font-size:.78rem;color:var(--gray);">טיולים</div></div>
    <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
      <div style="font-size:1.5rem;font-weight:900;color:var(--orange);">${totalPax}</div><div style="font-size:.78rem;color:var(--gray);">משתתפים</div></div>
    <div style="background:white;border-radius:12px;padding:.8rem 1.2rem;box-shadow:var(--card-shadow);flex:1;min-width:120px;text-align:center;">
      <div style="font-size:1.5rem;font-weight:900;color:var(--green);">${all.filter(t=>!t.hidden).length}</div><div style="font-size:.78rem;color:var(--gray);">ציבוריים</div></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;">
    <span style="font-weight:700;color:var(--dark);">כל הטיולים</span>
    <div style="display:flex;gap:.5rem;">
      <button class="btn btn-ghost btn-sm" onclick="loadAdminTrips()"><span class="ms">refresh</span> רענן</button>
      <button class="btn btn-ghost btn-sm" onclick="showList()"><span class="ms">arrow_forward</span> חזרה</button>
    </div>
  </div>`;
  h+=all.map(t=>`<div style="background:white;border-radius:12px;padding:.8rem 1rem;margin-bottom:.65rem;box-shadow:var(--card-shadow);display:flex;align-items:center;gap:.8rem;">
    <div style="width:55px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;">
      ${t.image?`<img src="${t.image}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`:'<div style="width:100%;height:100%;background:#eef2f5;"></div>'}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:.9rem;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${t.name} ${t.hidden?'<span style="background:#fff3e0;color:var(--orange-dark);font-size:.68rem;padding:.1rem .4rem;border-radius:4px;font-weight:600;">פרטי</span>':''}
      </div>
      <div style="font-size:.75rem;color:var(--gray);">${t.date||'—'} | ${t.participants.length} משתתפים | ${t.waypoints.length} נקודות</div>
    </div>
    <div style="display:flex;gap:.3rem;flex-shrink:0;">
      <button style="background:var(--teal-pale);border:none;border-radius:8px;padding:.35rem .5rem;cursor:pointer;color:var(--teal-dark);" onclick="showTrip('${t.id}')"><span class="ms" style="font-size:1rem;">visibility</span></button>
      <button style="background:#ffebee;border:none;border-radius:8px;padding:.35rem .5rem;cursor:pointer;color:#c62828;" onclick="adminDeleteTrip('${t.id}')"><span class="ms" style="font-size:1rem;">delete</span></button>
    </div>
  </div>`).join('');
  if(!all.length) h+='<div style="text-align:center;padding:2rem;color:var(--gray);">אין טיולים עדיין</div>';
  el.innerHTML=h;
}
async function adminDeleteTrip(id){
  if(!confirm('למחוק טיול זה?'))return;
  try{await fetch(`${API}/trips/${id}`,{method:'DELETE',headers:{'X-Admin-Token':adminToken}});}catch(e){}
  loadAdminTrips();
}

// ===================== INIT =====================
(async function init(){
  // Clean old localStorage data
  try{localStorage.removeItem('tiyulim_data');}catch(e){}
  // Auto-load Google Maps API key from server config
  if(!gmapsKey){
    try{const r=await fetch(`${API}/config`);if(r.ok){const c=await r.json();
      if(c.gmapsKey){gmapsKey=c.gmapsKey;localStorage.setItem('tiyulim_gmaps_key',c.gmapsKey);}
    }}catch(e){}
  }
  trips=await loadTripsFromAPI();
  syncIds();
  renderList();
  initRouter();
})();
