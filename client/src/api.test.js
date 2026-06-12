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
});
