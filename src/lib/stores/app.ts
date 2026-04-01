import { writable } from 'svelte/store';
import type { Trip } from '$lib/types';

// --- Trip data ---
export const trips = writable<Trip[]>([]);
export const currentTrip = writable<Trip | null>(null);

// --- Creator token (persisted in localStorage with ct_ prefix) ---
function initCreatorToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('tiyulim_creator') || '';
  if (!token) {
    token = 'ct_' + Math.random().toString(36).substr(2, 12);
    localStorage.setItem('tiyulim_creator', token);
  }
  return token;
}
export const creatorToken = writable<string>(initCreatorToken());

// --- Google Maps ---
function initGmapsKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tiyulim_gmaps_key') || '';
}
export const gmapsKey = writable<string>(initGmapsKey());
export const gmapsLoaded = writable<boolean>(false);

// --- Toast ---
export const toastMessage = writable<string>('');

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.set(msg);
  toastTimer = setTimeout(() => {
    toastMessage.set('');
    toastTimer = null;
  }, 2800);
}

// --- Drawer ---
export const drawerOpen = writable<boolean>(false);

// --- Modal state ---
export const modalState = writable<{
  tripEditor: boolean;
  waypointEditor: boolean;
  apiKey: boolean;
  editingTripId: string | null;
  editingWaypointId: string | null;
}>({
  tripEditor: false,
  waypointEditor: false,
  apiKey: false,
  editingTripId: null,
  editingWaypointId: null
});

// --- Unlocked trips (trip ID -> password) ---
export const unlockedTrips = writable<Record<string, string>>({});

// --- Admin ---
function initAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tiyulim_admin_token') || '';
}
export const adminToken = writable<string>(initAdminToken());
