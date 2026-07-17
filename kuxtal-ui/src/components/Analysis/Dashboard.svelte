<script lang="ts">
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  import { onMount, onDestroy, tick } from 'svelte';
  import { selectAll, exec } from '../../lib/db/sqlite';
  import { planted, zones as zonesStore } from '../../lib/stores/appState';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping';
  import { t } from '../../lib/i18n/index.svelte';
  import { formatDate, formatNumber } from '../../lib/utils/dates';
  import { computeFootprint, litresToM3, showerEquivalents, carKmEquivalent, type FootprintResult } from '../../lib/footprint/calc';
  import { FOOTPRINT_SOURCES } from '../../lib/footprint/factors';
  import { catchmentLitresPerYear, householdDays, RUNOFF_COEFFICIENTS, CATCHMENT_SOURCE, type SurfaceKind } from '../../lib/water/catchment';
  import type { TranslationKey } from '../../lib/i18n/index.svelte';

  // ---- Rainwater catchment (WA-02) ----
  let catchArea = $state(100);
  let catchRain = $state(1200);
  let catchSurface = $state<SurfaceKind>('roof_metal');
  const catchLitres = $derived(
    catchmentLitresPerYear({ areaM2: catchArea, annualRainfallMm: catchRain, runoff: RUNOFF_COEFFICIENTS[catchSurface] })
  );
  const SURFACE_KINDS = Object.keys(RUNOFF_COEFFICIENTS) as SurfaceKind[];

  // ---- Free-text site notes (LA-04), stored per-land ----
  let siteNotes = $state('');
  let siteNotesSaved = $state(false);
  function siteNotesKey(): string { return `site.notes:${landId}`; }
  function loadSiteNotes(): void {
    try {
      const r = selectAll<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [siteNotesKey()]);
      siteNotes = r[0]?.value ? (JSON.parse(r[0].value) as string) : '';
    } catch { siteNotes = ''; }
  }
  function saveSiteNotes(): void {
    try {
      exec(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [siteNotesKey(), JSON.stringify(siteNotes)]
      );
      siteNotesSaved = true;
      setTimeout(() => (siteNotesSaved = false), 1800);
    } catch { /* ignore */ }
  }

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

  type SpeciesAggregation = { species_id: string; common_name: string; scientific_name: string | null; count: number };
  let bySpecies = $state<SpeciesAggregation[]>([]);
  let footprint = $state<FootprintResult>({ waterL: 0, co2Kg: 0, plants: 0, perSpecies: [] });
  let landName = $state('');
  const printDate = formatDate(new Date());
  function printDesign(): void { window.print(); }

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
      `SELECT s.id AS species_id, s.common_name, s.scientific_name, COUNT(p.id) AS count
         FROM planted p JOIN plant_species s ON s.id = p.species_id
        WHERE p.land_id = ? GROUP BY p.species_id ORDER BY count DESC`,
      [landId]
    );

    // EFT calculator: recompute the footprint from the current canvas planting.
    const aggs = selectAll<{ species_id: string; plant_type: string | null; count: number }>(
      `SELECT p.species_id, s.plant_type, COUNT(p.id) AS count
         FROM planted p JOIN plant_species s ON s.id = p.species_id
        WHERE p.land_id = ? GROUP BY p.species_id, s.plant_type`,
      [landId]
    );
    footprint = computeFootprint(aggs);

    const ln = selectAll<{ name: string }>('SELECT name FROM land WHERE id = ?', [landId]);
    landName = ln[0]?.name ?? 'Kuxtal';
  }

  function speciesName(id: string): string {
    return bySpecies.find((b) => b.species_id === id)?.common_name ?? id;
  }
  const fmtInt = (n: number) => formatNumber(Math.round(n));

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
        labels: bySpecies.map((b) => localSpeciesName(b.common_name, b.scientific_name)),
        datasets: [{
          label: t('dash_chart_label'),
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
    loadSiteNotes();
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

<section class="card" style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
  <div>
    <div class="label">{t('print_card_title')}</div>
    <p class="sub" style="margin-top: 4px;">{t('print_card_sub')}</p>
  </div>
  <button type="button" class="btn btn-primary" onclick={printDesign}>
    <Glyph name="Book" size={14} /> {t('print_btn')}
  </button>
</section>

<section class="card-warm card">
  <div class="label">{t('dash_title')}</div>
  <div class="big-grid" style="margin-top: 10px;">
    <div class="big">
      <div class="big-n">{metrics.plants}</div>
      <div class="label">{t('dash_plants')}</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.zones}</div>
      <div class="label">{t('dash_zones')}</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.species}</div>
      <div class="label">{t('dash_species')}</div>
    </div>
    <div class="big">
      <div class="big-n">{metrics.rules}</div>
      <div class="label">{t('dash_rules')}</div>
    </div>
  </div>
