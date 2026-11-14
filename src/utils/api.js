const API_BASE = '/api';

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function fetchTodayAttendance(dateStr) {
  const query = dateStr ? `?date=${dateStr}` : '';
  const res = await fetch(`${API_BASE}/attendance/today${query}`);
  if (!res.ok) throw new Error('Failed to load today attendance');
  return res.json();
}

export async function punchAttendance({ workerId, type, method = 'QR', date, time, markedBy }) {
  const res = await fetch(`${API_BASE}/attendance/punch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId, type, method, date, time, markedBy })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to record punch');
  return data;
}

export async function fetchWorkers() {
  const res = await fetch(`${API_BASE}/workers`);
  if (!res.ok) throw new Error('Failed to load workers');
  return res.json();
}

export async function createWorker(workerData) {
  const res = await fetch(`${API_BASE}/workers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workerData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create worker');
  return data;
}

export async function updateWorker(id, updates) {
  const res = await fetch(`${API_BASE}/workers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update worker');
  return data;
}

export async function deleteWorker(id) {
  const res = await fetch(`${API_BASE}/workers/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete worker');
  return res.json();
}

export async function fetchMonthlyReport(monthStr) {
  const query = monthStr ? `?month=${monthStr}` : '';
  const res = await fetch(`${API_BASE}/reports/monthly${query}`);
  if (!res.ok) throw new Error('Failed to load monthly report');
  return res.json();
}

export async function manualOverrideAttendance(payload) {
  const res = await fetch(`${API_BASE}/attendance/manual-override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to override attendance');
  return data;
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.json();
}

export async function fetchNetworkIp() {
  const res = await fetch(`${API_BASE}/settings/network-ip`);
  return res.json();
}
