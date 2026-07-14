// Minimal 5-field cron evaluator. No external dependencies.
// Supports: *, */N, a-b ranges, comma-separated lists, and combinations thereof.

function parseField(field) {
  if (field === "*") return () => true;
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    if (!Number.isFinite(step) || step < 1)
      throw new Error(`invalid cron step "${field}"`);
    return (v) => v % step === 0;
  }
  const values = new Set();
  for (const part of field.split(",")) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b))
        throw new Error(`invalid cron range "${part}"`);
      for (let i = a; i <= b; i++) values.add(i);
    } else {
      const n = Number(part);
      if (!Number.isFinite(n)) throw new Error(`invalid cron value "${part}"`);
      values.add(n);
    }
  }
  return (v) => values.has(v);
}

/**
 * Parse a 5-field cron expression and return a match predicate.
 * @param {string} expr - e.g. "0 8 * * 1" (Monday 08:00)
 * @returns {(date: Date) => boolean}
 */
export function parseCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5)
    throw new Error(`cron expression must have exactly 5 fields: "${expr}"`);
  const [minF, hourF, domF, monthF, dowF] = parts.map(parseField);
  return (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const dow = d.getDay(); // 0=Sun…6=Sat
    return (
      minF(d.getMinutes()) &&
      hourF(d.getHours()) &&
      domF(d.getDate()) &&
      monthF(d.getMonth() + 1) &&
      (dowF(dow) || (dow === 0 && dowF(7))) // treat 0 and 7 both as Sunday
    );
  };
}
