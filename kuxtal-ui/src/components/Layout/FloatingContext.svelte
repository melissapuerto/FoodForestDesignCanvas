<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { speciesById, type PlantedRow } from '../../lib/stores/appState';

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

<aside class="ctx-rail" aria-label="Resumen del lienzo">
  <div class="codex-card ctx-card">
    <div class="label">Lienzo</div>
    <div class="ctx-grid">
      <div class="ctx-mini">
        <div class="n">{plantedRows.length}</div>
        <div class="l">plantas</div>
      </div>
      <div class="ctx-mini">
        <div class="n">{zonesCount}</div>
        <div class="l">zonas</div>
      </div>
    </div>
  </div>

  <div class="codex-card ctx-card">
    <div class="ctx-head">
      <span class="label">Animales</span>
      <button type="button" class="lk" onclick={onOpenAnimales}>ver →</button>
    </div>
    <div class="sub" style="font-style: italic; font-family: var(--serif); font-size: 13px;">
      Toca el módulo Animales para registrar lo que vive en tu tierra.
    </div>
  </div>

  {#if speciesUsed.length > 0}
    <div class="codex-card ctx-card ctx-inv">
      <div class="label">Inventario</div>
      <div class="inv-grid">
        {#each speciesUsed as [sp, n]}
          {@const def = speciesById(sp)}
          {#if def}
            <div class="inv-chip" title={def.scientific_name ?? ''}>
              <span class="inv-ico" style="color: {plantTone(sp)};">
                <Glyph name={plantGlyph(sp)} size={14} />
              </span>
              <span class="inv-name">{def.common_name}</span>
              <span class="coord inv-n">×{n}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  .ctx-rail {
    position: absolute;
    right: 14px;
    top: 84px;
    bottom: 92px;
    z-index: 11;
    width: 240px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: auto;
  }
  .ctx-card { padding: 10px 12px; }
  .ctx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
  .ctx-mini { background: var(--paper-warm); border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px; }
  .ctx-mini .n { font-family: var(--serif); font-size: 22px; line-height: 1; }
  .ctx-mini .l { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); margin-top: 2px; }
  .ctx-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .lk { background: none; border: none; color: var(--ocre-deep); font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; padding: 2px 4px; }
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
    font-size: 11px;
  }
  .inv-name { font-weight: 500; }
  .inv-n { font-size: 9px; }

  @media (max-width: 900px) {
    .ctx-rail { display: none; }
  }
</style>
