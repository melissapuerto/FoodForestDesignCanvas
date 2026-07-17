<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import maplibregl, { type Map as MlMap } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { metersToDegLat, metersToDegLng } from '../../lib/map/geometry';
  import { showToast } from '../../lib/stores/toast';
  import { formatMeters } from '../../lib/utils/format';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    lat = $bindable<string>(),
    lng = $bindable<string>(),
    radiusM = 0,
    height = '320px',
    label = t('lp_pick_label'),
    onUserMove
  }: {
    lat: string;
    lng: string;
    radiusM?: number;
    height?: string;
    label?: string;
    /** Fired when the USER moves the point (pin drag, map tap, GPS) — lets the
     *  parent refresh the human-readable address to match the new geopoint. */
    onUserMove?: (c: { lat: number; lng: number }) => void;
  } = $props();

  let mapEl: HTMLDivElement | undefined = $state();
  let map: MlMap | null = null;
  let marker: maplibregl.Marker | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let busy = $state(false);
  // Coordinates last set from inside the map (click/drag/GPS). When the bound
  // lat/lng differ from this, the change came from outside (search result,
  // typed coordinates) and the camera must travel to it — the tester's bug #1
  // was a marker silently placed off-screen while the map stayed put.
  let lastInternal = '';
  let lastFitRadius = -1;

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
        setInternal(c.lat, c.lng);
      });
    }
    marker.setLngLat([ln, la]).addTo(map);
    updateRing();
  }

  /** A user-made move (drag/tap/GPS): update the binding, tell the parent. */
  function setInternal(la: number, ln: number): void {
    const laS = la.toFixed(6);
    const lnS = ln.toFixed(6);
    lastInternal = `${laS},${lnS}`;
    lat = laS;
    lng = lnS;
    updateRing();
    onUserMove?.({ lat: la, lng: ln });
  }

  /** Bounds of the area ring (or a small box around the point when no ring). */
  function pointBounds(la: number, ln: number, m: number): maplibregl.LngLatBoundsLike {
    const r = Math.max(m, 30);
    const dLat = metersToDegLat(r);
    const dLng = metersToDegLng(r, la);
    return [[ln - dLng, la - dLat], [ln + dLng, la + dLat]];
  }

  /** Travel to the point: fit the area ring when there is one, else fly in. */
  function travelTo(la: number, ln: number): void {
    if (!map) return;
    if (radiusM > 0) {
      map.fitBounds(pointBounds(la, ln, radiusM), { padding: 40, duration: 500, maxZoom: 18 });
    } else {
      map.flyTo({ center: [ln, la], zoom: Math.max(map.getZoom(), 15), duration: 600 });
    }
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
    if (!ll) {
      marker?.remove();
      updateRing();
      return;
    }
    placeMarker(ll.lat, ll.lng);
    updateRing();
    const key = `${lat},${lng}`;
    if (key !== lastInternal) {
      // External change (search pick, typed coordinates): bring it on screen.
      lastInternal = key;
      travelTo(ll.lat, ll.lng);
      lastFitRadius = radiusM;
    } else if (radiusM > 0 && radiusM !== lastFitRadius) {
      // Same point, new area (the size step): keep the whole ring in view.
      lastFitRadius = radiusM;
      map.fitBounds(pointBounds(ll.lat, ll.lng, radiusM), { padding: 40, duration: 300, maxZoom: 18 });
    }
  });

  function onPick(e: maplibregl.MapMouseEvent): void {
    setInternal(e.lngLat.lat, e.lngLat.lng);
    placeMarker(e.lngLat.lat, e.lngLat.lng);
  }

  async function useGps(): Promise<void> {
    if (!navigator.geolocation) {
      showToast({ message: t('nb_geo_unavailable'), tone: 'warn' });
      return;
    }
    busy = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        busy = false;
        setInternal(pos.coords.latitude, pos.coords.longitude);
        if (map) {
          map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 600 });
          placeMarker(pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => {
        busy = false;
        const msg = err.code === err.PERMISSION_DENIED
          ? t('geo_denied')
          : err.code === err.POSITION_UNAVAILABLE
            ? t('geo_gps_unavailable')
            : t('geo_failed_generic');
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
    // The mount position already honors the bound point; mark it as seen so the
    // first effect pass doesn't animate. The ring branch still runs and fits
    // the area circle when this picker opens with a radius (wizard size step).
    if (initial) lastInternal = `${lat},${lng}`;
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

    // The map may be measured before its container has its final size (it is
    // mounted inside a dialog that is still animating open), which leaves the
    // tiles drawn into a corner of the frame. Re-measure whenever the frame
    // actually changes size.
    resizeObserver = new ResizeObserver(() => map?.resize());
    resizeObserver.observe(mapEl);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
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
      <button type="button" class="lp-btn" onclick={useGps} disabled={busy} aria-label={t('a11y_lp_use_gps')}>
        <Glyph name="Pin" size={14} /> {busy ? t('a11y_lp_searching') : t('a11y_lp_use_gps_short')}
      </button>
      {#if lat && lng}
        <button type="button" class="lp-btn lp-btn-danger" onclick={clearLocation} aria-label={t('a11y_lp_clear_location')}>
          <Glyph name="Close" size={12} />
        </button>
      {/if}
    </div>
  </div>
  <div class="lp-coord">
    {#if lat && lng}
      <span class="coord">lat {parseFloat(lat).toFixed(4)}° · lng {parseFloat(lng).toFixed(4)}°</span>
      {#if radiusM > 0}
        <span class="coord"> · {t('lp_radius', { r: formatMeters(radiusM, 0) })}</span>
      {/if}
    {:else}
      <span class="coord">{t('lp_no_point')}</span>
    {/if}
  </div>
</div>

<style>
  .lp { display: flex; flex-direction: column; gap: 8px; }
  .lp-label {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
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
    font-size: calc(10px * var(--text-scale));
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
