<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { planted, species, zones, dbReady } from '../../lib/stores/appState';
  import { isDbReady } from '../../lib/db/sqlite';
  import { bioregionLabel } from '../../lib/climate/region';
  import { buildCanvasState } from '../../lib/recommend/canvasState';
  import { buildRuleIndex } from '../../lib/recommend/ruleIndex';
  import { recommendPlants } from '../../lib/recommend/scorePlant';
  import { getEngineSite } from '../../lib/recommend/site';
  import { pickGuildForSite, realizeGuild, roleLabel, guildName, guildDescription } from '../../lib/recommend/guilds';
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  import MicrozoneTagger from '../Canvas/MicrozoneTagger.svelte';
  import type { ScoreBreakdown } from '../../lib/recommend/types';
  import { t } from '../../lib/i18n/index.svelte';
  import { structuralConditions, prefersLowInput } from '../../lib/stores/conditions';

  let { onPick, onClose }: { onPick: (id: string) => void; onClose?: () => void } = $props();

  // ONB-06 influence: when the grower flagged restricted input supply, surface
  // a note that suggestions favour low-input, locally-sourced species.
  const lowInput = $derived(prefersLowInput($structuralConditions));

  // Active filters
  let filterLayer = $state<string | null>(null);
  let filterFn = $state<string | null>(null);
  // Which plant's breakdown tooltip is open
  let openBreakdown = $state<string | null>(null);

  const LAYER_CHIP_KEYS = [
    { v: 'canopy', lk: 'layer_canopy' },
    { v: 'sub-canopy', lk: 'layer_sub_canopy' },
    { v: 'shrub', lk: 'layer_shrub' },
    { v: 'herb', lk: 'layer_herb' },
    { v: 'groundcover', lk: 'layer_groundcover' },
    { v: 'vine', lk: 'layer_vine' },
    { v: 'root', lk: 'layer_root' }
  ] as const;

  const FN_CHIP_KEYS = [
    { v: 'nitrogen-fixer', lk: 'fn_nitrogen_fixer' },
    { v: 'dynamic-accumulator', lk: 'fn_dynamic_accumulator' },
    { v: 'pollinator', lk: 'fn_pollinator' },
    { v: 'biomass', lk: 'fn_biomass' },
    { v: 'living-mulch', lk: 'fn_living_mulch' }
  ] as const;

  const layerLabel = (layer: string): string =>
    t((`layer_${layer.replace('-', '_')}`) as any) || layer;

  const DIMENSION_KEYS: Array<{ key: keyof ScoreBreakdown; lk: string; maxPoints: number }> = [
    { key: 'climateFit', lk: 'dim_climateFit', maxPoints: 30 },
    { key: 'moistureFit', lk: 'dim_moistureFit', maxPoints: 20 },
    { key: 'goalFit', lk: 'dim_goalFit', maxPoints: 18 },
    { key: 'soilFit', lk: 'dim_soilFit', maxPoints: 15 },
    { key: 'layerGap', lk: 'dim_layerGap', maxPoints: 15 },
    { key: 'challengeFit', lk: 'dim_challengeFit', maxPoints: 12 },
    { key: 'functionGap', lk: 'dim_functionGap', maxPoints: 10 },
    { key: 'companion', lk: 'dim_companion', maxPoints: 30 },
    { key: 'sunFit', lk: 'dim_sunFit', maxPoints: 8 },
    { key: 'budgetFit', lk: 'dim_budgetFit', maxPoints: 6 },
    { key: 'conflict', lk: 'dim_conflict', maxPoints: 75 },
    { key: 'invasive', lk: 'dim_invasive', maxPoints: 40 }
  ];

  const ready = $derived($dbReady && isDbReady());

  const view = $derived.by(() => {
    const plantedRows = $planted;
    const speciesRows = $species;
    void $zones;
    if (!ready) return null;

    const site = getEngineSite();
    const hasSite = site.usdaZone != null || site.bioregion != null;
    const ruleIndex = buildRuleIndex();
    const canvas = buildCanvasState(plantedRows, speciesRows);
    const allResults = recommendPlants({ site, canvas, ruleIndex, limit: 24 });
    const guilds = pickGuildForSite(site).map((g) => ({
      guild: g,
      members: realizeGuild(g, site, canvas, ruleIndex)
    }));
    return { site, hasSite, allResults, guilds, canvas };
  });

  // Derive which layer/function chips have results to show (to hide useless chips)
  const availableLayers = $derived.by(() => {
    if (!view) return new Set<string>();
    return new Set(view.allResults.map(r => r.plant.layer).filter(Boolean) as string[]);
  });

  const filteredResults = $derived.by(() => {
    if (!view) return [];
    let results = view.allResults;
    if (filterLayer) results = results.filter(r => r.plant.layer === filterLayer);
    if (filterFn) results = results.filter(r => (r.plant.fns as readonly string[]).includes(filterFn!));
    return results.slice(0, 12);
  });

  // Gap-driven grouping (only when no active filter)
  type GroupedSection = { label: string; hint: string; items: typeof filteredResults };

  const groupedSections = $derived.by((): GroupedSection[] | null => {
    if (!view || filterLayer || filterFn) return null;
    const results = filteredResults;
    if (results.length < 4) return null;

    const layerItems: typeof results = [];
    const fnItems: typeof results = [];
    const rest: typeof results = [];

    for (const r of results) {
      const s = r.score;
      const layerContrib = s.layerGap * 15;
      const fnContrib = s.functionGap * 10;
      const companionContrib = s.companion * 10;
      const top = Math.max(layerContrib, fnContrib, companionContrib);
      if (layerContrib >= top && s.layerGap > 0.5) {
        layerItems.push(r);
      } else if (fnContrib >= top && s.functionGap > 0.4) {
        fnItems.push(r);
      } else {
        rest.push(r);
      }
    }

    const groups: GroupedSection[] = [];
    if (layerItems.length) {
      const layers = [...new Set(layerItems.map(r => layerLabel(r.plant.layer ?? '')))];
      groups.push({ label: t('sug_group_forest'), hint: layers.slice(0, 3).join(' · '), items: layerItems });
    }
    if (fnItems.length) {
      groups.push({ label: t('sug_group_functions'), hint: '', items: fnItems });
    }
    if (rest.length) {
      groups.push({ label: t('sug_group_top'), hint: '', items: rest });
    }
    return groups.length > 1 ? groups : null;
  });

  function badgeTone(total: number): string {
    if (total >= 55) return 'var(--jade-deep)';
    if (total >= 35) return 'var(--ocre-deep)';
    return 'var(--ink-soft)';
  }

  function toggleBreakdown(id: string, e: MouseEvent): void {
    e.stopPropagation();
    openBreakdown = openBreakdown === id ? null : id;
  }

  function clearFilters(): void {
    filterLayer = null;
    filterFn = null;
  }

  const LAYER_CHIPS = $derived(LAYER_CHIP_KEYS.map(c => ({ v: c.v, l: t(c.lk as any) })));
  const FN_CHIPS = $derived(FN_CHIP_KEYS.map(c => ({ v: c.v, l: t(c.lk as any) })));
  const DIMENSION_LABELS = $derived(DIMENSION_KEYS.map(d => ({ ...d, label: t(d.lk as any) })));
