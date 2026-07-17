<script lang="ts">
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { speciesById, type PlantedRow } from '../../lib/stores/appState';
  import { t } from '../../lib/i18n/index.svelte';
  import { railCollapsed, toggleRail } from '../../lib/stores/chrome';

  let {
    plantedRows,
    zonesCount,
    onOpenAnimales
  }: {
    plantedRows: PlantedRow[];
    zonesCount: number;
    onOpenAnimales: () => void;
  } = $props();

  const speciesUsed = $derived.by(() => {
    const m = new Map<string, number>();
    for (const p of plantedRows) m.set(p.species_id, (m.get(p.species_id) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  });
</script>

<aside class="ctx-rail" class:collapsed={$railCollapsed} aria-label={t('ctx_title')}>
  <button
    type="button"
    class="rail-handle"
    aria-expanded={!$railCollapsed}
    aria-controls="ctx-rail-inner"
    aria-label={$railCollapsed ? t('rail_show') : t('rail_hide')}
    title={$railCollapsed ? t('rail_show') : t('rail_hide')}
    onclick={toggleRail}
  >
    <span aria-hidden="true">{$railCollapsed ? '◂' : '▸'}</span>
  </button>
  <div id="ctx-rail-inner" class="ctx-rail-inner" inert={$railCollapsed}>
  <div class="codex-card ctx-card">
    <div class="label">{t('ctx_canvas')}</div>
    <div class="ctx-grid">
      <div class="ctx-mini">
        <div class="n">{plantedRows.length}</div>
        <div class="l">{t('ctx_plants')}</div>
      </div>
      <div class="ctx-mini">
        <div class="n">{zonesCount}</div>
        <div class="l">{t('ctx_zones')}</div>
      </div>
    </div>
  </div>

  <div class="codex-card ctx-card">
    <div class="ctx-head">
      <span class="label">{t('ctx_animals')}</span>
      <button type="button" class="lk" onclick={onOpenAnimales}>{t('ctx_animals_see')}</button>
    </div>
    <div class="sub" style="font-style: italic; font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale));">
      {t('ctx_animals_hint')}
    </div>
  </div>

  {#if speciesUsed.length > 0}
    <div class="codex-card ctx-card ctx-inv">
      <div class="label">{t('ctx_inventory')}</div>
      <div class="inv-grid">
        {#each speciesUsed as [sp, n]}
          {@const def = speciesById(sp)}
          {#if def}
            <div class="inv-chip" title={def.scientific_name ?? ''}>
              <span class="inv-ico" style="color: {plantTone(sp)};">
                <Glyph name={plantGlyph(sp)} size={14} />
              </span>
              <span class="inv-name">{localSpeciesName(def.common_name, def.scientific_name)}</span>
              <span class="coord inv-n" aria-hidden="true">×{n}</span>
              <span class="sr-only">, {t('count_total', { n: String(n) })}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
  </div>
</aside>

<style>
  .ctx-rail {
    position: absolute;
    right: calc(14px + var(--safe-right));
    top: calc(var(--topbar-h, 64px) + 12px);
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 20px);
    z-index: var(--z-canvas-rail);
    width: 240px;
    /* The container itself is non-interactive; the handle and the inner stack
       own pointer events. This lets the inner slide away while the handle
       stays put. */
    pointer-events: none;
  }
  .ctx-rail-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: auto;
    transition: transform 0.42s var(--ease-codex), opacity 0.3s var(--ease-codex);
  }
  .ctx-rail.collapsed .ctx-rail-inner {
    transform: translateX(calc(100% + 30px));
    opacity: 0;
    pointer-events: none;
  }
  /* Pull-tab to collapse / restore the rail. Stays on-screen at the rail's
     left edge; pins to the viewport's right edge when the rail is tucked. */
  .rail-handle {
    position: absolute;
    left: 0;
    top: 12px;
    transform: translateX(-100%);
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 44px;
    padding: 6px;
    border: 1.5px solid var(--ink);
    border-right: none;
    border-radius: 8px 0 0 8px;
    background: var(--paper);
    color: var(--ink);
    font-size: calc(13px * var(--text-scale));
    cursor: pointer;
    box-shadow: -2px 0 8px oklch(0.2 0.04 60 / 0.12);
    transition: right 0.42s var(--ease-codex), transform 0.42s var(--ease-codex);
  }
  .rail-handle:hover { background: var(--paper-warm); }
  .ctx-rail.collapsed .rail-handle {
    left: auto;
    right: 0;
    transform: translateX(calc(14px + var(--safe-right)));
    border-right: 1.5px solid var(--ink);
  }
  .ctx-card { padding: 10px 12px; }
  .ctx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
  .ctx-mini { background: var(--paper-warm); border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; }
  .ctx-mini .n { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale)); line-height: 1; }
  .ctx-mini .l { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); margin-top: 2px; }
  .ctx-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .lk { background: none; border: none; color: var(--ocre-deep); font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; padding: 2px 4px; }
  .lk:hover { color: var(--ocre); text-decoration: underline; }

  .ctx-inv { flex: 1; min-height: 0; overflow: auto; }
  .inv-grid { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .inv-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: calc(11px * var(--text-scale));
  }
  .inv-name { font-weight: 500; }
  .inv-n { font-size: calc(9px * var(--text-scale)); }

  @media (max-width: 900px) {
    .ctx-rail { display: none; }
  }
</style>
