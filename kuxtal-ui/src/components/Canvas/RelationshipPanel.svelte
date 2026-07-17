<script lang="ts">
  import { localRuleMessage, localSpeciesName } from '../../lib/i18n/dataLocal';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { planted, species, zones } from '../../lib/stores/appState';
  import { formatMeters } from '../../lib/utils/format';
  import type { RuleHit } from '../../lib/rules/types';
  import { getEngineSite } from '../../lib/recommend/site';
  import { buildCanvasState } from '../../lib/recommend/canvasState';
  import { buildRuleIndex } from '../../lib/recommend/ruleIndex';
  import { recommendPlants } from '../../lib/recommend/scorePlant';
  import { applyMicrozone, microzoneAt } from '../../lib/recommend/microzone';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    plantId,
    hits,
    onClose,
    onPick
  }: {
    plantId: string;
    hits: RuleHit[];
    onClose: () => void;
    onPick?: (id: string) => void;
  } = $props();

  // Forward suggestions: best plants to add in this plant's neighborhood.
  const suggestions = $derived.by(() => {
    const plantedRows = $planted;
    const speciesRows = $species;
    const zoneRows = $zones;
    const row = plantedRows.find((p) => p.id === plantId);
    if (!row) return [];
    const at = { lat: row.lat, lng: row.lng };
    const site = applyMicrozone(getEngineSite(), microzoneAt(at, zoneRows));
    const canvas = buildCanvasState(plantedRows, speciesRows, at);
    return recommendPlants({ site, canvas, ruleIndex: buildRuleIndex(), limit: 5 });
  });

  const warns = $derived(hits.filter((h) =>
    h.rule.relationship === 'incompatible' || h.rule.relationship === 'harmful'
  ));
  const helps = $derived(hits.filter((h) =>
    h.rule.relationship === 'companion' || h.rule.relationship === 'beneficial'
  ));
  const neutrals = $derived(hits.filter((h) =>
    h.rule.relationship !== 'incompatible' && h.rule.relationship !== 'harmful' &&
    h.rule.relationship !== 'companion' && h.rule.relationship !== 'beneficial'
  ));
</script>

<aside class="rel-panel codex-card-soft" aria-label={t('rel_panel_aria')}>
  <div class="rel-head">
    <div class="label">{t('rel_title', { n: String(hits.length) })}</div>
    <button type="button" class="btn btn-ghost btn-sm" onclick={onClose} aria-label={t('rel_close')}>
      <Glyph name="Reset" size={12} /> {t('rel_close')}
    </button>
  </div>

  {#if hits.length === 0}
    <div class="empty" style="margin-top: 8px;">{t('rel_empty')}</div>
  {:else}
    {#if warns.length}
      <div class="rel-group">
        <div class="rel-group-label warn-label">
          <Glyph name="Help" size={12} />
          {t('rel_incompatible', { n: String(warns.length) })}
        </div>
        {#each warns as hit}
          <div class="rel-item warn">
            <div class="rel-entity">
              <span class="chip chip-cinabrio">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{t('rel_distance', { d: formatMeters(hit.distanceM) })}</span>
            </div>
            <div class="rel-msg">{localRuleMessage(hit.rule)}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if helps.length}
      <div class="rel-group">
        <div class="rel-group-label help-label">
          <Glyph name="Check" size={12} />
          {t('rel_companion', { n: String(helps.length) })}
        </div>
        {#each helps as hit}
          <div class="rel-item help">
            <div class="rel-entity">
              <span class="chip chip-jade">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{t('rel_distance', { d: formatMeters(hit.distanceM) })}</span>
            </div>
            <div class="rel-msg">{localRuleMessage(hit.rule)}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if neutrals.length}
      <div class="rel-group">
        <div class="rel-group-label">
          <Glyph name="Sparkle" size={12} />
          {t('rel_neutral', { n: String(neutrals.length) })}
        </div>
        {#each neutrals as hit}
          <div class="rel-item">
            <div class="rel-entity">
              <span class="chip">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{t('rel_distance', { d: formatMeters(hit.distanceM) })}</span>
            </div>
            <div class="rel-msg">{localRuleMessage(hit.rule)}</div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if suggestions.length}
    <div class="rel-group">
      <div class="rel-group-label help-label">
        <Glyph name="Seed" size={12} />
        {t('rel_suggestions')}
      </div>
      {#each suggestions as { plant, score } (plant.id)}
        <button
          type="button"
          class="rel-sug"
          onclick={() => onPick?.(plant.id)}
          disabled={!onPick}
          title={score.reasons.slice(0, 2).join(' · ')}
        >
          <span class="rel-sug-ico" style="color: {plantTone(plant.id)};">
            <Glyph name={plantGlyph(plant.id)} size={16} />
          </span>
          <span class="rel-sug-name">{localSpeciesName(plant.n, plant.sci)}</span>
          <span class="rel-sug-score">{Math.round(score.total)}</span>
        </button>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .rel-panel {
    position: absolute;
    bottom: 92px;
    left: calc(14px + var(--safe-left));
    z-index: var(--z-bar);
    width: min(360px, calc(100% - 100px));
    max-height: min(400px, 50vh);
    overflow-y: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: inkBloom 0.25s var(--ease-codex) both;
  }
  .rel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .rel-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rel-group-label {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--line);
  }
  .warn-label { color: var(--cinabrio); }
  .help-label { color: var(--jade-deep); }
  .rel-item {
    padding: 8px 10px;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rel-item.warn { border-left: 3px solid var(--cinabrio); }
  .rel-item.help { border-left: 3px solid var(--jade-deep); }
  .rel-entity {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rel-msg {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(13px * var(--text-scale));
    line-height: 1.4;
    color: var(--ink);
  }
  .rel-sug {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
  }
  .rel-sug:hover:not(:disabled) { background: var(--paper-warm); }
  .rel-sug:disabled { cursor: default; }
  .rel-sug-ico { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rel-sug-name { flex: 1; font-size: calc(13px * var(--text-scale)); font-weight: 500; }
  .rel-sug-score { font-family: var(--mono); font-size: calc(12px * var(--text-scale)); font-weight: 700; color: var(--jade-deep); }

  @media (max-width: 760px) {
    .rel-panel {
      bottom: calc(var(--nav-h) + var(--safe-bottom) + 84px);
      left: calc(8px + var(--safe-left));
      width: calc(100% - 16px - var(--safe-left) - var(--safe-right));
      max-height: 45dvh;
    }
  }
</style>
