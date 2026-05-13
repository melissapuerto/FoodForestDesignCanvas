<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import NotificationBell from './NotificationBell.svelte';
  import { persistence } from '../../lib/stores/appState';

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
    tweaksOpen = false
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
  } = $props();
</script>

<div class="topbar-row" aria-label="Lienzo · barra superior">
  <div class="codex-card identity">
    <div class="identity-glyph" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="16" cy="16" r="13" />
        <ellipse cx="16" cy="17" rx="3" ry="6" fill="currentColor" />
        <path d="M16 11 C 16 8 19 6 22 7" stroke-linecap="round" />
      </svg>
    </div>
    <div class="identity-text">
      <div class="coord">KUXTAL · LIENZO</div>
      <div class="parcel">{parcelName}</div>
    </div>
  </div>

  <div class="codex-card mode-switch" role="group" aria-label="Modo de mapa">
    <button
      type="button"
      class="btn {mode === '2d' ? 'btn-primary' : 'btn-ghost'}"
      style="padding: 8px 14px; font-size: 12px; border: none;"
      aria-pressed={mode === '2d'}
      disabled={switchingMode}
      onclick={() => setMode('2d')}
    >
      <Glyph name="Map" size={14} />
      2D
    </button>
    <button
      type="button"
      class="btn {mode === '3d' ? 'btn-primary' : 'btn-ghost'}"
      style="padding: 8px 14px; font-size: 12px; border: none;"
      aria-pressed={mode === '3d'}
      disabled={switchingMode}
      onclick={() => setMode('3d')}
    >
      <Glyph name="Cube" size={14} />
      3D
    </button>
    <span class="mode-divider"></span>
    {#if setBasemap}
      {#if hasRealCoordinates}
        <button class="bm-btn" class:on={basemap === 'blank'} onclick={() => setBasemap('blank')}>Lienzo</button>
        <button class="bm-btn" class:on={basemap === 'paper'} onclick={() => setBasemap('paper')}>Papel</button>
        <button class="bm-btn" class:on={basemap === 'streets'} onclick={() => setBasemap('streets')}>Calles</button>
        <button class="bm-btn" class:on={basemap === 'satellite'} onclick={() => setBasemap('satellite')}>Satélite</button>
      {:else}
        <button class="bm-btn" class:on={basemap === 'blank'} onclick={() => setBasemap('blank')}>Lienzo</button>
        <button class="bm-btn bm-real" class:on={basemap === 'paper'} onclick={() => setBasemap('paper')}>
          <Glyph name="Compass" size={12} /> Mapa real
        </button>
      {/if}
    {/if}
  </div>

  <div class="topbar-right">
    {#if onFitBoundary}
      <button type="button" class="codex-card map-act-btn" onclick={onFitBoundary} aria-label="Ajustar vista">
        <Glyph name="Map" size={14} />
      </button>
    {/if}
    {#if hasRealCoordinates && onLocateMe}
      <button type="button" class="codex-card map-act-btn" onclick={onLocateMe} aria-label="Mi ubicación">
        <Glyph name="Pin" size={14} />
      </button>
    {/if}
    <div class="codex-card status-pill">
      <span class="dot" class:warn={$persistence === 'memory'}></span>
      <span class="coord status-text">
        {$persistence === 'memory' ? 'memoria · sin persistencia' : 'offline · sincronizado'}
      </span>
    </div>
    <div style="position: relative;">
      <NotificationBell />
    </div>
    <button
      type="button"
      class="codex-card tweaks-btn"
      class:open={tweaksOpen}
      aria-pressed={tweaksOpen}
      onclick={onTweaks}
    >
      <Glyph name="Settings" size={14} />
      Ajustes
    </button>
  </div>
</div>

<style>
  .topbar-row {
    position: absolute;
    top: 14px;
    left: 14px;
    right: 14px;
    z-index: 12;
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
  .identity-text .coord { font-size: 9px; margin-bottom: 2px; }
  .parcel { font-family: var(--serif); font-size: 16px; line-height: 1; }

  .mode-switch {
    padding: 4px;
    display: flex;
    gap: 2px;
    align-items: center;
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
    font-size: 10px;
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
  .status-text { font-size: 10px; }

  .tweaks-btn {
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1.5px solid var(--ink);
    cursor: pointer;
    color: var(--ink);
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: var(--paper);
  }
  .tweaks-btn.open { background: var(--paper-warm); }

  @media (max-width: 760px) {
    .topbar-row { flex-wrap: wrap; gap: 6px; top: 8px; left: 8px; right: 8px; }
    .status-text { display: none; }
    .mode-switch { order: 3; flex-basis: 100%; justify-content: center; flex-wrap: wrap; }
    .identity { padding: 6px 10px; }
    .identity-glyph { width: 22px; height: 22px; }
    .parcel { font-size: 14px; }
    .identity-text .coord { font-size: 8px; }
    .tweaks-btn { padding: 6px 8px; font-size: 9px; }
    .status-pill { padding: 6px 8px; }
    .bm-btn { padding: 4px 7px; font-size: 9px; }
    .map-act-btn { padding: 5px 6px; }
  }
  @media (max-width: 420px) {
    .identity-text .coord { display: none; }
    .mode-divider { display: none; }
    .bm-btn { font-size: 8px; padding: 3px 5px; }
  }
</style>
