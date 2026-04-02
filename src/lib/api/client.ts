import type { Trip } from '$lib/types';

const API = '/api';

interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { data: null, error: text || `HTTP ${res.status}` };
    }
    const data = await res.json() as T;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message || 'Network error' };
  }
}

// --- Trips ---

export async function loadTrips(creatorToken: string): Promise<ApiResult<Trip[]>> {
  return request<Trip[]>(`${API}/trips?mine=${encodeURIComponent(creatorToken)}`);
}

export async function loadTrip(id: string): Promise<ApiResult<Trip>> {
  return request<Trip>(`${API}/trips/${id}`);
}

export async function createTrip(
  trip: Partial<Trip> & { password?: string },
  creatorToken: string,
  password?: string
): Promise<ApiResult<{ id: string }>> {
  const body = { ...trip };
  if (password) body.password = password;
  return request<{ id: string }>(`${API}/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Creator-Token': creatorToken
    },
    body: JSON.stringify(body)
  });
}

export async function updateTrip(
  trip: Trip,
  creatorToken: string,
  password?: string
): Promise<ApiResult<Trip>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Creator-Token': creatorToken
  };
  if (password) headers['X-Trip-Password'] = btoa(unescape(encodeURIComponent(password)));
  return request<Trip>(`${API}/trips/${trip.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(trip)
  });
}

// Atomic participant operations — no race conditions

export async function addParticipant(
  tripId: string,
  participant: Record<string, unknown>
): Promise<ApiResult<{ success: boolean; participant: unknown; total: number }>> {
  return request(`${API}/trips/${tripId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(participant)
  });
}

export async function removeParticipant(
  tripId: string,
  pid: string
): Promise<ApiResult<{ success: boolean }>> {
  return request(`${API}/trips/${tripId}/participants?pid=${pid}`, {
    method: 'DELETE'
  });
}

export async function assignParticipant(
  tripId: string,
  pid: string,
  assignedTo: string | null
): Promise<ApiResult<{ success: boolean; participants: unknown[] }>> {
  return request(`${API}/trips/${tripId}/participants`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid, assignedTo })
  });
}

export async function toggleParticipantCar(
  tripId: string,
  pid: string,
  hasCar: boolean,
  seats?: number
): Promise<ApiResult<{ success: boolean; participants: unknown[] }>> {
  return request(`${API}/trips/${tripId}/participants`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid, hasCar, seats: hasCar ? (seats || 4) : 0 })
  });
}

// Legacy: full participant save (kept for backward compat)
export async function saveParticipants(
  trip: Trip,
  creatorToken: string
): Promise<ApiResult<{ success: boolean }>> {
  return request<{ success: boolean }>(`${API}/trips/${trip.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Creator-Token': creatorToken
    },
    body: JSON.stringify(trip)
  });
}

export async function deleteTrip(
  id: string,
  creatorToken: string,
  password?: string
): Promise<ApiResult<{ ok: boolean }>> {
  const headers: Record<string, string> = {
    'X-Creator-Token': creatorToken
  };
  if (password) headers['X-Trip-Password'] = btoa(unescape(encodeURIComponent(password)));
  return request<{ ok: boolean }>(`${API}/trips/${id}`, {
    method: 'DELETE',
    headers
  });
}

// --- Password ---

export async function checkPassword(
  id: string,
  password: string
): Promise<ApiResult<{ valid: boolean }>> {
  return request<{ valid: boolean }>(`${API}/trips/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
}

export async function setPassword(
  id: string,
  password: string,
  creatorToken?: string
): Promise<ApiResult<{ valid: boolean }>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (creatorToken) headers['X-Creator-Token'] = creatorToken;
  return request<{ valid: boolean }>(`${API}/trips/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ setPassword: password })
  });
}

// --- Admin ---

export async function loadAdminTrips(
  adminToken: string
): Promise<ApiResult<Trip[]>> {
  return request<Trip[]>(`${API}/admin/trips`, {
    headers: { 'X-Admin-Token': adminToken }
  });
}

// --- Config ---

export async function loadConfig(): Promise<ApiResult<{ gmapsKey?: string }>> {
  return request<{ gmapsKey?: string }>(`${API}/config`);
}
