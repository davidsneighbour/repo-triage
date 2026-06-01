const json = (r) => r.json();

export const api = {
  list: () => fetch('/api/repos').then(json),
  refresh: () => fetch('/api/refresh', { method: 'POST' }).then(json),
  setPriority: (id, priority) =>
    fetch(`/api/repos/${id}/priority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    }).then(json),
  touch: (id) => fetch(`/api/repos/${id}/touch`, { method: 'POST' }).then(json),
  setInactivity: (id, days) =>
    fetch(`/api/repos/${id}/inactivity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    }).then(json),
  reorder: (orderedIds) =>
    fetch('/api/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    }).then(json),
};
