import { useEffect, useId, useRef, useState } from 'react';
import { searchDiscs } from '../api/client';
import { useDebounced } from '../lib/session';
import { humanizeStability } from '../lib/flight';
import type { Disc } from '../api/types';

interface Props {
  /** Copies of each catalog disc already in the bag. A mold can be added again. */
  counts: Record<string, number>;
  onSelect: (disc: Disc) => void;
}

/**
 * Type-ahead picker over the backend disc catalog. Selection is the only way a
 * disc enters the bag: there is no free-text disc name entry, so every disc in
 * the bag has real flight numbers behind it.
 */
export function DiscSearch({ counts, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Disc[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const debounced = useDebounced(query, 180);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Kicking off a network request is exactly the "synchronize with an
    // external system" case the rule carves out for.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    setError(null);
    searchDiscs(debounced, { limit: 12, signal: controller.signal })
      .then((discs) => {
        setResults(discs);
        setActive(0);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Search failed.');
        setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const choose = (disc: Disc) => {
    onSelect(disc);
    setQuery('');
    setOpen(true);
    // Keep focus on the field so you can keep typing (and so Escape still
    // closes the list) after picking a disc with the mouse.
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const disc = results[active];
      if (disc) choose(disc);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="disc-search" ref={rootRef}>
      <div className="disc-search__field">
        <span className="disc-search__icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          className="disc-search__input"
          placeholder="Search discs by name or brand…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="disc-search__spinner" aria-hidden="true" />}
      </div>

      {open && (
        <ul className="disc-search__results" id={listId} role="listbox" aria-label="Disc catalog results">
          {error && <li className="disc-search__empty disc-search__empty--error">{error}</li>}
          {!error && !results.length && !loading && (
            <li className="disc-search__empty">
              {debounced.trim()
                ? `No discs in the catalog match “${debounced.trim()}”.`
                : 'Type a mold or brand — Buzzz, Innova, Zone — to search the catalog.'}
            </li>
          )}
          {results.map((disc, i) => {
            const owned = counts[disc.id] ?? 0;
            return (
              <li key={disc.id} id={`${listId}-${disc.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`disc-search__result${i === active ? ' is-active' : ''}${owned ? ' is-added' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(disc)}
                >
                  <span className="disc-search__result-name">
                    {disc.name}
                    <em>{disc.brand}</em>
                    {owned > 0 && <span className="disc-search__owned">×{owned} in bag — add another</span>}
                  </span>
                  <span className="disc-search__result-numbers">
                    {disc.speed} / {disc.glide} / {disc.turn} / {disc.fade}
                  </span>
                  <span className="disc-search__result-stability">
                    {humanizeStability(disc.stability)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
