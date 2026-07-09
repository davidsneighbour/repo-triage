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
  clearSchedule: (id) => fetch(`/api/repos/${id}/clear`, { method: 'POST' }).then(json),
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
  snooze: (id, days) =>
    fetch(`/api/repos/${id}/snooze`, {
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
  bulk: (action, ids, params = {}) =>
    fetch('/api/repos/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids, ...params }),
    }).then(json),
  setIgnored: (id, ignored) =>
    fetch(`/api/repos/${id}/ignore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored }),
    }).then(json),
  addNotice: (id, body, createdAt) =>
    fetch(`/api/repos/${id}/notices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, created_at: createdAt }),
    }).then(json),
  restoreState: (id, prioritySetAt, checkedAt) =>
    fetch(`/api/repos/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority_set_at: prioritySetAt, checked_at: checkedAt }),
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
  deleteTag: (tag) => fetch(`/api/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }).then(json),
  addFlag: (id, flag) =>
    fetch(`/api/repos/${id}/flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag }),
    }).then(json),
  removeFlag: (id, flag) => fetch(`/api/repos/${id}/flags/${encodeURIComponent(flag)}`, { method: 'DELETE' }).then(json),
  ghOpen: (id) => fetch(`/api/repos/${id}/gh/open`, { method: 'POST' }).then(json),
  ghPrs: (id) => fetch(`/api/repos/${id}/gh/prs`).then(json),
  ghCreateIssue: (id, title, body) =>
    fetch(`/api/repos/${id}/gh/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    }).then(json),
  getSettings: () => fetch('/api/settings').then(json),
  putSettings: (settings) =>
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).then(json),
  getPrefs: () => fetch('/api/prefs').then(json),
  putPrefs: (prefs) =>
    fetch('/api/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    }).then(json),
  reportKinds: () => fetch('/api/reports').then(json),
  report: (kind, { format = 'json', days } = {}) => {
    const qs = new URLSearchParams({ format });
    if (days != null) qs.set('days', String(days));
    const p = fetch(`/api/reports/${encodeURIComponent(kind)}?${qs}`);
    return format === 'json' ? p.then(json) : p.then((r) => r.text());
  },
  getTagRules: () => fetch('/api/tag-rules').then(json),
  putTagRule: (tag, days) =>
    fetch(`/api/tag-rules/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    }).then(json),
  deleteTagRule: (tag) =>
    fetch(`/api/tag-rules/${encodeURIComponent(tag)}`, { method: 'DELETE' }).then(json),
  getActivity: (id) => fetch(`/api/repos/${id}/activity`).then(json),
  getUndoLog: () => fetch('/api/undo').then(json),
  createUndo: (label, ops) =>
    fetch('/api/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, ops }),
    }).then(json),
  executeUndo: (id) => fetch(`/api/undo/${id}`, { method: 'POST' }).then(json),
  discardUndo: (id) => fetch(`/api/undo/${id}`, { method: 'DELETE' }).then(json),
  getLastExport: () => fetch('/api/reports/last-export').then(json),
  repoIssues: (id) => fetch(`/api/repos/${id}/issues`).then(json),
  syncRepoIssues: (id) => fetch(`/api/repos/${id}/issues/sync`, { method: 'POST' }).then(json),
  setIssueSync: (id, enabled) =>
    fetch(`/api/repos/${id}/issue-sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then(json),
  setIssueFlagged: (id, number, flagged) =>
    fetch(`/api/repos/${id}/issues/${number}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged }),
    }).then(json),
  getSettingsSets: () => fetch('/api/settings-sets').then(json),
  getRepoConformance: (id, presetId) =>
    fetch(`/api/repos/${id}/settings-sets/${encodeURIComponent(presetId)}`).then(json),
};
