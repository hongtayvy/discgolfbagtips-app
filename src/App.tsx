import { useCallback, useEffect, useRef, useState } from 'react';
import { getDisc, getLineup, getWeatherReport } from './api/client';
import type { BagProfileSummary, RecommendationRequest } from './api/types';
import type {
  BagEntry,
  BagLineupResponse,
  Disc,
  PlayerProfile,
  RecommendationFilters,
  Weather,
  WeatherReport,
} from './api/types';
import { useSessionState } from './lib/session';
import { parseBag, parseBagModelId, parseProfile } from './lib/validate';
import type { FlightContext } from './lib/flight';
import { downloadBag, parseBagFile } from './lib/bagFile';
import { DiscSearch } from './components/DiscSearch';
import { DiscCard } from './components/DiscCard';
import { ProfilePicker } from './components/ProfilePicker';
import { WeatherToggle } from './components/WeatherToggle';
import { StabilitySpeedMap } from './components/StabilitySpeedMap';
import { Lineup } from './components/Lineup';
import { RecommendationCard } from './components/RecommendationCard';
import { FilterBar } from './components/FilterBar';
import { BagPicker } from './components/BagPicker';
import { ProfileBar } from './components/ProfileBar';

const DEFAULT_PROFILE: PlayerProfile = {
  skillLevel: 'INTERMEDIATE',
  throwingStyle: 'BACKHAND',
  courseType: 'MIXED',
};

