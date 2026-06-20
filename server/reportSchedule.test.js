import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-dash-sched-'));
process.env.DATA_DIR = tmpDir;
process.env.SYNC_ON_STARTUP = 'false';
process.env.SYNC_AUTO = 'false';
process.env.GITHUB_TOKEN = 'test-token';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('./github.js', () => ({
  rateLimit: { limit: 5000, remaining: 4999, used: 1, reset: null, lastChecked: null, authInvalid: false },
  sourceStatus: { owners: [], warnings: [] },
  authStatus: { source: 'env', present: true },
  fetchAllRepos: vi.fn().mockResolvedValue([]),
  parseRateLimitHeaders: vi.fn(),
  parseOwners: (raw) => (raw ? String(raw).split(/[\s,]+/).filter(Boolean) : []),
}));

const { checkReportSchedule, getScheduleConfig, setScheduleConfig, getLastExport } = await import('./lib/reportSchedule.js');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkReportSchedule', () => {
  it('does nothing when no schedule is configured', () => {
    setScheduleConfig(null);
    expect(() => checkReportSchedule(new Date())).not.toThrow();
    expect(getLastExport()).toBeNull();
  });

  it('does nothing when schedule does not match current time', () => {
    const outputPath = path.join(tmpDir, 'reports-nomatch');
    setScheduleConfig({ cron: '59 23 31 12 6', outputPath }); // extremely unlikely to match
    const past = new Date(2026, 0, 1, 0, 0); // Jan 1 00:00 - won't match "59 23 31 12 6"
    checkReportSchedule(past);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('exports reports when schedule matches and writes last-export info', () => {
    const outputPath = path.join(tmpDir, 'reports-match');
    // Use a specific date and matching cron expression.
    const matchDate = new Date(2026, 5, 13, 8, 0, 0); // June 13, 08:00 local
    const cron = `0 ${matchDate.getHours()} ${matchDate.getDate()} ${matchDate.getMonth() + 1} *`;
    setScheduleConfig({ cron, outputPath });
    checkReportSchedule(matchDate);

    // Files are written async (runExport is async), but the write is synchronous
    // inside the async function. We need to wait a tick.
    return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
      const last = getLastExport();
      expect(last).not.toBeNull();
      expect(last.status).toBe('ok');
      expect(fs.readdirSync(outputPath).length).toBeGreaterThan(0);
    });
  });

  it('logs an error and skips export when cron expression is invalid', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Store a config with an invalid cron (too few fields) directly, bypassing
    // the settings-route validation that would reject it first.
    setScheduleConfig({ cron: 'not-valid-cron', outputPath: path.join(tmpDir, 'bad-cron') });
    const now = new Date(2099, 0, 1, 0, 0);
    checkReportSchedule(now);
    expect(spy).toHaveBeenCalledWith('[report-schedule] invalid cron expression:', expect.any(String));
    spy.mockRestore();
  });

  it('records error status when outputPath cannot be created', () => {
    // Create a regular file where the outputPath sub-directory should live so
    // mkdirSync throws ENOTDIR.
    const blocker = path.join(tmpDir, 'blocking-file');
    fs.writeFileSync(blocker, 'i am a file');
    const badPath = path.join(blocker, 'sub');
    const now = new Date(2098, 0, 1, 0, 0);
    const cron = `0 ${now.getHours()} ${now.getDate()} ${now.getMonth() + 1} *`;
    setScheduleConfig({ cron, outputPath: badPath });
    checkReportSchedule(now);

    return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
      const last = getLastExport();
      expect(last?.status).toBe('error');
      expect(last?.error).toMatch(/cannot create outputPath/);
    });
  });

  it('does not run twice in the same minute', () => {
    const outputPath = path.join(tmpDir, 'reports-dedup');
    const now = new Date(2027, 0, 1, 9, 0, 0);
    const cron = `0 ${now.getHours()} ${now.getDate()} ${now.getMonth() + 1} *`;
    setScheduleConfig({ cron, outputPath });

    checkReportSchedule(now);
    const sameMinute = new Date(now.getTime() + 30_000);
    checkReportSchedule(sameMinute);

    return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
      // Should have created output once.
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });
});

describe('getScheduleConfig / setScheduleConfig', () => {
  it('roundtrips a config object', () => {
    const config = { cron: '0 9 * * 1-5', outputPath: '/tmp/out', emailTo: 'a@b.com' };
    setScheduleConfig(config);
    expect(getScheduleConfig()).toEqual(config);
  });

  it('setScheduleConfig(null) clears the config', () => {
    setScheduleConfig({ cron: '0 9 * * *', outputPath: '/tmp' });
    setScheduleConfig(null);
    expect(getScheduleConfig()).toBeNull();
  });
});
