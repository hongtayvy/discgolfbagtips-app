import { useEffect, useState } from 'react';
import { deleteProfile, listProfiles, loadProfile, saveProfile } from '../api/client';
import type { BagProfileSummary, RecommendationRequest } from '../api/types';

const when = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

/**
 * Named bags, saved server-side via /api/v1/profiles.
 *
 * These are keyed by the session cookie rather than an account — the API has no
 * authentication — so they do not follow you to another browser or device. The
 * UI says so rather than implying a login exists.
 */
export function ProfileBar({
  buildRequest,
  onLoad,
  disabled,
}: {
  /** The current bag as a request body, or null when there is nothing to save. */
  buildRequest: () => RecommendationRequest | null;
  onLoad: (request: RecommendationRequest, profile: BagProfileSummary) => void;
  disabled?: boolean;
}) {
  const [profiles, setProfiles] = useState<BagProfileSummary[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  const refresh = () =>
    listProfiles()
      .then(setProfiles)
      .catch(() => {
        // An empty list is indistinguishable from a failure here; the save and
        // load actions surface their own errors.
      });

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 6000);
    return () => clearTimeout(id);
  }, [status]);

  const save = async () => {
    const request = buildRequest();
    if (!request || !name.trim()) return;
    setBusy(true);
    try {
      const saved = await saveProfile({ name: name.trim(), bag: request });
      setName('');
      await refresh();
      setStatus({ tone: 'ok', message: `Saved “${saved.profile.name}”.` });
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const load = async (profile: BagProfileSummary) => {
    setBusy(true);
    try {
      const detail = await loadProfile(profile.id);
      onLoad(detail.request, detail.profile);
      setStatus({ tone: 'ok', message: `Loaded “${detail.profile.name}”.` });
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Could not load.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (profile: BagProfileSummary) => {
    setBusy(true);
    try {
      await deleteProfile(profile.id);
      await refresh();
      setStatus({ tone: 'ok', message: `Deleted “${profile.name}”.` });
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Could not delete.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profiles">
      <div className="profiles__save">
        <label className="field">
          <span className="field__label">Save this bag as</span>
          <input
            className="field__control"
            type="text"
            maxLength={80}
            placeholder="Wooded setup"
            value={name}
            disabled={disabled || busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void save();
            }}
          />
        </label>
        <button
          type="button"
          className="button button--ghost"
          disabled={disabled || busy || !name.trim()}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>

      {status && (
        <p className={`transfer-note${status.tone === 'error' ? ' transfer-note--error' : ''}`} role="status">
          {status.message}
        </p>
      )}

      {profiles.length > 0 && (
        <ul className="profiles__list">
          {profiles.map((p) => (
            <li key={p.id} className="profile-item">
              <div className="profile-item__body">
                <p className="profile-item__name">{p.name}</p>
                <p className="profile-item__meta">
                  {p.discCount} disc{p.discCount === 1 ? '' : 's'}
                  {p.bagModelId != null && ' · bag saved'}
                  {when(p.updatedAt) && ` · updated ${when(p.updatedAt)}`}
                </p>
              </div>
              <button type="button" className="button button--ghost" disabled={busy} onClick={() => void load(p)}>
                Load
              </button>
              <button
                type="button"
                className="button button--ghost profile-item__delete"
                disabled={busy}
                onClick={() => void remove(p)}
                aria-label={`Delete ${p.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="profiles__caveat">
        Saved bags live with this browser's session on the server — there is no sign-in yet, so they will
        not appear on another device. Use <strong>Export bag</strong> to move one.
      </p>
    </div>
  );
}
