<script lang="ts">
  import { onMount } from 'svelte';
  import { loadPlan, clearPlan, materializeFromPlan } from '../../lib/permaculture/realize';
  import { suggestPlan } from '../../lib/permaculture/engine';
  import type { Plan } from '../../lib/permaculture/types';
  import { dbReady, reloadFromDb } from '../../lib/stores/appState';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import { showToast } from '../../lib/stores/toast';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { formatMeters } from '../../lib/utils/format';

  let { onEdit }: { onEdit?: () => void } = $props();

  let plan = $state<Plan | null>(null);

  dbReady.subscribe((ready) => { if (ready) refresh(); });
  onMount(() => refresh());

  function refresh(): void {
    plan = loadPlan();
  }

  function recompute(): void {
    if (!plan) return;
    plan = suggestPlan(plan.inputs);
    showToast({ message: 'Plan recalculado.', tone: 'ok' });
  }

  async function generateZones(): Promise<void> {
    if (!plan) return;
    const lat = plan.inputs.lat;
    const lng = plan.inputs.lng;
    if (lat == null || lng == null) {
      showToast({ message: 'Necesito coordenadas para generar zonas. Edita tus datos en el wizard.', tone: 'warn' });
      return;
    }
    const ok = await dialogConfirm({
      title: '¿Generar contorno y zonas en el lienzo?',
      body: 'Se crearán polígonos circulares concéntricos. Podrás moverlos o borrarlos después.',
      confirmLabel: 'Generar'
    });
    if (!ok) return;
    const r = materializeFromPlan({
      plan, landId: 'land-default',
      centerLat: lat, centerLng: lng,
      createBoundary: true, createZones: true
    });
    reloadFromDb('land-default');
    showToast({
      message: `Plan dibujado: ${r.boundaryCreated ? 'contorno + ' : ''}${r.zonesCreated} zonas.`,
      tone: 'ok'
    });
  }

  async function discard(): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Borrar el plan guardado?',
      body: 'No se borrarán las zonas ya creadas en el lienzo.',
      confirmLabel: 'Borrar plan',
      danger: true
    });
    if (!ok) return;
    clearPlan();
    plan = null;
    showToast({ message: 'Plan borrado.', tone: 'ok' });
  }

  function formatDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('es-CO'); } catch { return iso; }
  }
</script>

<section class="card">
  <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
    <div>
      <div class="label">Mi plan</div>
      <p class="sub" style="margin-top: 6px;">
        Bosque comestible sugerido por Kuxtal a partir de tu onboarding.
      </p>
    </div>
    {#if plan}
      <span class="coord">generado {formatDate(plan.generatedAt)}</span>
    {/if}
  </div>

  {#if !plan}
    <div class="empty" style="margin-top: 10px;">
      <div>Aún no tienes un plan guardado.</div>
      <p class="sub" style="margin-top: 6px;">Ejecuta el wizard de bienvenida para generar uno.</p>
    </div>
  {:else}
    <div class="weave" style="margin: 10px 0;" aria-hidden="true"></div>
    <div class="row" style="gap: 18px; flex-wrap: wrap;">
      <div><div style="font-family: var(--serif); font-size: 22px;">{plan.totalAreaM2.toFixed(0)}</div><div class="coord">m²</div></div>
      <div><div style="font-family: var(--serif); font-size: 22px;">{plan.zones.length}</div><div class="coord">zonas</div></div>
      <div><div style="font-family: var(--serif); font-size: 22px;">{plan.strata.length}</div><div class="coord">estratos</div></div>
      <div><div style="font-family: var(--serif); font-size: 18px;">{plan.inputs.climate}</div><div class="coord">clima</div></div>
    </div>

    <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
    <div class="label">Zonas</div>
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
    <div class="label">Estratos</div>
    <ul class="plan-strata">
      {#each plan.strata as s}
        <li>
          <div style="font-family: var(--serif); font-size: 15px;">{s.name}</div>
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
          <Glyph name="Settings" size={14} /> Editar mis respuestas
        </button>
      {/if}
      <button class="btn btn-primary" onclick={generateZones}>
        <Glyph name="Layers" size={14} /> Generar zonas en el lienzo
      </button>
      <button class="btn" onclick={recompute}>
        <Glyph name="Reset" size={14} /> Recalcular
      </button>
      <button class="btn btn-danger" onclick={discard}>
        <Glyph name="Trash" size={14} /> Borrar plan
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
  .z-tag { background: var(--ocre); color: var(--paper); font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
  .z-name { font-family: var(--serif); font-size: 16px; flex: 1; }
  .plan-strata { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .plan-strata li { padding: 8px 10px; background: var(--paper-warm); border: 1px solid var(--line); border-radius: 4px; }
</style>
