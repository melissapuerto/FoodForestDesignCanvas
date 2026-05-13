<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let {
    visible = false,
    onSelect,
    onCancel
  }: {
    visible?: boolean;
    onSelect: (coords: { lat: number; lng: number }) => void;
    onCancel: () => void;
  } = $props();

  let miniMapEl: HTMLDivElement | undefined = $state();
  let miniMap: maplibregl.Map | null = $state(null);
  let marker: maplibregl.Marker | null = $state(null);

  let latInput = $state('');
  let lngInput = $state('');
  let searchQuery = $state('');
  let searching = $state(false);
  let selectedCoords = $state<{ lat: number; lng: number } | null>(null);
  let tab = $state<'map' | 'coords'>('map');
  let mapInited = false;

  // Watch for visibility changes and init map when dialog becomes visible
  $effect(() => {
    if (visible && tab === 'map' && !mapInited) {
      // Wait for DOM to render the map container
      tick().then(() => {
        requestAnimationFrame(() => {
          initMiniMap();
        });
      });
    }
    if (!visible && miniMap) {
      // Cleanup when dialog closes
      marker?.remove();
      marker = null;
      miniMap.remove();
      miniMap = null;
      mapInited = false;
    }
  });

  onDestroy(() => {
    marker?.remove();
    miniMap?.remove();
    miniMap = null;
  });

  function initMiniMap(): void {
    if (!miniMapEl || mapInited) return;
    mapInited = true;
    miniMap = new maplibregl.Map({
      container: miniMapEl,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [-75.57, 6.25], // Default to Medellín
      zoom: 12,
      attributionControl: false
    });

    miniMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Force resize after style loads (fixes blank map in dialogs)
    miniMap.on('load', () => {
      miniMap?.resize();
    });

    marker = new maplibregl.Marker({ color: '#B5723F', draggable: true })
      .setLngLat([-75.57, 6.25])
      .addTo(miniMap);

    marker.on('dragend', () => {
      const ll = marker!.getLngLat();
      selectedCoords = { lat: ll.lat, lng: ll.lng };
      latInput = ll.lat.toFixed(6);
      lngInput = ll.lng.toFixed(6);
    });

    miniMap.on('click', (e) => {
      const ll = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      selectedCoords = ll;
      latInput = ll.lat.toFixed(6);
      lngInput = ll.lng.toFixed(6);
      marker?.setLngLat([ll.lng, ll.lat]);
    });

    selectedCoords = { lat: 6.25, lng: -75.57 };
    latInput = '6.250000';
    lngInput = '-75.570000';
  }

  async function searchLocation(): Promise<void> {
    if (!searchQuery.trim()) return;
    searching = true;
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data = await resp.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        selectedCoords = { lat, lng };
        latInput = lat.toFixed(6);
        lngInput = lng.toFixed(6);
        marker?.setLngLat([lng, lat]);
        miniMap?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
      }
    } catch { /* search failed, ignore */ }
    searching = false;
  }

  function applyCoords(): void {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    selectedCoords = { lat, lng };
    marker?.setLngLat([lng, lat]);
    miniMap?.flyTo({ center: [lng, lat], zoom: 16, duration: 500 });
  }

  function confirmSelection(): void {
    if (selectedCoords) {
      onSelect(selectedCoords);
    }
  }

  function handleSearchKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') searchLocation();
  }

  function handleCoordsKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') applyCoords();
  }

  function tryGPS(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        selectedCoords = { lat, lng };
        latInput = lat.toFixed(6);
        lngInput = lng.toFixed(6);
        marker?.setLngLat([lng, lat]);
        miniMap?.flyTo({ center: [lng, lat], zoom: 17, duration: 800 });
      },
      () => { /* GPS failed */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lp-backdrop" onclick={onCancel}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="lp-dialog codex-card" onclick={(e) => e.stopPropagation()}>
      <div class="lp-header">
        <div class="lp-title">
          <Glyph name="Compass" size={20} />
          <span>Ubicación de tu tierra</span>
        </div>
        <button type="button" class="lp-close" onclick={onCancel} aria-label="Cerrar">✕</button>
      </div>

      <div class="lp-tabs">
        <button class="lp-tab" class:on={tab === 'map'} onclick={() => (tab = 'map')}>
          <Glyph name="Map" size={14} /> En el mapa
        </button>
        <button class="lp-tab" class:on={tab === 'coords'} onclick={() => (tab = 'coords')}>
          <Glyph name="Pin" size={14} /> Coordenadas
        </button>
      </div>

      {#if tab === 'map'}
        <div class="lp-search-row">
          <input
            type="text"
            class="lp-search"
            placeholder="Buscar lugar, ciudad, dirección..."
            bind:value={searchQuery}
            onkeydown={handleSearchKey}
          />
          <button class="btn btn-sm btn-primary" onclick={searchLocation} disabled={searching}>
            {searching ? '…' : 'Buscar'}
          </button>
          <button class="btn btn-sm" onclick={tryGPS} aria-label="Usar GPS">
            <Glyph name="Pin" size={14} /> GPS
          </button>
        </div>
        <div class="lp-map" bind:this={miniMapEl}></div>
        <div class="lp-hint">Toca el mapa o arrastra el marcador para elegir la ubicación exacta.</div>
      {:else}
        <div class="lp-coords-form">
          <div class="lp-field">
            <label for="lp-lat">Latitud</label>
            <input
              id="lp-lat"
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              class="lp-input"
              bind:value={latInput}
              onkeydown={handleCoordsKey}
              placeholder="ej. 6.250000"
            />
          </div>
          <div class="lp-field">
            <label for="lp-lng">Longitud</label>
            <input
              id="lp-lng"
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              class="lp-input"
              bind:value={lngInput}
              onkeydown={handleCoordsKey}
              placeholder="ej. -75.570000"
            />
          </div>
          <button class="btn btn-sm" onclick={applyCoords}>Aplicar</button>
        </div>
        <div class="lp-hint">Ingresa las coordenadas GPS de tu terreno (WGS84).</div>
      {/if}

      {#if selectedCoords}
        <div class="lp-selected">
          <span class="coord">📍 {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}</span>
        </div>
      {/if}

      <div class="lp-actions">
        <button class="btn btn-sm" onclick={onCancel}>Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick={confirmSelection} disabled={!selectedCoords}>
          <Glyph name="Check" size={14} /> Usar esta ubicación
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .lp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: oklch(0.1 0.02 60 / 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .lp-dialog {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    padding: 0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .lp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--line);
  }
  .lp-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--serif);
    font-size: 18px;
    color: var(--ink);
  }
  .lp-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--ink-soft);
    padding: 4px 8px;
    border-radius: 4px;
  }
  .lp-close:hover { background: var(--paper-warm); }

  .lp-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 20px 0;
  }
  .lp-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1.5px solid var(--line-strong);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .lp-tab:hover { background: var(--paper-warm); }
  .lp-tab.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .lp-search-row {
    display: flex;
    gap: 6px;
    padding: 12px 20px;
  }
  .lp-search {
    flex: 1;
    padding: 8px 12px;
    border: 1.5px solid var(--line-strong);
    border-radius: 6px;
    font-family: var(--sans);
    font-size: 13px;
    background: var(--paper);
    color: var(--ink);
  }
  .lp-search:focus { outline: none; border-color: var(--ocre); }

  .lp-map {
    width: calc(100% - 40px);
    height: 300px;
    margin: 0 20px;
    border-radius: 8px;
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .lp-coords-form {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    padding: 16px 20px;
    flex-wrap: wrap;
  }
  .lp-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 140px;
  }
  .lp-field label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .lp-input {
    padding: 8px 10px;
    border: 1.5px solid var(--line-strong);
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 13px;
    background: var(--paper);
    color: var(--ink);
  }
  .lp-input:focus { outline: none; border-color: var(--ocre); }

  .lp-hint {
    padding: 8px 20px;
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    color: var(--ink-soft);
  }

  .lp-selected {
    padding: 8px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lp-selected .coord {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ocre-deep);
    background: var(--paper-warm);
    padding: 4px 10px;
    border-radius: 4px;
  }

  .lp-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--line);
  }

  @media (max-width: 480px) {
    .lp-map { height: 220px; }
    .lp-search-row { flex-wrap: wrap; }
    .lp-coords-form { flex-direction: column; }
  }
</style>
