import { useState } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../lib/useDialog.js';
import { devId } from '../lib/devIdOverlay.js';
import { cx } from '../lib/constants.js';

export function SettingsDialog({ settings, defaults, tagRules = [], lastExport = null, onSave, onTagRuleSave, onTagRuleDelete, onClose }) {
  const dialogRef = useDialog(onClose);

  const [defaultInactivityDays, setDefaultInactivityDays] = useState(
    String(settings?.defaultInactivityDays ?? defaults?.defaultInactivityDays ?? 7)
  );
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(
    String(settings?.syncIntervalMinutes ?? defaults?.syncIntervalMinutes ?? 60)
  );
  const [githubOwners, setGithubOwners] = useState(
    String(settings?.githubOwners ?? defaults?.githubOwners ?? '')
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newRuleDays, setNewRuleDays] = useState('');
  const [ruleError, setRuleError] = useState('');
  const [scheduleCron, setScheduleCron] = useState(settings?.reportSchedule?.cron ?? '');
  const [scheduleOutputPath, setScheduleOutputPath] = useState(settings?.reportSchedule?.outputPath ?? '');

  const handleAddRule = async () => {
    const tag = newRuleTag.trim().toLowerCase();
    const days = Number(newRuleDays);
    if (!tag) { setRuleError('Tag is required.'); return; }
    if (!Number.isFinite(days) || days < 1 || days > 365) { setRuleError('Days must be 1–365.'); return; }
    setRuleError('');
    await onTagRuleSave?.(tag, days);
    setNewRuleTag('');
    setNewRuleDays('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = [];
    const days = Number(defaultInactivityDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) errs.push('Review cycle must be between 1 and 365 days.');
    const mins = Number(syncIntervalMinutes);
    if (!Number.isFinite(mins) || mins < 1 || mins > 1440) errs.push('Sync interval must be between 1 and 1440 minutes.');
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    const reportSchedule = scheduleCron.trim() && scheduleOutputPath.trim()
      ? { cron: scheduleCron.trim(), outputPath: scheduleOutputPath.trim() }
      : null;
    try {
      await onSave({ defaultInactivityDays: days, syncIntervalMinutes: mins, githubOwners, reportSchedule });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 outline-hidden focus:border-neutral-500';
  const labelClass = 'mb-1 block text-[11px] text-neutral-400';

  return (
    <>
      <div className="fixed inset-0 z-30 bg-neutral-950/80" onClick={onClose} />
      <section
        {...devId('SettingsDialog')}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        className="fixed inset-x-4 top-6 z-40 mx-auto max-w-md overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
      >
        <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 id="settings-dialog-title" className="text-sm font-semibold text-neutral-100">Settings</h2>
            <p className="text-[11px] text-neutral-500">Overrides for .env defaults · persisted across restarts</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-300 hover:bg-neutral-800"
            aria-label="Close settings"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate className="px-4 py-4 space-y-4">
          {errors.length > 0 && (
            <div role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <div>
            <label htmlFor="settings-inactivity-days" className={labelClass}>
              Default review cycle (days)
            </label>
            <input
              id="settings-inactivity-days"
              type="number"
              min={1}
              max={365}
              value={defaultInactivityDays}
              onChange={(e) => setDefaultInactivityDays(e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1 text-[10px] text-neutral-600">
              Repos unseen for this many days return to Today. Env default: {defaults?.defaultInactivityDays ?? 7}d.
            </p>
          </div>

          <div>
            <label htmlFor="settings-sync-interval" className={labelClass}>
              Auto-sync interval (minutes)
            </label>
            <input
              id="settings-sync-interval"
              type="number"
              min={1}
              max={1440}
              value={syncIntervalMinutes}
              onChange={(e) => setSyncIntervalMinutes(e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1 text-[10px] text-neutral-600">
              How often the server polls GitHub. Env default: {defaults?.syncIntervalMinutes ?? 60}m.
            </p>
          </div>

          <div>
            <label htmlFor="settings-owners" className={labelClass}>
              GitHub owners (comma-separated)
            </label>
            <input
              id="settings-owners"
              type="text"
              value={githubOwners}
              onChange={(e) => setGithubOwners(e.target.value)}
              placeholder="Leave blank to load the authenticated user's repos"
              className={cx(fieldClass, 'placeholder:text-neutral-700')}
            />
            <p className="mt-1 text-[10px] text-neutral-600">
              Changing owners triggers an immediate re-sync. Env default: {defaults?.githubOwners || '(token owner)'}.
            </p>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <p className={labelClass}>Tag rules</p>
            <p className="mb-2 text-[10px] text-neutral-600">
              Override review cadence per tag. Precedence: per-repo → tag rule → global default. Minimum days wins when multiple tags match.
            </p>
            {tagRules.length > 0 && (
              <ul className="mb-2 space-y-1">
                {tagRules.map((r) => (
                  <li key={r.tag} className="flex items-center justify-between rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-300">
                    <span><span className="font-mono text-neutral-100">{r.tag}</span> → {r.days}d</span>
                    <button
                      type="button"
                      onClick={() => onTagRuleDelete?.(r.tag)}
                      aria-label={`Delete tag rule for ${r.tag}`}
                      className="text-neutral-500 hover:text-rose-400"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ruleError && (
              <p role="alert" className="mb-1 text-[10px] text-rose-400">{ruleError}</p>
            )}
            <div className="flex gap-2">
              <input
                aria-label="Tag rule tag"
                type="text"
                placeholder="tag"
                value={newRuleTag}
                onChange={(e) => setNewRuleTag(e.target.value)}
                className={cx(fieldClass, 'flex-1 placeholder:text-neutral-700')}
              />
              <input
                aria-label="Tag rule days"
                type="number"
                min={1}
                max={365}
                placeholder="days"
                value={newRuleDays}
                onChange={(e) => setNewRuleDays(e.target.value)}
                className={cx(fieldClass, 'w-20 placeholder:text-neutral-700')}
              />
              <button
                type="button"
                onClick={handleAddRule}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-700"
              >
                Add
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4">
            <p className={labelClass}>Scheduled report export</p>
            <p className="mb-2 text-[10px] text-neutral-600">
              Writes all reports to disk after each sync when the cron schedule matches (5-field format, local time).
              Leave blank to disable.
            </p>
            <div className="space-y-2">
              <div>
                <label htmlFor="settings-sched-cron" className={labelClass}>Cron expression</label>
                <input
                  id="settings-sched-cron"
                  type="text"
                  placeholder="0 8 * * 1-5  (Mon–Fri at 08:00)"
                  value={scheduleCron}
                  onChange={(e) => setScheduleCron(e.target.value)}
                  className={cx(fieldClass, 'placeholder:text-neutral-700 font-mono')}
                />
              </div>
              <div>
                <label htmlFor="settings-sched-path" className={labelClass}>Output path</label>
                <input
                  id="settings-sched-path"
                  type="text"
                  placeholder="/data/reports"
                  value={scheduleOutputPath}
                  onChange={(e) => setScheduleOutputPath(e.target.value)}
                  className={cx(fieldClass, 'placeholder:text-neutral-700')}
                />
              </div>
              {lastExport && (
                <p className="text-[10px] text-neutral-500">
                  Last export: {lastExport.status === 'ok' ? '✓' : '⚠'} {new Date(lastExport.timestamp).toLocaleString()}
                  {lastExport.outputPath && ` → ${lastExport.outputPath}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
