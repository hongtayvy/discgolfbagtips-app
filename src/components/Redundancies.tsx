import type { RedundancyReport } from '../api/types';

/**
 * Discs that overlap enough to be doing the same job. `separation` is how far
 * apart they fly — 0 means interchangeable — and `level` is the server's own
 * severity banding, so the UI does not re-decide what counts as a problem.
 */
export function Redundancies({ reports }: { reports: RedundancyReport[] }) {
  if (!reports.length) return null;

  return (
    <div className="redundancies">
      {reports.map((r) => (
        <article
          key={`${r.slot}/${r.stabilityClass}/${r.discs.map((d) => d.discId).join('-')}`}
          className={`redundancy redundancy--${r.level.toLowerCase()}`}
        >
          <header className="redundancy__head">
            <h4>
              {r.discs.map((d) => `${d.brand} ${d.name}`).join(' · ')}
            </h4>
            <span className="redundancy__level">{r.level.toLowerCase()}</span>
            <span className="redundancy__sep" title="Flight separation; 0 is interchangeable">
              separation {r.separation.toFixed(1)}
            </span>
          </header>
          <p className="redundancy__reason">{r.reason}</p>
        </article>
      ))}
    </div>
  );
}
