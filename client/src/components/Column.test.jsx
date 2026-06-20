import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Column } from './Column.jsx';

const col = { key: 'day-0', title: 'Today', subtitle: '0d', accent: 'neutral', daysAgoTarget: 0 };

describe('Column sort select', () => {
  it('applies the active sort class when sort is changed from default', () => {
    render(<Column col={col} repos={[]} onDropColumn={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Sort Today column' });
    expect(select.className).toMatch(/text-neutral-500/);
    fireEvent.change(select, { target: { value: 'name:asc' } });
    expect(select.className).toMatch(/text-neutral-200/);
  });
});

describe('Column drag events when not schedulable', () => {
  it('dragover on a non-schedulable column does not set the over state', () => {
    const { container } = render(
      <Column col={col} repos={[]} onDropColumn={vi.fn()} schedulable={false} />
    );
    const dropZone = container.querySelector('.border-dashed');
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).not.toMatch(/border-neutral-500/);
  });

  it('drop on a non-schedulable column does not call onDropColumn', () => {
    const onDropColumn = vi.fn();
    const { container } = render(
      <Column col={col} repos={[]} onDropColumn={onDropColumn} schedulable={false} />
    );
    const dropZone = container.querySelector('.border-dashed');
    fireEvent.drop(dropZone, {
      dataTransfer: { getData: () => '42' },
    });
    expect(onDropColumn).not.toHaveBeenCalled();
  });
});
