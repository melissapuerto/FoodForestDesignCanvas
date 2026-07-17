import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Drawer from '../../src/components/Layout/Drawer.svelte';
import LocationSearch from '../../src/components/Layout/LocationSearch.svelte';
import CanvasInventory from '../../src/components/Canvas/CanvasInventory.svelte';
import { species, planted, zones, lands, waterFeatures } from '../../src/lib/stores/appState';
import { t } from '../../src/lib/i18n/index.svelte';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Drawer moves focus into the panel on open', () => {
  it('focuses the heading (not a button) so the screen reader enters the panel', async () => {
    const { container } = render(Drawer, { props: { open: true, title: 'Plantas', onClose: vi.fn() } });
    await tick();
    await flush();
    const heading = container.querySelector('h2.drawer-title') as HTMLElement;
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(heading);
  });
});

describe('LocationSearch — accessible geocoding', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn(async () => ({
      json: async () => [
        { lat: '6.2518', lon: '-75.5636', display_name: 'Medellín, Antioquia, Colombia' },
        { lat: '4.7110', lon: '-74.0721', display_name: 'Bogotá, Colombia' }
      ]
    }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('searches as you type and lets you pick a result, returning coordinates', async () => {
    const onSelect = vi.fn();
    const { getByLabelText, findByText } = render(LocationSearch, { props: { onSelect } });

    // No Search button any more: typing runs the search (debounced).
    const input = getByLabelText(t('locsearch_label')) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Medellin' } });

    const first = await findByText('Medellín, Antioquia, Colombia', undefined, { timeout: 2000 });
    await fireEvent.click(first);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0];
    expect(arg.lat).toBeCloseTo(6.2518, 3);
    expect(arg.lng).toBeCloseTo(-75.5636, 3);
    expect(arg.label).toContain('Medellín');
  });

  it('is a combobox whose results can be reached and chosen by keyboard', async () => {
    const onSelect = vi.fn();
    const { getByLabelText, findByRole } = render(LocationSearch, { props: { onSelect } });

    const input = getByLabelText(t('locsearch_label')) as HTMLInputElement;
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await fireEvent.input(input, { target: { value: 'Medellin' } });
    const list = await findByRole('listbox', undefined, { timeout: 2000 });
    expect(list).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // Arrow down highlights the first option, Enter chooses it — no mouse needed.
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await tick();
    expect(input.getAttribute('aria-activedescendant')).toBe('locsearch-opt-0');

    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].label).toContain('Medellín');
  });

  it('offers a GPS button instead of a redundant search button', () => {
    const { getByLabelText, queryByText } = render(LocationSearch, { props: { onSelect: vi.fn() } });
    expect(getByLabelText(t('locsearch_gps_aria'))).toBeInTheDocument();
    expect(queryByText(t('locsearch_btn'))).not.toBeInTheDocument();
  });

  it('exposes a live status region for screen readers', () => {
    const { container } = render(LocationSearch, { props: { onSelect: vi.fn() } });
    const status = container.querySelector('#locsearch-status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

describe('CanvasInventory — every canvas element is reachable', () => {
  beforeEach(() => {
    species.set([]); planted.set([]); zones.set([]); waterFeatures.set([]); lands.set([]);
  });

  it('lists water features with rename and delete controls', async () => {
    waterFeatures.set([
      { id: 'w1', land_id: 'land-test', name: 'Estanque norte', type: 'pond', geometry_geojson: '{}', notes: null, created_at: '', updated_at: '' }
    ] as any);
    const { getByLabelText, getByText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    expect(getByText(t('ci_water_heading'))).toBeInTheDocument();
    expect(getByLabelText(t('ci_rename_water', { name: 'Estanque norte' }))).toBeInTheDocument();
    expect(getByLabelText(t('ci_delete_water', { name: 'Estanque norte' }))).toBeInTheDocument();
  });

  it('offers to delete the boundary when one exists', async () => {
    lands.set([
      { id: 'land-test', name: 'Mi finca', boundary_geojson: '{"type":"Polygon","coordinates":[]}', boundary_closed: 1, center_lat: 0, center_lng: 0, created_at: '', updated_at: '' }
    ] as any);
    const { getByText } = render(CanvasInventory, { props: { landId: 'land-test', onPlace: vi.fn() } });
    await tick();
    expect(getByText(t('ci_boundary_present'))).toBeInTheDocument();
    expect(getByText(t('ci_delete_boundary'))).toBeInTheDocument();
  });
});
