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
  setChecked: (id, daysAgo = 0) =>
    fetch(`/api/repos/${id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daysAgo }),
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
  setIgnored: (id, ignored) =>
    fetch(`/api/repos/${id}/ignore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored }),
    }).then(json),
  addNotice: (id, body) =>
    fetch(`/api/repos/${id}/notices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }).then(json),
  repoNotices: (id) => fetch(`/api/repos/${id}/notices`).then(json),
  allNotices: (sort = 'date', dir = 'desc') =>
    fetch(`/api/notices?sort=${encodeURIComponent(sort)}&dir=${encodeURIComponent(dir)}`).then(json),
  deleteNotice: (noticeId) => fetch(`/api/notices/${noticeId}`, { method: 'DELETE' }).then(json),
  addTag: (id, tag) =>
    fetch(`/api/repos/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    }).then(json),
  removeTag: (id, tag) => fetch(`/api/repos/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }).then(json),
};
