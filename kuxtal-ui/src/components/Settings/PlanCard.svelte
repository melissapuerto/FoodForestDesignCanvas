<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDate as formatDateLocale } from '../../lib/utils/dates';
  import { onMount } from 'svelte';
  import { loadPlan, clearPlan, materializeFromPlan } from '../../lib/permaculture/realize';
  import { suggestPlan } from '../../lib/permaculture/engine';
  import type { Plan } from '../../lib/permaculture/types';
  import { dbReady, reloadFromDb } from '../../lib/stores/appState';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import { showToast } from '../../lib/stores/toast';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { formatMeters } from '../../lib/utils/format';
  import { t } from '../../lib/i18n/index.svelte';

  let { onEdit }: { onEdit?: () => void } = $props();

  let plan = $state<Plan | null>(null);

  $effect(() => { if ($dbReady) untrack(refresh); });
  onMount(() => refresh());

  function refresh(): void {
    plan = loadPlan();
  }

  function recompute(): void {
    if (!plan) return;
    plan = suggestPlan(plan.inputs);
    showToast({ message: t('plan_recalculated'), tone: 'ok' });
  }

  async function generateZones(): Promise<void> {
    if (!plan) return;
    const lat = plan.inputs.lat;
    const lng = plan.inputs.lng;
    if (lat == null || lng == null) {
      showToast({ message: t('plan_need_coords'), tone: 'warn' });
      return;
    }
    const ok = await dialogConfirm({
      title: t('plan_gen_title'),
      body: t('plan_gen_body'),
      confirmLabel: t('plan_gen_btn')
    });
    if (!ok) return;
    const r = materializeFromPlan({
      plan, landId: 'land-default',
      centerLat: lat, centerLng: lng,
      createBoundary: true,
      createZones: true,
      createPlants: true
    });
    reloadFromDb('land-default');
    showToast({
      message: t('plan_drawn', { boundary: r.boundaryCreated ? t('plan_drawn_boundary') : '', zones: String(r.zonesCreated) }),
      tone: 'ok'
    });
  }

  async function discard(): Promise<void> {
    const ok = await dialogConfirm({
      title: t('plan_delete_title'),
      body: t('plan_delete_body'),
      confirmLabel: t('plan_delete_btn'),
      danger: true
    });
    if (!ok) return;
    clearPlan();
    plan = null;
    showToast({ message: t('plan_deleted'), tone: 'ok' });
  }

  function formatDate(iso: string): string {
    try { return formatDateLocale(iso); } catch { return iso; }
  }
</script>

<section class="card">
  <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
    <div>
      <div class="label">{t('plan_my_plan')}</div>
      <p class="sub" style="margin-top: 6px;">
        {t('plan_kuxtal_suggestion')}
      </p>
    </div>
    {#if plan}
      <span class="coord">{t('plan_generated_label')} {formatDate(plan.generatedAt)}</span>
    {/if}
  </div>

  {#if !plan}
    <div class="empty" style="margin-top: 10px;">
      <div>{t('plan_no_plan')}</div>
      <p class="sub" style="margin-top: 6px;">{t('plan_run_wizard')}</p>
      {#if onEdit}
        <button class="btn btn-primary" style="margin-top: 12px;" onclick={onEdit}>
          <Glyph name="Sparkle" size={14} /> {t('plan_create_btn')}
        </button>
      {/if}
    </div>
  {:else}
    <div class="weave" style="margin: 10px 0;" aria-hidden="true"></div>
    <div class="row" style="gap: 18px; flex-wrap: wrap;">
      <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale));">{plan.totalAreaM2.toFixed(0)}</div><div class="coord">m²</div></div>
      <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale));">{plan.zones.length}</div><div class="coord">{t('plan_zones_label')}</div></div>
      <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale));">{plan.strata.length}</div><div class="coord">{t('plan_strata_label')}</div></div>
      <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale));">{plan.inputs.climate}</div><div class="coord">{t('plan_climate_label')}</div></div>
    </div>

    <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
    <div class="label">{t('plan_zones_label')}</div>
    <ol class="plan-zones">
      {#each plan.zones as z}
        <li>
          <span class="z-tag">Z{z.zone}</span>
          <span class="z-name">{z.name}</span>
          <span class="coord">~{formatMeters(z.ringRadiusM)} · {z.areaPercent}%</span>
        </li>
      {/each}
    </ol>

    <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
    <div class="label">{t('plan_strata_label')}</div>
    <ul class="plan-strata">
      {#each plan.strata as s}
        <li>
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale));">{s.name}</div>
          <div class="tag-row" style="margin-top: 4px;">
            {#each s.speciesIds as id}<span class="chip chip-jade">{id}</span>{/each}
          </div>
        </li>
      {/each}
    </ul>

    {#if plan.warnings.length}
      <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
      {#each plan.warnings as w}
        <div class="banner warn" style="margin-top: 6px;">{w}</div>
      {/each}
    {/if}

    <div class="row wrap" style="margin-top: 14px; gap: 8px;">
      {#if onEdit}
        <button class="btn btn-accent" onclick={onEdit}>
          <Glyph name="Settings" size={14} /> {t('plan_edit_answers')}
        </button>
      {/if}
      <button class="btn btn-primary" onclick={generateZones}>
        <Glyph name="Layers" size={14} /> {t('plan_gen_zones_canvas')}
      </button>
      <button class="btn" onclick={recompute}>
        <Glyph name="Reset" size={14} /> {t('plan_recompute')}
      </button>
      <button class="btn btn-danger" onclick={discard}>
        <Glyph name="Trash" size={14} /> {t('plan_delete_btn')}
      </button>
    </div>
  {/if}
</section>

<style>
  .plan-zones { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .plan-zones li {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 8px 10px; background: var(--paper-warm); border: 1px solid var(--line); border-radius: 4px;
  }
  .z-tag { background: var(--ocre); color: var(--paper); font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
  .z-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); flex: 1; }
  .plan-strata { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .plan-strata li { padding: 8px 10px; background: var(--paper-warm); border: 1px solid var(--line); border-radius: 4px; }
</style>
