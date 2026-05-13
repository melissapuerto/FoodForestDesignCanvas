<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import type { SpeciesRow } from '../../lib/stores/appState';
  import { recentPlants } from '../../lib/stores/recents';
  import { formatMeters } from '../../lib/utils/format';

  let {
    speciesList,
    selectedId,
    onPick,
    onOpenCatalog,
    onPlaceAtCenter,
    onClose
  }: {
    speciesList: SpeciesRow[];
    selectedId: string | null;
    onPick: (id: string) => void;
    onOpenCatalog: () => void;
    onPlaceAtCenter: () => void;
    onClose?: () => void;
  } = $props();

  function isMobile(): boolean {
    return globalThis.matchMedia?.('(max-width: 760px)').matches ?? false;
  }

  function handlePick(id: string): void {
    onPick(id);
    if (isMobile() && onClose) onClose();
  }

  let search = $state('');
  let recents = $state<string[]>([]);
  recentPlants.subscribe((ids) => (recents = ids));

  // Build ordered list: recents first (if they exist), then the rest
  let displayList = $derived.by(() => {
    const q = search.trim().toLowerCase();

    // Filter by search query if provided
    let pool = speciesList;
    if (q) {
      pool = speciesList.filter((sp) =>
        `${sp.common_name} ${sp.scientific_name ?? ''} ${sp.notes ?? ''}`.toLowerCase().includes(q)
      );
    }

    if (!recents.length && !q) return pool.slice(0, 8);

    // Sort recents to the front
    const recentSet = new Set(recents);
    const recentItems: SpeciesRow[] = [];
    const rest: SpeciesRow[] = [];
    for (const sp of pool) {
      if (recentSet.has(sp.id)) recentItems.push(sp);
      else rest.push(sp);
    }
    // Preserve recent order
    recentItems.sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));

    const combined = [...recentItems, ...rest];
    // If searching, show all results; otherwise cap at 12
    return q ? combined : combined.slice(0, 12);
  });
</script>

<div class="quick codex-card" role="radiogroup" aria-label="Especie a sembrar">
  <div class="quick-head">
    <span class="label">Sembrando</span>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button type="button" class="lk" onclick={onOpenCatalog}>catálogo →</button>
      {#if onClose}
        <button type="button" class="btn btn-sm btn-ghost" aria-label="Cerrar" onclick={onClose}>
          <Glyph name="Close" size={14} />
        </button>
      {/if}
    </div>
  </div>
  <div class="quick-search">
    <input
      class="inp quick-inp"
      type="search"
      placeholder="Buscar especie…"
      aria-label="Buscar especie para sembrar"
      bind:value={search}
    />
  </div>
  <div class="quick-list">
    {#each displayList as sp}
      <button
        type="button"
        class="qchip"
        class:on={selectedId === sp.id}
        class:recent={recents.includes(sp.id)}
        role="radio"
        aria-checked={selectedId === sp.id}
        aria-label={`${sp.common_name}, espacio ${sp.spacing_m} metros`}
        title={sp.scientific_name ?? sp.common_name}
        onclick={() => handlePick(sp.id)}
      >
        <span class="qchip-ico" style="color: {plantTone(sp.id)};">
          <Glyph name={plantGlyph(sp.id)} size={20} />
        </span>
        <span class="qchip-name">{sp.common_name}</span>
        <span class="coord">{formatMeters(sp.spacing_m)}</span>
      </button>
    {:else}
      <div class="empty" style="width: 100%; padding: 10px;">Sin coincidencias.</div>
    {/each}
  </div>
  <div class="quick-action">
    <button type="button" class="btn btn-accent" onclick={onPlaceAtCenter} disabled={!selectedId}>
      <Glyph name="Plus" size={14} />
      Sembrar al centro
    </button>
    <span class="sub">o toca el mapa donde quieras</span>
  </div>
</div>

<style>
  .quick {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 11;
    width: min(720px, calc(100% - 32px));
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .quick-head { display: flex; justify-content: space-between; align-items: center; }
  .lk { background: none; border: none; color: var(--ocre-deep); font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  .lk:hover { text-decoration: underline; color: var(--ocre); }

  .quick-search { display: flex; }
  .quick-inp { min-height: 34px; font-size: 13px; padding: 6px 10px; }

  .quick-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    flex-wrap: nowrap;
  }
  .qchip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 76px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1.5px solid var(--line-strong);
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
    flex-shrink: 0;
  }
  .qchip:hover { background: var(--paper-warm); }
  .qchip.on {
    border-color: var(--ocre);
    background: var(--paper-warm);
    box-shadow: 0 0 0 2px oklch(0.62 0.16 55 / 0.2);
  }
  .qchip.recent::after {
    content: '•';
    font-size: 8px;
    color: var(--ocre);
    line-height: 1;
    margin-top: -2px;
  }
  .qchip-ico { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
  @media (max-width: 760px) {
    .quick { bottom: 152px; padding: 8px 10px; gap: 6px; }
    .qchip { min-width: 64px; padding: 6px; }
    .qchip-name { font-size: 10px; }
    .qchip-ico { width: 18px; height: 18px; }
    .quick-inp { font-size: 12px; min-height: 30px; }
  }
  .qchip-name { font-size: 11px; font-weight: 500; }
  .qchip .coord { font-size: 9px; }

  .quick-action { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
</style>
