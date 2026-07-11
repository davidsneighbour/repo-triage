import { cx } from '../lib/constants.js';
import { devId } from '../lib/devIdOverlay.js';

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    sky: 'bg-sky-500/15 text-sky-300',
    violet: 'bg-violet-500/15 text-violet-300',
    rose: 'bg-rose-500/15 text-rose-300',
  };
  return <span {...devId('Badge')} className={cx('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', tones[tone])}>{children}</span>;
}
