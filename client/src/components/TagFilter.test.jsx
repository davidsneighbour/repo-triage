import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagFilter } from './TagFilter.jsx';
import { setDesktopViewport } from '../test/viewport.js';

const tags = [{ tag: 'infra', count: 2 }, { tag: 'docs', count: 1 }];

function open(onChange, value = { tags: [], mode: 'any' }, onDelete) {
  render(<TagFilter available={tags} value={value} onChange={onChange} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter by tag' }));
}

describe('TagFilter panel interactions (desktop)', () => {
  beforeEach(() => setDesktopViewport());

  it('toggles a tag on when its checkbox is clicked', () => {
    const onChange = vi.fn();
    open(onChange);
    fireEvent.click(screen.getByRole('checkbox', { name: /infra/ }));
    expect(onChange).toHaveBeenCalledWith({ tags: ['infra'], mode: 'any' });
  });

  it('toggles a tag off when it is already selected', () => {
    const onChange = vi.fn();
    open(onChange, { tags: ['infra'], mode: 'any' });
    fireEvent.click(screen.getByRole('checkbox', { name: /infra/ }));
    expect(onChange).toHaveBeenCalledWith({ tags: [], mode: 'any' });
  });

  it('shows a clear button when tags are selected and clicking it resets tags', () => {
    const onChange = vi.fn();
    open(onChange, { tags: ['infra'], mode: 'any' });
    const clearBtn = screen.getByRole('button', { name: 'clear' });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({ tags: [], mode: 'any' });
  });

  it('does not show the clear button when no tags are selected', () => {
    const onChange = vi.fn();
    open(onChange);
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument();
  });

  it('shows any/all mode toggle when 2 or more tags are selected', () => {
    const onChange = vi.fn();
    open(onChange, { tags: ['infra', 'docs'], mode: 'any' });
    expect(screen.getByRole('button', { name: 'match any' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'match all' })).toBeInTheDocument();
  });

  it('switching mode from any to all calls onChange with updated mode', () => {
    const onChange = vi.fn();
    open(onChange, { tags: ['infra', 'docs'], mode: 'any' });
    fireEvent.click(screen.getByRole('button', { name: 'match all' }));
    expect(onChange).toHaveBeenCalledWith({ tags: ['infra', 'docs'], mode: 'all' });
  });

  it('does not show mode toggle with fewer than 2 tags selected', () => {
    const onChange = vi.fn();
    open(onChange, { tags: ['infra'], mode: 'any' });
    expect(screen.queryByRole('button', { name: 'match any' })).not.toBeInTheDocument();
  });

  it('shows delete button when onDelete prop is provided', () => {
    open(vi.fn(), { tags: [], mode: 'any' }, vi.fn());
    expect(screen.getByRole('button', { name: 'Delete tag infra' })).toBeInTheDocument();
  });

  it('calls onDelete with the tag when confirmed', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    open(vi.fn(), { tags: [], mode: 'any' }, onDelete);
    fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
    expect(onDelete).toHaveBeenCalledWith('infra');
  });

  it('does not call onDelete when confirm is cancelled', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    open(vi.fn(), { tags: [], mode: 'any' }, onDelete);
    fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows "no tags yet" when no tags are available', () => {
    render(<TagFilter available={[]} value={{ tags: [], mode: 'any' }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter by tag' }));
    expect(screen.getByText('no tags yet')).toBeInTheDocument();
  });
});
