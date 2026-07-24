<script lang="ts">
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { dbReady, planted, type SpeciesRow } from '../../lib/stores/appState';
  import { recentPlants } from '../../lib/stores/recents';
  import { formatMeters } from '../../lib/utils/format';
  import { isDbReady } from '../../lib/db/sqlite';
  import { getSiteContext } from '../../lib/pfaf/siteContext';
  import { filterSpeciesForSite, sortSpeciesForSite } from '../../lib/pfaf/catalogSort';
  import { allNormalizedPlants } from '../../lib/pfaf/pfafSchema';
  import { getEngineSite } from '../../lib/recommend/site';
  import { buildCanvasState } from '../../lib/recommend/canvasState';
  import { buildRuleIndex } from '../../lib/recommend/ruleIndex';
  import { scorePlant } from '../../lib/recommend/scorePlant';
  import { t } from '../../lib/i18n/index.svelte';

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
  const recents = $derived($recentPlants);
  const catalogDbReady = $derived($dbReady);

  const siteCtx = $derived(catalogDbReady && isDbReady() ? getSiteContext() : null);

  // Recommendation score per species (by scientific name), recomputed as the
  // canvas changes. Empty until the DB is ready.
  const scoreMap = $derived.by(() => {
    const plantedRows = $planted;
    const m = new Map<string, number>();
    if (!catalogDbReady || !isDbReady()) return m;
    const site = getEngineSite();
    const canvas = buildCanvasState(plantedRows, speciesList);
    const ruleIndex = buildRuleIndex();
    for (const p of allNormalizedPlants()) {
      const s = scorePlant(p, site, canvas, ruleIndex);
      if (s.eligible) m.set(p.sci.toLowerCase(), Math.round(s.total));
    }
    return m;
  });

  function scoreFor(sp: SpeciesRow): number | null {
    const sci = sp.scientific_name?.toLowerCase();
    return sci ? scoreMap.get(sci) ?? null : null;
  }

  // Build ordered list: recents first (if they exist), then regional/native, then rest
  let displayList = $derived.by(() => {
    const q = search.trim().toLowerCase();
    let pool = sortSpeciesForSite(filterSpeciesForSite(speciesList, siteCtx), siteCtx);
    if (q) {
      pool = pool.filter((sp) =>
        `${sp.common_name} ${localSpeciesName(sp.common_name, sp.scientific_name)} ${sp.scientific_name ?? ''} ${sp.notes ?? ''}`.toLowerCase().includes(q)
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

<div class="quick codex-card" role="radiogroup" aria-label={t('picker_aria')}>
  <div class="quick-head">
    <span class="label">{t('picker_planting')}</span>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button type="button" class="lk" onclick={onOpenCatalog}>{t('picker_catalog')}</button>
      {#if onClose}
        <button type="button" class="btn btn-sm btn-ghost" aria-label={t('picker_close')} onclick={onClose}>
          <Glyph name="Close" size={14} />
        </button>
      {/if}
    </div>
  </div>
  <div class="quick-search">
    <input
      class="inp quick-inp"
      type="search"
      placeholder={t('picker_search_placeholder')}
      aria-label={t('picker_search_aria')}
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
        aria-label={t('picker_chip', { name: localSpeciesName(sp.common_name, sp.scientific_name), space: formatMeters(sp.spacing_m) })}
        title={sp.scientific_name ?? sp.common_name}
        onclick={() => handlePick(sp.id)}
      >
        <span class="qchip-ico" style="color: {plantTone(sp.id)};">
          <Glyph name={plantGlyph(sp.id)} size={20} />
        </span>
        <span class="qchip-name">{localSpeciesName(sp.common_name, sp.scientific_name)}</span>
        <span class="coord">{formatMeters(sp.spacing_m)}</span>
        {#if scoreFor(sp) !== null}
          <span class="qchip-score" title={t('picker_suitability_title')}>{scoreFor(sp)}</span>
        {/if}
      </button>
    {:else}
      <div class="empty" style="width: 100%; padding: 10px;">{t('picker_no_results')}</div>
    {/each}
  </div>
  <div class="quick-action">
    <button type="button" class="btn btn-accent hide-on-mobile" onclick={onPlaceAtCenter} disabled={!selectedId}>
      <Glyph name="Plus" size={14} />
      {t('picker_plant_center')}
    </button>
    <span class="sub">{t('picker_place_hint')}</span>
  </div>
</div>

<style>
  .quick {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-canvas-rail);
    width: min(720px, calc(100% - 32px - var(--safe-left) - var(--safe-right)));
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .quick-head { display: flex; justify-content: space-between; align-items: center; }
  .lk { background: none; border: none; color: var(--ocre-deep); font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  .lk:hover { text-decoration: underline; color: var(--ocre); }

  .quick-search { display: flex; }
  .quick-inp { min-height: 34px; font-size: calc(13px * var(--text-scale)); padding: 6px 10px; }

  .quick-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    flex-wrap: nowrap;
  }
  .qchip {
    position: relative;
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
    font-size: calc(8px * var(--text-scale));
    color: var(--ocre);
    line-height: 1;
    margin-top: -2px;
  }
  .qchip-ico { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
  @media (max-width: 760px) {
    .hide-on-mobile { display: none !important; }
    .quick { bottom: calc(var(--nav-h) + var(--safe-bottom) + 84px); padding: 8px 10px; gap: 6px; }
    .qchip { min-width: 64px; padding: 6px; }
    .qchip-name { font-size: calc(10px * var(--text-scale)); }
    .qchip-ico { width: 18px; height: 18px; }
    .quick-inp { font-size: calc(12px * var(--text-scale)); min-height: 30px; }
  }
  .qchip-name { font-size: calc(11px * var(--text-scale)); font-weight: 500; }
  .qchip .coord { font-size: calc(9px * var(--text-scale)); }
  .qchip-score {
    position: absolute;
    top: 3px;
    right: 4px;
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    font-weight: 700;
    line-height: 1;
    color: var(--jade-deep);
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px 4px;
  }

  .quick-action { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
</style>
