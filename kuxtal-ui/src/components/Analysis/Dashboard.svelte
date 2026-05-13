<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { selectAll } from '../../lib/db/sqlite';
  import { planted, zones as zonesStore } from '../../lib/stores/appState';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';

  let { landId }: { landId: string } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: any = null;
  let unsubPlanted: (() => void) | null = null;
  let unsubZones: (() => void) | null = null;
  let alive = false;

  let metrics = $state({
    plants: 0, zones: 0, species: 0, rules: 0,
    logs: 0, biodiversity: 0, resources: 0
  });

  type SpeciesAggregation = { species_id: string; common_name: string; count: number };
  let bySpecies = $state<SpeciesAggregation[]>([]);

  function compute(): void {
    const q = (sql: string, bind: any[] = []) => selectAll<{ n: number }>(sql, bind)[0]?.n ?? 0;
    metrics = {
      plants: q('SELECT COUNT(*) AS n FROM planted WHERE land_id = ?', [landId]),
      zones: q('SELECT COUNT(*) AS n FROM zone WHERE land_id = ?', [landId]),
      species: q('SELECT COUNT(DISTINCT species_id) AS n FROM planted WHERE land_id = ?', [landId]),
      rules: q('SELECT COUNT(*) AS n FROM rule WHERE retracted_at IS NULL'),
      logs: q('SELECT COUNT(*) AS n FROM log_entry WHERE land_id = ? OR land_id IS NULL', [landId]),
      biodiversity: q('SELECT COUNT(*) AS n FROM biodiversity_note'),
      resources: q('SELECT COUNT(*) AS n FROM resource_item')
    };

    bySpecies = selectAll<SpeciesAggregation>(
      `SELECT s.id AS species_id, s.common_name, COUNT(p.id) AS count
         FROM planted p JOIN plant_species s ON s.id = p.species_id
        WHERE p.land_id = ? GROUP BY p.species_id ORDER BY count DESC`,
      [landId]
    );
  }

  function colorForSpecies(speciesId: string): string {
    const tone = plantTone(speciesId);
    if (tone === 'var(--jade-deep)') return '#346B5C';
    if (tone === 'var(--jade)') return '#5B8F76';
    if (tone === 'var(--ocre)') return '#B5723F';
    if (tone === 'var(--ocre-deep)') return '#8C5421';
    if (tone === 'var(--cinabrio)') return '#C04848';
    if (tone === 'var(--maiz)') return '#D7B450';
    return '#6B5340';
  }

  async function drawChart(): Promise<void> {
    if (!alive || !canvas || bySpecies.length === 0) {
      if (chart) { chart.destroy(); chart = null; }
      return;
    }
    // Wait for the canvas to actually have layout (drawer open animation)
    if (canvas.clientWidth === 0) {
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      if (!alive || !canvas || canvas.clientWidth === 0) return;
    }
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    if (chart) { chart.destroy(); chart = null; }
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: bySpecies.map((b) => b.common_name),
        datasets: [{
          label: 'Plantas sembradas',
          data: bySpecies.map((b) => b.count),
          backgroundColor: bySpecies.map((b) => colorForSpecies(b.species_id)),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'JetBrains Mono' } } },
          x: { ticks: { font: { family: 'Inter' } } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  async function refresh(): Promise<void> {
    compute();
    await tick();
    drawChart();
  }

  onMount(() => {
    alive = true;
    refresh();
    unsubPlanted = planted.subscribe(() => { if (alive) refresh(); });
    unsubZones = zonesStore.subscribe(() => { if (alive) compute(); });
  });

  onDestroy(() => {
    alive = false;
    chart?.destroy();
    chart = null;
    unsubPlanted?.();
    unsubZones?.();
  });
</script>

<section class="card-warm card">
  <div class="label">Resumen del códice</div>
  <div class="big-grid" style="margin-top: 10px;">
    <div class="big">
      <div class="big-n">{metrics.plants}</div>
      <div class="label">plantas</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.zones}</div>
      <div class="label">zonas</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.species}</div>
      <div class="label">especies</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.rules}</div>
      <div class="label">reglas</div>
    </div>
  </div>
</section>

<section class="card">
  <div class="label">Bitácora</div>
  <div class="row" style="gap: 18px; margin-top: 8px; flex-wrap: wrap;">
    <div><div class="big-n" style="font-size: 28px;">{metrics.logs}</div><div class="coord">cuaderno</div></div>
    <div><div class="big-n" style="font-size: 28px;">{metrics.biodiversity}</div><div class="coord">biodiversidad</div></div>
    <div><div class="big-n" style="font-size: 28px;">{metrics.resources}</div><div class="coord">recursos</div></div>
  </div>
</section>

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="label">Distribución por especie</div>
  {#if bySpecies.length}
    <div style="height: 260px; margin-top: 10px;">
      <canvas bind:this={canvas} aria-label="Gráfica de plantas por especie"></canvas>
    </div>
    <div class="tag-row" style="margin-top: 12px;">
      {#each bySpecies as b}
        <span class="chip" style="color: var(--ink);">
          <span style="color: {plantTone(b.species_id)}; display: inline-flex;"><Glyph name={plantGlyph(b.species_id)} size={12} /></span>
          {b.common_name} <span class="coord">×{b.count}</span>
        </span>
      {/each}
    </div>
  {:else}
    <div class="empty" style="margin-top: 10px;">Aún no has sembrado plantas para graficar.</div>
  {/if}
</section>

<style>
  .big-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .big {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 6px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .big-n { font-family: var(--serif); font-size: 38px; line-height: 1; color: var(--ink); }
</style>
