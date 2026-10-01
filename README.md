# Bag Tips — web

React + TypeScript front end for the disc golf bag analysis tool. Build your bag
from the catalog, answer three questions about your game, and get one recommended
next disc with the retrieval-augmented reasoning behind it — analysed across
every weather condition at once.

```bash
npm install
npm run dev
```

Scripts: `dev`, `build` (typecheck + bundle), `test` (node's built-in runner),
`lint` (oxlint), `preview`.

## Connecting the backend

The dev server proxies `/api` to the Spring Boot API, so run the backend on
**http://localhost:8080** and `npm run dev` talks to it with no extra config.

Same-origin requests keep the API's `BAGTIPS_SESSION` cookie first-party and
avoid CORS entirely, which also means the dev server's port doesn't have to
match the API's CORS allowlist. Override the target with `API_TARGET`, or point
a built bundle at another origin with `VITE_API_BASE_URL` (see `.env.example`).
Requests are sent with `credentials: 'include'`.

There is no mock or bundled disc list — the catalog is the API's 1206 discs,
synced from DiscIt. If the API is down the app says so rather than quietly
serving fixtures.

### Endpoints consumed

All wire types live in `src/api/types.ts`, mirroring the server's OpenAPI
schemas (`http://localhost:8080/v3/api-docs`). Nothing else talks to the network.

| Endpoint | Used for |
| --- | --- |
| `GET /api/v1/discs/search?q=&limit=` | Type-ahead. Returns a bare `DiscSummary[]`; `q` is required and an empty term returns `[]`. |
| `GET /api/v1/discs/{id}` | Resolving a disc the recommendation named, so alternatives get their real slot and category. |
| `GET /api/v1/plastics?brand=` | Plastic blends for a disc's brand, plus the universal ones. Cached per brand, loaded when a disc's detail panel first opens. |
| `GET /api/v1/brands` | Manufacturer list for the brand filter. These names are exactly what `filters.brands` accepts. |
| `POST /api/v1/lineup` | The bag slot by slot, with per-gap suggestions, carry weight and better-fitting bags. Same request body as recommendations. |
| `GET /api/v1/bags` | Bag model catalog, filterable by `capacity`, `brand`, `type`. |
| `GET /api/v1/bags/brands`, `GET /api/v1/bags/{id}` | Bag manufacturers and one model. |
| `GET/POST /api/v1/profiles`, `GET/DELETE /api/v1/profiles/{id}` | Named saved bags. |
| `POST /api/v1/recommendations` | The headline pick. Body is `{ bag: [{discId, plastic?, weightGrams?, wear?}], profile, conditions: { weather }, filters? }` with the server's uppercase enums. |

A disc's `stability` is a **display string** from the API (`"overstable"`), not a
number. The numeric `turn + fade` is computed locally only where a coordinate is
needed — plotting on the coverage map.

## Plastic, weight and wear

A disc is not just its mold. The server folds plastic, weight and wear into an
*effective* stability that can sit far from the published numbers, and returns
the arithmetic in `stabilityExplanation`:

```
0 published  -0.3 plastic  -0.52 weight  -2.52 wear  =  -3.34
```

That is a stock Buzzz — published *stable* — resolving to **very understable**
once it is a well-worn 165 g Pro-D, which changes what the bag is missing and
therefore what gets recommended. Note the relative sizes: **wear moves stability
roughly eight times as much as plastic does**, so a bag entered without wear is
being analysed as if every disc were fresh out of the box.

Open any disc card to set the three. Weight is a free-text field with a datalist
of the weights discs are actually sold at — you usually know the number, so
typing beats stepping to it, and the list is there when you would rather pick.
Plastics are filtered to that disc's brand plus universal blends and grouped by
family, with each blend's stability shift shown inline. An unrecognised plastic name is silently ignored by the server, so
the UI only ever offers catalog values — there is no free-text entry here either.

The card then redraws for how *you* own that disc: the flight curve takes the
shift (negative adds turn, positive adds fade), the stability line shows the
resolved value with an `adjusted` marker, and the server's breakdown is printed
underneath.

## Carry weight and bag models

`GET /api/v1/bags` is a real catalog of bag models with published specs, so the
front end no longer guesses. An earlier version listed five *classes* of bag with
typical weights, precisely because inventing per-model figures from memory would
have looked authoritative without being checked. That is all gone.

Pick a bag and its id goes to the server as `carriedBag.bagModelId`. The lineup
response then carries:

- `carryWeight` — bag grams, disc grams, total in pounds, whether any disc
  weights were assumed, the bag's capacity, and an `overpacked` flag with notes
  like *"20 discs exceeds the 12 this bag is rated for."*
- `betterFittingBags` — alternatives with headroom and the server's own
  comparison prose, each addable in one click.

Several catalog fields are nullable — not every manufacturer publishes a weight
or a minimum capacity — so the UI renders "capacity not published" rather than a
blank or a zero.

## Saved bags (profiles)

`POST /api/v1/profiles` stores the current bag under a name; the list, load and
delete round-trip is in `ProfileBar`. Loading one re-fetches each disc from the
catalog to rebuild the cards, and reports how many were dropped if the catalog no
longer knows them.

**These are not user accounts.** The API exposes no authentication — no security
schemes in the OpenAPI document, no login endpoint — and profiles are keyed by
the `BAGTIPS_SESSION` cookie. Verified directly: a second client with no cookie
gets an empty list from `/profiles` and a 404 loading a known id. So a saved bag
does not follow you to another browser or device, and goes when the cookie does.
The UI says this plainly rather than implying a sign-in exists, and the bag file
export stays the portable route between devices.

Real accounts need auth on the backend first; the front end would then swap the
cookie for whatever identity mechanism lands.

## Redundancy

`analysis.redundancies` and each slot's `redundancies` report discs doing the
same job — `separation` is how far apart they fly, `0` meaning interchangeable,
with the server's own `level` banding (WARNING, NOTE). Shown per slot in the
lineup rather than re-derived client-side.

## The lineup, slot by slot

`POST /api/v1/lineup` returns the whole bag as four slots, and the UI is tabs
over that response. Each slot carries its own `status` (COMPLETE / THIN /
EMPTY), a `summary`, what the slot is *for* and its speed band, a
`stabilityCoverage` grid with a `covered` flag per class, and `gaps` — each with
a target flight, a suggested weight range, plain-language `behaviour`, and
`suggestions`: real catalog discs, addable in one click.

The endpoint deliberately does not call the reasoning model, so there is no
prose per gap; the headline `POST /api/v1/recommendations` still supplies that
for the single top pick. The lineup call is the slower of the two, so it runs
after the headline result is on screen rather than holding it up, and is cached
per weather.

Three things this replaced, all of them client-side approximations written
before the endpoint existed: an iterative chain that re-asked /recommendations
with each pick added to walk across the slots; a coverage verdict computed from
`analysis.coverage`; and a flight-number distance function for brand-filtered
suggestions. The server does all three now, and does them better — it reaches
every slot rather than the top four gaps.

### Filters

`GET /api/v1/brands` populates a brand picker (51 manufacturers), and the
selected names go to the server as `filters.brands` on **both** the
recommendation and lineup requests. There is also a `maxSpeed` cap, useful for
holding suggestions to what a player can actually bring up to full flight.

These filter the pipeline itself rather than the results after the fact — with
Innova selected, the headline pick comes back as an Innova disc, and the lineup
echoes `filters: brands in [innova]` in its explainability footer.

### When retrieval degrades

`explainability.retrievalMode` reports `VECTOR_SIMILARITY` normally and
`FLIGHT_NUMBER_FALLBACK` when the embedding service is unreachable, with the
reason in `degradations`. Both are surfaced in the lineup footer.

This matters for display: the `similarity` figures in fallback mode are not
cosine similarities and can be **negative**, so rendering them as "-12% match"
would be nonsense. Similarity is shown only when the mode is real vector
retrieval (`isVectorRetrieval` in `src/lib/format.ts`); otherwise the flight
delta against the target is shown instead, which stays meaningful either way.

## Conditions are analysed, not asked

Weather is not an input you fill in before the analysis. Pressing **Recommend my
next disc** runs the pipeline once for each of the five weathers the API models
— hot, normal, rainy, cold, windy — and the toggle under the result switches
between finished answers. Tapping it makes no network request.

That matters because the weather changes the advice rather than the pick: the
condition-specific reasoning, the plastic guidance and the suggested weight range
all differ per environment (windy nudged one recommendation from 167-174 g to
169-174 g), and every flight curve on the page redraws for the selected weather.

## Saving a bag between sessions

State is session-only by design, so **Export bag** writes the current bag and
profile to `bag-tips-YYYY-MM-DD.json`, and **Import bag** reads one back. Weather
is deliberately not stored — every environment is re-analysed on load. From v4
the file also carries `bagModelId`, so the bag travels with the discs; v2 and v3
files still load, with the newer fields unset.

```jsonc
{
  "format": "bag-tips.bag",
  "version": 3,
  "exportedAt": "2026-08-30T14:29:05.286Z",
  "profile": { "skillLevel": "ADVANCED", "throwingStyle": "FOREHAND", "courseType": "WOODED" },
  "bag": [ { "id": "b61c0b30-f06b-5f66-a567-78287b003869", "name": "Buzzz",
             "brand": "Discraft", "category": "Midrange", "speed": 5, "glide": 4,
             "turn": -1, "fade": 1, "stability": "stable", "slot": "MIDRANGE",
             "plastic": "Pro-D", "weightGrams": 165, "wear": "WELL_WORN" } ]
}
```

An imported file is untrusted input: `src/lib/bagFile.ts` validates every field,
rejects unknown enum values and out-of-range flight numbers, truncates long
strings, drops unknown keys and duplicate discs, and caps the bag at 30 (the
API's own limit). Version 1 exports are refused rather than migrated — their
disc ids came from a bundled list the live catalog does not know. Version 2
files still load, with plastic, weight and wear unset. A file that fails
validation leaves the current bag untouched and explains why. Carry-weight
settings are session-only and are not written to the file.
`npm test` covers the round trip and each rejection path.

Discs are stored with their flight numbers rather than as bare catalog ids, so
an export still loads if the catalog changes. The trade-off is that the numbers
are a snapshot from export time — the ids are what the API resolves against, so
re-analysis always uses current catalog values.

## How it's put together

```
src/
  api/       wire types and the fetch client
  lib/       flight-path model, session state hooks, bag export/import,
             shape validation, formatters
  components/
    DiscSearch          type-ahead over the catalog (no free-text disc names)
    DiscCard            one bag disc + its flight curve, drawn as you own it
    DiscDetailEditor    plastic / weight / wear, plus the server's stability maths
    CarryWeight         total carried load from disc weights + bag class
    FlightPath          the S-curve SVG
    ProfilePicker       skill / dominant throw / course type
    WeatherToggle       switches which analysed environment is on screen
    StabilitySpeedMap   coverage map: gap rectangles + each gap's target flight
    Lineup              per-slot tabs over POST /api/v1/lineup
    BagPicker           bag model from the catalog + server-computed carry load
    ProfileBar          save / load / delete named bags
    Redundancies        discs doing the same job
    FilterBar           brand chips and a max-speed cap, sent to the server
    RecommendationCard  the pick, its curve, the API's reasoning, and the
                        retrieval table (vector matches, similarity, timings)
    ToggleGroup         the segmented toggle both pickers are built from
```

**Flight model** (`src/lib/flight.ts`). A disc's line is two overlapping lateral
components on a downrange axis: a mid-flight *turn* bulge peaking around ⅔ of
the way out, and a late *fade* pull. Both are scaled by how much of the disc's
rated speed the thrower actually delivers, which is why a speed-12 driver draws
as a hard early hook for a beginner and a full S-curve for an advanced arm.
Weather modulates the same terms, matching how the API describes each one — thin
hot air turns more and carries further, cold dense air flies shorter and more
overstable, rain costs grip and therefore snap, wind makes everything play
overstable. A forehand mirrors the whole path. The output is normalized, so the
SVG layer only scales it. This is a drawing aid, not the server's model.

**Restoring state is validated.** Stored session state can outlive a deploy, and
restoring a shape the current code no longer understands took the whole page down
once (a pre-rewrite bag held a numeric `stability`, and rendering it threw). Both
`sessionStorage` restore and file import go through `src/lib/validate.ts`;
anything that fails is dropped and cleared rather than coerced, and
`ErrorBoundary` catches whatever still gets through so a render error can never
produce a blank page again.

**State.** Session-only, no accounts: bag and profile live in `sessionStorage`
(`src/lib/session.ts`) and the API tracks its own session by cookie, so a reload
keeps your work and closing the tab starts clean. Once a result is on screen, any
change to the bag or profile re-runs all five analyses automatically.

There is deliberately no shared component library yet — patterns get extracted
once there are a few front ends to extract them from.
