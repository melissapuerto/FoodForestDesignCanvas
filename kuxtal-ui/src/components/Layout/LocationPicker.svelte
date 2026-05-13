<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map as MlMap } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { metersToDegLat, metersToDegLng } from '../../lib/map/geometry';
  import { showToast } from '../../lib/stores/toast';
  import { formatMeters } from '../../lib/utils/format';

  let {
    lat = $bindable<string>(),
    lng = $bindable<string>(),
    radiusM = 0,
    height = '320px',
    label = 'Toca o arrastra para elegir el centro de tu finca'
  }: {
    lat: string;
    lng: string;
    radiusM?: number;
    height?: string;
    label?: string;
  } = $props();

  let mapEl: HTMLDivElement | undefined = $state();
  let map: MlMap | null = null;
  let marker: maplibregl.Marker | null = null;
  let busy = $state(false);

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
      { id: 'paper-bg', type: 'background', paint: { 'background-color': '#F1ECDD' } },
      {
        id: 'paper-osm',
        type: 'raster',
        source: 'paper',
        paint: {
          'raster-saturation': -0.55,
          'raster-contrast': -0.05,
          'raster-brightness-min': 0.18,
          'raster-brightness-max': 0.95,
          'raster-opacity': 0.75
        }
      }
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  };

  function parseLngLat(): { lat: number; lng: number } | null {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
    return null;
  }

  function makeMarkerEl(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'lp-marker';
    el.innerHTML = `
      <svg viewBox="0 0 32 40" width="28" height="36" aria-hidden="true">
        <path d="M16 1 C 8 1 2 7 2 15 C 2 23 16 39 16 39 C 16 39 30 23 30 15 C 30 7 24 1 16 1 Z"
              fill="#B5723F" stroke="#3B2F1E" stroke-width="1.5"/>
        <circle cx="16" cy="15" r="5" fill="#F1ECDD" stroke="#3B2F1E" stroke-width="1.2"/>
      </svg>`;
    return el;
  }

  function placeMarker(la: number, ln: number): void {
    if (!map) return;
    if (!marker) {
      marker = new maplibregl.Marker({ element: makeMarkerEl(), draggable: true, anchor: 'bottom' });
      marker.on('dragend', () => {
        const c = marker!.getLngLat();
        lat = c.lat.toFixed(6);
        lng = c.lng.toFixed(6);
        updateRing();
      });
    }
    marker.setLngLat([ln, la]).addTo(map);
    updateRing();
  }

  function ringFeature(la: number, ln: number, m: number): GeoJSON.Feature {
    const dLat = metersToDegLat(m);
    const dLng = metersToDegLng(m, la);
    const ring: number[][] = [];
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      ring.push([ln + Math.cos(a) * dLng, la + Math.sin(a) * dLat]);
    }
    ring.push(ring[0]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
  }

  function updateRing(): void {
    if (!map) return;
    const src = map.getSource('lp-ring') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const ll = parseLngLat();
    if (!ll || !radiusM || radiusM <= 0) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    src.setData(ringFeature(ll.lat, ll.lng, radiusM));
  }

  $effect(() => {
    void radiusM;
    void lat;
    void lng;
    if (!map) return;
    const ll = parseLngLat();
    if (ll) placeMarker(ll.lat, ll.lng);
    else marker?.remove();
    updateRing();
  });

  function onPick(e: maplibregl.MapMouseEvent): void {
    lat = e.lngLat.lat.toFixed(6);
    lng = e.lngLat.lng.toFixed(6);
    placeMarker(e.lngLat.lat, e.lngLat.lng);
  }

  async function useGps(): Promise<void> {
    if (!navigator.geolocation) {
      showToast({ message: 'Tu navegador no soporta geolocalización.', tone: 'warn' });
      return;
    }
    busy = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        busy = false;
        lat = pos.coords.latitude.toFixed(6);
        lng = pos.coords.longitude.toFixed(6);
        if (map) {
          map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 600 });
          placeMarker(pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => {
        busy = false;
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Ubicación no disponible. Revisa tu GPS.'
            : 'No pude obtener tu ubicación.';
        showToast({ message: msg, tone: 'warn' });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function clearLocation(): void {
    lat = '';
    lng = '';
    marker?.remove();
    marker = null;
    updateRing();
  }

  onMount(() => {
    if (!mapEl) return;
    const initial = parseLngLat();
    map = new maplibregl.Map({
      container: mapEl,
      style: PAPER_STYLE,
      center: initial ? [initial.lng, initial.lat] : [-75.567, 6.244],
      zoom: initial ? 15 : 4,
      maxZoom: 22,
      attributionControl: { compact: true },
      cooperativeGestures: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
    map.on('load', () => {
      if (!map) return;
      map.addSource('lp-ring', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'lp-ring-fill',
        type: 'fill',
        source: 'lp-ring',
        paint: { 'fill-color': '#B5723F', 'fill-opacity': 0.14 }
      });
      map.addLayer({
        id: 'lp-ring-line',
        type: 'line',
        source: 'lp-ring',
        paint: { 'line-color': '#A85D2A', 'line-width': 1.6, 'line-dasharray': [3, 2] }
      });
      if (initial) placeMarker(initial.lat, initial.lng);
      updateRing();
    });
    map.on('click', onPick);
  });

  onDestroy(() => {
    map?.remove();
    map = null;
    marker = null;
  });
</script>

<div class="lp">
  <div class="lp-label" id="lp-help">{label}</div>
  <div class="lp-frame codex-card-soft" style="height: {height};">
    <div class="lp-map" bind:this={mapEl} aria-describedby="lp-help" role="application"></div>
    <div class="lp-actions">
      <button type="button" class="lp-btn" onclick={useGps} disabled={busy} aria-label="Usar mi ubicación GPS">
        <Glyph name="Pin" size={14} /> {busy ? 'Buscando...' : 'Usar mi GPS'}
      </button>
      {#if lat && lng}
        <button type="button" class="lp-btn lp-btn-danger" onclick={clearLocation} aria-label="Borrar ubicación">
          <Glyph name="Close" size={12} />
        </button>
      {/if}
    </div>
  </div>
  <div class="lp-coord">
    {#if lat && lng}
      <span class="coord">lat {parseFloat(lat).toFixed(4)}° · lng {parseFloat(lng).toFixed(4)}°</span>
      {#if radiusM > 0}
        <span class="coord"> · radio ~{formatMeters(radiusM, 0)}</span>
      {/if}
    {:else}
      <span class="coord">Aún no has marcado un punto.</span>
    {/if}
  </div>
</div>

<style>
  .lp { display: flex; flex-direction: column; gap: 8px; }
  .lp-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .lp-frame {
    position: relative;
    overflow: hidden;
    border-radius: 6px;
  }
  .lp-map { width: 100%; height: 100%; }
  .lp-actions {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 5;
    display: flex;
    gap: 6px;
  }
  .lp-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    color: var(--ink);
    padding: 6px 10px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .lp-btn:hover:enabled { background: var(--paper-warm); }
  .lp-btn:disabled { opacity: 0.55; cursor: default; }
  .lp-btn-danger { background: var(--cinabrio); color: var(--paper); border-color: var(--cinabrio); }
  .lp-coord { color: var(--ink-soft); }
  :global(.lp-marker) { display: block; cursor: grab; }
  :global(.lp-marker:active) { cursor: grabbing; }
</style>
