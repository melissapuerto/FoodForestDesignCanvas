import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';

// In-memory data layer so the REAL CanvasInventory logic runs in jsdom (the app
// uses SQLite-WASM, which can't init here). Stores are created in a hoisted
// block so both the mock and the test can read them.
const mem = vi.hoisted(() => {
  const { writable } = require('svelte/store');
  return {
    species: writable<any[]>([]),
    planted: writable<any[]>([]),
    zones: writable<any[]>([]),
    waterFeatures: writable<any[]>([]),
    lands: writable<any[]>([
      { id: 'land-test', name: 'Mi finca', boundary_geojson: null, boundary_closed: 0, center_lat: 6.25, center_lng: -75.57, created_at: '', updated_at: '' }
    ]),
    seq: { n: 0 }
  };
});

vi.mock('../../src/lib/stores/appState', () => {
  const { get } = require('svelte/store');
  const id = (p: string) => `${p}-${++mem.seq.n}`;
  return {
    species: mem.species, planted: mem.planted, zones: mem.zones,
    waterFeatures: mem.waterFeatures, lands: mem.lands,
    insertZone: ({ landId, name, polygon }: any) => { const i = id('zone'); mem.zones.update((r: any[]) => [...r, { id: i, land_id: landId, name, polygon_geojson: JSON.stringify(polygon), created_at: '', updated_at: '' }]); return i; },
    deleteZone: (i: string) => { let row = null; mem.zones.update((r: any[]) => { row = r.find((z) => z.id === i) ?? null; return r.filter((z) => z.id !== i); }); return row; },
    getZoneById: (i: string) => get(mem.zones).find((z: any) => z.id === i) ?? null,
    restoreZone: (row: any) => mem.zones.update((r: any[]) => [...r, row]),
    updateZone: (i: string, patch: any) => mem.zones.update((r: any[]) => r.map((z) => z.id === i ? { ...z, ...patch } : z)),
    insertWaterFeature: ({ landId, name, type, geometry }: any) => { const i = id('wtr'); mem.waterFeatures.update((r: any[]) => [...r, { id: i, land_id: landId, name, type, geometry_geojson: JSON.stringify(geometry), notes: null, created_at: '', updated_at: '' }]); return i; },
    deleteWaterFeature: (i: string) => { let row = null; mem.waterFeatures.update((r: any[]) => { row = r.find((w) => w.id === i) ?? null; return r.filter((w) => w.id !== i); }); return row; },
    restoreWaterFeature: (row: any) => mem.waterFeatures.update((r: any[]) => [...r, row]),
    renameWaterFeature: (i: string, name: string) => mem.waterFeatures.update((r: any[]) => r.map((w) => w.id === i ? { ...w, name } : w)),
    insertPlanted: ({ landId, speciesId, lat, lng }: any) => { const i = id('plt'); mem.planted.update((r: any[]) => [...r, { id: i, land_id: landId, species_id: speciesId, lat, lng, zone_id: null, planted_at: null, notes: null, created_at: '', updated_at: '' }]); return i; },
    deletePlanted: (i: string) => { let row = null; mem.planted.update((r: any[]) => { row = r.find((p) => p.id === i) ?? null; return r.filter((p) => p.id !== i); }); return row; },
    getPlantedById: (i: string) => get(mem.planted).find((p: any) => p.id === i) ?? null,
    restorePlanted: (row: any) => mem.planted.update((r: any[]) => [...r, row]),
    updateLandBoundary: (landId: string, polygon: any, closed: boolean) => mem.lands.update((r: any[]) => r.map((l) => l.id === landId ? { ...l, boundary_geojson: polygon ? JSON.stringify(polygon) : null, boundary_closed: closed ? 1 : 0 } : l)),
    getLand: (i: string) => get(mem.lands).find((l: any) => l.id === i) ?? null
  };
});

// Confirms/prompts resolve automatically so the flow isn't blocked on DialogHost.
vi.mock('../../src/lib/stores/dialog', () => ({
  dialogConfirm: vi.fn(async () => true),
  dialogPrompt: vi.fn(async () => 'Renombrada'),
  dialogAlert: vi.fn(async () => {})
}));