</script>

<!-- Close breakdown when clicking outside any breakdown panel -->
<svelte:window onclick={(e) => { if (!(e.target as Element)?.closest?.('.breakdown,.rec-score')) openBreakdown = null; }} />

<div class="sug">
  <header class="sug-head">
    <div>
      <div class="label">{t('sug_title')}</div>
      {#if view?.site?.bioregion}
        <div class="sug-sub">{bioregionLabel(view.site.bioregion)}{view.site.usdaZone ? ` · USDA ${view.site.usdaZone}` : ''}</div>
      {/if}
    </div>
    {#if onClose}
      <button type="button" class="btn btn-sm btn-ghost" aria-label={t('common_close')} onclick={onClose}>
        <Glyph name="Close" size={16} />
      </button>
    {/if}
  </header>

  {#if lowInput}
    <div class="banner" role="note">{t('cond_lowinput_notice')}</div>
  {/if}

  {#if !ready}
    <div class="sug-empty">{t('sug_loading')}</div>
  {:else if !view?.hasSite}
    <div class="sug-empty">{t('sug_no_site')}</div>
  {:else}
    <!-- Filter chips -->
    <div class="filter-row">
      {#each LAYER_CHIPS as chip}
        {#if availableLayers.has(chip.v)}
          <button
            type="button"
            class="fchip"
            class:fchip-on={filterLayer === chip.v}
            onclick={() => { filterLayer = filterLayer === chip.v ? null : chip.v; filterFn = null; }}
          >{chip.l}</button>
        {/if}
      {/each}
      {#each FN_CHIPS as chip}
        <button
          type="button"
          class="fchip fchip-fn"
          class:fchip-on={filterFn === chip.v}
          onclick={() => { filterFn = filterFn === chip.v ? null : chip.v; filterLayer = null; }}
        >{chip.l}</button>
      {/each}
      {#if filterLayer || filterFn}
        <button type="button" class="fchip fchip-clear" onclick={clearFilters}>✕ {t('sug_filter_clear')}</button>
      {/if}
    </div>

    <!-- Plant results -->
    <section class="sug-sec">
      {#if filteredResults.length === 0}
        <div class="sug-empty">{t('sug_filter_empty')}</div>
      {:else if groupedSections}
        {#each groupedSections as grp}
          <div class="grp-head">
            <span class="grp-label">{grp.label}</span>
            {#if grp.hint}<span class="grp-hint">{grp.hint}</span>{/if}
          </div>
          <ul class="rec-list">
            {#each grp.items as { plant, score } (plant.id)}
              {@render plantRow(plant, score)}
            {/each}
          </ul>
        {/each}
      {:else}
        <ul class="rec-list">
          {#each filteredResults as { plant, score } (plant.id)}
            {@render plantRow(plant, score)}
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Guild templates -->
    {#if view.guilds.length}
      <section class="sug-sec">
        <div class="sec-title">{t('sug_guilds_title')}</div>
        {#each view.guilds as { guild, members } (guild.id)}
          <div class="guild-card">
            <div class="guild-name">{guildName(guild)}</div>
            <div class="guild-desc">{guildDescription(guild)}</div>
            <div class="guild-members">
              {#each members as m (m.role + m.plant.id)}
                <button type="button" class="guild-chip" class:fallback={m.fallback} onclick={() => onPick(m.plant.id)} title={`${roleLabel(m.role)}: ${localSpeciesName(m.plant.n, m.plant.sci)}`}>
                  <span class="gc-ico" style="color: {plantTone(m.plant.id)};">
                    <Glyph name={plantGlyph(m.plant.id)} size={14} />
                  </span>
                  <span class="gc-name">{localSpeciesName(m.plant.n, m.plant.sci)}</span>
                  <span class="gc-role">{roleLabel(m.role)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <!-- Microzones -->
    {#if $zones.length}
      <section class="sug-sec">
        <div class="sec-title">{t('sug_zones_title')}</div>
        <div class="sec-hint">{t('sug_zones_hint')}</div>
        <div class="mz-list">
          {#each $zones as z (z.id)}
            <MicrozoneTagger zone={z} />
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

{#snippet plantRow(plant: { id: string; n: string; layer?: string | null; sci?: string }, score: ScoreBreakdown)}
  <li class="rec-row">
    <span class="rec-ico" style="color: {plantTone(plant.id)};">
      <Glyph name={plantGlyph(plant.id)} size={20} />
    </span>
    <div class="rec-main">
      <div class="rec-line">
        <span class="rec-name">{localSpeciesName(plant.n, plant.sci)}</span>
        {#if plant.layer}
          <span class="rec-layer">{layerLabel(plant.layer ?? '')}</span>
        {/if}
      </div>
      {#if score.reasons.length}
        <div class="rec-why">{score.reasons.slice(0, 2).join(' · ')}</div>
      {/if}
      {#if openBreakdown === plant.id}
        <div class="breakdown" role="status" aria-live="polite">
          {#each DIMENSION_LABELS as dim}
            {@const pts = score[dim.key] as number}
            {#if Math.abs(pts) > 0.5}
              <div class="bd-row">
                <span class="bd-label">{dim.label}</span>
                <div class="bd-bar-wrap">
                  <div
                    class="bd-bar"
                    class:bd-bar-neg={pts < 0}
                    style="width: {Math.min(100, Math.abs(pts) / dim.maxPoints * 100)}%"
                  ></div>
                </div>
                <span class="bd-val" class:neg={pts < 0}>{pts > 0 ? '+' : ''}{Math.round(pts)}</span>
              </div>
            {/if}
          {/each}
          <div class="bd-total">{t('sug_breakdown_total')}: {Math.round(score.total)}</div>
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="rec-score"
      style="--bt: {badgeTone(score.total)};"
      onclick={(e) => toggleBreakdown(plant.id, e)}
      title={t('sug_score_tip')}
      aria-expanded={openBreakdown === plant.id}
    >{Math.round(score.total)}</button>
    <button type="button" class="btn btn-sm btn-accent rec-pick" onclick={() => onPick(plant.id)} aria-label={t('sug_plant_btn', { name: localSpeciesName(plant.n, plant.sci) })}>
      <Glyph name="Plus" size={12} />
    </button>
  </li>
{/snippet}

<style>
  .sug {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    overflow-y: auto;
    padding: 2px;
  }
  .sug-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .sug-sub { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(13px * var(--text-scale)); color: var(--ink-soft); margin-top: 2px; }
  .sug-empty { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); line-height: 1.5; color: var(--ink-soft); padding: 8px 2px; }

  /* Filter chips */
  .filter-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .fchip {
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--paper);
    cursor: pointer;
    color: var(--ink-soft);
    transition: all 0.15s;
  }
  .fchip:hover { background: var(--paper-warm); color: var(--ink); }
  .fchip-on { background: var(--ocre); border-color: var(--ocre); color: var(--paper); }
  .fchip-fn { border-color: var(--jade); }
  .fchip-fn.fchip-on { background: var(--jade); border-color: var(--jade); }
  .fchip-clear { border-color: var(--cinabrio); color: var(--cinabrio); font-size: calc(9px * var(--text-scale)); }
  .fchip-clear:hover { background: var(--cinabrio); color: var(--paper); }

  /* Gap grouping */
  .grp-head { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; }
  .grp-label { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ocre-deep); }
  .grp-hint { font-size: calc(10px * var(--text-scale)); color: var(--ink-soft); font-style: italic; }

  .sug-sec { display: flex; flex-direction: column; gap: 8px; }
  .sec-title { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ocre-deep); }
  .sec-hint { font-size: calc(12px * var(--text-scale)); color: var(--ink-soft); font-style: italic; }

  .rec-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .rec-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper-warm);
  }
  .rec-ico { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
  .rec-main { flex: 1; min-width: 0; }
  .rec-line { display: flex; align-items: baseline; gap: 6px; }
  .rec-name { font-weight: 600; font-size: calc(13px * var(--text-scale)); }
  .rec-layer { font-family: var(--mono); font-size: calc(8px * var(--text-scale)); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); }
  .rec-why { font-size: calc(11px * var(--text-scale)); color: var(--ink-soft); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }

  /* Score badge — acts as a button to toggle breakdown */
  .rec-score {
    font-family: var(--mono);
    font-size: calc(13px * var(--text-scale));
    font-weight: 700;
    color: var(--bt, var(--ink));
    min-width: 26px;
    text-align: right;
    flex-shrink: 0;
    padding: 4px 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
  }
  .rec-score:hover { background: var(--line); }
  .rec-pick { padding: 5px 7px; flex-shrink: 0; }

  /* Score breakdown tooltip */
  .breakdown {
    margin-top: 6px;
    padding: 8px 10px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: calc(11px * var(--text-scale));
  }
  .bd-row { display: flex; align-items: center; gap: 6px; }
  .bd-label { width: 100px; color: var(--ink-soft); flex-shrink: 0; font-size: calc(10px * var(--text-scale)); }
  .bd-bar-wrap { flex: 1; height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; }
  .bd-bar { height: 100%; background: var(--jade); border-radius: 2px; transition: width 0.2s; }
  .bd-bar.bd-bar-neg { background: var(--cinabrio); }
  .bd-val { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); min-width: 24px; text-align: right; }
  .bd-val.neg { color: var(--cinabrio); }
  .bd-total { font-family: var(--mono); font-size: calc(10px * var(--text-scale)); font-weight: 700; text-align: right; border-top: 1px solid var(--line); padding-top: 4px; margin-top: 2px; }

  .guild-card { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .guild-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale)); }
  .guild-desc { font-size: calc(12px * var(--text-scale)); color: var(--ink-soft); line-height: 1.35; }
  .guild-members { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .guild-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: var(--paper);
    cursor: pointer;
    font-size: calc(11px * var(--text-scale));
  }
  .guild-chip:hover { background: var(--paper-warm); }
  .guild-chip.fallback { border-style: dashed; }
  .gc-role { font-family: var(--mono); font-size: calc(8px * var(--text-scale)); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }

  .mz-list { display: flex; flex-direction: column; gap: 6px; }
</style>
