import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardMenu } from './CardMenu.jsx';

const anchor = { current: document.createElement('button') };
const noop = () => {};

const makeHandlers = (overrides = {}) => ({
  onSetChecked: noop, onClearCheck: noop, onSetPriority: noop, onSetInactivity: noop,
  onSetIgnored: noop, onAddNotice: noop, onViewNotices: noop, onAddTag: noop,
  onRemoveTag: noop, onAddFlag: noop, onRemoveFlag: noop, onClose: noop,
  defaultInactivity: 7,
  ...overrides,
});

const baseRepo = {
  id: 1, name: 'alpha', full_name: 'me/alpha',
  html_url: 'https://github.com/me/alpha',
  tags: [], topics: [], flags: [],
  priority: null, ignored: false, notice_count: 0, inactivity_days: null,
};

const HYGIENE_PRESET = [{ id: 'hygiene', name: 'Repo hygiene', description: '', checkCount: 5 }];

describe('CardMenu — settings sets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when no presets are configured', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={[]} />);
    expect(screen.queryByText('Settings sets')).not.toBeInTheDocument();
  });

  it('fetches and shows the conformance score on open', async () => {
    const onGetConformance = vi.fn().mockResolvedValue({
      presetId: 'hygiene',
      presetName: 'Repo hygiene',
      checks: [
        { id: 'has_description', label: 'Has a description', pass: true },
        { id: 'has_license', label: 'Has a license', pass: false },
      ],
      passCount: 1,
      total: 2,
    });

    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />);

    expect(onGetConformance).toHaveBeenCalledWith(1, 'hygiene');
    expect(await screen.findByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('Repo hygiene')).toBeInTheDocument();
    expect(screen.getByText('Has a description')).toBeInTheDocument();
    expect(screen.getByText('Has a license')).toBeInTheDocument();
  });

  it('shows an error message when conformance fetch fails', async () => {
    const onGetConformance = vi.fn().mockRejectedValue(new Error('boom'));

    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not evaluate');
  });

  it('does not fetch conformance in tag-only mode', () => {
    const onGetConformance = vi.fn();
    render(
      <CardMenu repo={baseRepo} anchorRef={anchor} tagOnly {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />
    );
    expect(onGetConformance).not.toHaveBeenCalled();
    expect(screen.queryByText('Settings sets')).not.toBeInTheDocument();
  });

  it('does not fetch conformance when onGetConformance is not provided', () => {
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} />);
    // Renders the section (presets exist) but shows neither a score nor a crash.
    expect(screen.getByText('Settings sets')).toBeInTheDocument();
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument();
  });

  it('shows a full-pass score with the pass styling band', async () => {
    const onGetConformance = vi.fn().mockResolvedValue({
      presetId: 'hygiene', presetName: 'Repo hygiene',
      checks: [{ id: 'a', label: 'a', pass: true }],
      passCount: 1, total: 1,
    });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />);
    const score = await screen.findByText('1/1');
    expect(score.className).toMatch(/#6ee7b7/);
  });

  it('shows a zero-pass score with the fail styling band', async () => {
    const onGetConformance = vi.fn().mockResolvedValue({
      presetId: 'hygiene', presetName: 'Repo hygiene',
      checks: [{ id: 'a', label: 'a', pass: false }],
      passCount: 0, total: 1,
    });
    render(<CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />);
    const score = await screen.findByText('0/1');
    expect(score.className).toMatch(/rose/);
  });

  it('re-fetches conformance when the repo changes', async () => {
    const onGetConformance = vi.fn().mockResolvedValue({
      presetId: 'hygiene', presetName: 'Repo hygiene', checks: [], passCount: 0, total: 0,
    });
    const { rerender } = render(
      <CardMenu repo={baseRepo} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />
    );
    await waitFor(() => expect(onGetConformance).toHaveBeenCalledWith(1, 'hygiene'));

    rerender(
      <CardMenu repo={{ ...baseRepo, id: 2 }} anchorRef={anchor} {...makeHandlers()} settingsSets={HYGIENE_PRESET} onGetConformance={onGetConformance} />
    );
    await waitFor(() => expect(onGetConformance).toHaveBeenCalledWith(2, 'hygiene'));
  });
});
