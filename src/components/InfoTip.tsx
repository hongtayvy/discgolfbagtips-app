import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { clampShift } from '../lib/ui';

/**
 * A small "i" button that opens a floating explanation.
 *
 * Floats rather than expanding in place, so opening it never moves the page.
 * Closes on Escape, on a click outside, and when the button is pressed again;
 * Escape returns focus to the button. The panel is nudged to stay on screen.
 */
export function InfoTip({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the panel inside the card it belongs to. Bounds come from that card, not the
  // window: an overflowing panel is what widens the window, so the window can't be trusted.
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const bounds = (root.current?.closest('.section') ?? document.body).getBoundingClientRect();
    const r = panel.current.getBoundingClientRect();
    const margin = 8;
    setShift((current) => clampShift(r.left - current, r.right - current, bounds.left + margin, bounds.right - margin));
  }, [open]);

  return (
    <span className="infotip" ref={root}>
      <button
        ref={button}
        type="button"
        className="infotip__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setShift(0);
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
          <path d="M8 7.4v4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className="infotip__panel"
          role="region"
          aria-label={title}
          style={{ transform: `translateX(${shift}px)` }}
        >
          <p className="infotip__title">{title}</p>
          {children}
        </div>
      )}
    </span>
  );
}
