<script lang="ts">
  /**
   * The canvas hover + ghost-placement tooltips, extracted from MapCanvas.svelte
   * (Use Small and Slow Solutions: shrink the core). Purely presentational — the
   * parent resolves the models and passes them in. These are hover-driven, so
   * they only appear on pointer devices; touch/mobile never renders them, which
   * is why extracting them is safe for the mobile-critical path.
   */
  import { t } from '../../lib/i18n/index.svelte';

  type Rule = { tone: 'warn' | 'help'; message: string };
  type Pos = { x: number; y: number };
  export type PlantTip = Pos & {
    glyphSvg: string; tone: string; name: string; latin: string | null;
    plantType: string | null; spacingM: number; rules: Rule[];
  };
  export type WaterTip = Pos & { tone: string; typeLabel: string; name: string; notes: string | null };
  export type ZoneTip = Pos & { tone: string; zoneNumber: number | null; name: string; intent: string | null; elevationM: number | null };
  export type GhostTip = Pos & { tone: string; blocked: boolean; blockMessage: string | null; score: number | null; rules: Rule[] };

  let { plant = null, water = null, zone = null, ghost = null }:
    { plant?: PlantTip | null; water?: WaterTip | null; zone?: ZoneTip | null; ghost?: GhostTip | null } = $props();

  const vw = () => (typeof window !== 'undefined' ? window.innerWidth : 800);
  const clampLeft = (x: number, off: number) => Math.min(x + off, vw() - 300);
  const clampTop = (y: number, off: number) => Math.max(y - off, 8);
  const ruleLabel = (tone: 'warn' | 'help') => (tone === 'warn' ? t('map_rule_caution') : t('map_rule_companion_label'));
</script>

{#if plant}
  <div class="plant-tip codex-card-soft" style="left: {clampLeft(plant.x, 16)}px; top: {clampTop(plant.y, 16)}px; --tone: {plant.tone};">
    <div class="tip-head">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- glyphSvg is renderGlyphSvg output (internal glyph-data path constants), never user input -->
      <span class="tip-glyph">{@html plant.glyphSvg}</span>
      <div class="tip-text">
        <span class="tip-name">{plant.name}</span>
        <span class="tip-latin">{plant.latin}</span>
      </div>
    </div>
    <div class="tip-meta">
      <span class="badge">{plant.plantType}</span>
      <span class="badge">{t('map_diam_label')} {plant.spacingM}m</span>
    </div>
    {#if plant.rules.length > 0}
      <div class="tip-rules">
        {#each plant.rules as r}
          <div class="tip-rule {r.tone}">
            <div class="tip-rule-label">{ruleLabel(r.tone)}</div>
            <div class="tip-rule-msg">{r.message}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else if water}
  <div class="zone-tip codex-card-soft" style="left: {clampLeft(water.x, 12)}px; top: {clampTop(water.y, 12)}px; --tone: {water.tone};">
    <div class="zt-head">
      <span class="zt-tag" style="background: {water.tone};">{water.typeLabel}</span>
      <span class="zt-name">{water.name}</span>
    </div>
    {#if water.notes}<div class="zt-notes">{water.notes}</div>{/if}
  </div>
{:else if zone}
  <div class="zone-tip codex-card-soft" style="left: {clampLeft(zone.x, 12)}px; top: {clampTop(zone.y, 12)}px; --tone: {zone.tone};">
    <div class="zt-head">
      {#if zone.zoneNumber}<span class="zt-tag">Z{zone.zoneNumber}</span>{/if}
      <span class="zt-name">{zone.name}</span>
    </div>
    {#if zone.intent}<div class="zt-intent">{zone.intent}</div>{/if}
    {#if zone.elevationM}<div class="zt-notes">{t('map_elevation_label')} {zone.elevationM.toFixed(1)}m</div>{/if}
  </div>
{/if}

{#if ghost}
  <div class="ghost-tip codex-card-soft" style="left: {ghost.x + 16}px; top: {ghost.y + 16}px; --tone: {ghost.blocked ? 'var(--cinabrio)' : ghost.tone};">
    <div class="gt-label">
      {ghost.blocked ? t('map_blocked') : t('map_possible_spot')}
      {#if !ghost.blocked && ghost.score !== null}<span class="gt-score">{t('map_suitability_label')} {ghost.score}</span>{/if}
    </div>
    {#if ghost.blocked && ghost.blockMessage}
      <div class="gt-msg">{ghost.blockMessage}</div>
    {:else if ghost.rules.length > 0}
      <div class="gt-rule">
        {#each ghost.rules as r}
          <div class="gt-rule {r.tone}">
            <div class="gt-rule-label">{ruleLabel(r.tone)}</div>
            <div class="gt-rule-msg">{r.message}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .plant-tip { position: absolute; z-index: var(--z-canvas-tip); padding: 12px 14px; max-width: 280px; pointer-events: none; border-left: 3px solid var(--tone, var(--ocre)); animation: inkBloom 0.18s var(--ease-codex) both; }
  .tip-head { display: flex; gap: 10px; align-items: center; }
  .tip-glyph { color: var(--tone, var(--ocre)); display: inline-flex; }
  .tip-text { display: flex; flex-direction: column; gap: 2px; }
  .tip-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.1; color: var(--ink); }
  .tip-latin { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(12px * var(--text-scale)); color: var(--ink-soft); }
  .tip-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
  .tip-rules { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); }
  .tip-rule .tip-rule-label { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--jade-deep); }
  .tip-rule.warn .tip-rule-label { color: var(--cinabrio); }
  .tip-rule-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); line-height: 1.4; margin-top: 2px; color: var(--ink); }

  .zone-tip { position: absolute; z-index: var(--z-canvas-tip); padding: 12px 14px; max-width: 280px; pointer-events: none; border-left: 3px solid var(--tone, var(--ocre)); animation: inkBloom 0.18s var(--ease-codex) both; }
  .zt-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zt-tag { background: var(--tone, var(--ocre)); color: var(--paper); font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; }
  .zt-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.1; color: var(--ink); }
  .zt-intent { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(13px * var(--text-scale)); margin-top: 6px; color: var(--ink-soft); }
  .zt-notes { font-size: calc(12px * var(--text-scale)); margin-top: 6px; color: var(--ink-soft); line-height: 1.4; }

  .ghost-tip { position: absolute; z-index: var(--z-canvas-tip); padding: 10px 12px; max-width: 260px; pointer-events: none; border-left: 3px solid var(--tone, var(--jade-deep)); animation: inkBloom 0.16s var(--ease-codex) both; }
  .gt-label { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--tone, var(--jade-deep)); }
  .gt-score { margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: var(--paper-warm); border: 1px solid var(--line); color: var(--jade-deep); font-weight: 700; }
  .gt-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); margin-top: 4px; color: var(--ink); }
  .gt-rule { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--line); }
  .gt-rule .gt-rule-label { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.14em; text-transform: uppercase; color: var(--jade-deep); }
  .gt-rule.warn .gt-rule-label { color: var(--cinabrio); }
  .gt-rule-msg { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(13px * var(--text-scale)); line-height: 1.4; margin-top: 2px; color: var(--ink); }

  @media (max-width: 420px) {
    .plant-tip, .zone-tip, .ghost-tip { max-width: 240px; }
  }
</style>
