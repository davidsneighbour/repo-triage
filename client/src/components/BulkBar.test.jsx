import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkBar } from './BulkBar.jsx';

const actions = {
  checkedNow: vi.fn(),
  moveTo: vi.fn(),
  moveToday: vi.fn(),
  clear: vi.fn(),
  ignore: vi.fn(),
  unignore: vi.fn(),
  tag: vi.fn(),
  untag: vi.fn(),
  priority: vi.fn(),
};
const noop = () => {};

describe('BulkBar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Move to Today" button when no column list is provided', () => {
    render(<BulkBar count={2} actions={actions} columns={[]} onClear={noop} />);
    expect(screen.getByRole('button', { name: 'Move to Today' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Move selected to column' })).not.toBeInTheDocument();
  });

  it('shows a column select when columns are provided', () => {
    const cols = [{ key: 'day-1', title: 'Tomorrow', daysAgoTarget: 6 }];
    render(<BulkBar count={1} actions={actions} columns={cols} onClear={noop} />);
    expect(screen.getByRole('combobox', { name: 'Move selected to column' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move to Today' })).not.toBeInTheDocument();
  });

  it('select ignores the blank default option (guard branch)', () => {
    const cols = [{ key: 'day-1', title: 'Tomorrow', daysAgoTarget: 6 }];
    render(<BulkBar count={1} actions={actions} columns={cols} onClear={noop} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Move selected to column' }), { target: { value: '' } });
    expect(actions.moveTo).not.toHaveBeenCalled();
  });

  it('submitUntag is a no-op when the tag input is empty', () => {
    render(<BulkBar count={1} actions={actions} columns={[]} onClear={noop} />);
    // The Remove tag button is disabled when tag is empty; fire click to confirm no-op.
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag' }));
    expect(actions.untag).not.toHaveBeenCalled();
  });

  it('calls onClear when Deselect is clicked', () => {
    const onClear = vi.fn();
    render(<BulkBar count={3} actions={actions} columns={[]} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }));
    expect(onClear).toHaveBeenCalled();
  });
});
