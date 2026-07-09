import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagFilter } from './TagFilter.jsx';
import { setDesktopViewport } from '../test/viewport.js';

const tags = [{ tag: 'infra', count: 2 }, { tag: 'docs', count: 1 }];

function open(onChange, value = { tags: [], mode: 'any' }, { onDelete, onCreate, onRename } = {}) {
  render(<TagFilter available={tags} value={value} onChange={onChange} onDelete={onDelete} onCreate={onCreate} onRename={onRename} />);
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

  it('shows "no tags yet" when no tags are available', () => {
    render(<TagFilter available={[]} value={{ tags: [], mode: 'any' }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter by tag' }));
    expect(screen.getByText('no tags yet')).toBeInTheDocument();
  });

  describe('delete', () => {
    it('shows delete button when onDelete prop is provided', () => {
      open(vi.fn(), undefined, { onDelete: vi.fn() });
      expect(screen.getByRole('button', { name: 'Delete tag infra' })).toBeInTheDocument();
    });

    it('arms an inline confirm instead of deleting immediately', () => {
      const onDelete = vi.fn();
      open(vi.fn(), undefined, { onDelete });
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText((_, node) => node?.textContent === 'Delete #infra from all 2 repos?')).toBeInTheDocument();
    });

    it('calls onDelete with resetCheck=false when confirmed without checking the reset box', () => {
      const onDelete = vi.fn();
      open(vi.fn(), undefined, { onDelete });
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith('infra', false);
    });

    it('calls onDelete with resetCheck=true when the reset checkbox is checked', () => {
      const onDelete = vi.fn();
      open(vi.fn(), undefined, { onDelete });
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
      fireEvent.click(screen.getByRole('checkbox', { name: /also reset check status/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith('infra', true);
    });

    it('cancelling the inline confirm does not call onDelete', () => {
      const onDelete = vi.fn();
      open(vi.fn(), undefined, { onDelete });
      fireEvent.click(screen.getByRole('button', { name: 'Delete tag infra' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Delete tag infra' })).toBeInTheDocument();
    });

    it('does not render delete affordances when onDelete is not provided', () => {
      open(vi.fn());
      expect(screen.queryByRole('button', { name: 'Delete tag infra' })).not.toBeInTheDocument();
    });
  });

  describe('rename', () => {
    it('shows a rename button when onRename prop is provided', () => {
      open(vi.fn(), undefined, { onRename: vi.fn() });
      expect(screen.getByRole('button', { name: 'Rename tag infra' })).toBeInTheDocument();
    });

    it('switches the row into an edit input on click', () => {
      open(vi.fn(), undefined, { onRename: vi.fn() });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      expect(screen.getByLabelText('Rename infra')).toHaveValue('infra');
    });

    it('calls onRename with the new value on Enter', () => {
      const onRename = vi.fn();
      open(vi.fn(), undefined, { onRename });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      const input = screen.getByLabelText('Rename infra');
      fireEvent.change(input, { target: { value: 'platform' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith('infra', 'platform');
    });

    it('calls onRename with the new value via the save button', () => {
      const onRename = vi.fn();
      open(vi.fn(), undefined, { onRename });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      fireEvent.change(screen.getByLabelText('Rename infra'), { target: { value: 'platform' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save rename' }));
      expect(onRename).toHaveBeenCalledWith('infra', 'platform');
    });

    it('cancels editing on Escape without calling onRename', () => {
      const onRename = vi.fn();
      open(vi.fn(), undefined, { onRename });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      const input = screen.getByLabelText('Rename infra');
      fireEvent.change(input, { target: { value: 'platform' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rename tag infra' })).toBeInTheDocument();
    });

    it('cancels editing via the cancel button', () => {
      const onRename = vi.fn();
      open(vi.fn(), undefined, { onRename });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel rename' }));
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rename tag infra' })).toBeInTheDocument();
    });

    it('submitting an unchanged value cancels editing without calling onRename', () => {
      const onRename = vi.fn();
      open(vi.fn(), undefined, { onRename });
      fireEvent.click(screen.getByRole('button', { name: 'Rename tag infra' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save rename' }));
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rename tag infra' })).toBeInTheDocument();
    });
  });

  describe('create', () => {
    it('shows a create-tag input when onCreate prop is provided', () => {
      open(vi.fn(), undefined, { onCreate: vi.fn() });
      expect(screen.getByLabelText('New tag name')).toBeInTheDocument();
    });

    it('does not show a create-tag input when onCreate is not provided', () => {
      open(vi.fn());
      expect(screen.queryByLabelText('New tag name')).not.toBeInTheDocument();
    });

    it('calls onCreate with the trimmed value and clears the input', () => {
      const onCreate = vi.fn();
      open(vi.fn(), undefined, { onCreate });
      const input = screen.getByLabelText('New tag name');
      fireEvent.change(input, { target: { value: '  security  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create tag' }));
      expect(onCreate).toHaveBeenCalledWith('security');
      expect(input).toHaveValue('');
    });

    it('submits on Enter', () => {
      const onCreate = vi.fn();
      open(vi.fn(), undefined, { onCreate });
      const input = screen.getByLabelText('New tag name');
      fireEvent.change(input, { target: { value: 'security' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCreate).toHaveBeenCalledWith('security');
    });

    it('does not call onCreate for an empty value', () => {
      const onCreate = vi.fn();
      open(vi.fn(), undefined, { onCreate });
      fireEvent.click(screen.getByRole('button', { name: 'Create tag' }));
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('does not call onCreate for a tag that already exists (case-insensitive)', () => {
      const onCreate = vi.fn();
      open(vi.fn(), undefined, { onCreate });
      const input = screen.getByLabelText('New tag name');
      fireEvent.change(input, { target: { value: 'Infra' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create tag' }));
      expect(onCreate).not.toHaveBeenCalled();
    });
  });
});
