<script lang="ts">
  import { onMount } from 'svelte';
  import { getLand, reloadFromDb } from '../../lib/stores/appState';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import { showToast } from '../../lib/stores/toast';
  import { migrateCoordinates } from '../../lib/map/migrate';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import LocationPicker from '../Layout/LocationPicker.svelte';

  let {
    onClose
  }: {
    onClose: () => void;
  } = $props();

  let landId = 'land-default';
  let hasRealCoordinates = $state(false);
  let oldLat = $state(0);
  let oldLng = $state(0);

  // New coordinates if moving to real map
  let newLatStr = $state('4.6097');
  let newLngStr = $state('-74.0817');

  onMount(() => {
    const land = getLand(landId);
    if (land?.boundary_geojson) {
      try {
        const geo = JSON.parse(land.boundary_geojson);
        if (geo.coordinates?.[0]?.length) {
          const ring = geo.coordinates[0];
          oldLng = ring.reduce((a: number, c: number[]) => a + c[0], 0) / ring.length;
          oldLat = ring.reduce((a: number, c: number[]) => a + c[1], 0) / ring.length;
          
          if (Math.abs(oldLng) < 0.01 && Math.abs(oldLat) < 0.01) {
            hasRealCoordinates = false;
          } else {
            hasRealCoordinates = true;
          }
        }
      } catch {}
    }
  });

  async function migrateToBlank(): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Migrar a Lienzo en Blanco?',
      body: 'Tus dibujos y plantas se mantendrán, pero perderán su referencia geográfica en el mundo real. Podrás colocar coordenadas nuevamente después.',
      confirmLabel: 'Sí, migrar a lienzo en blanco'
    });
    if (!ok) return;

    // Center of blank canvas is 0, 0
    migrateCoordinates(landId, { lat: oldLat, lng: oldLng }, { lat: 0, lng: 0 });
    reloadFromDb(landId);
    showToast({ message: 'Migrado a lienzo en blanco exitosamente.', tone: 'ok' });
    onClose();
  }

  async function migrateToReal(): Promise<void> {
    const newLat = parseFloat(newLatStr);
    const newLng = parseFloat(newLngStr);
    if (isNaN(newLat) || isNaN(newLng)) {
      showToast({ message: 'Coordenadas inválidas.', tone: 'error' });
      return;
    }
    const ok = await dialogConfirm({
      title: '¿Migrar a Mapa con Coordenadas?',
      body: 'Tus dibujos actuales serán movidos al centro de la nueva ubicación que seleccionaste.',
      confirmLabel: 'Sí, migrar a mapa real'
    });
    if (!ok) return;

    migrateCoordinates(landId, { lat: 0, lng: 0 }, { lat: newLat, lng: newLng });
    reloadFromDb(landId);
    showToast({ message: 'Migrado a mapa con coordenadas exitosamente.', tone: 'ok' });
    onClose();
  }
</script>

<div class="modal-overlay">
  <div class="modal-card card">
    <div class="label" style="display:flex; justify-content:space-between; align-items:center;">
      <span>Migrar tipo de lienzo</span>
      <button class="btn btn-sm btn-ghost" onclick={onClose}><Glyph name="Close" size={14} /></button>
    </div>
    
    <div class="weave" style="margin: 12px 0;" aria-hidden="true"></div>

    <div class="info-block">
      {#if hasRealCoordinates}
        <p>Actualmente tu lienzo está anclado a coordenadas reales: <b>{oldLat.toFixed(4)}, {oldLng.toFixed(4)}</b>.</p>
        <p style="margin-top: 8px;">Si migras a Lienzo en Blanco, podrás dibujar sin depender de un mapa del mundo real. Todos tus dibujos actuales se conservarán.</p>
        
        <button class="btn btn-danger" style="margin-top: 16px; width: 100%; justify-content: center;" onclick={migrateToBlank}>
          Migrar a Lienzo en Blanco
        </button>
      {:else}
        <p>Actualmente tu lienzo está en blanco (sin ancla geográfica).</p>
        <p style="margin-top: 8px;">Para migrar a un mapa real, busca tu finca en el mapa o arrastra el marcador rojo. Todos tus dibujos actuales serán centrados en la nueva ubicación.</p>
        
        <div style="margin-top: 16px; height: 300px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;">
          <LocationPicker
            bind:lat={newLatStr}
            bind:lng={newLngStr}
          />
        </div>
        
        <button class="btn btn-primary" style="margin-top: 16px; width: 100%; justify-content: center;" onclick={migrateToReal}>
          Migrar a Mapa (con estas coordenadas)
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: oklch(0 0 0 / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-card {
    width: 100%;
    max-width: 500px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-lg);
    animation: dialogIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes dialogIn {
    from { opacity: 0; transform: scale(0.96) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .info-block {
    font-family: var(--serif);
    font-size: 15px;
    line-height: 1.5;
    color: var(--ink);
  }
</style>
