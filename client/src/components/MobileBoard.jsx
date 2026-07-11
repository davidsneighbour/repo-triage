import { useEffect, useState } from 'react';
import { devId } from '../lib/devIdOverlay.js';
import { DayPicker } from './DayPicker.jsx';
import { Column } from './Column.jsx';

// Mobile board (see DESIGN.md → Layout → Responsive / mobile). Renders exactly
// one full-width day/bucket column at a time; the visible one is chosen from the
// `DayPicker`. Reuses the existing `Column`/`RepoCard` — only the column width
// and the day-selection chrome differ from desktop. `columns` is the unified
// list built in App ({ key, title, subtitle, accent, repos, daysAgoTarget,
// schedulable }) so this works for both the day schedule and the owner/tag/
// language groupings.
export function MobileBoard({ columns, onDropColumn, ...cardProps }) {
  const [activeKey, setActiveKey] = useState(() => columns[0]?.key);

  // Keep the selection valid when the column set changes (group-by switch, or a
  // sync removing a bucket). Fall back to the first column.
  useEffect(() => {
    if (columns.length > 0 && !columns.some((c) => c.key === activeKey)) {
      setActiveKey(columns[0].key);
    }
  }, [columns, activeKey]);

  const active = columns.find((c) => c.key === activeKey) || columns[0];

  const pickerColumns = columns.map((c) => ({
    key: c.key,
    title: c.title,
    subtitle: c.subtitle,
    accent: c.accent,
    count: c.repos.length,
  }));

  return (
    <div {...devId('MobileBoard')} className="flex min-h-0 flex-1 flex-col gap-3">
      <DayPicker columns={pickerColumns} activeKey={active?.key} onSelect={setActiveKey} />
      {active ? (
        <div className="flex min-h-0 flex-1">
          <Column
            col={active}
            repos={active.repos}
            schedulable={active.schedulable !== false}
            onDropColumn={onDropColumn}
            mobile
            {...cardProps}
          />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center text-center text-xs text-neutral-700">no repositories to show</div>
      )}
    </div>
  );
}
