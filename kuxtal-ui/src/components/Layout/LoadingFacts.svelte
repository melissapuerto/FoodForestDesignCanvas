<script lang="ts">
  /**
   * What the user sees while a code-split chunk (or the map engine at boot) is
   * fetched. Instead of a blank spinner, the wait teaches a permaculture /
   * sustainability fact and — opt-in — exposes the data and estimated energy the
   * load costs. PermaSE: "Use Edges and Value the Marginals" × "Expose the Seams".
   *
   * Honest, calm, non-gamified:
   *  - Shown only when prefs.loadingFacts is on; the user can turn it off.
   *  - The energy line is off unless prefs.loadingEnergyHint (seam offered, not forced).
   *  - Facts rotate only when motion is allowed (prefs.reducedMotion / OS setting).
   *  - Screen readers get a single stable "loading" status, not the rotating text,
   *    so it never becomes chatty.
   */
  import { prefs } from '../../lib/stores/prefs';
  import { t, getLocale } from '../../lib/i18n/index.svelte';
  import {
    pickFact,
    CHUNK_BYTES,
    estimateWh,
    formatBytes,
    FACTS
  } from '../../lib/loading/facts';
  import { onDestroy } from 'svelte';

  let {
    moduleKey = 'boot',
    context = 'module'
  }: { moduleKey?: string; context?: 'boot' | 'module' } = $props();

  let idx = $state(Math.floor(Math.random() * FACTS.length));
  const fact = $derived(pickFact(idx));
  const factText = $derived(getLocale() === 'en' ? fact.en : fact.es);

  const bytes = $derived(CHUNK_BYTES[moduleKey] ?? 0);
  const whText = $derived.by(() => {
    const wh = estimateWh(bytes);
    return wh < 0.01 ? '<0.01' : wh.toFixed(2);
  });

  // Rotate facts on a gentle cadence, but never when the user asked for reduced
  // motion (or the OS did): then a single fact stays put.
  let timer: ReturnType<typeof setInterval> | null = null;
  $effect(() => {
    if (timer) { clearInterval(timer); timer = null; }
    if ($prefs.loadingFacts && !$prefs.reducedMotion) {
      timer = setInterval(() => { idx = (idx + 1) % FACTS.length; }, 5000);
    }
  });
  onDestroy(() => { if (timer) clearInterval(timer); });
</script>

{#if $prefs.loadingFacts}
  <div class="lf" class:boot={context === 'boot'} data-testid="loading-facts">
    <!-- Stable, non-chatty status for screen readers. -->
    <span class="sr-only" role="status" aria-live="polite">{t('loading_label')}</span>

    <div class="lf-card" aria-hidden="true">
      <div class="lf-spinner" class:still={$prefs.reducedMotion}></div>
      <p class="lf-fact">{factText}</p>
      <p class="lf-src">{fact.source}</p>
      {#if bytes > 0}
        <p class="lf-meta">
          <span class="lf-tag">{t('loading_label')}</span>
          <span>· {formatBytes(bytes)}</span>
          {#if $prefs.loadingEnergyHint}
            <span title={t('loading_energy_src')}>· ≈{whText} Wh {t('loading_est')}</span>
          {/if}
        </p>
      {/if}
    </div>
  </div>
{:else}
  <!-- Keeps layout stable when the feature is off. -->
  <div class="lf-fill" class:boot={context === 'boot'} aria-hidden="true"></div>
{/if}

<style>
  .lf {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 20px;
    min-height: 160px;
  }
  .lf.boot { position: absolute; inset: 0; background: var(--paper); }
  .lf-fill { min-height: 160px; background: var(--paper); }
  .lf-fill.boot { position: absolute; inset: 0; }

  .lf-card {
    max-width: 340px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .lf-spinner {
    width: 26px; height: 26px; border-radius: 50%;
    border: 3px solid var(--line);
    border-top-color: var(--ocre);
    animation: lf-spin 0.9s linear infinite;
    margin-bottom: 4px;
  }
  .lf-spinner.still { animation: none; border-top-color: var(--line); }
  .lf-fact {
    font-family: var(--serif);
    font-weight: var(--display-weight);
    font-size: calc(15px * var(--text-scale));
    line-height: 1.5;
    color: var(--ink);
    margin: 0;
  }
  .lf-src { font-size: calc(11px * var(--text-scale)); color: var(--muted); margin: 0; font-style: italic; }
  .lf-meta {
    display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;
    font-size: calc(11px * var(--text-scale)); color: var(--muted); margin: 6px 0 0;
  }
  .lf-tag { text-transform: lowercase; }
  :global(.a11y-reduced-motion) .lf-spinner { animation: none !important; border-top-color: var(--line); }
  @keyframes lf-spin { to { transform: rotate(360deg); } }
</style>
