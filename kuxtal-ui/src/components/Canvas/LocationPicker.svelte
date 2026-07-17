<script lang="ts">
  /**
   * "Put my land on the real map" dialog, opened from the canvas.
   *
   * This is the onboarding place step in a modal: it uses the very same
   * LocationSearch and LocationPicker components the wizard uses, so search,
   * GPS, the map and the coordinate readout behave identically in both places.
   * It used to carry its own cut-down search (one result, no list, no GPS on the
   * map), which is why the two flows felt like different features.
   */
  import { tick } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import LocationSearch from '../Layout/LocationSearch.svelte';
  import LocationPicker from '../Layout/LocationPicker.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    visible = false,
    onSelect,
    onCancel
  }: {
    visible?: boolean;
    onSelect: (coords: { lat: number; lng: number }) => void;
    onCancel: () => void;
  } = $props();

  // Bound to LocationPicker, which owns the map, the marker and the GPS button.
  let lat = $state('');
  let lng = $state('');
  let tab = $state<'map' | 'coords'>('map');

  const coords = $derived.by(() => {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
  });

  function confirmSelection(): void {
    if (coords) onSelect(coords);
  }

  // ---- Modal accessibility: focus management + trap + Escape ----
  let dlgEl: HTMLElement | undefined = $state();
  let lastFocus: HTMLElement | null = null;

  function focusableEls(): HTMLElement[] {
    if (!dlgEl) return [];
    const sel = 'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(dlgEl.querySelectorAll<HTMLElement>(sel)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  $effect(() => {
    if (visible) {
      lastFocus = document.activeElement as HTMLElement | null;
      tick().then(() => {
        const els = focusableEls();
        (els[0] ?? dlgEl)?.focus();
      });
    } else if (lastFocus && document.body.contains(lastFocus)) {
      lastFocus.focus();
      lastFocus = null;
    }
  });

  function onKey(e: KeyboardEvent): void {
    if (!visible) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      const els = focusableEls();
      if (els.length === 0) {
        e.preventDefault();
        dlgEl?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activeEl === first || !dlgEl?.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lp-backdrop" onclick={onCancel} onkeydown={onKey}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={dlgEl}
      class="lp-dialog codex-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-title-h"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="lp-header">
        <div class="lp-title" id="lp-title-h">
          <Glyph name="Compass" size={20} />
          <span>{t('loc_title')}</span>
        </div>
        <button type="button" class="lp-close" onclick={onCancel} aria-label={t('common_close')}>✕</button>
      </div>

      <div class="lp-tabs">
        <button type="button" class="lp-tab" class:on={tab === 'map'} onclick={() => (tab = 'map')}>
          <Glyph name="Map" size={14} /> {t('loc_tab_map')}
        </button>
        <button type="button" class="lp-tab" class:on={tab === 'coords'} onclick={() => (tab = 'coords')}>
          <Glyph name="Pin" size={14} /> {t('loc_tab_coords')}
        </button>
      </div>

      <div class="lp-body">
        {#if tab === 'map'}
          <!-- The same two components as the onboarding place step. -->
          <LocationSearch
            onSelect={(r) => { lat = r.lat.toFixed(6); lng = r.lng.toFixed(6); }}
          />
          <LocationPicker bind:lat bind:lng label={t('place_map_hint')} height="300px" />
        {:else}
          <div class="lp-coords-form">
            <div class="lp-field">
              <label for="lp-lat">{t('loc_lat')}</label>
              <input
                id="lp-lat"
                class="inp"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                bind:value={lat}
                placeholder={t('loc_lat_placeholder')}
              />
            </div>
            <div class="lp-field">
              <label for="lp-lng">{t('loc_lng')}</label>
              <input
                id="lp-lng"
                class="inp"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                bind:value={lng}
                placeholder={t('loc_lng_placeholder')}
              />
            </div>
          </div>
          <div class="lp-hint">{t('loc_gps_hint')}</div>
        {/if}
      </div>

      <div class="lp-actions">
        <button type="button" class="btn btn-sm" onclick={onCancel}>{t('common_cancel')}</button>
        <button type="button" class="btn btn-primary btn-sm" onclick={confirmSelection} disabled={!coords}>
          <Glyph name="Check" size={14} /> {t('loc_use')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .lp-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-panel);
    background: oklch(0.1 0.02 60 / 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(16px, var(--safe-top)) max(16px, var(--safe-right)) max(16px, var(--safe-bottom)) max(16px, var(--safe-left));
    animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .lp-dialog {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .lp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--line);
  }
  .lp-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(18px * var(--text-scale));
    color: var(--ink);
  }
  .lp-close {
    background: none;
    border: none;
    font-size: calc(18px * var(--text-scale));
    color: var(--ink-soft);
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
  }
  .lp-close:hover { color: var(--ink); }

  .lp-tabs {
    display: flex;
    gap: 4px;
    padding: 12px 20px 0;
  }
  .lp-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 40px;
    background: none;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--ink-soft);
    font-family: var(--mono);
    font-size: calc(11px * var(--text-scale));
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .lp-tab.on {
    background: var(--ocre);
    border-color: var(--ocre);
    color: var(--paper);
  }

  .lp-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 20px;
  }

  .lp-coords-form { display: flex; flex-direction: column; gap: 10px; }
  .lp-field { display: flex; flex-direction: column; gap: 4px; }
  .lp-field label {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .lp-hint {
    font-size: calc(12px * var(--text-scale));
    color: var(--ink-soft);
    line-height: 1.5;
  }

  .lp-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--line);
  }
</style>
