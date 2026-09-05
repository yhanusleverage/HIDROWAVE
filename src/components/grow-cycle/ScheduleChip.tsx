'use client';

import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { ScheduleBlock, ScheduleKind } from '@/lib/grow-cycle-timeline/types';
import {
  resolveScheduleKind,
  scheduleCadenceShort,
  scheduleChipClasses,
  scheduleTextClass,
} from '@/lib/grow-cycle-timeline/schedule-tokens';

interface ScheduleChipProps {
  schedule: ScheduleBlock;
  variant?: 'compact' | 'detail';
  className?: string;
}

function ScheduleKindIcon({
  kind,
  className,
}: {
  kind: ScheduleKind;
  className?: string;
}) {
  const iconClass = className ?? 'w-3 h-3 shrink-0';
  if (kind === 'circulation') {
    return <ArrowPathIcon className={iconClass} aria-hidden />;
  }
  if (kind === 'maintenance') {
    return <ClockIcon className={iconClass} aria-hidden />;
  }
  return <CalendarDaysIcon className={iconClass} aria-hidden />;
}

export function ScheduleChip({
  schedule,
  variant = 'compact',
  className = '',
}: ScheduleChipProps) {
  const kind = resolveScheduleKind(schedule);
  const cadenceShort = scheduleCadenceShort(schedule);
  const title = `${schedule.label} (${schedule.cadence})`;

  if (variant === 'detail') {
    return (
      <div
        className={`rounded-lg px-3 py-2 ${scheduleChipClasses(kind)} ${className}`}
        title={title}
      >
        <div className="flex items-center gap-2">
          <ScheduleKindIcon kind={kind} className={`w-4 h-4 shrink-0 ${scheduleTextClass(kind)}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-dark-text truncate">{schedule.label}</p>
            <p className={`text-[10px] tabular-nums ${scheduleTextClass(kind)}`}>{schedule.cadence}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] font-mono text-dark-textSecondary truncate">
          {schedule.ruleId}
        </p>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 max-w-full min-w-0 rounded-md px-1 py-0.5 text-[9px] font-medium ${scheduleChipClasses(kind)} ${className}`}
      title={title}
    >
      <ScheduleKindIcon kind={kind} className={`w-2.5 h-2.5 shrink-0 ${scheduleTextClass(kind)}`} />
      <span className="truncate min-w-0 text-dark-text">
        {schedule.label === 'Circulação' ? 'Circ' : schedule.label.split(' ')[0]}
      </span>
      <span className={`shrink-0 tabular-nums opacity-90 ${scheduleTextClass(kind)}`}>
        ·{cadenceShort}
      </span>
    </span>
  );
}
