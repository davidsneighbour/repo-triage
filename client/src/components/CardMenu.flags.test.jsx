import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardMenu } from './CardMenu.jsx';

const makeRepo = (flags = []) => ({
  id: 1,
  name: 'alpha',
  full_name: 'me/alpha',
  tags: [],
  topics: [],
  flags,
  priority: null,
  ignored: false,
  notice_count: 0,
  inactivity_days: null,
});

const anchor = { current: document.createElement('button') };

const handlers = {
  onSetChecked: vi.fn(),
  onClearCheck: vi.fn(),
  onSetPriority: vi.fn(),
  onSetInactivity: vi.fn(),
  onSetIgnored: vi.fn(),
  onAddNotice: vi.fn(),
  onViewNotices: vi.fn(),
  onAddTag: vi.fn(),
  onRemoveTag: vi.fn(),
  onAddFlag: vi.fn(),
  onRemoveFlag: vi.fn(),
  onClose: vi.fn(),
  defaultInactivity: 7,
};

describe('CardMenu flag toggles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders pinned, muted, needs-decision buttons', () => {
    render(<CardMenu repo={makeRepo()} anchorRef={anchor} {...handlers} />);
    expect(screen.getByRole('button', { name: /pinned/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /muted/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /needs decision/i })).toBeInTheDocument();
  });

  it('shows inactive state when flag is absent', () => {
    render(<CardMenu repo={makeRepo([])} anchorRef={anchor} {...handlers} />);
    const btn = screen.getByRole('button', { name: /pinned/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows active state when flag is set', () => {
    render(<CardMenu repo={makeRepo(['pinned'])} anchorRef={anchor} {...handlers} />);
    const btn = screen.getByRole('button', { name: /pinned/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onAddFlag when an inactive flag is clicked', () => {
    render(<CardMenu repo={makeRepo([])} anchorRef={anchor} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /pinned/i }));
    expect(handlers.onAddFlag).toHaveBeenCalledWith(1, 'pinned');
    expect(handlers.onRemoveFlag).not.toHaveBeenCalled();
  });

  it('calls onRemoveFlag when an active flag is clicked', () => {
    render(<CardMenu repo={makeRepo(['muted'])} anchorRef={anchor} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /muted/i }));
    expect(handlers.onRemoveFlag).toHaveBeenCalledWith(1, 'muted');
    expect(handlers.onAddFlag).not.toHaveBeenCalled();
  });

  it('wraps flag emoji in aria-hidden span so AT reads only the label', () => {
    render(<CardMenu repo={makeRepo()} anchorRef={anchor} {...handlers} />);
    const btn = screen.getByRole('button', { name: /pinned/i });
    const hiddenSpan = btn.querySelector('span[aria-hidden="true"]');
    expect(hiddenSpan).toBeInTheDocument();
    expect(hiddenSpan).toHaveTextContent('📌');
  });
});
