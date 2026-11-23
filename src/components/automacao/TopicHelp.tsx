'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const VISIBLE_MS = 30_000;

interface TopicHelpProps {
  title: string;
  meaning: string;
  how: string;
  /** Reservado. El aviso siempre sale centrado, uno a la vez. */
  block?: boolean;
}

type OpenHelp = {
  id: number;
  title: string;
  meaning: string;
  how: string;
};

let seq = 0;
let openHelp: OpenHelp | null = null;
const subscribers = new Set<() => void>();

function publish(next: OpenHelp | null) {
  openHelp = next;
  subscribers.forEach((notify) => notify());
}

/** ? que abre un único aviso centrado. Dura 30 s y reemplaza al anterior. */
export function TopicHelp({ title, meaning, how }: TopicHelpProps) {
  const mine = useRef(0);
  const [, redraw] = useState(0);

  useEffect(() => {
    const notify = () => redraw((n) => n + 1);
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  const visible = openHelp?.id === mine.current && mine.current !== 0;

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      if (openHelp?.id === mine.current) publish(null);
    }, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  function toggle() {
    if (openHelp?.id === mine.current && mine.current !== 0) {
      publish(null);
      return;
    }
    mine.current = ++seq;
    publish({ id: mine.current, title, meaning, how });
  }

  return (
    <span
      className="inline-flex"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={visible}
        aria-label={title}
        onClick={toggle}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold leading-none transition-colors ${
          visible
            ? 'border-aqua-300 bg-aqua-500/25 text-aqua-100'
            : 'border-aqua-400/45 text-aqua-300 hover:bg-aqua-500/15'
        }`}
      >
        ?
      </button>
      {visible && openHelp && typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center p-4">
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-aqua-400/35 border-l-4 border-l-cyan-400 bg-[#0c1b33] text-left shadow-2xl"
              >
                <div className="flex items-start gap-3 px-4 pt-3.5">
                  <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-aqua-300">
                    {openHelp.title}
                  </p>
                  <button
                    type="button"
                    aria-label="OK"
                    onClick={() => publish(null)}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-dark-textSecondary hover:bg-white/10 hover:text-dark-text"
                  >
                    ×
                  </button>
                </div>
                <p className="px-4 pt-2 text-sm leading-snug text-dark-text">{openHelp.meaning}</p>
                <p className="px-4 pb-3 pt-2 text-xs leading-snug text-dark-textSecondary">{openHelp.how}</p>
                <div className="h-0.5 bg-white/10">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: '100%', animation: 'topic-help-bar 30s linear forwards' }}
                  />
                </div>
                <style>{`@keyframes topic-help-bar{from{width:100%}to{width:0%}}`}</style>
              </div>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
