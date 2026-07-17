import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import CanvasInventory from '../../src/components/Canvas/CanvasInventory.svelte';
import { species, planted, zones } from '../../src/lib/stores/appState';
import { setLocale, t } from '../../src/lib/i18n/index.svelte';
import { expectNoA11yViolations } from '../setup';

// The non-visual equivalent of the map's core plant/zone actions. These tests
// assert it is reachable and operable without sight: labelled controls, a live
// region, named per-item actions, and locale-following text.

const SPECIES = [
  { id: 'maiz', common_name: 'Maíz', spacing_m: 1 },
  { id: 'frijol', common_name: 'Frijol', spacing_m: 0.5 }
] as any;

beforeEach(() => {
  setLocale('es');
  species.set([]);
  planted.set([]);
  zones.set([]);
});

describe('CanvasInventory — non-visual plant/zone management', () => {
  it('exposes a polite live region for action results', () => {
    const { container } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    const live = container.querySelector('[role="status"]');
    expect(live).toBeInTheDocument();
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('labels the species and location selects and the placed/zones regions', async () => {
    species.set(SPECIES);
    const { container, getByLabelText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    // Both selects are reachable by their visible <label>.
    expect(getByLabelText(t('ci_species_label'))).toBeInTheDocument();
    expect(getByLabelText(t('ci_location_label'))).toBeInTheDocument();
    // Each card is a region named by its heading: place, plants, zones, water, boundary.
    const labelled = container.querySelectorAll('section[aria-labelledby]');
    expect(labelled.length).toBe(5);
  });

  it('searches, picks a species, and places it via onPlace with numeric coords', async () => {
    species.set(SPECIES);
    const onPlace = vi.fn();
    const { getByText, getByLabelText, getByRole } = render(CanvasInventory, { props: { landId: 'land-test', onPlace } });
    await tick();
    // Type to filter, then choose from the results — the same as the Plants catalog search.
    await fireEvent.input(getByLabelText(t('ci_species_label')), { target: { value: 'Ma' } });
    await fireEvent.click(getByRole('button', { name: 'Maíz' }));
    await fireEvent.click(getByText(t('ci_place_btn')));
    expect(onPlace).toHaveBeenCalledTimes(1);
    const [speciesId, lat, lng] = onPlace.mock.calls[0];
    expect(speciesId).toBe('maiz');
    expect(Number.isFinite(lat)).toBe(true);
    expect(Number.isFinite(lng)).toBe(true);
  });

  it('filters the species list by query, like the Plants catalog', async () => {
    species.set(SPECIES);
    const { getByLabelText, getByRole, queryByRole } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    await fireEvent.input(getByLabelText(t('ci_species_label')), { target: { value: 'frij' } });
    expect(getByRole('button', { name: 'Frijol' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Maíz' })).toBeNull();
  });

  it('lists placed plants grouped by species with a named remove control', async () => {
    species.set(SPECIES);
    planted.set([
      { id: 'p1', species_id: 'maiz' },
      { id: 'p2', species_id: 'maiz' }
    ] as any);
    const { getByLabelText, getByText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    expect(getByText(t('ci_plants_count', { n: '2' }))).toBeInTheDocument();
    // The remove control names what it removes (not a bare "Delete").
    expect(getByLabelText(t('ci_remove_plant', { name: 'Maíz' }))).toBeInTheDocument();
  });

  it('announces companion-rule feedback returned by placement (not sight-only)', async () => {
    species.set(SPECIES);
    const onPlace = vi.fn(() => ({ warns: ['Maíz no junto a hinojo'], helps: [], collision: false }));
    const { container, getByText, getByRole, getByLabelText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace } });
    await tick();
    await fireEvent.input(getByLabelText(t('ci_species_label')), { target: { value: 'Ma' } });
    await fireEvent.click(getByRole('button', { name: 'Maíz' }));
    await fireEvent.click(getByText(t('ci_place_btn')));
    await waitFor(() => expect(container.querySelector('.ci-status')?.textContent).toContain('Maíz no junto a hinojo'));
  });

  it('follows the active locale (English) for its labels', async () => {
    setLocale('en');
    species.set(SPECIES);
    const { getByText, getByLabelText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    expect(getByText('Place a plant')).toBeInTheDocument();
    expect(getByLabelText('Species')).toBeInTheDocument();
    setLocale('es');
  });

  it('has no axe violations (empty and populated)', async () => {
    const empty = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await expectNoA11yViolations(empty.container);

    species.set(SPECIES);
    planted.set([{ id: 'p1', species_id: 'maiz' }] as any);
    zones.set([{ id: 'z1', name: 'Huerto', polygon_geojson: '{"type":"Polygon","coordinates":[[[0,0],[0,1],[1,1],[0,0]]]}' }] as any);
    const full = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    await expectNoA11yViolations(full.container);
  });
});
