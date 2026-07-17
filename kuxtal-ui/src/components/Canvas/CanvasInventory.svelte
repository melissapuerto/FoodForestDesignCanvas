<script lang="ts">
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  /**
   * CanvasInventory — a fully keyboard- and screen-reader-operable way to do
   * everything the visual map canvas does for plants and zones, without sight:
   * place a species at a chosen location, and review / remove placed plants and
   * rename / delete zones. The map is a spatial *view*; this panel is the
   * non-visual equivalent of its core actions (see ACCESSIBILITY_AUDIT.md — the
   * map drawing surface itself is not screen-reader operable by design).
   *
   * It mutates through the same appState primitives the map uses, and the map
   * subscribes to those stores, so both stay in sync automatically. Every
   * action reports its result through a polite live region.
   */
  import {
    species,
    planted,
    zones,
    lands,
    waterFeatures,
    deletePlanted,
    getPlantedById,
    restorePlanted,
    insertZone,
    updateZone,
    deleteZone,
    getZoneById,
    restoreZone,
    insertWaterFeature,
    deleteWaterFeature,
    restoreWaterFeature,
    renameWaterFeature,
    updateLandBoundary,
    getLand,
    type SpeciesRow,
    type PlantedRow,
    type ZoneRow,
    type WaterFeatureRow
  } from '../../lib/stores/appState';
  import { polygonToGeoJson, metersToDegLat, metersToDegLng, type LngLat } from '../../lib/map/geometry';
  import { dialogConfirm, dialogPrompt } from '../../lib/stores/dialog';
  import { pushCommand } from '../../lib/stores/history';
  import { t } from '../../lib/i18n/index.svelte';
  import { tick } from 'svelte';

  let {
    landId,
    onPlace
  }: {
    landId: string;
    /** Place `speciesId` at the given coordinates. App wires this to the map's
     *  placeSpeciesAt(), which runs the full collision/companion-rule path and
     *  returns the rule hits so we can announce them. */
    onPlace: (speciesId: string, lat: number, lng: number) => PlaceResult | null | void;
  } = $props();

  type PlaceResult = { warns: string[]; helps: string[]; collision: boolean };

  // $store auto-subscriptions (via $derived) instead of manual .subscribe():
  // this panel is remounted on every drawer open, and manual subscriptions
  // were never torn down — each open leaked one forever.
  const speciesList = $derived($species);
  const plantedRows = $derived($planted);
  const zoneRows = $derived($zones);
  const waterRows = $derived($waterFeatures);
  // The boundary lives on the land row; recompute whenever lands reload.
  const hasBoundary = $derived.by(() => {
    const land = $lands.find((l) => l.id === landId);
    return !!land?.boundary_geojson;
  });

  let selectedSpeciesId = $state('');
  let selectedLocation = $state('land'); // 'land' | zone id
  let liveMsg = $state('');
  let plantsHeadingEl: HTMLHeadingElement | undefined = $state();
  let placeBtnEl: HTMLButtonElement | undefined = $state();

  /**
   * Non-visual entry point for "plant this species" from the Plants catalog.
   * In screen-reader mode the map can't be tapped, so the catalog routes here:
   * the species becomes the selected one in "Place a plant" and focus moves to
   * the Place button, so the user only has to (optionally) pick a location and
   * activate it. Exported for App to call on the SR-home instance.
   */
  export function chooseSpeciesById(id: string): void {
    const sp = speciesList.find((s) => s.id === id);
    if (!sp) return;
    selectedSpeciesId = sp.id;
    speciesQuery = '';
    tick().then(() => placeBtnEl?.focus());
  }

  // Plant search — works the same as the Plants catalog: type to filter the
  // species by common name, scientific name, aliases or notes. (The on-canvas
  // quick picker is inert in screen-reader mode, so this is the searchable
  // plant menu a non-visual user actually reaches.)
  let speciesQuery = $state('');
  const speciesAllMatches = $derived.by(() => {
    const q = speciesQuery.trim().toLowerCase();
    if (!q) return [] as SpeciesRow[];
    return speciesList.filter((sp) => {
      let aliasesStr = '';
      if (sp.aliases) {
        try { aliasesStr = (JSON.parse(sp.aliases) as string[]).join(' '); }
        catch { aliasesStr = sp.aliases; }
      }
      return `${sp.common_name} ${sp.scientific_name ?? ''} ${aliasesStr} ${sp.notes ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  });
  const speciesMatches = $derived(speciesAllMatches.slice(0, 25));

  /** Common name from the loaded catalog, so lookups don't depend on a live DB query. */
  function speciesName(id: string): string {
    const sp = speciesList.find((s) => s.id === id);
    return sp ? localSpeciesName(sp.common_name, sp.scientific_name) : id;
  }

  function chooseSpecies(sp: SpeciesRow): void {
    selectedSpeciesId = sp.id;
    speciesQuery = '';
    announce(t('ci_species_chosen', { name: localSpeciesName(sp.common_name, sp.scientific_name) }));
  }

  // Placed plants grouped by species: fewer, clearer list items for a screen
  // reader, each with a running count.
  const grouped = $derived.by(() => {
    const m = new Map<string, number>();
    for (const p of plantedRows) m.set(p.species_id, (m.get(p.species_id) ?? 0) + 1);
    return [...m.entries()]
      .map(([id, n]) => ({ id, n, name: speciesName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  function announce(msg: string): void {
    // Clear then set on the next tick so repeated identical messages are still
    // re-announced by assistive tech.
    liveMsg = '';
    tick().then(() => (liveMsg = msg));
  }

  /** Small deterministic offset (~a few metres) so repeated placements at the
   *  same reference point don't land exactly on top of each other. */
  function jitter(seed: number): number {
    return (((seed * 37) % 11) - 5) * 0.00002;
  }

  function zoneCentroid(z: ZoneRow): { lat: number; lng: number } | null {
    try {
      const geo = JSON.parse(z.polygon_geojson);
      const ring = geo?.coordinates?.[0];
      if (!Array.isArray(ring) || !ring.length) return null;
      let sx = 0, sy = 0, n = 0;
      for (const pt of ring) {
        if (Array.isArray(pt) && pt.length >= 2) { sx += Number(pt[0]); sy += Number(pt[1]); n++; }
      }
      return n ? { lat: sy / n, lng: sx / n } : null;
    } catch {
      return null;
    }
  }

  function targetLocation(): { lat: number; lng: number; label: string } {
    const seed = plantedRows.length;
    if (selectedLocation !== 'land') {
      const z = zoneRows.find((zz) => zz.id === selectedLocation);
      const c = z && zoneCentroid(z);
      if (z && c) {
        return { lat: c.lat + jitter(seed), lng: c.lng + jitter(seed + 1), label: t('ci_in_zone', { zone: z.name }) };
      }
    }
    const land = getLand(landId);
    return {
      lat: (land?.center_lat ?? 0) + jitter(seed),
      lng: (land?.center_lng ?? 0) + jitter(seed + 1),
      label: t('ci_location_land_center')
    };
  }

  function place(): void {
    const sp = speciesList.find((s) => s.id === selectedSpeciesId);
    if (!sp) { announce(t('ci_choose_species_first')); return; }
    const target = targetLocation();
    const result = onPlace(sp.id, target.lat, target.lng);
    // appState mutations are synchronous, so the store is already updated.
    const parts = [t('ci_announce_placed', { name: localSpeciesName(sp.common_name, sp.scientific_name), loc: target.label, n: String(plantedRows.length) })];
    if (result) {
      // Announce the same companion / incompatibility feedback the map shows
      // visually — it's the core value of the app and must not be sight-only.
      if (result.warns.length) parts.push(t('ci_announce_warn', { msg: result.warns.join('; ') }));
      if (result.helps.length) parts.push(t('ci_announce_companion', { msg: result.helps.join('; ') }));
    }
    announce(parts.join(' '));
  }

  async function removeOneOf(speciesId: string): Promise<void> {
    const name = speciesName(speciesId);
    const ok = await dialogConfirm({
      title: t('map_delete_plant_title', { name }),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    // Remove the most recently placed plant of this species.
    const target = [...plantedRows].reverse().find((p) => p.species_id === speciesId);
    if (!target) return;
    const wasLast = grouped.find((g) => g.id === speciesId)?.n === 1;
    const snapshot = getPlantedById(target.id);
    deletePlanted(target.id, landId);
    if (snapshot) {
      pushCommand({
        label: t('hist_plant_removed'),
        undo: () => restorePlanted(snapshot),
        redo: () => deletePlanted(snapshot.id, landId)
      });
    }
    announce(t('ci_announce_removed', { name, n: String(plantedRows.length) }));
    // If that species' row vanished, focus would be orphaned — move it to the heading.
    if (wasLast) { await tick(); plantsHeadingEl?.focus(); }
  }

  async function renameZone(z: ZoneRow): Promise<void> {
    const name = await dialogPrompt({
      title: t('ci_rename_zone_title'),
      body: t('ci_rename_zone_body'),
      defaultValue: z.name,
      confirmLabel: t('common_save')
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === z.name) return;
    updateZone(z.id, { name: trimmed });
    announce(t('ci_announce_zone_renamed', { name: trimmed }));
  }

  async function removeZone(z: ZoneRow): Promise<void> {
    const ok = await dialogConfirm({
      title: t('ci_delete_zone_title', { name: z.name }),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    const snapshot = getZoneById(z.id);
    deleteZone(z.id, landId);
    if (snapshot) {
      pushCommand({
        label: t('hist_zone_removed'),
        undo: () => restoreZone(snapshot),
        redo: () => deleteZone(snapshot.id, landId)
      });
    }
    announce(t('ci_announce_zone_deleted', { name: z.name, n: String(zoneRows.length) }));
  }

  async function renameWater(w: WaterFeatureRow): Promise<void> {
    const name = await dialogPrompt({
      title: t('ci_rename_water_title'),
      body: t('ci_rename_water_body'),
      defaultValue: w.name,
      confirmLabel: t('common_save')
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === w.name) return;
    renameWaterFeature(w.id, trimmed, landId);
    announce(t('ci_announce_water_renamed', { name: trimmed }));
  }

  async function removeWater(w: WaterFeatureRow): Promise<void> {
    const ok = await dialogConfirm({
      title: t('ci_delete_water_title', { name: w.name }),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    const snapshot = deleteWaterFeature(w.id, landId);
    if (snapshot) {
      pushCommand({
        label: t('ci_water_heading'),
        undo: () => restoreWaterFeature(snapshot),
        redo: () => deleteWaterFeature(snapshot.id, landId)
      });
    }
    announce(t('ci_announce_water_deleted', { name: w.name, n: String(waterRows.length) }));
  }

  async function deleteBoundary(): Promise<void> {
    const ok = await dialogConfirm({
      title: t('ci_delete_boundary_title'),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    updateLandBoundary(landId, null, false);
    announce(t('ci_announce_boundary_deleted'));
  }

  // ---- Non-visual creation of zones / water / boundary ----
  // The map creates these by drawing, which a blind user can't do. Here they are
  // created with a sensible default shape (a circle near the land centre, offset
  // so they don't stack), which the user can later refine on a sighted device.
  let newZoneName = $state('');
  let newWaterName = $state('');
  let newWaterType = $state<'pond' | 'well' | 'spring'>('pond');

  function landCenter(): LngLat {
    const land = getLand(landId);
    return { lat: land?.center_lat ?? 0, lng: land?.center_lng ?? 0 };
  }
  function circleAround(center: LngLat, radiusM: number, seedIdx: number): GeoJSON.Polygon {
    const cy = center.lat + jitter(seedIdx);
    const cx = center.lng + jitter(seedIdx + 1);
    const dLat = metersToDegLat(radiusM);
    const dLng = metersToDegLng(radiusM, cy);
    const ring: LngLat[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 2 * Math.PI;
      ring.push({ lng: cx + Math.cos(a) * dLng, lat: cy + Math.sin(a) * dLat });
    }
    return polygonToGeoJson(ring);
  }

  function createZone(): void {
    const name = newZoneName.trim() || t('ci_default_zone_name', { n: String(zoneRows.length + 1) });
    const id = insertZone({ landId, name, polygon: circleAround(landCenter(), 8, zoneRows.length) });
    const row = getZoneById(id);
    if (row) {
      pushCommand({ label: t('hist_zone_added'), undo: () => deleteZone(id, landId), redo: () => restoreZone(row) });
    }
    newZoneName = '';
    announce(t('ci_announce_zone_created', { name, n: String(zoneRows.length) }));
  }

  function createWater(): void {
    const name = newWaterName.trim() || t('ci_default_water_name', { n: String(waterRows.length + 1) });
    const id = insertWaterFeature({ landId, name, type: newWaterType, geometry: circleAround(landCenter(), 4, waterRows.length) });
    pushCommand({ label: t('ci_water_heading'), undo: () => deleteWaterFeature(id, landId), redo: () => {} });
    newWaterName = '';
    announce(t('ci_announce_water_created', { name, n: String(waterRows.length) }));
  }

  function createBoundary(): void {
    updateLandBoundary(landId, circleAround(landCenter(), 40, 0), true);
    announce(t('ci_announce_boundary_created'));
  }
</script>

<div class="ci">
  <!-- Polite live region: announces every place / remove / rename result. -->
  <p class="ci-status" role="status" aria-live="polite">{liveMsg}</p>

  <section class="codex-card ci-card" aria-labelledby="ci-place-h">
    <h3 id="ci-place-h" class="label">{t('ci_place_heading')}</h3>
    {#if speciesList.length === 0}
      <p class="empty">{t('ci_no_species')}</p>
    {:else}
      <div class="ci-field">
        <label for="ci-species">{t('ci_species_label')}</label>
        <input
          id="ci-species"
          class="inp"
          type="search"
          bind:value={speciesQuery}
          placeholder={t('ci_species_ph')}
          aria-describedby="ci-species-status"
          autocomplete="off"
        />
      </div>
      <p id="ci-species-status" class="coord" role="status" aria-live="polite">
        {#if speciesQuery.trim()}{speciesAllMatches.length ? t('ci_species_count', { n: String(speciesAllMatches.length) }) : t('picker_no_results')}{/if}
      </p>
      {#if speciesMatches.length}
        <ul class="ci-species-results" aria-label={t('ci_species_label')}>
          {#each speciesMatches as sp (sp.id)}
            <li>
              <button type="button" class="ci-species-result" aria-pressed={selectedSpeciesId === sp.id} onclick={() => chooseSpecies(sp)}>
                {sp.common_name}{#if sp.scientific_name} <span class="coord">· {sp.scientific_name}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="ci-species-current">
        {selectedSpeciesId ? t('ci_species_current', { name: speciesName(selectedSpeciesId) }) : t('ci_species_none_chosen')}
      </p>
      <div class="ci-field">
        <label for="ci-location">{t('ci_location_label')}</label>
        <select id="ci-location" class="inp" bind:value={selectedLocation}>
          <option value="land">{t('ci_location_land_center')}</option>
          {#each zoneRows as z (z.id)}
            <option value={z.id}>{t('ci_in_zone', { zone: z.name })}</option>
          {/each}
        </select>
      </div>
      <button type="button" class="btn btn-accent ci-place" bind:this={placeBtnEl} onclick={place} disabled={!selectedSpeciesId}>
        {t('ci_place_btn')}
      </button>
    {/if}
  </section>

  <section class="codex-card ci-card" aria-labelledby="ci-plants-h">
    <h3 id="ci-plants-h" class="label" tabindex="-1" bind:this={plantsHeadingEl}>
      {t('ci_plants_heading')}
    </h3>
    <p class="coord">{t('ci_plants_count', { n: String(plantedRows.length) })}</p>
    {#if grouped.length === 0}
      <p class="empty">{t('ci_empty_plants')}</p>
    {:else}
      <ul class="ci-list">
        {#each grouped as g (g.id)}
          <li class="ci-row">
            <span class="ci-row-name">{g.name} <span class="coord" aria-hidden="true">×{g.n}</span><span class="sr-only">, {t('count_total', { n: String(g.n) })}</span></span>
            <button type="button" class="btn btn-sm btn-danger" aria-label={t('ci_remove_plant', { name: g.name })} onclick={() => removeOneOf(g.id)}>
              {t('common_delete')}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="codex-card ci-card" aria-labelledby="ci-zones-h">
    <h3 id="ci-zones-h" class="label">{t('ci_zones_heading')}</h3>
    <p class="coord">{t('ci_zones_count', { n: String(zoneRows.length) })}</p>
    {#if zoneRows.length === 0}
      <p class="empty">{t('ci_empty_zones')}</p>
    {:else}
      <ul class="ci-list">
        {#each zoneRows as z (z.id)}
          <li class="ci-row">
            <span class="ci-row-name">{z.name}</span>
            <span class="ci-row-actions">
              <button type="button" class="btn btn-sm" aria-label={t('ci_rename_zone', { name: z.name })} onclick={() => renameZone(z)}>
                {t('common_edit')}
              </button>
              <button type="button" class="btn btn-sm btn-danger" aria-label={t('ci_delete_zone', { name: z.name })} onclick={() => removeZone(z)}>
                {t('common_delete')}
              </button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="ci-create">
      <label for="ci-new-zone">{t('ci_new_zone_label')}</label>
      <div class="ci-create-row">
        <input id="ci-new-zone" class="inp" bind:value={newZoneName} placeholder={t('ci_new_zone_label')} />
        <button type="button" class="btn btn-sm btn-accent" onclick={createZone}>{t('ci_create_zone_btn')}</button>
      </div>
    </div>
  </section>

  <section class="codex-card ci-card" aria-labelledby="ci-water-h">
    <h3 id="ci-water-h" class="label">{t('ci_water_heading')}</h3>
    <p class="coord">{t('ci_water_count', { n: String(waterRows.length) })}</p>
    {#if waterRows.length === 0}
      <p class="empty">{t('ci_empty_water')}</p>
    {:else}
      <ul class="ci-list">
        {#each waterRows as w (w.id)}
          <li class="ci-row">
            <span class="ci-row-name">{w.name}</span>
            <span class="ci-row-actions">
              <button type="button" class="btn btn-sm" aria-label={t('ci_rename_water', { name: w.name })} onclick={() => renameWater(w)}>
                {t('common_edit')}
              </button>
              <button type="button" class="btn btn-sm btn-danger" aria-label={t('ci_delete_water', { name: w.name })} onclick={() => removeWater(w)}>
                {t('common_delete')}
              </button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="ci-create">
      <label for="ci-new-water">{t('ci_new_water_label')}</label>
      <div class="ci-create-row">
        <input id="ci-new-water" class="inp" bind:value={newWaterName} placeholder={t('ci_new_water_label')} />
        <select class="inp" bind:value={newWaterType} aria-label={t('ci_water_type_label')}>
          <option value="pond">{t('ci_wtype_pond')}</option>
          <option value="well">{t('ci_wtype_well')}</option>
          <option value="spring">{t('ci_wtype_spring')}</option>
        </select>
        <button type="button" class="btn btn-sm btn-accent" onclick={createWater}>{t('ci_create_water_btn')}</button>
      </div>
    </div>
  </section>

  <section class="codex-card ci-card" aria-labelledby="ci-boundary-h">
    <h3 id="ci-boundary-h" class="label">{t('ci_boundary_heading')}</h3>
    {#if hasBoundary}
      <p class="coord">{t('ci_boundary_present')}</p>
      <button type="button" class="btn btn-sm btn-danger" onclick={deleteBoundary}>
        {t('ci_delete_boundary')}
      </button>
    {:else}
      <p class="empty">{t('ci_boundary_absent')}</p>
      <button type="button" class="btn btn-sm btn-accent" onclick={createBoundary}>
        {t('ci_create_boundary_btn')}
      </button>
    {/if}
  </section>
</div>

<style>
  .ci { display: flex; flex-direction: column; gap: 14px; }
  .ci-card { padding: 14px 16px; }
  .ci-card h3 { margin: 0 0 8px; }
  .ci-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .ci-field label { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }

  .ci-species-results {
    list-style: none; margin: 6px 0 0; padding: 0;
    border: 1px solid var(--line); border-radius: 6px; overflow: hidden;
    max-height: 220px; overflow-y: auto;
  }
  .ci-species-result {
    display: block; width: 100%; text-align: left;
    padding: 10px 12px; min-height: 44px;
    background: var(--paper); border: none; border-bottom: 1px solid var(--line);
    color: var(--ink); font-size: calc(14px * var(--text-scale)); cursor: pointer;
  }
  .ci-species-result:last-child { border-bottom: none; }
  .ci-species-result:hover { background: var(--paper-warm); }
  .ci-species-result[aria-pressed='true'] { background: var(--paper-warm); font-weight: 600; }
  .ci-species-current { margin: 8px 0 0; font-size: calc(13px * var(--text-scale)); color: var(--ink-soft); }

  .ci-create { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; }
  .ci-create label { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
  .ci-create-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .ci-create-row .inp { flex: 1; min-width: 120px; }
  .ci-create-row .btn { min-height: 44px; white-space: nowrap; }
  .ci-place { margin-top: 4px; min-height: 44px; }

  .ci-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ci-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .ci-row-name { font-size: calc(14px * var(--text-scale)); }
  .ci-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .ci-row .btn { min-height: 36px; }

  /* The status line is visible (helps low-vision users) and announced politely
     to screen readers. Reserve space so placement doesn't shift the layout. */
  .ci-status {
    min-height: 1.2em;
    margin: 0;
    font-family: var(--serif); font-weight: var(--display-weight);
    font-style: italic;
    font-size: calc(13px * var(--text-scale));
    color: var(--jade-deep);
  }
  .ci-status:empty { visibility: hidden; }

  .empty { color: var(--ink-soft); font-style: italic; margin: 4px 0 0; }
</style>
