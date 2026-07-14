export function timeAgo(iso, nowMs = Date.now()) {
  if (!iso) return "never";
  const s = (nowMs - new Date(iso).getTime()) / 1000;
  const units = [
    ["y", 31536000],
    ["mo", 2592000],
    ["w", 604800],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [u, secs] of units) {
    if (s >= secs) return `${Math.floor(s / secs)}${u} ago`;
  }
  return "just now";
}

// Column heads lead with the relative phrase (Today / Tomorrow / In N days) and
// keep the concrete weekday as the muted subtitle, e.g. "Tomorrow · Saturday".
export function calendarLabel(offset, now = new Date()) {
  if (offset === 0) return { title: "Today", subtitle: "needs review" };

  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
  }).format(date);

  if (offset === 1) return { title: "Tomorrow", subtitle: weekday };
  if (offset === 2) return { title: "Day after", subtitle: weekday };
  return { title: `In ${offset} days`, subtitle: weekday };
}
