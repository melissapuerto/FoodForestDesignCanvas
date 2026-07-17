<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map as MlMap, type MapMouseEvent } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  import {
    species,
    zones,
    planted,
    waterFeatures,
    getLand,
    updateLandBoundary,
    insertZone,
    insertPlanted,
    deletePlanted,
    deleteZone,
    restorePlanted,
    restoreZone,
    getPlantedById,
    getZoneById,
    speciesById,
    insertWaterFeature,
    deleteWaterFeature,
    restoreWaterFeature,
    reloadFromDb,
    type SpeciesRow,
    type PlantedRow,
    type ZoneRow,
    type WaterFeatureRow
  } from '../../lib/stores/appState';
  import {
    polygonToGeoJson,
    haversineMeters,
    metersToDegLat,
    metersToDegLng,
    type LngLat
  } from '../../lib/map/geometry';
  import { GeoSpatialIndex, type SpatialItem } from '../../lib/map/spatialIndex';
  import { findRulesAt } from '../../lib/rules/engine';
  import type { RuleHit } from '../../lib/rules/types';
  import { showToast } from '../../lib/stores/toast';
  import { dialogPrompt, dialogAlert, dialogConfirm } from '../../lib/stores/dialog';
  import { offerUndo } from '../../lib/stores/undo';
  import { pushCommand } from '../../lib/stores/history';
  import { plantTone, plantGlyph } from '../../lib/glyphs/mapping';
  import { GLYPHS, type GlyphName } from '../../lib/glyphs/glyph-data';
  import { formatMeters } from '../../lib/utils/format';
  import { pushRuleMessage } from '../../lib/stores/ruleMessages';
  import { exec, selectAll } from '../../lib/db/sqlite';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import FloatingTools, { type ToolId } from '../Layout/FloatingTools.svelte';
  import SpeciesQuickPicker from '../Layout/SpeciesQuickPicker.svelte';
  import MeasurementOverlay from './MeasurementOverlay.svelte';
  import RelationshipPanel from './RelationshipPanel.svelte';
  import LocationPicker from './LocationPicker.svelte';
  import { localRuleMessage, localSpeciesName } from '../../lib/i18n/dataLocal';
  import { addRecentPlant } from '../../lib/stores/recents';
  import { allNormalizedPlants, type NormalizedPlant } from '../../lib/pfaf/pfafSchema';
  import { getEngineSite } from '../../lib/recommend/site';
  import { buildCanvasState } from '../../lib/recommend/canvasState';
  import { buildRuleIndex } from '../../lib/recommend/ruleIndex';
  import { scorePlant } from '../../lib/recommend/scorePlant';
  import { applyMicrozone, microzoneAt } from '../../lib/recommend/microzone';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    landId,
    onOpenPlantasCatalog
  }: {
    landId: string;
    onOpenPlantasCatalog?: () => void;
  } = $props();

  let mapEl: HTMLDivElement | undefined = $state();
  let map = $state<MlMap | null>(null);
  let mapReady = $state(false);

  let mode = $state<'2d' | '3d'>('2d');
  let basemap = $state<'streets' | 'satellite' | 'paper' | 'blank'>('paper');
  let tool = $state<ToolId>('pan');
  let selectedSpeciesId = $state<string | null>(null);
  let speciesPickerVisible = $state(true);

  let drawingBoundary = $state<LngLat[]>([]);
  let drawingZone = $state<LngLat[]>([]);
  let drawingWater = $state<LngLat[]>([]);
  let waterType = $state<'pond' | 'river' | 'channel' | 'swale' | 'well' | 'spring' | 'other'>('pond');
  let waterFeatureRows = $state<WaterFeatureRow[]>([]);

  // Relationship panel
  let relPanelPlantId = $state<string | null>(null);
  let relPanelHits = $state<RuleHit[]>([]);

  // Always show measurement overlay on the canvas
  let showMeasurements = true;

  // Transition animation state
  let transitioning = $state(false);

  // Location picker state
  let locationPickerVisible = $state(false);
  let pendingBasemapSwitch = $state<'streets' | 'satellite' | 'paper' | 'blank' | null>(null);

  // Detect if we have real geo coordinates (not just 0,0)
  function checkRealCoordinates(): boolean {
    const land = getLand(landId);
    if (!land?.boundary_geojson) return false;
    try {
      const geo = JSON.parse(land.boundary_geojson) as GeoJSON.Polygon;
      const ring = geo.coordinates?.[0];
      if (!ring?.length) return false;
      const avgLng = ring.reduce((a: number, c: number[]) => a + c[0], 0) / ring.length;
      const avgLat = ring.reduce((a: number, c: number[]) => a + c[1], 0) / ring.length;
      return Math.abs(avgLng) > 0.01 || Math.abs(avgLat) > 0.01;
    } catch { return false; }
  }
  let hasRealCoordinates = $state(false);
  // Re-check when zones/boundary change
  $effect(() => {
    // depend on zoneRows to trigger recalc when data changes
    void zoneRows.length;
    hasRealCoordinates = checkRealCoordinates();
  });

  // Shape templates
  type DrawShape = 'free' | 'square' | 'rectangle' | 'circle';
  let boundaryShape = $state<DrawShape | null>(null);
  let shapeAnchor = $state<LngLat | null>(null);

  let zoneShape = $state<DrawShape | null>(null);
  let zoneAnchor = $state<LngLat | null>(null);

  // Hover preview state for plant tooltips
  let hoverPlantId = $state<string | null>(null);
  let hoverPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let hoveredPlantRules = $state<Array<{ message: string; tone: 'warn' | 'help' }>>([]);
  let hoverZoneId = $state<string | null>(null);
  let hoverWaterId = $state<string | null>(null);

  // Ghost (would-place) rule preview while hovering in plant mode
  let ghostPos = $state<{ x: number; y: number } | null>(null);
  let ghostRules = $state<Array<{ message: string; tone: 'warn' | 'help' }>>([]);
  let ghostBlocked = $state(false);
  let ghostBlockMessage = $state<string | null>(null);
  let ghostScore = $state<number | null>(null);

  function normalizedForSpecies(speciesId: string): NormalizedPlant | null {
    const pool = allNormalizedPlants();
    const byId = pool.find((p) => p.id === speciesId);
    if (byId) return byId;
    const sci = speciesById(speciesId)?.scientific_name?.toLowerCase();
    return sci ? pool.find((p) => p.sci.toLowerCase() === sci) ?? null : null;
  }

  function computeGhostScore(at: LngLat): number | null {
    if (!selectedSpeciesId) return null;
    const candidate = normalizedForSpecies(selectedSpeciesId);
    if (!candidate) return null;
    const site = applyMicrozone(getEngineSite(), microzoneAt(at, zoneRows));
    const canvas = buildCanvasState(plantedRows, speciesList, { lat: at.lat, lng: at.lng });
    const score = scorePlant(candidate, site, canvas, buildRuleIndex());
    return score.eligible ? Math.round(score.total) : null;
  }

  let speciesList = $state<SpeciesRow[]>([]);
  let zoneRows = $state<ZoneRow[]>([]);
  let plantedRows = $state<PlantedRow[]>([]);
  
  let editingId = $state<string | null>(null);
  let editingType = $state<'zone' | 'water' | 'boundary' | 'plant' | null>(null);
  let editingPoints = $state<LngLat[]>([]);
  let draggingVertexIndex = $state<number | null>(null);
  let draggingWholeShape = $state(false);
  let dragStart = $state<LngLat | null>(null);
  let editMarker: maplibregl.Marker | null = null; // For draggable plant/water point editing

  let stats = $derived({
    zones: zoneRows.length,
    plants: plantedRows.length,
    hasBoundary: !!getLand(landId)?.boundary_closed
  });

  const waterTypeNames = $derived<Record<string, string>>({
    pond: t('map_water_pond'), river: t('map_water_river'), channel: t('map_water_channel'),
    well: t('map_water_well'), spring: t('map_water_spring'), swale: t('map_water_swale'), other: t('map_water_other'),
  });
  const shapeOptions = $derived([
    { v: 'free', l: t('map_shape_free') }, { v: 'square', l: t('map_shape_square') },
    { v: 'rectangle', l: t('map_shape_rectangle') }, { v: 'circle', l: t('map_shape_circle') },
  ]);

  const spatial = new GeoSpatialIndex();
  const plantMarkers = new Map<string, maplibregl.Marker>();

  function renderGlyphSvg(name: GlyphName): string {
    const def = GLYPHS[name] ?? GLYPHS.Seed;
    const parts: string[] = [];
    for (const d of def.paths) parts.push(`<path d="${d}"/>`);
    for (const c of def.circles ?? []) parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"${c.fill ? ' fill="currentColor"' : ' fill="none"'}/>`);
    for (const e of def.ellipses ?? []) parts.push(`<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"${e.transform ? ` transform="${e.transform}"` : ''}/>`);
    for (const r of def.rects ?? []) parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.rx ?? 0}"/>`);
    return `<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts.join('')}</svg>`;
  }

  function makePlantMarkerEl(speciesId: string, glyphName: GlyphName): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'plant-marker';
    el.style.color = plantTone(speciesId);
    el.innerHTML = renderGlyphSvg(glyphName);
    return el;
  }

  function syncPlantMarkers(): void {
    if (!map) return;
    const seen = new Set<string>();
    for (const p of plantedRows) {
      seen.add(p.id);
      let m = plantMarkers.get(p.id);
      if (!m) {
        const sp = speciesById(p.species_id);
        const glyphName = (sp?.glyph as GlyphName | null) || plantGlyph(p.species_id);
        const el = makePlantMarkerEl(p.species_id, glyphName);
        
        // Handle interactions
        el.onpointerdown = (e) => e.stopPropagation(); // prevent map drag interference
        el.onclick = (e) => {
          e.stopPropagation();
          if (tool === 'erase') askDeletePlant(p.id);
          else if (tool === 'edit') startEditing('plant', p.id);
          else if (tool === 'pan') showRelationshipPanel(p.id);
        };
        el.onmouseenter = (e) => {
          hoverPlantId = p.id;
          const rect = el.getBoundingClientRect();
          hoverPos = { x: rect.left + rect.width / 2, y: rect.top };
          computeHoveredRules(p.id);
        };
        el.onmouseleave = () => {
          hoverPlantId = null;
        };

        m = new maplibregl.Marker({
          element: el,
          anchor: 'center'
        }).setLngLat([p.lng, p.lat]).addTo(map);
        plantMarkers.set(p.id, m);
      } else {
        m.setLngLat([p.lng, p.lat]);
      }
    }
    for (const [id, m] of plantMarkers) {
      if (!seen.has(id)) {
        m.remove();
        plantMarkers.delete(id);
      }
    }
  }

  species.subscribe((rows) => {
    speciesList = rows;
    if (!selectedSpeciesId && rows.length) selectedSpeciesId = rows[0].id;
  });
  zones.subscribe((rows) => {
    zoneRows = rows;
    refreshLayers();
  });
  planted.subscribe((rows) => {
    plantedRows = rows;
    rebuildSpatial();
    refreshLayers();
    syncPlantMarkers();
  });
  waterFeatures.subscribe((rows) => {
    waterFeatureRows = rows;
    refreshLayers();
  });

  // Zone metadata helpers (parses optional "Zona N · Name" prefix from name + intent stored in notes)
  function parseZoneMeta(z: ZoneRow): { zoneNumber: number | null; intent: string | null } {
    const m = /^Zona\s+(\d+)\s*[·\-:]\s*(.+)$/i.exec(z.name);
    const zoneNumber = m ? parseInt(m[1], 10) : null;
    let intent: string | null = null;
    if (z.notes) {
      const ni = /^([^.]+)\./.exec(z.notes);
      intent = ni ? ni[1].trim() : z.notes.slice(0, 80);
    }
    return { zoneNumber, intent };
  }
  function zoneTone(zn: number | null): string {
    // codex zone palette — Z1 deep ocre to Z5 jade
    if (zn === 1) return '#D6A87A';
    if (zn === 2) return '#C7894C';
    if (zn === 3) return '#9CA47B';
    if (zn === 4) return '#7C9F88';
    if (zn === 5) return '#5B8F76';
    return '#C7B58A';
  }
  function zoneLineTone(zn: number | null): string {
    if (zn === 1) return '#A85D2A';
    if (zn === 2) return '#8C5421';
    if (zn === 3) return '#5C6E3A';
    if (zn === 4) return '#3F6F4F';
    if (zn === 5) return '#2D5A48';
    return '#6B5340';
  }

  function rebuildSpatial(): void {
    const items: SpatialItem[] = [];
    for (const p of plantedRows) {
      const sp = speciesById(p.species_id);
      const radius = (sp?.spacing_m ?? 1) / 2;
      items.push({
        id: p.id,
        kind: 'plant',
        speciesId: p.species_id,
        lng: p.lng,
        lat: p.lat,
        radiusM: radius
      });
    }
    spatial.rebuild(items);
  }

  // ---------- Map styles (codex-toned) ----------
  const PAPER_STYLE: any = {
    version: 8,
    sources: {
      paper: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap'
      }
    },
    layers: [
      {
        id: 'paper-bg',
        type: 'background',
        paint: { 'background-color': '#F1ECDD' }
      },
      {
        id: 'paper-osm',
        type: 'raster',
        source: 'paper',
        paint: {
          'raster-saturation': -0.55,
          'raster-contrast': -0.05,
          'raster-brightness-min': 0.18,
          'raster-brightness-max': 0.95,
          'raster-opacity': 0.7
        }
      }
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  };

  const STREETS_STYLE: any = {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  };

  const SATELLITE_STYLE: any = {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles © Esri'
      }
    },
    layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  };

  const BLANK_STYLE: any = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'blank-bg',
        type: 'background',
        paint: { 'background-color': '#FAF8F2' }
      }
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  };

  function styleFor(b: typeof basemap): any {
    if (b === 'blank') return BLANK_STYLE;
    if (b === 'satellite') return SATELLITE_STYLE;
    if (b === 'streets') return STREETS_STYLE;
    return PAPER_STYLE;
  }

  // ---------- Editing Feature ----------
  function refreshEditSource(): void {
    if (!map) return;
    // When editing a plant or water point, hide the generic vertex circle
    const isPointEdit = editMarker !== null;
    const pts: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: isPointEdit ? [] : editingPoints.map((p, i) => ({
        type: 'Feature',
        properties: { index: i },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
      }))
    };
    (map.getSource('edit-vertices') as any).setData(pts);

    let shapeGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (editingPoints.length >= 2) {
      if (editingType === 'boundary' || editingType === 'zone' || (editingType === 'water' && $waterFeatures.find(w => w.id === editingId)?.type === 'pond')) {
        if (editingPoints.length >= 3) {
          shapeGeo.features.push({
            type: 'Feature',
            properties: {},
            geometry: polygonToGeoJson(editingPoints)
          });
        }
      } else if (editingType === 'water' && $waterFeatures.find(w => w.id === editingId)?.type !== 'well') {
        shapeGeo.features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: editingPoints.map(p => [p.lng, p.lat]) }
        });
      }
    }
    (map.getSource('edit-shape') as any).setData(shapeGeo);
  }

  function startEditing(type: 'zone' | 'water' | 'boundary' | 'plant', id: string): void {
    editingId = id;
    editingType = type;
    let geoJson: string | null = null;
    if (type === 'boundary') geoJson = getLand(landId)?.boundary_geojson || null;
    else if (type === 'zone') geoJson = zoneRows.find(z => z.id === id)?.polygon_geojson || null;
    else if (type === 'water') geoJson = $waterFeatures.find(w => w.id === id)?.geometry_geojson || null;
    else if (type === 'plant') {
      const p = plantedRows.find(p => p.id === id);
      if (p) geoJson = JSON.stringify({ type: 'Point', coordinates: [p.lng, p.lat] });
    }

    if (!geoJson) return;
    try {
      const geo = JSON.parse(geoJson);
      const coords = geo.type === 'Polygon' ? geo.coordinates[0] : geo.type === 'LineString' ? geo.coordinates : [geo.coordinates];
      // For polygon, last point is same as first, remove it for editing handles
      if (geo.type === 'Polygon') coords.pop();
      editingPoints = coords.map((c: any) => ({ lng: c[0], lat: c[1] }));

      // For point features (plant, well, spring), use a draggable marker with the element's icon
      if (type === 'plant' || (type === 'water' && ($waterFeatures.find(w => w.id === id)?.type === 'well' || $waterFeatures.find(w => w.id === id)?.type === 'spring'))) {
        removeEditMarker();
        let el: HTMLDivElement;
        if (type === 'plant') {
          const p = plantedRows.find(p => p.id === id);
          const sp = p ? speciesById(p.species_id) : null;
          const glyphName = (sp?.glyph as GlyphName | null) || (p ? plantGlyph(p.species_id) : 'Seed');
          el = document.createElement('div');
          el.className = 'plant-marker editing-marker';
          el.style.color = p ? plantTone(p.species_id) : 'var(--jade)';
          el.style.cursor = 'grab';
          el.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))';
          el.innerHTML = renderGlyphSvg(glyphName);
        } else {
          // Water point — use a water droplet icon
          el = document.createElement('div');
          el.className = 'plant-marker editing-marker';
          el.style.color = 'var(--agua)';
          el.style.cursor = 'grab';
          el.style.filter = 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))';
          el.innerHTML = renderGlyphSvg('Drop' as GlyphName);
        }
        editMarker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: true })
          .setLngLat([editingPoints[0].lng, editingPoints[0].lat])
          .addTo(map!);
        editMarker.on('drag', () => {
          const ll = editMarker!.getLngLat();
          editingPoints = [{ lng: ll.lng, lat: ll.lat }];
        });
        // Hide the original plant marker while editing
        const existingMarker = plantMarkers.get(id);
        if (existingMarker) existingMarker.getElement().style.display = 'none';
      }

      refreshEditSource();
      refreshLayers(); // Hides the original feature while editing
    } catch (e) {
      console.warn('Edit parse failed', e);
    }
  }

  async function saveEditing(): Promise<void> {
    if (!editingId || !editingType) return;
    const pts = [...editingPoints];
    let geo: GeoJSON.Polygon | GeoJSON.LineString | GeoJSON.Point;
    if (editingType === 'boundary' || editingType === 'zone' || (editingType === 'water' && $waterFeatures.find(w => w.id === editingId)?.type === 'pond')) {
      geo = polygonToGeoJson(pts);
    } else if (editingType === 'water' && $waterFeatures.find(w => w.id === editingId)?.type === 'well' || editingType === 'plant') {
      geo = { type: 'Point', coordinates: [pts[0].lng, pts[0].lat] };
    } else {
      geo = { type: 'LineString', coordinates: pts.map(p => [p.lng, p.lat]) };
    }

    if (editingType === 'boundary') {
      exec(`UPDATE land SET boundary_geojson = ? WHERE id = ?`, [JSON.stringify(geo), landId]);
      showToast({ message: t('map_boundary_updated'), tone: 'ok' });
    } else if (editingType === 'zone') {
      exec(`UPDATE zone SET polygon_geojson = ? WHERE id = ?`, [JSON.stringify(geo), editingId]);
      showToast({ message: t('map_zone_updated'), tone: 'ok' });
    } else if (editingType === 'water') {
      exec(`UPDATE water_feature SET geometry_geojson = ? WHERE id = ?`, [JSON.stringify(geo), editingId]);
      showToast({ message: t('map_water_updated'), tone: 'ok' });
    } else if (editingType === 'plant') {
      exec(`UPDATE planted SET lng = ?, lat = ? WHERE id = ?`, [pts[0].lng, pts[0].lat, editingId]);
      showToast({ message: t('map_plant_moved'), tone: 'ok' });
    }

    reloadFromDb(landId);
    // Fully release modify mode after save
    editingId = null;
    editingType = null;
    editingPoints = [];
    draggingVertexIndex = null;
    if (map) map.dragPan.enable();
    removeEditMarker();
    refreshEditSource();
    refreshLayers();
  }

  function removeEditMarker(): void {
    if (editMarker) {
      editMarker.remove();
      editMarker = null;
    }
    // Restore hidden plant markers
    for (const [, m] of plantMarkers) {
      m.getElement().style.display = '';
    }
  }

  async function renameEditing(): Promise<void> {
    if (!editingId || !editingType || editingType === 'boundary' || editingType === 'plant') return;
    const currentName = editingType === 'zone' ? zoneRows.find(z => z.id === editingId)?.name : $waterFeatures.find(w => w.id === editingId)?.name;
    const name = await dialogPrompt({ title: t('map_rename_title'), body: t('map_rename_body'), defaultValue: currentName || '' });
    if (name === null) return;
    if (editingType === 'zone') {
      exec(`UPDATE zone SET name = ? WHERE id = ?`, [name.trim(), editingId]);
    } else if (editingType === 'water') {
      exec(`UPDATE water_feature SET name = ? WHERE id = ?`, [name.trim(), editingId]);
    }
    reloadFromDb(landId);
    showToast({ message: t('map_name_updated'), tone: 'ok' });
  }

  // ---------- Lifecycle ----------
  onMount(() => {
    if (!mapEl) return;
    const land = getLand(landId);
    let center: [number, number] = [0, 0];

    // Priority: center_lat/center_lng > boundary centroid > default
    if (land?.center_lat && land?.center_lng) {
      center = [land.center_lng, land.center_lat];
    } else if (land?.boundary_geojson) {
      try {
        const geo = JSON.parse(land.boundary_geojson) as GeoJSON.Polygon;
        const ring = geo.coordinates?.[0];
        if (ring?.length) {
          const lng = ring.reduce((a, c) => a + c[0], 0) / ring.length;
          const lat = ring.reduce((a, c) => a + c[1], 0) / ring.length;
          center = [lng, lat];
        }
      } catch (err) {
        console.warn('boundary parse failed', err);
      }
    }

    // Auto-select basemap based on real coordinates
    const isBlankCanvas = Math.abs(center[0]) < 0.01 && Math.abs(center[1]) < 0.01;
    if (isBlankCanvas) basemap = 'blank';
    hasRealCoordinates = !isBlankCanvas;

    map = new maplibregl.Map({
      container: mapEl,
      style: styleFor(basemap),
      center,
      zoom: 17,
      maxZoom: 22,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 85,
      touchPitch: true
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      mapReady = true;
      addEditorLayers();
      refreshLayers();
      syncPlantMarkers();
      if (land?.boundary_geojson) fitToBoundary();
    });

    map.on('click', onMapClick);
    map.on('mousedown', onMapMouseDown);
    map.on('mouseup', onMapMouseUp);
    map.on('mousemove', onMapMouseMove);
    // Mirror to touch events so vertex drag and pencil work on mobile
    map.on('touchstart', (e: any) => { if (e?.points?.length === 1) onMapMouseDown(e); });
    map.on('touchend', (e: any) => onMapMouseUp(e));
    map.on('touchmove', (e: any) => {
      if (draggingVertexIndex !== null || draggingWholeShape || isPencilDown) {
        e.originalEvent?.preventDefault?.();
        onMapMouseMove(e);
      }
    });
    map.on('touchcancel', (e: any) => onMapMouseUp(e));
    map.on('mouseout', () => {
      ghostPos = null;
      ghostRules = [];
      ghostBlocked = false;
      ghostBlockMessage = null;
      ghostScore = null;
    });
  });

  onDestroy(() => {
    for (const m of plantMarkers.values()) m.remove();
    plantMarkers.clear();
    map?.remove();
    map = null;
  });

  function addEditorLayers(): void {
    if (!map) return;
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    map.addSource('boundary', { type: 'geojson', data: empty });
    map.addSource('boundary-draft', { type: 'geojson', data: empty });
    map.addSource('boundary-draft-points', { type: 'geojson', data: empty });
    map.addSource('boundary-draft-close', { type: 'geojson', data: empty });
    map.addSource('zones', { type: 'geojson', data: empty });
    map.addSource('zone-draft', { type: 'geojson', data: empty });
    map.addSource('zone-draft-points', { type: 'geojson', data: empty });
    map.addSource('zone-draft-close', { type: 'geojson', data: empty });
    map.addSource('plants', { type: 'geojson', data: empty });
    map.addSource('plant-radii', { type: 'geojson', data: empty });
    map.addSource('water', { type: 'geojson', data: empty });
    map.addSource('water-draft', { type: 'geojson', data: empty });
    map.addSource('water-draft-points', { type: 'geojson', data: empty });

    map.addSource('edit-vertices', { type: 'geojson', data: empty });

    map.addLayer({
      id: 'boundary-fill',
      type: 'fill',
      source: 'boundary',
      paint: { 'fill-color': '#B5723F', 'fill-opacity': 0.07 }
    });
    // ZONES (under boundary line)
    map.addLayer({
      id: 'zones-fill',
      type: 'fill',
      source: 'zones',
      paint: {
        'fill-color': ['coalesce', ['get', 'tone'], '#C7B58A'],
        'fill-opacity': 0.34
      }
    });
    map.addLayer({
      id: 'zones-extrude',
      type: 'fill-extrusion',
      source: 'zones',
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': ['coalesce', ['get', 'tone'], '#C7B58A'],
        'fill-extrusion-height': ['coalesce', ['get', 'elevation_m'], 0],
        'fill-extrusion-opacity': 0.55
      }
    });
    map.addLayer({
      id: 'zones-line',
      type: 'line',
      source: 'zones',
      paint: {
        'line-color': ['coalesce', ['get', 'line_tone'], '#6B5340'],
        'line-width': 1.6
      }
    });
    
    // BOUNDARY LINE ON TOP OF ZONES
    map.addLayer({
      id: 'boundary-line',
      type: 'line',
      source: 'boundary',
      paint: { 'line-color': '#A85D2A', 'line-width': 2.4 }
    });
    map.addLayer({
      id: 'boundary-draft-line',
      type: 'line',
      source: 'boundary-draft',
      paint: { 'line-color': '#A85D2A', 'line-width': 2, 'line-dasharray': [2, 2] }
    });
    map.addLayer({
      id: 'boundary-draft-close',
      type: 'line',
      source: 'boundary-draft-close',
      paint: { 'line-color': '#A85D2A', 'line-width': 1.6, 'line-dasharray': [1, 2], 'line-opacity': 0.6 }
    });
    map.addLayer({
      id: 'boundary-draft-points',
      type: 'circle',
      source: 'boundary-draft-points',
      paint: {
        'circle-radius': 6,
        'circle-color': '#F1ECDD',
        'circle-stroke-color': '#A85D2A',
        'circle-stroke-width': 2
      }
    });


    map.addSource('edit-shape', { type: 'geojson', data: empty });

    map.addLayer({
      id: 'edit-shape-fill',
      type: 'fill',
      source: 'edit-shape',
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#3B82F6', 'fill-opacity': 0.15 }
    });
    map.addLayer({
      id: 'edit-shape-line',
      type: 'line',
      source: 'edit-shape',
      paint: { 'line-color': '#3B82F6', 'line-width': 2.5, 'line-dasharray': [4, 3] }
    });

    map.addLayer({
      id: 'edit-vertices',
      type: 'circle',
      source: 'edit-vertices',
      paint: {
        'circle-radius': 7,
        'circle-color': '#F59E0B',
        'circle-stroke-color': '#3B2F1E',
        'circle-stroke-width': 2
      }
    });

    map.addLayer({
      id: 'zone-draft-line',
      type: 'line',
      source: 'zone-draft',
      paint: { 'line-color': '#A85D2A', 'line-width': 1.4, 'line-dasharray': [2, 2] }
    });
    map.addLayer({
      id: 'zone-draft-close',
      type: 'line',
      source: 'zone-draft-close',
      paint: { 'line-color': '#A85D2A', 'line-width': 1.2, 'line-dasharray': [1, 2], 'line-opacity': 0.55 }
    });
    map.addLayer({
      id: 'zone-draft-points',
      type: 'circle',
      source: 'zone-draft-points',
      paint: {
        'circle-radius': 5,
        'circle-color': '#F1ECDD',
        'circle-stroke-color': '#A85D2A',
        'circle-stroke-width': 1.6
      }
    });

    map.addLayer({
      id: 'plant-radii-circle',
      type: 'circle',
      source: 'plant-radii',
      paint: {
        'circle-radius': ['get', 'radius_px'],
        'circle-color': '#A85D2A',
        'circle-opacity': 0.06,
        'circle-stroke-color': '#A85D2A',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.3
      }
    });
    map.addLayer({
      id: 'plant-symbol',
      type: 'circle',
      source: 'plants',
      paint: {
        'circle-radius': 14,
        'circle-color': ['get', 'tone'],
        'circle-opacity': 0.0,
        'circle-stroke-color': '#3B2F1E',
        'circle-stroke-width': 0
      }
    });

    // --- Water feature layers ---
    map.addLayer({
      id: 'water-fill',
      type: 'fill',
      source: 'water',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': ['match', ['get', 'wtype'],
          'pond', '#4DA8DA',
          'swale', '#6BBF8A',
          '#4DA8DA'],
        'fill-opacity': 0.3
      }
    });
    map.addLayer({
      id: 'water-line',
      type: 'line',
      source: 'water',
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': ['match', ['get', 'wtype'],
          'river', '#2980B9',
          'channel', '#7B6840',
          'swale', '#4A8C62',
          '#2980B9'],
        'line-width': ['match', ['get', 'wtype'],
          'river', 4,
          'channel', 2.5,
          'swale', 2,
          3],
        'line-dasharray': ['match', ['get', 'wtype'],
          'channel', ['literal', [6, 3]],
          'swale', ['literal', [3, 2]],
          ['literal', [1]]]
      }
    });
    map.addLayer({
      id: 'water-line-outline',
      type: 'line',
      source: 'water',
      filter: ['==', '$type', 'Polygon'],
      paint: { 'line-color': '#2980B9', 'line-width': 1.5 }
    });
    map.addLayer({
      id: 'water-point',
      type: 'circle',
      source: 'water',
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': ['match', ['get', 'wtype'],
          'well', 7,
          'spring', 9,
          8],
        'circle-color': ['match', ['get', 'wtype'],
          'well', '#5C5040',
          'spring', '#4DA8DA',
          '#4DA8DA'],
        'circle-opacity': 0.7,
        'circle-stroke-color': ['match', ['get', 'wtype'],
          'well', '#3B2F1E',
          'spring', '#2980B9',
          '#2980B9'],
        'circle-stroke-width': 2
      }
    });
    // Water draft layers
    map.addLayer({
      id: 'water-draft-line',
      type: 'line',
      source: 'water-draft',
      paint: { 'line-color': '#2980B9', 'line-width': 2, 'line-dasharray': [3, 2] }
    });
    map.addLayer({
      id: 'water-draft-points-circle',
      type: 'circle',
      source: 'water-draft-points',
      paint: {
        'circle-radius': 5,
        'circle-color': '#2980B9',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1
      }
    });

    // Hover effects
    map.on('mousemove', 'plant-symbol', (e) => {
      if (!map) return;
      if (tool === 'plant' || tool === 'boundary' || tool === 'zone') return;
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (!id) return;
      map.getCanvas().style.cursor = tool === 'erase' ? 'crosshair' : 'pointer';
      hoverPos = { x: e.point.x, y: e.point.y };
      if (hoverPlantId !== id) {
        hoverPlantId = id;
        computeHoveredRules(id);
      }
    });
    map.on('mouseleave', 'plant-symbol', () => {
      if (!map) return;
      map.getCanvas().style.cursor = '';
      hoverPlantId = null;
      hoveredPlantRules = [];
    });

    map.on('mousemove', 'zones-fill', (e) => {
      if (!map) return;
      if (tool === 'plant' || tool === 'boundary' || tool === 'zone') return;
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (!id) return;
      hoverZoneId = id;
      hoverPos = { x: e.point.x, y: e.point.y };
      if (tool !== 'erase') map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'zones-fill', () => {
      hoverZoneId = null;
      if (map && !hoverPlantId) map.getCanvas().style.cursor = '';
    });

    // Water hover
    const waterLayers = ['water-fill', 'water-line', 'water-point', 'water-line-outline'];
    for (const wl of waterLayers) {
      map.on('mousemove', wl, (e) => {
        if (!map) return;
        if (tool === 'water' || tool === 'edit') return;
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (!id) return;
        hoverWaterId = id;
        hoverPos = { x: e.point.x, y: e.point.y };
        if (tool !== 'erase') map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', wl, () => {
        hoverWaterId = null;
        if (map && !hoverPlantId && !hoverZoneId) map.getCanvas().style.cursor = '';
      });
    }
  }

  function computeHoveredRules(plantId: string): void {
    const row = plantedRows.find((p) => p.id === plantId);
    if (!row) { hoveredPlantRules = []; return; }
    const sp = speciesById(row.species_id);
    const radius = (sp?.spacing_m ?? 1) / 2;
    const hits = findRulesAt({
      index: spatial,
      point: { lat: row.lat, lng: row.lng },
      candidateSpeciesId: row.species_id,
      candidateKind: 'plant',
      searchRadiusM: 30
    }).filter((h) => h.withEntityId !== plantId && h.distanceM > radius * 0.9);
    hoveredPlantRules = hits.slice(0, 3).map((h) => ({
      message: localRuleMessage(h.rule),
      tone: (h.rule.relationship === 'incompatible' || h.rule.relationship === 'harmful') ? 'warn' : 'help'
    }));
  }

  // ---------- Layer refresh ----------
  function refreshLayers(): void {
    if (!map || !mapReady) return;

    const land = getLand(landId);
    if (land?.boundary_geojson && land.boundary_closed) {
      const geo = JSON.parse(land.boundary_geojson) as GeoJSON.Polygon;
      (map.getSource('boundary') as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: geo,
        properties: {}
      });
    } else {
      (map.getSource('boundary') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    (map.getSource('zones') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: zoneRows.map((z) => {
        const meta = parseZoneMeta(z);
        return {
          type: 'Feature',
          geometry: JSON.parse(z.polygon_geojson) as GeoJSON.Polygon,
          properties: {
            id: z.id,
            name: z.name,
            zone_number: meta.zoneNumber ?? 0,
            tone: zoneTone(meta.zoneNumber),
            line_tone: zoneLineTone(meta.zoneNumber),
            intent: meta.intent ?? '',
            elevation_m: z.elevation_m ?? 0
          }
        };
      })
    });

    const plantFeatures: GeoJSON.Feature[] = [];
    const radiusFeatures: GeoJSON.Feature[] = [];
    for (const p of plantedRows) {
      const sp = speciesById(p.species_id);
      plantFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          species_id: p.species_id,
          tone: toneCss(p.species_id)
        }
      });
      radiusFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, radius_px: (sp?.spacing_m ?? 1) / 2 }
      });
    }
    (map.getSource('plants') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: plantFeatures
    });
    (map.getSource('plant-radii') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: radiusFeatures
    });

    // Water features
    const waterFC: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: waterFeatureRows.map((w) => ({
        type: 'Feature' as const,
        geometry: JSON.parse(w.geometry_geojson),
        properties: { id: w.id, name: w.name, wtype: w.type }
      }))
    };
    try {
      (map.getSource('water') as maplibregl.GeoJSONSource).setData(waterFC);
    } catch { /* source may not exist yet */ }
  }

  function toneCss(speciesId: string): string {
    const tone = plantTone(speciesId);
    if (tone === 'var(--jade-deep)') return '#346B5C';
    if (tone === 'var(--jade)') return '#5B8F76';
    if (tone === 'var(--ocre)') return '#B5723F';
    if (tone === 'var(--ocre-deep)') return '#8C5421';
    if (tone === 'var(--cinabrio)') return '#C04848';
    if (tone === 'var(--maiz)') return '#D7B450';
    return '#6B5340';
  }

  function refreshDraftSources(): void {
    if (!map || !mapReady) return;
    const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    function lineFeature(points: LngLat[]): GeoJSON.Feature {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) }, properties: {} };
    }
    function pointsFC(points: LngLat[]): GeoJSON.FeatureCollection {
      return {
        type: 'FeatureCollection',
        features: points.map((p, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { index: i }
        }))
      };
    }
    function closeFeature(points: LngLat[]): GeoJSON.Feature | GeoJSON.FeatureCollection {
      if (points.length < 3) return emptyFC;
      const a = points[points.length - 1];
      const b = points[0];
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
        properties: {}
      };
    }

    (map.getSource('boundary-draft') as maplibregl.GeoJSONSource).setData(
      drawingBoundary.length ? lineFeature(drawingBoundary) : emptyFC
    );
    (map.getSource('boundary-draft-points') as maplibregl.GeoJSONSource).setData(pointsFC(drawingBoundary));
    (map.getSource('boundary-draft-close') as maplibregl.GeoJSONSource).setData(closeFeature(drawingBoundary));

    (map.getSource('zone-draft') as maplibregl.GeoJSONSource).setData(
      drawingZone.length ? lineFeature(drawingZone) : emptyFC
    );
    (map.getSource('zone-draft-points') as maplibregl.GeoJSONSource).setData(pointsFC(drawingZone));
    (map.getSource('zone-draft-close') as maplibregl.GeoJSONSource).setData(closeFeature(drawingZone));

    // Water draft
    try {
      (map.getSource('water-draft') as maplibregl.GeoJSONSource).setData(
        drawingWater.length ? lineFeature(drawingWater) : emptyFC
      );
      (map.getSource('water-draft-points') as maplibregl.GeoJSONSource).setData(pointsFC(drawingWater));
    } catch { /* sources may not exist yet */ }
  }

  // ---------- Mode + basemap ----------
  let switchingMode = false;
  export function setModeExternal(m: '2d' | '3d'): void {
    setMode(m);
  }
  export function getBasemap(): typeof basemap { return basemap; }
  export function getHasRealCoordinates(): boolean { return hasRealCoordinates; }
  export function setBasemapExternal(b: typeof basemap): void { setBasemap(b); }
  export function fitToBoundaryExternal(): void { fitToBoundary(); }
  export function locateMeExternal(): void { locateMe(); }
  export function selectSpecies(id: string): void {
    selectedSpeciesId = id;
    tool = 'plant';
    if (map) map.getCanvas().style.cursor = 'copy';
  }
  /**
   * Non-visual placement entry point (used by the keyboard/screen-reader
   * CanvasInventory panel). Places a given species at explicit coordinates,
   * reusing the full placement path — collision check, companion-rule
   * messages, undo command and auto-log — so it behaves exactly like a map tap.
   */
  export function placeSpeciesAt(speciesId: string, lat: number, lng: number): { warns: string[]; helps: string[]; collision: boolean } | null {
    selectedSpeciesId = speciesId;
    return placePlant({ lat, lng });
  }
  /** Current map-centre coordinates, or null if the map isn't ready. */
  export function getCenterLngLat(): { lat: number; lng: number } | null {
    if (!map) return null;
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }
  function setMode(m: '2d' | '3d'): void {
    if (m === mode || switchingMode) return;
    switchingMode = true;
    transitioning = true;
    // Fade out
    setTimeout(() => {
      mode = m;
      if (m === '3d') enableTerrain();
      else disableTerrain();
      // Fade in after mode change
      setTimeout(() => {
        transitioning = false;
        switchingMode = false;
      }, 500);
    }, 300);
  }

  function setBasemap(b: typeof basemap): void {
    // If switching from blank to a real basemap and we don't have real coordinates,
    // show location picker first
    if (!hasRealCoordinates && b !== 'blank' && basemap === 'blank') {
      pendingBasemapSwitch = b;
      locationPickerVisible = true;
      return;
    }
    applyBasemap(b);
  }

  function applyBasemap(b: typeof basemap): void {
    basemap = b;
    if (!map) return;
    map.setStyle(styleFor(b));
    let applied = false;
    const apply = () => {
      if (applied || !map) return;
      applied = true;
      addEditorLayers();
      if (mode === '3d') enableTerrain();
      refreshLayers();
      syncPlantMarkers();
    };
    map.once('style.load', apply);
    // Safety fallback — some basemaps fire styledata but not style.load
    setTimeout(apply, 1200);
  }

  function onLocationSelected(coords: { lat: number; lng: number }): void {
    locationPickerVisible = false;
    if (!map) return;
    
    // Shift elements relative to the old center
    const land = getLand(landId);
    const oldLat = land?.center_lat || 0;
    const oldLng = land?.center_lng || 0;
    const dx = coords.lng - oldLng;
    const dy = coords.lat - oldLat;

    if (dx !== 0 || dy !== 0) {
      exec(`UPDATE planted SET lng = lng + ?, lat = lat + ? WHERE land_id = ?`, [dx, dy, landId]);
      
      const shiftGeoJson = (jsonStr: string | null) => {
        if (!jsonStr) return null;
        try {
          const geo = JSON.parse(jsonStr);
          const shiftCoords = (c: any[]) => {
            if (typeof c[0] === 'number') { c[0] += dx; c[1] += dy; }
            else c.forEach(shiftCoords);
          };
          if (geo.type === 'FeatureCollection') geo.features.forEach((f: any) => shiftCoords(f.geometry.coordinates));
          else if (geo.coordinates) shiftCoords(geo.coordinates);
          return JSON.stringify(geo);
        } catch { return jsonStr; }
      };

      const zones = selectAll(`SELECT id, polygon_geojson FROM zone WHERE land_id = ?`, [landId]);
      for (const z of zones) exec(`UPDATE zone SET polygon_geojson = ? WHERE id = ?`, [shiftGeoJson(z.polygon_geojson as string | null), z.id]);
      
      const waters = selectAll(`SELECT id, geometry_geojson FROM water_feature WHERE land_id = ?`, [landId]);
      for (const w of waters) exec(`UPDATE water_feature SET geometry_geojson = ? WHERE id = ?`, [shiftGeoJson(w.geometry_geojson as string | null), w.id]);
      
      if (land?.boundary_geojson) exec(`UPDATE land SET boundary_geojson = ? WHERE id = ?`, [shiftGeoJson(land.boundary_geojson), landId]);
      
      reloadFromDb(landId);
    }

    // Update the land coordinates in the database
    exec(`UPDATE land SET center_lat = ?, center_lng = ? WHERE id = ?`, [coords.lat, coords.lng, landId]);
    hasRealCoordinates = true;
    
    // Fly to the selected location
    map.flyTo({ center: [coords.lng, coords.lat], zoom: 17, duration: 1000 });
    // Then apply the pending basemap switch
    if (pendingBasemapSwitch) {
      setTimeout(() => {
        applyBasemap(pendingBasemapSwitch!);
        pendingBasemapSwitch = null;
      }, 500);
    }
  }

  function onLocationCancelled(): void {
    locationPickerVisible = false;
    pendingBasemapSwitch = null;
  }

  export function showLocationPickerExternal(): void {
    locationPickerVisible = true;
  }

  function whenStyleReady(fn: () => void): void {
    if (!map) return;
    if (mapReady && map.isStyleLoaded()) {
      fn();
    } else {
      map.once('load', fn);
    }
  }

  function enableTerrain(): void {
    if (!map) return;
    whenStyleReady(() => {
      if (!map) return;
      if (!map.getSource('dem')) {
        map.addSource('dem', {
          type: 'raster-dem',
          tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
          maxzoom: 15
        } as any);
      }
      map.setTerrain({ source: 'dem', exaggeration: 1.5 });
      if (map.getLayer('zones-extrude')) map.setLayoutProperty('zones-extrude', 'visibility', 'visible');
      if (map.getLayer('zones-fill')) map.setLayoutProperty('zones-fill', 'visibility', 'none');
      // Animate to 3D view with pitch and slight bearing for depth perception
      map.easeTo({ pitch: 55, bearing: map.getBearing(), duration: 800 });
      // Force re-render to avoid "stuck" loading — MapLibre sometimes needs a kick
      map.triggerRepaint();
      setTimeout(() => {
        if (map) {
          map.resize();
          map.triggerRepaint();
        }
      }, 200);
    });
  }

  function disableTerrain(): void {
    if (!map) return;
    whenStyleReady(() => {
      if (!map) return;
      try { map.setTerrain(null); } catch { /* terrain might not be set */ }
      if (map.getLayer('zones-extrude')) map.setLayoutProperty('zones-extrude', 'visibility', 'none');
      if (map.getLayer('zones-fill')) map.setLayoutProperty('zones-fill', 'visibility', 'visible');
      // Reset pitch and bearing when going back to 2D
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    });
  }

  // ---------- Tool handling ----------
  let isPencilDown = false;
  let pencilDragged = false;
  let lastPencilPoint: LngLat | null = null;

  function setTool(t: ToolId): void {
    // Cancel in-progress drawing (don't auto-finish)
    drawingBoundary = [];
    drawingZone = [];
    drawingWater = [];
    shapeAnchor = null;
    zoneAnchor = null;
    isPencilDown = false;
    pencilDragged = false;
    lastPencilPoint = null;
    if (t === 'plant') speciesPickerVisible = true;

    // Clear edit mode
    if (editingId) {
      editingId = null;
      editingType = null;
      editingPoints = [];
      draggingVertexIndex = null;
      if (map) {
        map.dragPan.enable();
        try { refreshEditSource(); } catch {}
      }
      refreshLayers(); // Must redraw original features that were hidden
    }

    // Reset sub-options to null — user must pick before drawing starts
    if (t === 'boundary') boundaryShape = null as any;
    if (t === 'zone') zoneShape = null as any;
    if (t === 'water') waterType = null as any;

    refreshDraftSources();
    tool = t;

    // Update cursor based on active tool
    if (map) {
      const canvas = map.getCanvas();
      if (t === 'pan') canvas.style.cursor = '';
      else if (t === 'plant') canvas.style.cursor = 'copy';
      else if (t === 'erase') canvas.style.cursor = 'crosshair';
      else if (t === 'edit') canvas.style.cursor = 'pointer';
      else if (t === 'boundary' || t === 'zone' || t === 'water') canvas.style.cursor = 'crosshair';
    }
  }

  function onMapMouseDown(e: MapMouseEvent): void {
    if (!map) return;
    if (tool === 'edit' && editingId) {
      // Check vertex first
      const feats = map.queryRenderedFeatures(e.point, { layers: ['edit-vertices'] });
      if (feats.length > 0 && feats[0].properties?.index !== undefined) {
        draggingVertexIndex = Number(feats[0].properties.index);
        map.dragPan.disable();
        return;
      }
      // Check if clicking inside the edit shape for whole-shape drag (zones, boundary, water polygons)
      if (editingType !== 'plant' && editingPoints.length >= 3) {
        const shapeLayers = ['edit-shape-fill', 'edit-shape-line'];
        const shapeFeats = map.queryRenderedFeatures(e.point, { layers: shapeLayers.filter(l => map!.getLayer(l)) });
        if (shapeFeats.length > 0) {
          draggingWholeShape = true;
          dragStart = { lng: e.lngLat.lng, lat: e.lngLat.lat };
          map.dragPan.disable();
          return;
        }
      }
    }
    if (tool === 'boundary' || tool === 'zone' || tool === 'water') {
      // Don't start drawing if no sub-option selected
      if (tool === 'boundary' && !boundaryShape) return;
      if (tool === 'zone' && !zoneShape) return;
      if (tool === 'water' && !waterType) return;
      if (tool === 'water' && (waterType === 'well' || waterType === 'spring')) return;
      
      // Shape tools (square/rectangle/circle) use click-click mode, not pencil drag
      const isFreeMode = (tool === 'boundary' && boundaryShape === 'free') ||
                         (tool === 'zone' && zoneShape === 'free') ||
                         (tool === 'water');
      if (!isFreeMode) return; // Let onMapClick handle shape tools
      
      const ll = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      isPencilDown = true;
      pencilDragged = false;
      lastPencilPoint = ll;
      
      map.dragPan.disable();
    }
  }

  function onMapMouseUp(e: MapMouseEvent): void {
    if (!map) return;
    if (draggingVertexIndex !== null && draggingVertexIndex !== undefined) {
      draggingVertexIndex = null;
      map.dragPan.enable();
      return;
    }
    if (draggingWholeShape) {
      draggingWholeShape = false;
      dragStart = null;
      map.dragPan.enable();
      return;
    }
    if (isPencilDown) {
      isPencilDown = false;
      lastPencilPoint = null;
      map.dragPan.enable();
      refreshDraftSources();

      const wasDragged = pencilDragged;
      setTimeout(() => { pencilDragged = false; }, 50);

      if (wasDragged) {
        if (tool === 'boundary' && shapeAnchor && boundaryShape && boundaryShape !== 'free') {
           if (drawingBoundary.length >= 3) commitBoundary(drawingBoundary);
        } else if (tool === 'zone' && zoneAnchor && zoneShape && zoneShape !== 'free') {
           if (drawingZone.length >= 3) finishZoneWithPts(drawingZone);
        }
      }
    }
  }

  function onMapMouseMove(e: MapMouseEvent): void {
    // Handle vertex dragging in edit mode
    if (draggingVertexIndex !== null && draggingVertexIndex !== undefined && editingPoints.length > draggingVertexIndex) {
      editingPoints[draggingVertexIndex] = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      editingPoints = [...editingPoints]; // trigger reactivity
      refreshEditSource();
      return;
    }
    // Handle whole-shape dragging in edit mode
    if (draggingWholeShape && dragStart && editingPoints.length > 0) {
      const dLng = e.lngLat.lng - dragStart.lng;
      const dLat = e.lngLat.lat - dragStart.lat;
      editingPoints = editingPoints.map(p => ({ lng: p.lng + dLng, lat: p.lat + dLat }));
      dragStart = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      refreshEditSource();
      return;
    }

    const ll: LngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat };

    if (isPencilDown) {
      // ONLY draw freely if shape is 'free'
      const isFree = (tool === 'boundary' && boundaryShape === 'free') || 
                     (tool === 'zone' && zoneShape === 'free') || 
                     (tool === 'water' && waterType); // water is currently always free
      
      if (isFree && lastPencilPoint && haversineMeters(lastPencilPoint, ll) > 1.5) {
        pencilDragged = true;
        lastPencilPoint = ll;
        if (tool === 'boundary') drawingBoundary = [...drawingBoundary, ll];
        else if (tool === 'zone') drawingZone = [...drawingZone, ll];
        else if (tool === 'water') drawingWater = [...drawingWater, ll];
        refreshDraftSources();
      }
      return;
    }

    // Live shape preview
    if (tool === 'boundary' && shapeAnchor && boundaryShape && boundaryShape !== 'free') {
      if (boundaryShape === 'rectangle') drawingBoundary = rectanglePoints(shapeAnchor, ll);
      else if (boundaryShape === 'square') drawingBoundary = squarePoints(shapeAnchor, ll);
      else if (boundaryShape === 'circle') drawingBoundary = circlePoints(shapeAnchor, ll);
      refreshDraftSources();
      return;
    }
    if (tool === 'zone' && zoneAnchor && zoneShape && zoneShape !== 'free') {
      if (zoneShape === 'rectangle') drawingZone = rectanglePoints(zoneAnchor, ll);
      else if (zoneShape === 'square') drawingZone = squarePoints(zoneAnchor, ll);
      else if (zoneShape === 'circle') drawingZone = circlePoints(zoneAnchor, ll);
      refreshDraftSources();
      return;
    }

    if (tool !== 'plant' || !selectedSpeciesId) {
      if (ghostPos) {
        ghostPos = null;
        ghostRules = [];
        ghostBlocked = false;
        ghostBlockMessage = null;
        ghostScore = null;
      }
      return;
    }
    const sp = speciesById(selectedSpeciesId);
    if (!sp) return;
    const radius = sp.spacing_m / 2;
    const collision = spatial.collidesAt(ll, radius);
    if (collision) {
      ghostBlocked = true;
      ghostBlockMessage = t('map_too_close', { dist: formatMeters(Math.min(radius * 2, collision.radiusM * 2)) });
      ghostRules = [];
      ghostScore = null;
    } else {
      ghostBlocked = false;
      ghostBlockMessage = null;
      const hits = findRulesAt({
        index: spatial,
        point: ll,
        candidateSpeciesId: selectedSpeciesId,
        candidateKind: 'plant',
        searchRadiusM: 30
      });
      ghostRules = hits.slice(0, 3).map((h) => ({
        message: localRuleMessage(h.rule),
        tone: (h.rule.relationship === 'incompatible' || h.rule.relationship === 'harmful') ? 'warn' : 'help'
      }));
      ghostScore = computeGhostScore(ll);
    }
    ghostPos = { x: e.point.x, y: e.point.y };
  }

  function rectanglePoints(a: LngLat, b: LngLat): LngLat[] {
    const minLat = Math.min(a.lat, b.lat);
    const maxLat = Math.max(a.lat, b.lat);
    const minLng = Math.min(a.lng, b.lng);
    const maxLng = Math.max(a.lng, b.lng);
    return [
      { lng: minLng, lat: minLat },
      { lng: maxLng, lat: minLat },
      { lng: maxLng, lat: maxLat },
      { lng: minLng, lat: maxLat }
    ];
  }

  function squarePoints(center: LngLat, edge: LngLat): LngLat[] {
    const dx = haversineMeters({ lng: edge.lng, lat: center.lat }, center);
    const dy = haversineMeters({ lng: center.lng, lat: edge.lat }, center);
    const half = Math.max(dx, dy);
    const dLat = metersToDegLat(half);
    const dLng = metersToDegLng(half, center.lat);
    return [
      { lng: center.lng - dLng, lat: center.lat - dLat },
      { lng: center.lng + dLng, lat: center.lat - dLat },
      { lng: center.lng + dLng, lat: center.lat + dLat },
      { lng: center.lng - dLng, lat: center.lat + dLat }
    ];
  }

  function circlePoints(center: LngLat, edge: LngLat, segments = 48): LngLat[] {
    const radius = haversineMeters(center, edge);
    if (radius <= 0) return [];
    const dLat = metersToDegLat(radius);
    const dLng = metersToDegLng(radius, center.lat);
    const out: LngLat[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * 2 * Math.PI;
      out.push({ lng: center.lng + Math.cos(a) * dLng, lat: center.lat + Math.sin(a) * dLat });
    }
    return out;
  }

  async function commitBoundary(points: LngLat[]): Promise<void> {
    if (points.length < 3) return;
    const polygon = polygonToGeoJson(points);
    updateLandBoundary(landId, polygon, true);
    drawingBoundary = [];
    shapeAnchor = null;
    refreshDraftSources();
    refreshLayers();
    showToast({ message: t('map_boundary_saved'), tone: 'ok' });
    tool = 'pan';
  }

  function onMapClick(e: MapMouseEvent): void {
    if (!map) return;
    
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['plant-symbol', 'water-fill', 'water-line', 'water-point', 'zones-fill']
    });

    if (features.length > 0) {
      const plant = features.find(f => f.layer.id === 'plant-symbol');
      const water = features.find(f => f.layer.id.startsWith('water-'));
      const zone = features.find(f => f.layer.id === 'zones-fill');

      if (tool === 'erase') {
        if (plant) askDeletePlant(plant.properties.id);
        else if (water) askDeleteWater(water.properties.id);
        else if (zone) askDeleteZone(zone.properties.id);
        return;
      } else if (tool === 'pan') {
        if (plant) {
          showRelationshipPanel(plant.properties.id);
          return;
        }
      }
    }

    if (pencilDragged) return;
    const ll: LngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat };

    if (tool === 'edit') {
      const feats = map.queryRenderedFeatures(e.point, { layers: ['plant-symbol', 'boundary-line', 'boundary-fill', 'zones-fill', 'water-fill', 'water-line', 'water-point'] });
      if (feats.length > 0) {
        const f = feats[0];
        if (f.layer.id === 'boundary-fill' || f.layer.id === 'boundary-line') startEditing('boundary', 'land-default');
        else if (f.layer.id === 'zones-fill') startEditing('zone', f.properties.id);
        else if (f.layer.id.startsWith('water-')) startEditing('water', f.properties.id);
        else if (f.layer.id === 'plant-symbol') startEditing('plant', f.properties.id);
      }
      return;
    }

    if (tool === 'boundary') {
      if (!boundaryShape) return; // Must pick shape first
      if (boundaryShape === 'free') {
        drawingBoundary = [...drawingBoundary, ll];
        refreshDraftSources();
        return;
      }
      if (!shapeAnchor) {
        shapeAnchor = ll;
        drawingBoundary = [ll];
        refreshDraftSources();
      } else {
        let pts: LngLat[] = [];
        if (boundaryShape === 'rectangle') pts = rectanglePoints(shapeAnchor, ll);
        else if (boundaryShape === 'square') pts = squarePoints(shapeAnchor, ll);
        else if (boundaryShape === 'circle') pts = circlePoints(shapeAnchor, ll);
        if (pts.length >= 3) commitBoundary(pts);
      }
    } else if (tool === 'zone') {
      if (!zoneShape) return; // Must pick shape first
      if (zoneShape === 'free') {
        drawingZone = [...drawingZone, ll];
        refreshDraftSources();
        return;
      }
      if (!zoneAnchor) {
        zoneAnchor = ll;
        drawingZone = [ll];
        refreshDraftSources();
      } else {
        let pts: LngLat[] = [];
        if (zoneShape === 'rectangle') pts = rectanglePoints(zoneAnchor, ll);
        else if (zoneShape === 'square') pts = squarePoints(zoneAnchor, ll);
        else if (zoneShape === 'circle') pts = circlePoints(zoneAnchor, ll);
        if (pts.length >= 3) finishZoneWithPts(pts);
      }
    } else if (tool === 'water') {
      if (!waterType) return; // Must pick water type first
      drawingWater = [...drawingWater, ll];
      refreshDraftSources();
      if (waterType === 'well' || waterType === 'spring') finishWater();
    } else if (tool === 'plant') {
      placePlant(ll);
    }
  }

  function setBoundaryShape(s: DrawShape): void {
    boundaryShape = s;
    shapeAnchor = null;
    drawingBoundary = [];
    refreshDraftSources();
  }

  function placePlantAtCenter(): void {
    if (!map) return;
    const c = map.getCenter();
    placePlant({ lng: c.lng, lat: c.lat });
  }

  function placePlant(ll: LngLat): { warns: string[]; helps: string[]; collision: boolean } | null {
    if (!selectedSpeciesId) {
      showToast({ message: t('map_pick_species'), tone: 'warn' });
      return null;
    }
    const sp = speciesById(selectedSpeciesId);
    if (!sp) return null;
    const radius = sp.spacing_m / 2;

    const collision = spatial.collidesAt(ll, radius);
    if (collision) {
      // Non-blocking: show tooltip warning but allow planting.
      pushRuleMessage({
        tone: 'warn',
        title: t('map_tight_space', { name: sp.common_name }),
        speciesName: sp.common_name,
        lines: [t('map_min_distance', { dist: formatMeters(Math.min(radius * 2, collision.radiusM * 2)) })]
      });
    }

    const hits: RuleHit[] = findRulesAt({
      index: spatial,
      point: ll,
      candidateSpeciesId: selectedSpeciesId,
      candidateKind: 'plant',
      searchRadiusM: 30
    });

    const newPlantId = insertPlanted({ landId, speciesId: selectedSpeciesId, lat: ll.lat, lng: ll.lng });
    const newPlantRow = getPlantedById(newPlantId);
    if (newPlantRow) {
      pushCommand({
        label: t('hist_plant_added'),
        undo: () => deletePlanted(newPlantId, landId),
        redo: () => restorePlanted(newPlantRow)
      });
    }
    addRecentPlant(selectedSpeciesId);

    const warns: string[] = [];
    const helps: string[] = [];
    for (const h of hits) {
      const rel = h.rule.relationship;
      if (rel === 'incompatible' || rel === 'harmful') warns.push(h.rule.message);
      else if (rel === 'companion' || rel === 'beneficial') helps.push(h.rule.message);
    }

    if (warns.length) {
      pushRuleMessage({ tone: 'warn', title: t('map_rule_warn_title', { name: sp.common_name }), speciesName: `${sp.common_name}-warn`, lines: warns });
    }
    if (helps.length) {
      pushRuleMessage({ tone: 'help', title: t('map_rule_help_title', { name: sp.common_name }), speciesName: `${sp.common_name}-help`, lines: helps });
    }

    // Returned so non-visual callers (CanvasInventory) can announce the same
    // companion-rule feedback the map shows visually in the RuleMessageStack.
    return { warns, helps, collision: !!collision };
  }

  async function finishBoundary(): Promise<void> {
    if (drawingBoundary.length < 3) return;
    const polygon = polygonToGeoJson(drawingBoundary);
    updateLandBoundary(landId, polygon, true);
    drawingBoundary = [];
    refreshDraftSources();
    refreshLayers();
    showToast({ message: t('map_boundary_saved'), tone: 'ok' });
    tool = 'pan';
  }

  async function finishZoneWithPts(pts: LngLat[]): Promise<void> {
    if (pts.length < 3) return;
    const defaultName = `Zona ${stats.zones + 1}`;
    const name = await dialogPrompt({
      title: t('map_zone_name_title'),
      body: t('map_zone_name_body'),
      defaultValue: defaultName,
      confirmLabel: t('common_save')
    });
    if (name === null) {
      drawingZone = [];
      zoneAnchor = null;
      refreshDraftSources();
      return;
    }
    const polygon = polygonToGeoJson(pts);
    const newZoneId = insertZone({ landId, name: name.trim() || defaultName, polygon });
    const newZoneRow = getZoneById(newZoneId);
    if (newZoneRow) {
      pushCommand({
        label: t('hist_zone_added'),
        undo: () => deleteZone(newZoneId, landId),
        redo: () => restoreZone(newZoneRow)
      });
    }
    drawingZone = [];
    zoneAnchor = null;
    refreshDraftSources();
    showToast({ message: t('map_zone_saved', { name: name.trim() || defaultName }), tone: 'ok' });
    tool = 'pan';
  }

  async function finishZone(): Promise<void> {
    return finishZoneWithPts(drawingZone);
  }

  function setZoneShape(s: DrawShape): void {
    zoneShape = s;
    zoneAnchor = null;
    drawingZone = [];
    refreshDraftSources();
  }

  async function finishWater(): Promise<void> {
    if (drawingWater.length < 1) return;
    if ((waterType === 'pond' || waterType === 'river' || waterType === 'channel' || waterType === 'swale') && drawingWater.length < 2) return;
    
    const typeName = waterTypeNames[waterType] ?? waterType;
    const defaultName = `${typeName} ${waterFeatureRows.length + 1}`;
    const name = await dialogPrompt({
      title: t('map_water_name_title', { type: typeName.toLowerCase() }),
      body: t('map_water_name_body'),
      defaultValue: defaultName,
      confirmLabel: t('common_save')
    });
    
    if (name === null) { drawingWater = []; refreshDraftSources(); return; }

    let geometry: GeoJSON.Polygon | GeoJSON.LineString | GeoJSON.Point;
    if (waterType === 'pond') geometry = polygonToGeoJson(drawingWater);
    else if (waterType === 'well' || waterType === 'spring') geometry = { type: 'Point', coordinates: [drawingWater[0].lng, drawingWater[0].lat] };
    else geometry = { type: 'LineString', coordinates: drawingWater.map((p) => [p.lng, p.lat]) };

    insertWaterFeature({ landId, name: name.trim() || defaultName, type: waterType, geometry });
    drawingWater = [];
    refreshDraftSources();
    showToast({ message: t('map_water_saved', { name: name.trim() || defaultName }), tone: 'ok' });
    tool = 'pan';
  }

  async function clearBoundary(): Promise<void> {
    const ok = await dialogConfirm({
      title: t('map_clear_boundary_title'),
      body: t('map_clear_boundary_body'),
      confirmLabel: t('map_clear_boundary_btn'),
      danger: true
    });
    if (!ok) return;
    updateLandBoundary(landId, null, false);
    refreshLayers();
    showToast({ message: t('map_boundary_deleted'), tone: 'ok' });
  }

  async function askDeletePlant(id: string): Promise<void> {
    const row = plantedRows.find((p) => p.id === id);
    if (!row) return;
    const sp = speciesById(row.species_id);
    const ok = await dialogConfirm({
      title: t('map_delete_plant_title', { name: sp?.common_name ?? t('map_default_plant') }),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    const deleted = deletePlanted(id, landId);
    if (deleted) {
      offerUndo({
        description: t('map_undo_plant_deleted', { name: sp?.common_name ?? t('map_default_plant_article') }),
        perform: () => { restorePlanted(deleted); showToast({ message: t('map_plant_restored'), tone: 'ok' }); }
      });
      pushCommand({
        label: t('hist_plant_removed'),
        undo: () => restorePlanted(deleted),
        redo: () => deletePlanted(deleted.id, landId)
      });
    }
  }

  async function askDeleteZone(id: string): Promise<void> {
    const row = zoneRows.find((z) => z.id === id);
    if (!row) return;
    const ok = await dialogConfirm({
      title: t('map_delete_zone_title', { name: row.name }),
      confirmLabel: t('map_delete_zone_btn'),
      danger: true
    });
    if (!ok) return;
    const deleted = deleteZone(id, landId);
    if (deleted) {
      offerUndo({
        description: t('map_undo_zone_deleted', { name: row.name }),
        perform: () => { restoreZone(deleted); showToast({ message: t('map_zone_restored'), tone: 'ok' }); }
      });
      pushCommand({
        label: t('hist_zone_removed'),
        undo: () => restoreZone(deleted),
        redo: () => deleteZone(deleted.id, landId)
      });
    }
  }

  async function askDeleteWater(id: string): Promise<void> {
    const row = waterFeatureRows.find((w) => w.id === id);
    if (!row) return;
    const ok = await dialogConfirm({
      title: t('map_delete_generic_title', { name: row.name }),
      confirmLabel: t('map_delete_water_btn'),
      danger: true
    });
    if (!ok) return;
    const deleted = deleteWaterFeature(id, landId);
    if (deleted) {
      offerUndo({
        description: t('map_undo_deleted', { name: row.name }),
        perform: () => { restoreWaterFeature(deleted); showToast({ message: t('map_water_restored'), tone: 'ok' }); }
      });
    }
  }

  function showRelationshipPanel(plantedId: string): void {
    const row = plantedRows.find((p) => p.id === plantedId);
    if (!row) return;
    const hits = findRulesAt({
      index: spatial,
      point: { lat: row.lat, lng: row.lng },
      candidateSpeciesId: row.species_id,
      candidateKind: 'plant',
      searchRadiusM: 30
    });
    relPanelHits = hits;
    relPanelPlantId = plantedId;
  }

  function fitToBoundary(): void {
    const land = getLand(landId);
    if (!map || !land?.boundary_geojson) {
      showToast({ message: t('map_no_boundary'), tone: 'info' });
      return;
    }
    const geo = JSON.parse(land.boundary_geojson) as GeoJSON.Polygon;
    const ring = geo.coordinates?.[0];
    if (!ring?.length) return;
    const lngs = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
      ],
      { padding: 60, duration: 600 }
    );
  }

  async function locateMe(): Promise<void> {
    if (!navigator.geolocation || !map) return;
    showToast({ message: t('map_locating'), tone: 'info' });
    navigator.geolocation.getCurrentPosition(
      (pos) => { map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 18, duration: 800 }); },
      async (err) => { await dialogAlert({ title: t('map_location_err_title'), body: t('map_location_err_body') }); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
</script>

<div class="lienzo" class:transitioning>
  <div bind:this={mapEl} class="lienzo-map" data-tour="canvas" aria-hidden="true"></div>

  <MeasurementOverlay {map} visible={showMeasurements} />


  <FloatingTools {tool} setTool={setTool} />

  <!-- Tooltips: Only show one at a time (plant > water > zone priority) -->
  {#if hoverPlantId && !editingId}
    {@const pRow = plantedRows.find((p) => p.id === hoverPlantId)}
    {@const sp = pRow ? speciesById(pRow.species_id) : null}
    {#if sp && pRow}
      <div class="plant-tip codex-card-soft" style="left: {Math.min(hoverPos.x + 16, (typeof window !== 'undefined' ? window.innerWidth - 300 : 800))}px; top: {Math.max(hoverPos.y - 16, 8)}px; --tone: {toneCss(sp.id)};">
        <div class="tip-head">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderGlyphSvg only emits the internal glyph-data.ts path constants, never user input -->
          <span class="tip-glyph">{@html renderGlyphSvg((sp.glyph as GlyphName | null) || plantGlyph(sp.id))}</span>
          <div class="tip-text">
            <span class="tip-name">{localSpeciesName(sp.common_name, sp.scientific_name)}</span>
            <span class="tip-latin">{sp.scientific_name}</span>
          </div>
        </div>
        <div class="tip-meta">
          <span class="badge">{sp.plant_type}</span>
          <span class="badge">{t('map_diam_label')} {sp.spacing_m}m</span>
        </div>
        {#if hoveredPlantRules.length > 0}
          <div class="tip-rules">
            {#each hoveredPlantRules as r}
              <div class="tip-rule {r.tone}">
                <div class="tip-rule-label">{r.tone === 'warn' ? t('map_rule_caution') : t('map_rule_companion_label')}</div>
                <div class="tip-rule-msg">{r.message}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {:else if hoverWaterId && !editingId}
    {@const wRow = waterFeatureRows.find(w => w.id === hoverWaterId)}
    {#if wRow}
      {@const wtypeLabels = waterTypeNames}
      <div class="zone-tip codex-card-soft" style="left: {Math.min(hoverPos.x + 12, (typeof window !== 'undefined' ? window.innerWidth - 300 : 800))}px; top: {Math.max(hoverPos.y - 12, 8)}px; --tone: #2980B9;">
        <div class="zt-head">
          <span class="zt-tag" style="background: #2980B9;">{wtypeLabels[wRow.type] ?? wRow.type}</span>
          <span class="zt-name">{wRow.name}</span>
        </div>
        {#if wRow.notes}
          <div class="zt-notes">{wRow.notes}</div>
        {/if}
      </div>
    {/if}
  {:else if hoverZoneId && !editingId}
    {@const zRow = zoneRows.find(z => z.id === hoverZoneId)}
    {#if zRow}
      {@const meta = parseZoneMeta(zRow)}
      <div class="zone-tip codex-card-soft" style="left: {Math.min(hoverPos.x + 12, (typeof window !== 'undefined' ? window.innerWidth - 300 : 800))}px; top: {Math.max(hoverPos.y - 12, 8)}px; --tone: {zoneTone(meta.zoneNumber)};">
        <div class="zt-head">
          {#if meta.zoneNumber}<span class="zt-tag">Z{meta.zoneNumber}</span>{/if}
          <span class="zt-name">{zRow.name}</span>
        </div>
        {#if meta.intent}<div class="zt-intent">{meta.intent}</div>{/if}
        {#if zRow.elevation_m}<div class="zt-notes">{t('map_elevation_label')} {zRow.elevation_m.toFixed(1)}m</div>{/if}
      </div>
    {/if}
  {/if}

  <!-- Ghost placement tooltip -->
  {#if ghostPos && selectedSpeciesId}
    {@const sp = speciesById(selectedSpeciesId)}
    {#if sp}
      <div class="ghost-tip codex-card-soft" style="left: {ghostPos.x + 16}px; top: {ghostPos.y + 16}px; --tone: {ghostBlocked ? 'var(--cinabrio)' : toneCss(sp.id)};">
        <div class="gt-label">
          {ghostBlocked ? t('map_blocked') : t('map_possible_spot')}
          {#if !ghostBlocked && ghostScore !== null}<span class="gt-score">{t('map_suitability_label')} {ghostScore}</span>{/if}
        </div>
        {#if ghostBlocked && ghostBlockMessage}
          <div class="gt-msg">{ghostBlockMessage}</div>
        {:else if ghostRules.length > 0}
          <div class="gt-rule">
            {#each ghostRules as r}
              <div class="tip-rule {r.tone}">
                <div class="gt-rule-label">{r.tone === 'warn' ? t('map_rule_caution') : t('map_rule_companion_label')}</div>
                <div class="gt-msg">{r.message}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if relPanelPlantId}
    <RelationshipPanel
      plantId={relPanelPlantId}
      hits={relPanelHits}
      onClose={() => (relPanelPlantId = null)}
      onPick={(id) => { selectSpecies(id); relPanelPlantId = null; }}
    />
  {/if}

  {#if tool === 'plant' && speciesPickerVisible}
    <SpeciesQuickPicker
      {speciesList}
      selectedId={selectedSpeciesId}
      onPick={(id) => (selectedSpeciesId = id)}
      onOpenCatalog={() => onOpenPlantasCatalog?.()}
      onPlaceAtCenter={placePlantAtCenter}
      onClose={() => (speciesPickerVisible = false)}
    />
  {:else if tool === 'plant' && !speciesPickerVisible}
    <button
      type="button"
      class="picker-reopen btn btn-sm btn-accent"
      onclick={() => (speciesPickerVisible = true)}
      aria-label={t('map_change_species')}
    >
      <Glyph name="Seed" size={14} /> {t('map_change_species')}
    </button>
  {/if}

  {#if tool === 'boundary'}
    <div class="canvas-banner codex-card-soft" role="status" aria-live="polite">
      <div class="cb-head">
        <Glyph name="Map" size={16} />
        <span><b>{t('map_contour_tool')}</b> · {boundaryShape ? (boundaryShape === 'free' ? t('map_tap_add_vertices') : t('map_tap_first_corner')) : t('map_choose_shape')}</span>
      </div>
      <div class="cb-shapes">
        {#each shapeOptions as opt}
          <button type="button" class="cb-shape" class:on={boundaryShape === opt.v} onclick={() => setBoundaryShape(opt.v as DrawShape)}>{opt.l}</button>
        {/each}
      </div>
      {#if boundaryShape}
        <div class="cb-actions">
          <button class="btn btn-primary btn-sm" onclick={finishBoundary} disabled={drawingBoundary.length < 3}>{t('map_close_boundary')}</button>
          <button class="btn btn-sm" onclick={() => { drawingBoundary = []; shapeAnchor = null; refreshDraftSources(); }}>{t('map_clear_btn')}</button>
        </div>
      {:else}
        <div class="cb-hint">{t('map_choose_shape_hint')}</div>
      {/if}
    </div>
  {/if}

  {#if tool === 'zone'}
    <div class="canvas-banner codex-card-soft" role="status" aria-live="polite">
      <div class="cb-head"><Glyph name="Layers" size={16} /> <span><b>{t('map_zone_tool')}</b> · {zoneShape ? (zoneShape === 'free' ? t('map_tap_draw') : t('map_tap_first_corner')) : t('map_choose_shape')}</span></div>
      <div class="cb-shapes">
        {#each shapeOptions as opt}
          <button type="button" class="cb-shape" class:on={zoneShape === opt.v} onclick={() => setZoneShape(opt.v as DrawShape)}>{opt.l}</button>
        {/each}
      </div>
      {#if zoneShape}
        <div class="cb-actions">
          <button class="btn btn-primary btn-sm" onclick={finishZone} disabled={drawingZone.length < 3}>{t('common_save')}</button>
          <button class="btn btn-sm" onclick={() => { drawingZone = []; zoneAnchor = null; refreshDraftSources(); }}>{t('map_clear_btn')}</button>
        </div>
      {:else}
        <div class="cb-hint">{t('map_choose_shape_hint')}</div>
      {/if}
    </div>
  {/if}

  {#if tool === 'water'}
    <div class="canvas-banner codex-card-soft" role="status" aria-live="polite">
      <div class="cb-head"><Glyph name="Drop" size={16} /> <span><b>{t('map_water_tool')}</b> · {waterType ? t('map_draw_on_map') : t('map_choose_water_type')}</span></div>
      <div class="cb-shapes">
        {#each Object.entries(waterTypeNames) as [wv, wl]}
          <button type="button" class="cb-shape" class:on={waterType === wv} onclick={() => { waterType = wv as any; drawingWater = []; refreshDraftSources(); }}>{wl}</button>
        {/each}
      </div>
      {#if waterType}
        <div class="cb-actions">
          <button class="btn btn-primary btn-sm" onclick={finishWater} disabled={drawingWater.length < 1}>{t('common_save')}</button>
          <button class="btn btn-sm" onclick={() => { drawingWater = []; refreshDraftSources(); }}>{t('map_clear_btn')}</button>
        </div>
      {:else}
        <div class="cb-hint">{t('map_choose_water_hint')}</div>
      {/if}
    </div>
  {/if}

  {#if tool === 'edit'}
    <div class="canvas-banner codex-card-soft" role="status" aria-live="polite">
      <div class="cb-head"><Glyph name="Map" size={16} /> <span><b>{t('map_edit_tool')}</b> · {editingId ? t('map_drag_points') : t('map_tap_to_edit')}</span></div>
      {#if editingId}
        <div class="cb-actions">
          <button class="btn btn-primary btn-sm" onclick={saveEditing}>{t('map_save_changes')}</button>
          {#if editingType !== 'boundary' && editingType !== 'plant'}
            <button class="btn btn-sm" onclick={renameEditing}>{t('map_rename_btn')}</button>
          {/if}
          <button class="btn btn-sm" onclick={() => { editingId = null; editingType = null; editingPoints = []; draggingWholeShape = false; dragStart = null; if (map) map.dragPan.enable(); removeEditMarker(); refreshEditSource(); refreshLayers(); }}>{t('common_cancel')}</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if tool === 'erase'}
    <div class="canvas-banner codex-card-soft warn" role="status" aria-live="polite">
      <Glyph name="Trash" size={16} /> <span><b>{t('map_delete_tool')}</b> · {t('map_tap_to_delete')}</span>
    </div>
  {/if}
</div>

<LocationPicker
  visible={locationPickerVisible}
  onSelect={onLocationSelected}
  onCancel={onLocationCancelled}
/>
<style>
  .lienzo { position: absolute; inset: 0; overflow: hidden; background: var(--paper); transition: opacity 0.3s ease-in-out; }
  .lienzo.transitioning { opacity: 0.3; }
  .lienzo-map { position: absolute; inset: 0; }

  /* (Removed dead .map-actions / .basemap-switcher / .map-act / .bm-btn styles —
     basemap + map actions now live in the CodexTopBar.) */

  /* ── Canvas Drawing Banner (above bottom nav bar) ── */
  .canvas-banner {
    position: absolute;
    bottom: 80px;
    left: 80px;
    z-index: var(--z-canvas-tip);
    padding: 12px 14px;
    width: min(480px, calc(100% - 96px));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cb-head { display: flex; align-items: center; gap: 8px; font-size: calc(13px * var(--text-scale)); }
  .cb-shapes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .cb-shape {
    padding: 5px 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: calc(11px * var(--text-scale));
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
  }
  .cb-shape:hover { background: var(--paper-warm); border-color: var(--ink-soft); }
  .cb-shape.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .cb-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .cb-hint { font-size: calc(11px * var(--text-scale)); font-style: italic; opacity: 0.7; font-family: var(--serif); font-weight: var(--display-weight); }

  @media (max-width: 900px) {
    .canvas-banner { left: 14px; width: calc(100% - 100px); }
  }
  @media (max-width: 760px) {
    /* Stack above the tool rail, which itself sits above the nav + safe area */
    .canvas-banner {
      bottom: calc(var(--nav-h) + var(--safe-bottom) + 72px);
      left: calc(8px + var(--safe-left));
      padding: 10px 12px;
      width: calc(100% - 16px - var(--safe-left) - var(--safe-right));
      max-width: none;
    }
    .cb-head { font-size: calc(12px * var(--text-scale)); }
  }
  @media (max-width: 420px) {
    .plant-tip, .zone-tip, .ghost-tip { max-width: 240px; }
  }

  :global(.plant-marker) {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--paper);
    border: 1.5px solid var(--ink);
    box-shadow: 0 1px 4px oklch(0.2 0.04 60 / 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s var(--ease-codex);
  }
  :global(.plant-marker:hover) { transform: scale(1.08); }
  :global(.plant-marker.editing-marker) {
    border-color: #3B82F6;
    border-width: 2.5px;
    animation: editPulse 1.5s ease-in-out infinite;
    z-index: var(--z-popover);
  }
  @keyframes editPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
  }

  .plant-tip {
    position: absolute;
    z-index: var(--z-canvas-tip);
    padding: 12px 14px;
    max-width: 280px;
    pointer-events: none;
    border-left: 3px solid var(--tone, var(--ocre));
    animation: inkBloom 0.18s var(--ease-codex) both;
  }
  .tip-head { display: flex; gap: 10px; align-items: center; }
  .tip-glyph { color: var(--tone, var(--ocre)); display: inline-flex; }
  .tip-text { display: flex; flex-direction: column; gap: 2px; }
  .tip-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.1; color: var(--ink); }
  .tip-latin { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(12px * var(--text-scale)); color: var(--ink-soft); }
  .tip-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
  .tip-rules { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); }
  .tip-rule .tip-rule-label {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--jade-deep);
  }
  .tip-rule.warn .tip-rule-label { color: var(--cinabrio); }
  .tip-rule-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); line-height: 1.4; margin-top: 2px; color: var(--ink); }

  .zone-tip {
    position: absolute;
    z-index: var(--z-canvas-tip);
    padding: 12px 14px;
    max-width: 280px;
    pointer-events: none;
    border-left: 3px solid var(--tone, var(--ocre));
    animation: inkBloom 0.18s var(--ease-codex) both;
  }
  .zt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zt-tag {
    background: var(--tone, var(--ocre));
    color: var(--paper);
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .zt-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.1; color: var(--ink); }
  .zt-intent { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(13px * var(--text-scale)); margin-top: 6px; color: var(--ink-soft); }
  .zt-notes { font-size: calc(12px * var(--text-scale)); margin-top: 6px; color: var(--ink-soft); line-height: 1.4; }

  .ghost-tip {
    position: absolute;
    z-index: var(--z-canvas-tip);
    padding: 10px 12px;
    max-width: 260px;
    pointer-events: none;
    border-left: 3px solid var(--tone, var(--jade-deep));
    animation: inkBloom 0.16s var(--ease-codex) both;
  }
  .gt-label {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--tone, var(--jade-deep));
  }
  .gt-score {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--paper-warm);
    border: 1px solid var(--line);
    color: var(--jade-deep);
    font-weight: 700;
  }
  .gt-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); margin-top: 4px; color: var(--ink); }
  .gt-rule { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--line); }
  .gt-rule .gt-rule-label {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--jade-deep);
  }
  .gt-rule.warn .gt-rule-label { color: var(--cinabrio); }
  .gt-rule-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); line-height: 1.4; margin-top: 2px; color: var(--ink); }

  .picker-reopen {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-canvas-rail);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  @media (max-width: 760px) {
    .picker-reopen { bottom: calc(var(--nav-h) + var(--safe-bottom) + 84px); }
  }
</style>