function Section({
  step,
  title,
  hint,
  children,
  aside,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="section">
      <header className="section__header">
        <span className="section__step">{step}</span>
        <div>
          <h2 className="section__title">{title}</h2>
          {hint && <p className="section__hint">{hint}</p>}
        </div>
        {aside && <div className="section__aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export default function App() {
  // Validated on restore: a session saved before the API rewrite holds a
  // different disc shape, and rendering it used to take the whole page down.
  const [bag, setBag, resetBag] = useSessionState<BagEntry[]>('bag', [], parseBag);
  const [profile, setProfile] = useSessionState<PlayerProfile>('profile', DEFAULT_PROFILE, parseProfile);

  /** Which already-analysed environment is on screen. Not an analysis input. */
  const [weather, setWeather] = useState<Weather>('NORMAL');

  /** Catalog id of the bag being carried; the server prices the load from it. */
  const [bagModelId, setBagModelId] = useSessionState<number | undefined>(
    'bagModel',
    undefined,
    parseBagModelId,
  );

  const [report, setReport] = useState<WeatherReport | null>(null);
  /** Slot-by-slot lineup per weather, cleared whenever a fresh report arrives. */
  const [lineup, setLineup] = useState<Partial<Record<Weather, BagLineupResponse>>>({});
  const [lineupLoading, setLineupLoading] = useState(false);
  const [filters, setFilters] = useSessionState<RecommendationFilters>('filters', {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ctx: FlightContext = { profile, weather };
  const result = report?.[weather] ?? null;

  const addDisc = (disc: Disc) => setBag((b) => (b.some((d) => d.id === disc.id) ? b : [...b, disc]));

  const updateDisc = (id: string, patch: Partial<BagEntry>) =>
    setBag((b) => b.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  /**
   * The single shape sent to every endpoint, and stored in a saved profile.
   *
   * Optional blocks are omitted rather than sent empty: `filters: {}` and a
   * half-populated `carriedBag` carry no meaning, and keeping the body minimal
   * avoids asking the server to interpret placeholders.
   */
  const buildRequest = useCallback(
    (weatherFor: Weather): RecommendationRequest => {
      const activeFilters = {
        ...(filters.brands?.length ? { brands: filters.brands } : {}),
        ...(filters.excludeBrands?.length ? { excludeBrands: filters.excludeBrands } : {}),
        ...(filters.maxSpeed !== undefined ? { maxSpeed: filters.maxSpeed } : {}),
      };
      return {
        bag: bag.map((d) => ({
          discId: d.id,
          // Omit rather than null: unset means "use the published numbers".
          ...(d.plastic ? { plastic: d.plastic } : {}),
          ...(d.weightGrams !== undefined ? { weightGrams: d.weightGrams } : {}),
          ...(d.wear ? { wear: d.wear } : {}),
        })),
        profile,
        conditions: { weather: weatherFor },
        ...(Object.keys(activeFilters).length ? { filters: activeFilters } : {}),
        ...(bagModelId !== undefined ? { carriedBag: { bagModelId } } : {}),
      };
    },
    [bag, profile, filters, bagModelId],
  );

  /**
   * Restores a saved profile. Disc ids come back without catalog detail, so
   * each is re-fetched to rebuild the cards; anything the catalog no longer
   * knows is dropped rather than rendered half-empty.
   */
  const loadProfileRequest = async (request: RecommendationRequest, saved: BagProfileSummary) => {
    setReport(null);
    setLineup({});
    if (request.profile) setProfile(request.profile);
    if (request.filters) setFilters(request.filters);
    setBagModelId(request.carriedBag?.bagModelId);

    const resolved = await Promise.all(
      request.bag.map(async (entry): Promise<BagEntry | null> => {
        try {
          const disc = await getDisc(entry.discId);
          return {
            ...disc,
            plastic: entry.plastic ?? undefined,
            weightGrams: entry.weightGrams ?? undefined,
            wear: entry.wear ?? undefined,
          };
        } catch {
          return null;
        }
      }),
    );
    const discs = resolved.filter((d): d is BagEntry => d !== null);
    setBag(discs);

    const missing = request.bag.length - discs.length;
    setTransfer({
      tone: missing ? 'error' : 'ok',
      message: missing
        ? `Loaded “${saved.name}” — ${missing} disc${missing === 1 ? '' : 's'} no longer in the catalog and ${missing === 1 ? 'was' : 'were'} dropped.`
        : `Loaded “${saved.name}” — ${discs.length} disc${discs.length === 1 ? '' : 's'}.`,
    });
  };

  const removeDisc = (id: string) => {
    const next = bag.filter((d) => d.id !== id);
    setBag(next);
    if (!next.length) setReport(null);
  };

  useEffect(() => {
    if (!transfer) return;
    const id = setTimeout(() => setTransfer(null), 7000);
    return () => clearTimeout(id);
  }, [transfer]);

  const exportBag = () => {
    downloadBag({ bag, profile, bagModelId });
    setTransfer({
      tone: 'ok',
      message: `Saved ${bag.length} disc${bag.length === 1 ? '' : 's'}. Keep the file — importing it restores this bag and your profile.`,
    });
  };

  const importBag = async (file: File) => {
    const parsed = parseBagFile(await file.text());
    if (!parsed.ok) {
      setTransfer({ tone: 'error', message: parsed.error });
      return;
    }
    setBag(parsed.data.bag);
    setProfile(parsed.data.profile);
    setBagModelId(parsed.data.bagModelId);
    setReport(null);
    setError(null);
    setTransfer({
      tone: 'ok',
      message: `Loaded ${parsed.data.bag.length} disc${parsed.data.bag.length === 1 ? '' : 's'} from ${file.name}.`,
    });
  };

  const analyze = useCallback(
    async (scroll = false) => {
      if (!bag.length) return;
      setLoading(true);
      setError(null);
      try {
        // Every weather is analysed together so the environment toggle below
        // the result switches between finished answers.
        const { conditions: _conditions, ...base } = buildRequest('NORMAL');
        const data = await getWeatherReport(base);
        setReport(data);
        setLineup({});
        if (scroll)
          requestAnimationFrame(() =>
            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    },
    [bag.length, buildRequest],
  );

  // The lineup is a second call and can be slow when the embedding service is
  // down and retrieval falls back, so it runs after the headline result rather
  // than holding it up.
  useEffect(() => {
    if (!report?.[weather] || lineup[weather]) return;

    const controller = new AbortController();
    setLineupLoading(true);
    getLineup(buildRequest(weather), { signal: controller.signal })
      .then((data) => setLineup((l) => ({ ...l, [weather]: data })))
      .catch(() => {
        // The headline recommendation still stands without the lineup.
      })
      .finally(() => setLineupLoading(false));

    return () => controller.abort();
    // `bag`, `profile` and `filters` are already baked into `report`; keying on
    // them would fire a second lineup before the new report lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, weather, lineup]);

  // Once a result is on screen, changes to the bag or profile re-run it.
  const hasReport = report !== null;
  useEffect(() => {
    if (!hasReport || !bag.length) return;
    const id = setTimeout(() => void analyze(), 250);
    return () => clearTimeout(id);
  }, [hasReport, analyze, bag.length]);

  /**
   * Alternatives come back without a slot or category, so fetch the canonical
   * catalog record rather than guessing at the fields the map and cards need.
   */
  const addFromRecommendation = async (discId: string) => {
    if (bag.some((d) => d.id === discId)) return;
    try {
      addDisc(await getDisc(discId));
    } catch (err) {
      setTransfer({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not add that disc.',
      });
    }
  };

  const clearAll = () => {
    resetBag();
    setReport(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__mark" aria-hidden="true" />
          <div>
            <h1>Bag Tips</h1>
            <p>Find the one disc your bag is missing.</p>
          </div>
        </div>
      </header>

      <main className="app__main">
        <Section
          step={1}
          title="Build your bag"
          hint="Search the catalog and pick the discs you actually throw. Open a card to set its plastic, weight and wear — the server folds all three into how the disc actually flies."
          aside={
            <div className="toolbar">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset so re-picking the same file fires change again.
                  e.target.value = '';
                  if (file) void importBag(file);
                }}
              />
              <button
                type="button"
                className="button button--ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                Import bag
              </button>
              {bag.length > 0 && (
                <>
                  <button type="button" className="button button--ghost" onClick={exportBag}>
                    Export bag
                  </button>
                  <button type="button" className="button button--ghost" onClick={clearAll}>
                    Clear bag
                  </button>
                </>
              )}
            </div>
          }
        >
          <DiscSearch selectedIds={bag.map((d) => d.id)} onSelect={addDisc} />

          {transfer && (
            <p
              className={`transfer-note${transfer.tone === 'error' ? ' transfer-note--error' : ''}`}
              role="status"
            >
              {transfer.message}
            </p>
          )}

          <ProfileBar
            buildRequest={() => (bag.length ? buildRequest(weather) : null)}
            onLoad={(request, saved) => void loadProfileRequest(request, saved)}
            disabled={!bag.length}
          />

          {bag.length === 0 ? (
            <p className="empty">
              Your bag is empty. Start with the discs you reach for most — or import a bag you exported
              earlier.
            </p>
          ) : (
            <>
              <p className="bag__count">
                {bag.length} disc{bag.length === 1 ? '' : 's'} in the bag
              </p>
              <div className="bag-grid">
                {bag.map((disc) => (
                  <DiscCard
                    key={disc.id}
                    disc={disc}
                    ctx={ctx}
                    resolved={result?.analysis.resolvedBag.find((r) => r.discId === disc.id)}
                    onRemove={() => removeDisc(disc.id)}
                    onChange={(patch) => updateDisc(disc.id, patch)}
                  />
                ))}
              </div>
            </>
          )}
        </Section>

        {bag.length > 0 && (
          <Section
            step={2}
            title="What you're carrying"
            hint="Disc weights come from the cards above; the bag comes from the catalog, and the server prices the load."
          >
            <BagPicker
              bagModelId={bagModelId}
              discCount={bag.length}
              carriedBag={lineup[weather]?.carriedBag ?? null}
              carryWeight={lineup[weather]?.carryWeight ?? null}
              betterFittingBags={lineup[weather]?.betterFittingBags ?? []}
              onChange={setBagModelId}
            />
          </Section>
        )}

        <Section step={bag.length ? 3 : 2} title="Your game" hint="Three answers. They change how each disc's line is modelled.">
          <ProfilePicker profile={profile} onChange={setProfile} />
          <FilterBar filters={filters} onChange={setFilters} />
        </Section>

        {bag.length > 0 && (
          <Section
            step={4}
            title="Coverage"
            hint="Where your bag sits on speed and stability — and where it doesn't."
            aside={
              result && (
                <div className="score">
                  <span className="score__value">{result.analysis.coverageScore}</span>
                  <span className="score__label">coverage</span>
                </div>
              )
            }
          >
            <StabilitySpeedMap
              bag={bag}
              gaps={result?.explainability.flightGaps ?? []}
              recommended={result?.recommendation}
            />
            {result?.analysis.notes.map((n) => (
              <p key={n} className="note">
                {n}
              </p>
            ))}
            {result?.analysis.unresolvedEntries.map((n) => (
              <p key={n} className="note note--warn">
                Could not resolve “{n}” against the catalog.
              </p>
            ))}
          </Section>
        )}

        <div className="analyze" ref={resultRef}>
          {!report && (
            <button
              type="button"
              className="button button--primary button--lg"
              disabled={!bag.length || loading}
              onClick={() => void analyze(true)}
            >
              {loading ? 'Analyzing every condition…' : 'Recommend my next disc'}
            </button>
          )}
          {!bag.length && <p className="analyze__hint">Add at least one disc to get a recommendation.</p>}
          {error && (
            <p className="error" role="alert">
              {error}{' '}
              <button type="button" className="button button--ghost" onClick={() => void analyze()}>
                Retry
              </button>
            </p>
          )}
        </div>

        {report && result && (
          <>
            <section className="section environment">
              <header className="section__header">
                <div>
                  <h2 className="section__title">Playing conditions</h2>
                  <p className="section__hint">
                    All five were analysed with your bag. Switch between them to see how the advice and the
                    flight lines change — no re-analysis needed.
                  </p>
                </div>
              </header>
              <WeatherToggle weather={weather} onChange={setWeather} />
            </section>

            <div className={loading ? 'is-refreshing' : undefined}>
              <RecommendationCard
                data={result}
                ctx={ctx}
                onAddToBag={(id) => void addFromRecommendation(id)}
              />
            </div>

            {lineup[weather] ? (
              <Lineup
                data={lineup[weather]}
                ctx={ctx}
                bagIds={bag.map((d) => d.id)}
                onAddToBag={(id) => void addFromRecommendation(id)}
              />
            ) : (
              <p className="lineup__pending">
                {lineupLoading
                  ? 'Analysing every slot — this one takes longer than the headline pick.'
                  : 'Slot-by-slot lineup unavailable for these conditions.'}
              </p>
            )}
          </>
        )}
      </main>

      <footer className="app__footer">
        <p>
          Session-only — your bag lives in this tab and the API's session cookie, never behind a login.
          Flight curves are a model, not a promise.
        </p>
      </footer>
    </div>
  );
}
