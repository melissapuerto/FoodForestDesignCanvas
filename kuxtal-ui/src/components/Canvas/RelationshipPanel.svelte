<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { speciesById, type PlantedRow } from '../../lib/stores/appState';
  import { formatMeters } from '../../lib/utils/format';
  import type { RuleHit } from '../../lib/rules/types';

  let {
    plantId,
    hits,
    onClose
  }: {
    plantId: string;
    hits: RuleHit[];
    onClose: () => void;
  } = $props();

  let plant = $derived.by(() => {
    // We get species info from the hits context
    return null; // placeholder — actual info from parent
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

<aside class="rel-panel codex-card-soft" aria-label="Relaciones de esta planta">
  <div class="rel-head">
    <div class="label">Relaciones cercanas ({hits.length})</div>
    <button type="button" class="btn btn-ghost btn-sm" onclick={onClose} aria-label="Cerrar panel">
      <Glyph name="Reset" size={12} /> Cerrar
    </button>
  </div>

  {#if hits.length === 0}
    <div class="empty" style="margin-top: 8px;">Sin reglas activas en la vecindad.</div>
  {:else}
    {#if warns.length}
      <div class="rel-group">
        <div class="rel-group-label warn-label">
          <Glyph name="Help" size={12} />
          Incompatibles / Riesgo ({warns.length})
        </div>
        {#each warns as hit}
          <div class="rel-item warn">
            <div class="rel-entity">
              <span class="chip chip-cinabrio">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{formatMeters(hit.distanceM)} de distancia</span>
            </div>
            <div class="rel-msg">{hit.rule.message}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if helps.length}
      <div class="rel-group">
        <div class="rel-group-label help-label">
          <Glyph name="Check" size={12} />
          Compañeras ({helps.length})
        </div>
        {#each helps as hit}
          <div class="rel-item help">
            <div class="rel-entity">
              <span class="chip chip-jade">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{formatMeters(hit.distanceM)} de distancia</span>
            </div>
            <div class="rel-msg">{hit.rule.message}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if neutrals.length}
      <div class="rel-group">
        <div class="rel-group-label">
          <Glyph name="Sparkle" size={12} />
          Otras ({neutrals.length})
        </div>
        {#each neutrals as hit}
          <div class="rel-item">
            <div class="rel-entity">
              <span class="chip">{hit.rule.entity_b ?? '?'}</span>
              <span class="coord">{formatMeters(hit.distanceM)} de distancia</span>
            </div>
            <div class="rel-msg">{hit.rule.message}</div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</aside>

<style>
  .rel-panel {
    position: absolute;
    bottom: 92px;
    left: 14px;
    z-index: 12;
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
    font-size: 10px;
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
    font-family: var(--serif);
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink);
  }

  @media (max-width: 760px) {
    .rel-panel {
      bottom: 152px;
      left: 8px;
      width: calc(100% - 16px);
      max-height: 45vh;
    }
  }
</style>