import CanvasInventory from '../../src/components/Canvas/CanvasInventory.svelte';
import { species, planted, zones, waterFeatures, lands, insertPlanted } from '../../src/lib/stores/appState';
import { t } from '../../src/lib/i18n/index.svelte';
import { localSpeciesName } from '../../src/lib/i18n/dataLocal';

const SPECIES = [
  { id: 'maiz', common_name: 'Maíz', scientific_name: 'Zea mays', spacing_m: 1, aliases: null, notes: null },
  { id: 'frijol', common_name: 'Frijol', scientific_name: 'Phaseolus', spacing_m: 0.5, aliases: null, notes: null }
];

// Placement goes through this prop in the real app (the map's placeSpeciesAt);
// here it writes to the in-memory store so the plant shows up in the list.
const onPlace = (speciesId: string, lat: number, lng: number) => {
  insertPlanted({ landId: 'land-test', speciesId, lat, lng } as any);
  return { warns: [], helps: [], collision: false };
};

beforeEach(() => {
  species.set(SPECIES as any);
  planted.set([]); zones.set([]); waterFeatures.set([]);
  lands.set([{ id: 'land-test', name: 'Mi finca', boundary_geojson: null, boundary_closed: 0, center_lat: 6.25, center_lng: -75.57, created_at: '', updated_at: '' }] as any);
  mem.seq.n = 0;
});

describe('Blind user can run the whole canvas flow by keyboard', () => {
  it('tabbing first lands on the plant search (the main action)', async () => {
    const user = userEvent.setup();
    render(CanvasInventory, { props: { landId: 'land-test', onPlace } });
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(t('ci_species_label')));
  });

  it('searches a species, places it, then creates a zone, water and boundary', async () => {
    const user = userEvent.setup();
    render(CanvasInventory, { props: { landId: 'land-test', onPlace } });

    // Place a plant: type to filter → choose from the list → activate Place.
    await user.type(screen.getByLabelText(t('ci_species_label')), 'Maí');
    await user.click(await screen.findByRole('button', { name: /Maíz/ }));
    await user.click(screen.getByRole('button', { name: t('ci_place_btn') }));
    expect(get(planted).length).toBe(1);

    // Create a zone with a name.
    await user.type(screen.getByLabelText(t('ci_new_zone_label')), 'Huerto');
    await user.click(screen.getByRole('button', { name: t('ci_create_zone_btn') }));
    expect(get(zones).map((z: any) => z.name)).toContain('Huerto');

    // Create a water feature.
    await user.type(screen.getByLabelText(t('ci_new_water_label')), 'Estanque');
    await user.click(screen.getByRole('button', { name: t('ci_create_water_btn') }));
    expect(get(waterFeatures).length).toBe(1);

    // Create the boundary.
    await user.click(screen.getByRole('button', { name: t('ci_create_boundary_btn') }));
    expect(get(lands)[0].boundary_geojson).toBeTruthy();
  });

  it('edits and deletes elements (zone rename + delete, plant remove)', async () => {
    const user = userEvent.setup();
    zones.set([{ id: 'z1', land_id: 'land-test', name: 'Huerto', polygon_geojson: '{}', created_at: '', updated_at: '' }] as any);
    planted.set([{ id: 'p1', land_id: 'land-test', species_id: 'maiz', lat: 6.25, lng: -75.57, zone_id: null, planted_at: null, notes: null, created_at: '', updated_at: '' }] as any);
    render(CanvasInventory, { props: { landId: 'land-test', onPlace } });

    // Rename the zone (dialogPrompt auto-returns "Renombrada").
    await user.click(screen.getByRole('button', { name: t('ci_rename_zone', { name: 'Huerto' }) }));
    expect(get(zones)[0].name).toBe('Renombrada');

    // Delete the zone (dialogConfirm auto-true).
    await user.click(screen.getByRole('button', { name: t('ci_delete_zone', { name: 'Renombrada' }) }));
    expect(get(zones).length).toBe(0);

    // Remove the placed plant.
    const maizName = localSpeciesName('Maíz', 'Zea mays');
    await user.click(screen.getByRole('button', { name: t('ci_remove_plant', { name: maizName }) }));
    expect(get(planted).length).toBe(0);
  });
});
