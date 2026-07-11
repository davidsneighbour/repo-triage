import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('api wrapper contract', () => {
    it('calls list endpoint with GET', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.list();

        expect(fetchMock).toHaveBeenCalledWith('/api/repos');
    });

    it('calls allIssues endpoint with GET', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ issues: [] }) });

        await api.allIssues();

        expect(fetchMock).toHaveBeenCalledWith('/api/issues');
    });

    it('calls allActivity endpoint with GET', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ activity: [] }) });

        await api.allActivity();

        expect(fetchMock).toHaveBeenCalledWith('/api/activity');
    });

    it('posts refresh endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.refresh();

        expect(fetchMock).toHaveBeenCalledWith('/api/refresh', { method: 'POST' });
    });

    it('posts check payload to check endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.setChecked(42, 3);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysAgo: 3 }),
        });
    });

    it('posts inactivity payload to inactivity endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.setInactivity(42, 14);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/inactivity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 14 }),
        });
    });

    it('posts snooze payload to snooze endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.snooze(42, 7);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/snooze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 7 }),
        });
    });

    it('posts priority payload to priority endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.setPriority(42, null);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/priority', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority: null }),
        });
    });

    it('posts ordered ids to reorder endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.reorder([3, 2, 1]);

        expect(fetchMock).toHaveBeenCalledWith('/api/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: [3, 2, 1] }),
        });
    });

    it('builds report URLs and parses json vs text per format', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ kind: 'summary' }), text: async () => 'md' });

        await api.reportKinds();
        expect(fetchMock).toHaveBeenCalledWith('/api/reports');

        expect(await api.report('summary')).toEqual({ kind: 'summary' });
        expect(fetchMock).toHaveBeenCalledWith('/api/reports/summary?format=json');

        expect(await api.report('stale', { format: 'md', days: 90 })).toBe('md');
        expect(fetchMock).toHaveBeenCalledWith('/api/reports/stale?format=md&days=90');
    });

    it('POSTs to gh/open endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.ghOpen(42);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/gh/open', { method: 'POST' });
    });

    it('GETs gh/prs endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ prs: [] }) });

        await api.ghPrs(42);

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/gh/prs');
    });

    it('POSTs gh/issue with title and body', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true, url: 'u', number: 1 }) });

        await api.ghCreateIssue(42, 'My issue', 'Some body');

        expect(fetchMock).toHaveBeenCalledWith('/api/repos/42/gh/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'My issue', body: 'Some body' }),
        });
    });

    it('fetches settings with GET /api/settings', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ settings: {}, defaults: {} }) });

        await api.getSettings();

        expect(fetchMock).toHaveBeenCalledWith('/api/settings');
    });

    it('writes settings with PUT /api/settings', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });
        const payload = { defaultInactivityDays: 14, syncIntervalMinutes: 30, githubOwners: 'myorg' };

        await api.putSettings(payload);

        expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    });

    it('fetches prefs with GET /api/prefs', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ prefs: null }) });

        await api.getPrefs();

        expect(fetchMock).toHaveBeenCalledWith('/api/prefs');
    });

    it('writes prefs with PUT /api/prefs', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });
        const payload = { density: 'compact', sort: 'alpha', view: 'list', groupBy: 'day' };

        await api.putPrefs(payload);

        expect(fetchMock).toHaveBeenCalledWith('/api/prefs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    });

    it('covers the remaining mutation wrappers', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.touch(1);
        await api.setIgnored(1, true);
        await api.addNotice(1, 'hi');
        await api.repoNotices(1);
        await api.allNotices('repo', 'asc');
        await api.deleteNotice(7);
        await api.addTag(1, 'infra');
        await api.removeTag(1, 'infra');

        const urls = fetchMock.mock.calls.map((c) => c[0]);
        expect(urls).toEqual(
            expect.arrayContaining([
                '/api/repos/1/touch',
                '/api/repos/1/ignore',
                '/api/repos/1/notices',
                '/api/notices?sort=repo&dir=asc',
                '/api/notices/7',
                '/api/repos/1/tags',
                '/api/repos/1/tags/infra',
            ])
        );
    });

    it('covers clearSchedule, restoreState, deleteTag, addFlag, removeFlag', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.clearSchedule(1);
        await api.restoreState(1, '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z');
        await api.deleteTag('infra');
        await api.addFlag(1, 'pinned');
        await api.removeFlag(1, 'pinned');

        const calls = fetchMock.mock.calls;
        expect(calls[0]).toEqual(['/api/repos/1/clear', { method: 'POST' }]);
        expect(calls[1]).toEqual(['/api/repos/1/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority_set_at: '2026-05-01T00:00:00.000Z', checked_at: '2026-05-02T00:00:00.000Z' }),
        }]);
        expect(calls[2]).toEqual(['/api/tags/infra', { method: 'DELETE' }]);
        expect(calls[3][0]).toBe('/api/repos/1/flags');
        expect(calls[3][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ flag: 'pinned' }) });
        expect(calls[4]).toEqual(['/api/repos/1/flags/pinned', { method: 'DELETE' }]);
    });

    it('covers getSettingsSets and getRepoConformance', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.getSettingsSets();
        await api.getRepoConformance(1, 'hygiene');

        expect(fetchMock.mock.calls[0]).toEqual(['/api/settings-sets']);
        expect(fetchMock.mock.calls[1]).toEqual(['/api/repos/1/settings-sets/hygiene']);
    });

    it('covers createTag, renameTag, and deleteTag with resetCheck', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.createTag('infra');
        await api.renameTag('infra', 'platform');
        await api.deleteTag('platform', true);

        const calls = fetchMock.mock.calls;
        expect(calls[0]).toEqual(['/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: 'infra' }),
        }]);
        expect(calls[1]).toEqual(['/api/tags/infra', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newTag: 'platform' }),
        }]);
        expect(calls[2]).toEqual(['/api/tags/platform?resetCheck=true', { method: 'DELETE' }]);
    });

    it('covers getTagRules, putTagRule, deleteTagRule', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.getTagRules();
        await api.putTagRule('infra', 14);
        await api.deleteTagRule('infra');

        expect(fetchMock.mock.calls[0]).toEqual(['/api/tag-rules']);
        expect(fetchMock.mock.calls[1]).toEqual(['/api/tag-rules/infra', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 14 }),
        }]);
        expect(fetchMock.mock.calls[2]).toEqual(['/api/tag-rules/infra', { method: 'DELETE' }]);
    });

    it('covers getActivity, getUndoLog, createUndo, executeUndo, discardUndo', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ ok: true }) });

        await api.getActivity(5);
        await api.getUndoLog();
        await api.createUndo('test', [{ type: 'setIgnored', repoId: 1, ignored: false }]);
        await api.executeUndo(7);
        await api.discardUndo(7);

        const urls = fetchMock.mock.calls.map((c) => c[0]);
        expect(urls[0]).toBe('/api/repos/5/activity');
        expect(urls[1]).toBe('/api/undo');
        expect(urls[2]).toBe('/api/undo');
        expect(urls[3]).toBe('/api/undo/7');
        expect(urls[4]).toBe('/api/undo/7');
        expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST' });
        expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: 'POST' });
        expect(fetchMock.mock.calls[4][1]).toMatchObject({ method: 'DELETE' });
    });
});
