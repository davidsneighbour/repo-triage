// Shared by the per-repo Activity tab (NoticesDialog) and the cross-repo
// EventLogView (#78) — one human-readable summary per activity_log action.
export const ACTION_LABEL = {
  priority: 'Priority changed',
  clear: 'Schedule cleared',
  state: 'State restored',
  check: 'Checked',
  touch: 'Touched',
  inactivity: 'Review cadence changed',
  snooze: 'Snoozed',
  ignore: 'Ignored/unignored',
  notice_add: 'Notice added',
  notice_delete: 'Notice deleted',
  tag_add: 'Tag added',
  tag_remove: 'Tag removed',
  flag_add: 'Flag added',
  flag_remove: 'Flag removed',
};

export function activitySummary(entry) {
  const d = entry.detail;
  if (!d) return ACTION_LABEL[entry.action] ?? entry.action;
  if (entry.action === 'check') return `Checked (${d.daysAgo}d ago)`;
  if (entry.action === 'snooze') return `Snoozed ${d.days}d`;
  if (entry.action === 'inactivity') return `Review cadence → ${d.days == null ? 'default' : `${d.days}d`}`;
  if (entry.action === 'priority') return `Priority → ${d.priority ?? 'none'}`;
  if (entry.action === 'tag_add') return `Tag added: ${d.tag}`;
  if (entry.action === 'tag_remove') return `Tag removed: ${d.tag}`;
  if (entry.action === 'flag_add') return `Flag added: ${d.flag}`;
  if (entry.action === 'flag_remove') return `Flag removed: ${d.flag}`;
  if (entry.action === 'ignore') return d.ignored ? 'Ignored' : 'Unignored';
  if (entry.action === 'notice_add') return `Notice: ${String(d.body).slice(0, 60)}${d.body?.length > 60 ? '…' : ''}`;
  return ACTION_LABEL[entry.action] ?? entry.action;
}