</section>

<section class="card-warm card">
  <div class="label">{t('eft_title')}</div>
  {#if footprint.plants > 0}
    <div class="row" style="gap: 18px; margin-top: 10px; flex-wrap: wrap;">
      <div>
        <div class="big-n" style="font-size: calc(32px * var(--text-scale));">{fmtInt(litresToM3(footprint.waterL))}</div>
        <div class="coord">{t('eft_water_unit')}</div>
      </div>
      <div>
        <div class="big-n" style="font-size: calc(32px * var(--text-scale));">{fmtInt(footprint.co2Kg)}</div>
        <div class="coord">{t('eft_co2_unit')}</div>
      </div>
    </div>
    <p class="sub" style="margin-top: 10px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
      {t('eft_interp', {
        plants: String(footprint.plants),
        water_m3: fmtInt(litresToM3(footprint.waterL)),
        showers: fmtInt(showerEquivalents(footprint.waterL)),
        co2: fmtInt(footprint.co2Kg),
        km: fmtInt(carKmEquivalent(footprint.co2Kg))
      })}
    </p>
    {#if footprint.perSpecies.length}
      <div class="label" style="margin-top: 10px;">{t('eft_top_title')}</div>
      <div class="tag-row" style="margin-top: 6px;">
        {#each footprint.perSpecies.slice(0, 4) as s}
          <span class="chip">{speciesName(s.species_id)} <span class="coord">{fmtInt(litresToM3(s.waterL))} m³</span></span>
        {/each}
      </div>
    {/if}
    <p class="sub" style="margin-top: 10px; font-size: calc(12px * var(--text-scale));">{t('eft_disclaimer')}</p>
    <div class="coord" style="margin-top: 6px;">{t('eft_sources_title')}</div>
    <ul class="eft-sources">
      {#each FOOTPRINT_SOURCES as s}
        <li><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></li>
      {/each}
    </ul>
  {:else}
    <div class="empty" style="margin-top: 10px;">{t('eft_empty')}</div>
  {/if}
</section>

<section class="card">
  <div class="label">{t('catch_title')}</div>
  <div class="row wrap" style="gap: 10px; margin-top: 8px;">
    <div class="field-row" style="flex: 1; min-width: 110px;">
      <label class="coord" for="ca-area">{t('catch_area')}</label>
      <input id="ca-area" class="inp" type="number" min="0" inputmode="numeric" bind:value={catchArea} />
    </div>
    <div class="field-row" style="flex: 1; min-width: 110px;">
      <label class="coord" for="ca-rain">{t('catch_rain')}</label>
      <input id="ca-rain" class="inp" type="number" min="0" inputmode="numeric" bind:value={catchRain} />
    </div>
    <div class="field-row" style="flex: 1; min-width: 140px;">
      <label class="coord" for="ca-surf">{t('catch_surface')}</label>
      <select id="ca-surf" class="inp" bind:value={catchSurface}>
        {#each SURFACE_KINDS as s}
          <option value={s}>{t(('catch_surf_' + s) as TranslationKey)}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="row" style="gap: 18px; margin-top: 10px; flex-wrap: wrap;">
    <div><div class="big-n" style="font-size: calc(30px * var(--text-scale));">{fmtInt(litresToM3(catchLitres))}</div><div class="coord">{t('catch_m3_unit')}</div></div>
    <div><div class="big-n" style="font-size: calc(30px * var(--text-scale));">{fmtInt(householdDays(catchLitres))}</div><div class="coord">{t('catch_days_unit')}</div></div>
  </div>
  <p class="sub" style="margin-top: 8px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
    {t('catch_interp', { m3: fmtInt(litresToM3(catchLitres)), days: fmtInt(householdDays(catchLitres)) })}
  </p>
  <ul class="eft-sources">
    <li><a href={CATCHMENT_SOURCE.url} target="_blank" rel="noopener noreferrer">{CATCHMENT_SOURCE.name}</a></li>
  </ul>
</section>

<section class="card">
  <div class="label">{t('dash_log')}</div>
  <div class="row" style="gap: 18px; margin-top: 8px; flex-wrap: wrap;">
    <div><div class="big-n" style="font-size: calc(28px * var(--text-scale));">{metrics.logs}</div><div class="coord">{t('dash_log_notebook')}</div></div>
    <div><div class="big-n" style="font-size: calc(28px * var(--text-scale));">{metrics.biodiversity}</div><div class="coord">{t('dash_log_biodiversity')}</div></div>
    <div><div class="big-n" style="font-size: calc(28px * var(--text-scale));">{metrics.resources}</div><div class="coord">{t('dash_log_resources')}</div></div>
  </div>
</section>

<section class="card">
  <div class="row" style="justify-content: space-between; align-items: baseline;">
    <div class="label">{t('notes_title')}</div>
    <span class="coord" role="status">{siteNotesSaved ? t('notes_saved') : ''}</span>
  </div>
  <textarea
    class="inp"
    rows="3"
    style="margin-top: 8px;"
    placeholder={t('notes_placeholder')}
    bind:value={siteNotes}
    onblur={saveSiteNotes}
    aria-label={t('notes_title')}
  ></textarea>
  <div class="coord" style="margin-top: 4px;">{t('notes_hint')}</div>
</section>

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="label">{t('dash_chart_title')}</div>
  {#if bySpecies.length}
    <div style="height: 260px; margin-top: 10px;" role="img" aria-label={t('dash_chart_aria')}>
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </div>
    <div class="tag-row" style="margin-top: 12px;">
      {#each bySpecies as b}
        <span class="chip" style="color: var(--ink);">
          <span style="color: {plantTone(b.species_id)}; display: inline-flex;"><Glyph name={plantGlyph(b.species_id)} size={12} /></span>
          {localSpeciesName(b.common_name, b.scientific_name)} <span class="coord" aria-hidden="true">×{b.count}</span><span class="sr-only">, {t('count_total', { n: String(b.count) })}</span>
        </span>
      {/each}
    </div>
  {:else}
    <div class="empty" style="margin-top: 10px;">{t('dash_chart_empty')}</div>
  {/if}
</section>

<!-- Print-only summary (DC-07). Hidden on screen; window.print() → Save as PDF. -->
<div class="print-summary" aria-hidden="true">
  <h1>{landName}</h1>
  <p>{t('print_subtitle')} — {printDate}</p>
  <h2>{t('print_metrics')}</h2>
  <p>{metrics.plants} {t('dash_plants')} · {metrics.zones} {t('dash_zones')} · {metrics.species} {t('dash_species')}</p>
  <h2>{t('print_plants')}</h2>
  {#if bySpecies.length}
    <ul>
      {#each bySpecies as b}<li>{localSpeciesName(b.common_name, b.scientific_name)} × {b.count}</li>{/each}
    </ul>
  {:else}
    <p>—</p>
  {/if}
  <h2>{t('eft_title')}</h2>
  <p>{fmtInt(litresToM3(footprint.waterL))} {t('eft_water_unit')} · {fmtInt(footprint.co2Kg)} {t('eft_co2_unit')}</p>
  <p class="print-foot">{t('print_footer')}</p>
</div>

<style>
  .big-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .big {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 6px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .big-n { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(38px * var(--text-scale)); line-height: 1; color: var(--ink); }
  .eft-sources { margin: 4px 0 0; padding-left: 18px; }
  .eft-sources li { font-size: calc(11px * var(--text-scale)); line-height: 1.5; color: var(--ink-soft); }
  .eft-sources a { color: var(--ocre-deep); text-decoration: underline; }
</style>
