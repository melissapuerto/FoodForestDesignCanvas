<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import NotificationBell from './NotificationBell.svelte';
  import { persistence } from '../../lib/stores/appState';
  import { suggestionsOpen, toggleSuggestions } from '../../lib/stores/layout';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    parcelName = 'Mi finca',
    mode = '2d',
    switchingMode = false,
    basemap = 'paper',
    hasRealCoordinates = false,
    setMode,
    setBasemap,
    onFitBoundary,
    onLocateMe,
    onTweaks,
    tweaksOpen = false,
    onStartTour
  }: {
    parcelName?: string;
    mode: '2d' | '3d';
    switchingMode?: boolean;
    basemap?: 'streets' | 'satellite' | 'paper' | 'blank';
    hasRealCoordinates?: boolean;
    setMode: (m: '2d' | '3d') => void;
    setBasemap?: (b: 'streets' | 'satellite' | 'paper' | 'blank') => void;
    onFitBoundary?: () => void;
    onLocateMe?: () => void;
    onTweaks: () => void;
    tweaksOpen?: boolean;
    onStartTour?: () => void;
  } = $props();

  // Publish the top bar's real height (its bottom edge) so top-anchored
  // overlays (toasts, rule messages, the TTS button) can sit below it no
  // matter how many rows it wraps into on a narrow screen.
  function publishTopbarHeight(node: HTMLElement) {
    const set = () => {
      const h = Math.round(node.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty('--topbar-h', `${h}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(node);
    window.addEventListener('resize', set);
    return {
      destroy() {
        ro.disconnect();
        window.removeEventListener('resize', set);
      }
    };
  }
</script>

<div class="topbar-row" role="banner" aria-label={t('topbar_region_aria')} use:publishTopbarHeight>
  <div class="codex-card identity" data-tour="identity">
    <div class="identity-glyph" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="16" cy="16" r="13" />
        <ellipse cx="16" cy="17" rx="3" ry="6" fill="currentColor" />
        <path d="M16 11 C 16 8 19 6 22 7" stroke-linecap="round" />
      </svg>
    </div>
    <div class="identity-text">
      <div class="coord">{t('topbar_canvas')}</div>
      <div class="parcel">{parcelName}</div>
    </div>
  </div>

  <div class="codex-card mode-switch" role="group" aria-label={t('topbar_mode_aria')} data-tour="basemap">
    <button
      type="button"
      class="btn {mode === '2d' ? 'btn-primary' : 'btn-ghost'}"
      style="padding: 8px 14px; font-size: calc(12px * var(--text-scale)); border: none;"
      aria-pressed={mode === '2d'}
      disabled={switchingMode}
      onclick={() => setMode('2d')}
    >
      <Glyph name="Map" size={14} />
      2D
    </button>
    <!-- 3D is not ready to ship, so the control is disabled rather than removed:
         it stays visible as a signpost, and says why on hover/focus. -->
    <button
      type="button"
      class="btn btn-ghost mode-3d-soon"
      style="padding: 8px 14px; font-size: calc(12px * var(--text-scale)); border: none;"
      disabled
      aria-disabled="true"
      title={t('topbar_3d_soon')}
      aria-label={t('topbar_3d_soon')}
    >
      <Glyph name="Cube" size={14} />
      3D
      <span class="soon-tag">{t('common_soon')}</span>
    </button>
    <span class="mode-divider" aria-hidden="true"></span>
    {#if setBasemap}
      {#if hasRealCoordinates}
        <button type="button" class="bm-btn" class:on={basemap === 'blank'} aria-pressed={basemap === 'blank'} onclick={() => setBasemap('blank')}>{t('topbar_basemap_blank')}</button>
        <button type="button" class="bm-btn" class:on={basemap === 'paper'} aria-pressed={basemap === 'paper'} onclick={() => setBasemap('paper')}>{t('topbar_basemap_paper')}</button>
        <button type="button" class="bm-btn" class:on={basemap === 'streets'} aria-pressed={basemap === 'streets'} onclick={() => setBasemap('streets')}>{t('topbar_basemap_streets')}</button>
        <button type="button" class="bm-btn" class:on={basemap === 'satellite'} aria-pressed={basemap === 'satellite'} onclick={() => setBasemap('satellite')}>{t('topbar_basemap_satellite')}</button>
      {:else}
        <button type="button" class="bm-btn" class:on={basemap === 'blank'} aria-pressed={basemap === 'blank'} onclick={() => setBasemap('blank')}>{t('topbar_basemap_blank')}</button>
        <button type="button" class="bm-btn bm-real" class:on={basemap === 'paper'} aria-pressed={basemap === 'paper'} onclick={() => setBasemap('paper')}>
          <Glyph name="Compass" size={12} /> {t('topbar_basemap_map')}
        </button>
      {/if}
    {/if}
  </div>

  <div class="topbar-right">
    {#if onStartTour}
      <button
        type="button"
        class="codex-card help-btn"
        data-tour="help"
        aria-label={t('tour_replay_aria')}
        title={t('tour_replay_title')}
        onclick={onStartTour}
      >
        <Glyph name="Help" size={15} />
      </button>
    {/if}
    <button
      type="button"
      class="codex-card sug-btn"
      class:open={$suggestionsOpen}
      aria-pressed={$suggestionsOpen}
      onclick={toggleSuggestions}
      data-tour="suggestions"
    >
      <Glyph name="Seed" size={14} />
      {t('topbar_suggestions')}
    </button>
    {#if onFitBoundary}
      <button type="button" class="codex-card map-act-btn" onclick={onFitBoundary} aria-label={t('topbar_fit_aria')}>
        <Glyph name="Map" size={14} />
      </button>
    {/if}
    {#if hasRealCoordinates && onLocateMe}
      <button type="button" class="codex-card map-act-btn" onclick={onLocateMe} aria-label={t('topbar_locate')}>
        <Glyph name="Pin" size={14} />
      </button>
    {/if}
    <div class="codex-card status-pill">
      <span class="dot" class:warn={$persistence === 'memory'}></span>
      <span class="coord status-text">
        {$persistence === 'memory' ? t('topbar_status_memory') : ($persistence === 'idb' ? t('topbar_status_idb') : t('topbar_status_offline'))}
      </span>
    </div>
    <div style="position: relative;" data-tour="notifications">
      <NotificationBell />
    </div>
    <button
      type="button"
      class="codex-card tweaks-btn"
      class:open={tweaksOpen}
      aria-pressed={tweaksOpen}
      onclick={onTweaks}
      data-tour="tweaks"
    >
      <Glyph name="Settings" size={14} />
      {t('topbar_tweaks')}
    </button>
  </div>
</div>

<style>
  .topbar-row {
    position: absolute;
    top: calc(14px + var(--safe-top));
    left: calc(14px + var(--safe-left));
    right: calc(14px + var(--safe-right));
    z-index: var(--z-bar);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    pointer-events: none;
  }
  .topbar-row > * { pointer-events: auto; }

  .identity {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
  }
  .identity-glyph { width: 26px; height: 26px; color: var(--ocre); flex-shrink: 0; }
  .identity-text .coord { font-size: calc(9px * var(--text-scale)); margin-bottom: 2px; }
  .parcel { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); line-height: 1; }

  .mode-switch {
    padding: 4px;
    display: flex;
    gap: 2px;
    align-items: center;
  }
  /* Disabled 3D control: legible, obviously inert, with a "soon" tag. */
  .mode-3d-soon { opacity: 0.55; cursor: not-allowed; position: relative; }
  .soon-tag {
    font-family: var(--mono);
    font-size: calc(8px * var(--text-scale));
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 1px 5px;
    margin-left: 6px;
    opacity: 0.9;
  }
  .mode-divider {
    width: 1px;
    height: 20px;
    background: var(--line-strong);
    margin: 0 4px;
    flex-shrink: 0;
  }
  .bm-btn {
    padding: 6px 10px;
    background: transparent;
    color: var(--ink-soft);
    border: none;
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
    white-space: nowrap;
  }
  .bm-btn:hover { background: var(--paper-warm); }
  .bm-btn.on { background: var(--ink); color: var(--paper); }
  .bm-real {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ocre-deep);
    font-weight: 600;
  }
  .bm-real:hover { color: var(--ocre); }

  .topbar-right { display: flex; gap: 10px; align-items: center; }
  .help-btn {
    padding: 7px 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ocre-deep);
    border: 1.5px solid var(--ocre);
    background: var(--paper);
  }
  .help-btn:hover { background: var(--ocre-deep); color: var(--paper); }
  .map-act-btn {
    padding: 6px 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ink);
    border: 1px solid var(--line-strong);
    background: var(--paper);
  }
  .map-act-btn:hover { background: var(--paper-warm); }
  .status-pill {
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .status-pill .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--jade);
    box-shadow: 0 0 0 3px oklch(0.48 0.09 155 / 0.2);
    animation: pulse 2s ease-in-out infinite;
  }
  .status-pill .dot.warn {
    background: var(--cinabrio);
    box-shadow: 0 0 0 3px oklch(0.55 0.20 28 / 0.2);
  }
  .status-text { font-size: calc(10px * var(--text-scale)); }

  .tweaks-btn {
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1.5px solid var(--ink);
    cursor: pointer;
    color: var(--ink);
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: var(--paper);
  }
  .tweaks-btn.open { background: var(--paper-warm); }

  .sug-btn {
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1.5px solid var(--ocre);
    cursor: pointer;
    color: var(--ocre-deep);
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: var(--paper);
  }
  .sug-btn:hover { background: var(--paper-warm); }
  .sug-btn.open { background: var(--ocre-deep); color: var(--paper); }

  @media (max-width: 760px) {
    .topbar-row {
      flex-wrap: wrap;
      gap: 6px;
      top: calc(8px + var(--safe-top));
      left: calc(8px + var(--safe-left));
      right: calc(8px + var(--safe-right));
    }
    .status-text { display: none; }
    /* Let the right-hand controls wrap instead of overflowing the screen edge
       (otherwise "Ajustes" is clipped on narrow phones). */
    .topbar-right { flex: 1; min-width: 0; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .mode-switch { order: 3; flex-basis: 100%; justify-content: center; flex-wrap: wrap; }
    .identity { padding: 6px 10px; }
    .identity-glyph { width: 22px; height: 22px; }
    .parcel { font-size: calc(14px * var(--text-scale)); }
    .identity-text .coord { font-size: calc(8px * var(--text-scale)); }
    .tweaks-btn { padding: 6px 8px; font-size: calc(9px * var(--text-scale)); }
    .status-pill { padding: 6px 8px; }
    .bm-btn { padding: 4px 7px; font-size: calc(9px * var(--text-scale)); }
    .map-act-btn { padding: 5px 6px; }
  }
  @media (max-width: 420px) {
    .identity-text .coord { display: none; }
    .mode-divider { display: none; }
    .bm-btn { font-size: calc(8px * var(--text-scale)); padding: 3px 5px; }
  }
  /* Touch devices: meet the 44px target-size requirement (plan §4.3) for the
     compact top-bar controls that are not .btn (basemap / map-action / pills). */
  @media (pointer: coarse) {
    .bm-btn, .map-act-btn, .help-btn, .sug-btn, .tweaks-btn, .mode-switch .btn { min-height: 44px; }
  }
</style>
