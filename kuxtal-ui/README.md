# Kuxtal — offline-first land & plant manager

PWA built with Vite + Svelte 5 + MapLibre GL JS + SQLite WASM (OPFS) + Dexie + Workbox.

## Why offline-first

The user stories that drive every architectural decision come from cooperative-farm interviews. The two anchor stories are:

- "As a farmer with no internet, I keep records on paper and need a digital system that supports offline capture and later sync."
- "As a person on a slow (2G) connection, I need the app to work without round-trips to the server for every action."

See [USERS.md](USERS.md) for the full personas, [ACCESSIBILITY_PLAN.md](ACCESSIBILITY_PLAN.md) for the WCAG 2.2 AA commitment, and [ARCHITECTURE.md](ARCHITECTURE.md) for the layered component layout. [SIMPLIFICATION_PATH.md](SIMPLIFICATION_PATH.md) lists what gets dropped first if maintenance cost rises, [FEEDBACK_LOOP.md](FEEDBACK_LOOP.md) describes how user feedback enters the project, and [MAINTENANCE.md](MAINTENANCE.md) sets the exit criteria.
## Architecture

- **UI:** Svelte 5 runes, single-codebase mobile-first.
- **Map:** MapLibre GL JS — 2D mode (OSM/satellite tiles). A 3D mode exists in code but is disabled in the UI (marked "soon"): it is not ready, and 2D covers the personas' needs on old hardware.
- **Local DB:** SQLite WASM with OPFS persistence (per-origin, no size cap on modern Chromium/Firefox). Falls back to in-memory when OPFS is unavailable; the UI surfaces this.
- **Media blobs:** Dexie/IndexedDB.
- **Spatial index:** rbush for plant-overlap detection and rule-trigger neighborhood lookups.
- **Rules engine:** SQL-backed `rule` table, queryable by entity + relationship + trigger distance.
- **Service worker:** Workbox via `vite-plugin-pwa` — `CacheFirst` for tiles, `generateSW` strategy.
- **Analysis:** Chart.js fed by SQLite aggregations.
- **Calendars:** Thun (lunar zodiac), Sinódico (lunar phase), Maya (Tzolkin/Haab), Andino (chakana markers).

## Modules

- Lienzo (Canvas) — boundary + zones + plants with companion-rule prompts and overlap blocking.
- Plantas — searchable PFAF-seeded plant guide with related rules.
- Animales — animal catalog and observations.
- Cuaderno — text/voice/photo notes (Web Speech API + camera input).
- Conocimiento Heredado — rule editor with retraction, attribution, JSON import/export.
- Recursos — stock items.
- Calendarios — opt-in biodynamic / lunar / maya / andino panels.
- Análisis — counts and species distribution chart.
- Comunidad — placeholder.

## Dev

```bash
pnpm install
pnpm dev
```

The dev server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` so SQLite OPFS works.

## Migration from prototype

On first load, if `localStorage["kuxtal-prototype-v1"]` exists, the app imports zones, plants,
biodiversity, log entries, feedback, and onboarding into SQLite, then sets a flag to skip future imports.

## Roadmap

- Real PFAF / GBIF ingestion pipeline (currently seeded from the curated list).
- Re-evaluate the 3D mode: either finish it behind the existing "soon" toggle or
  remove the code path per SIMPLIFICATION_PATH.md Tier 3. No new rendering
  dependencies until that decision is recorded in DECISIONS.md.
