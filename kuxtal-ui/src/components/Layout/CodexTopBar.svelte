<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import NotificationBell from './NotificationBell.svelte'
  import { persistence } from '../../lib/stores/appState'
  import { undo, redo, canUndo, canRedo } from '../../lib/stores/history'
  import { t } from '../../lib/i18n/index.svelte'
  import { fly } from 'svelte/transition'

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
    parcelName?: string
    mode: '2d' | '3d'
    switchingMode?: boolean
    basemap?: 'streets' | 'satellite' | 'paper' | 'blank'
    hasRealCoordinates?: boolean
    setMode: (m: '2d' | '3d') => void
    setBasemap?: (b: 'streets' | 'satellite' | 'paper' | 'blank') => void
    onFitBoundary?: () => void
    onLocateMe?: () => void
    onTweaks: () => void
    tweaksOpen?: boolean
    onStartTour?: () => void
  } = $props()

  let topCollapsed = $state(false)

  // ---- Basemap style picker dropdown ----
  let bmPickerOpen = $state(false)
  let bmPickerEl: HTMLDivElement | undefined = $state()

  function toggleBmPicker(): void {
    bmPickerOpen = !bmPickerOpen
  }
  function pickBasemap(b: 'streets' | 'satellite' | 'paper'): void {
    setBasemap?.(b)
    bmPickerOpen = false
  }

  // Close basemap picker on outside click
  function onDocClick(e: MouseEvent): void {
    if (bmPickerOpen && bmPickerEl && !bmPickerEl.contains(e.target as Node)) {
      bmPickerOpen = false
    }
  }
  $effect(() => {
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  })

  // ---- Lienzo warning dialog ----
  let lienzoWarnOpen = $state(false)

  function requestLienzoSwitch(): void {
    if (basemap === 'blank') return
    lienzoWarnOpen = true
  }
  function confirmLienzo(): void {
    lienzoWarnOpen = false
    setBasemap?.('blank')
  }
  function cancelLienzo(): void {
    lienzoWarnOpen = false
  }

  const isLienzo = $derived(basemap === 'blank')

  const currentStyleLabel = $derived(
    basemap === 'paper'
      ? t('topbar_basemap_paper' as any)
      : basemap === 'streets'
        ? t('topbar_basemap_streets' as any)
        : basemap === 'satellite'
          ? t('topbar_basemap_satellite' as any)
          : t('topbar_basemap_paper' as any)
  )

  // Publish the top bar's real height so top-anchored overlays sit below it.
  function publishTopbarHeight(node: HTMLElement) {
    const set = () => {
      const h = Math.round(node.getBoundingClientRect().bottom)
      document.documentElement.style.setProperty('--topbar-h', `${h}px`)
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(node)
    window.addEventListener('resize', set)
    return {
      destroy() {
        ro.disconnect()
        window.removeEventListener('resize', set)
      }
    }
  }
</script>

<div
  class="topbar-row"
  role="banner"
  aria-label={t('topbar_region_aria')}
  use:publishTopbarHeight
>
  <div
    class="canvas-info-container"
    style="display: flex; gap: 12px;"
  >
    <!-- Topbar collapse toggle -->
    <button
      type="button"
      class="codex-card icon-btn top-collapse-btn"
      onclick={() => (topCollapsed = !topCollapsed)}
      aria-label={t('nav_hide_menu' as any) ?? 'Toggle menu'}
    >
      <div
        style="display:flex; transform: rotate({topCollapsed
          ? -90
          : 90}deg); transition: transform 0.2s;"
      >
        <Glyph
          name="ChevronDown"
          size={16}
        />
      </div>
    </button>
    {#if !topCollapsed}
      <!-- Left: Identity card with status below -->
      <div
        class="codex-card identity"
        data-tour="identity"
        transition:fly={{ x: -20, duration: 200 }}
      >
        <div
          class="identity-glyph"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          >
            <circle
              cx="16"
              cy="16"
              r="13"
            />
            <ellipse
              cx="16"
              cy="17"
              rx="3"
              ry="6"
              fill="currentColor"
            />
            <path
              d="M16 11 C 16 8 19 6 22 7"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="identity-text">
          <div class="coord">{t('topbar_canvas')}</div>
          <div class="parcel">{parcelName}</div>
          <div class="status-inline">
            <span
              class="dot"
              class:warn={$persistence === 'memory'}
            ></span>
            <span class="coord">
              {$persistence === 'memory'
                ? t('topbar_status_memory')
                : $persistence === 'idb'
                  ? t('topbar_status_idb')
                  : t('topbar_status_offline')}
            </span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if !topCollapsed}
    <!-- Center: Mode + View + Style strip -->
    <div
      class="codex-card mode-switch"
      role="group"
      aria-label={t('topbar_mode_aria')}
      data-tour="basemap"
      transition:fly={{ y: -10, duration: 200 }}
    >
      <button
        type="button"
        class="mode-btn {mode === '2d' ? 'on' : ''}"
        aria-pressed={mode === '2d'}
        disabled={switchingMode}
        onclick={() => setMode('2d')}
      >
        <span class="mode-ico"
          ><Glyph
            name="Map"
            size={14}
          /></span
        >
        2D
      </button>
      <button
        type="button"
        class="mode-btn mode-3d-soon"
        disabled
        aria-disabled="true"
        title={t('topbar_3d_soon')}
        aria-label={t('topbar_3d_soon')}
      >
        <span class="mode-ico"
          ><Glyph
            name="Cube"
            size={14}
          /></span
        >
        3D
      </button>

      <span
        class="mode-divider"
        aria-hidden="true"
      ></span>

      {#if setBasemap}
        <button
          type="button"
          class="view-btn {isLienzo ? 'on' : ''}"
          aria-pressed={isLienzo}
          onclick={() => {
            if (!isLienzo) requestLienzoSwitch()
          }}
        >
          {t('topbar_view_lienzo' as any)}
        </button>
        <button
          type="button"
          class="view-btn {!isLienzo ? 'on' : ''}"
          aria-pressed={!isLienzo}
          onclick={() => {
            if (isLienzo) {
              setBasemap('paper')
            }
          }}
        >
          {t('topbar_view_map' as any)}
        </button>

        {#if !isLienzo && hasRealCoordinates}
          <span
            class="mode-divider"
            aria-hidden="true"
          ></span>
          <div
            class="bm-picker-wrap"
            bind:this={bmPickerEl}
          >
            <button
              type="button"
              class="bm-picker-btn"
              class:open={bmPickerOpen}
              onclick={toggleBmPicker}
              aria-haspopup="true"
              aria-expanded={bmPickerOpen}
            >
              {currentStyleLabel}
              <Glyph
                name="ChevronDown"
                size={10}
              />
            </button>
            {#if bmPickerOpen}
              <div
                class="bm-dropdown"
                role="listbox"
                aria-label={t('topbar_basemap_picker' as any)}
              >
                {#each ['paper', 'streets', 'satellite'] as const as style}
                  <button
                    type="button"
                    class="bm-drop-item"
                    class:on={basemap === style}
                    role="option"
                    aria-selected={basemap === style}
                    onclick={() => pickBasemap(style)}
                  >
                    {t(`topbar_basemap_${style}` as any)}
                  </button>
                {/each}

                <!-- Mobile only: Map Actions in dropdown -->
                <div class="show-on-mobile">
                  <div class="bm-drop-divider"></div>
                  {#if onFitBoundary}
                    <button
                      type="button"
                      class="bm-drop-item"
                      onclick={() => {
                        onFitBoundary()
                        bmPickerOpen = false
                      }}
                    >
                      <span class="bm-icon"
                        ><Glyph
                          name="Map"
                          size={14}
                        /></span
                      >
                      {t('topbar_fit_aria' as any) ?? 'Pan to Contorno'}
                    </button>
                  {/if}
                  {#if hasRealCoordinates && onLocateMe}
                    <button
                      type="button"
                      class="bm-drop-item"
                      onclick={() => {
                        onLocateMe()
                        bmPickerOpen = false
                      }}
                    >
                      <span class="bm-icon"
                        ><Glyph
                          name="Pin"
                          size={14}
                        /></span
                      >
                      {t('topbar_locate' as any) ?? 'Go to my location'}
                    </button>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Undo/Redo block for mobile -->
    <div class="codex-card mobile-undo-redo">
      <button
        type="button"
        class="icon-btn"
        disabled={!$canUndo}
        aria-label={t('tool_undo' as any)}
        onclick={undo}
      >
        <Glyph name="Reset" size={16} />
      </button>
      <button
        type="button"
        class="icon-btn"
        disabled={!$canRedo}
        aria-label={t('tool_redo' as any)}
        onclick={redo}
      >
        <Glyph name="Reset" size={16} style="transform: scaleX(-1);" />
      </button>
    </div>

    <!-- Right: Help + Notifications + Settings -->
    <div
      class="topbar-right"
      transition:fly={{ y: -10, duration: 200 }}
    >
      {#if onFitBoundary}
        <button
          type="button"
          class="codex-card icon-btn hide-on-mobile"
          onclick={onFitBoundary}
          aria-label={t('topbar_fit_aria' as any) ?? 'Pan to Contorno'}
          title={t('topbar_fit_aria' as any) ?? 'Pan to Contorno'}
        >
          <Glyph
            name="Map"
            size={16}
          />
        </button>
      {/if}
      {#if hasRealCoordinates && onLocateMe}
        <button
          type="button"
          class="codex-card icon-btn hide-on-mobile"
          onclick={onLocateMe}
          aria-label={t('topbar_locate' as any) ?? 'Go to my location'}
          title={t('topbar_locate' as any) ?? 'Go to my location'}
        >
          <Glyph
            name="Pin"
            size={16}
          />
        </button>
      {/if}
      {#if onStartTour}
        <button
          type="button"
          class="codex-card icon-btn"
          data-tour="help"
          aria-label={t('tour_replay_aria')}
          title={t('tour_replay_title')}
          onclick={onStartTour}
        >
          <Glyph
            name="Help"
            size={16}
          />
        </button>
      {/if}
      <div
        style="position: relative;"
        data-tour="notifications"
      >
        <NotificationBell />
      </div>
      <button
        type="button"
        class="codex-card icon-btn"
        class:open={tweaksOpen}
        aria-pressed={tweaksOpen}
        aria-label={t('topbar_tweaks')}
        onclick={onTweaks}
        data-tour="tweaks"
      >
        <Glyph
          name="Gear"
          size={16}
        />
      </button>
    </div>
  {/if}
</div>

<!-- Lienzo Warning Dialog -->
{#if lienzoWarnOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lienzo-overlay"
    onclick={cancelLienzo}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="lienzo-dialog codex-card"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lienzo-warn-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <div
        class="lienzo-dialog-icon"
        aria-hidden="true"
      >
        <Glyph
          name="Warning"
          size={28}
        />
      </div>
      <h2
        id="lienzo-warn-title"
        class="handline"
        style="font-size: calc(22px * var(--text-scale)); margin: 0 0 8px;"
      >
        {t('lienzo_warn_title' as any)}
      </h2>
      <p
        style="font-family: var(--serif); font-size: calc(14px * var(--text-scale)); color: var(--ink-soft); line-height: 1.5; margin: 0 0 20px;"
      >
        {t('lienzo_warn_body' as any)}
      </p>
      <div class="lienzo-dialog-actions">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelLienzo}>{t('lienzo_warn_cancel' as any)}</button
        >
        <button
          type="button"
          class="btn btn-primary"
          onclick={confirmLienzo}>{t('lienzo_warn_confirm' as any)}</button
        >
      </div>
    </div>
  </div>
{/if}

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
  .topbar-row > * {
    pointer-events: auto;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    flex-shrink: 0;
  }
  .identity-glyph {
    width: 26px;
    height: 26px;
    color: var(--ocre);
    flex-shrink: 0;
  }
  .identity-text .coord {
    font-size: calc(9px * var(--text-scale));
    margin-bottom: 2px;
  }
  .parcel {
    font-family: var(--serif);
    font-weight: var(--display-weight);
    font-size: calc(16px * var(--text-scale));
    line-height: 1;
  }
  .status-inline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .status-inline .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--jade);
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }
  .status-inline .dot.warn {
    background: var(--cinabrio);
  }

  .mode-switch {
    padding: 4px;
    display: flex;
    gap: 2px;
    align-items: center;
  }
  .mode-btn {
    padding: 8px 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: calc(12px * var(--text-scale));
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
  }
  .mode-btn:hover {
    background: var(--paper-warm);
  }
  .mode-btn.on {
    background: var(--ink);
    color: var(--paper);
  }
  .mode-3d-soon {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mode-divider {
    width: 1px;
    height: 20px;
    background: var(--line-strong);
    margin: 0 4px;
    flex-shrink: 0;
  }
  .view-btn {
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
  .view-btn:hover {
    background: var(--paper-warm);
  }
  .view-btn.on {
    background: var(--ocre-deep);
    color: var(--paper);
  }

  .bm-picker-wrap {
    position: relative;
  }
  .bm-picker-btn {
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s var(--ease-codex);
    white-space: nowrap;
  }
  .bm-picker-btn:hover,
  .bm-picker-btn.open {
    background: var(--paper-warm);
    color: var(--ink);
  }
  .bm-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 120px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: var(--z-menu);
    padding: 4px;
    animation: popUp 0.15s var(--ease-codex);
  }
  @keyframes popUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  .bm-drop-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: var(--mono);
    font-size: calc(11px * var(--text-scale));
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 4px;
    cursor: pointer;
    min-height: 36px;
    transition: background 0.12s var(--ease-codex);
  }
  .bm-drop-item:hover {
    background: var(--paper-warm);
  }
  .bm-drop-item.on {
    background: var(--ink);
    color: var(--paper);
  }

  .topbar-right {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .icon-btn {
    padding: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--ink);
    border: 1px solid var(--line-strong);
    background: var(--paper);
    min-width: 40px;
    min-height: 40px;
    transition: background 0.15s var(--ease-codex);
  }
  .icon-btn:hover {
    background: var(--paper-warm);
  }
  .icon-btn.open {
    background: var(--paper-warm);
    border-color: var(--ink);
  }

  .lienzo-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: oklch(0.15 0.02 60 / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    pointer-events: auto;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .lienzo-dialog {
    max-width: 380px;
    width: 100%;
    padding: 28px;
    text-align: center;
  }
  .lienzo-dialog-icon {
    color: var(--ocre);
    margin-bottom: 12px;
  }
  .lienzo-dialog-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .lienzo-dialog-actions .btn {
    min-width: 100px;
  }

  .show-on-mobile {
    display: none;
  }
  .hide-on-mobile {
    display: flex;
  }
  .mobile-undo-redo {
    display: none;
  }

  .bm-drop-divider {
    height: 1px;
    background: var(--line-strong);
    margin: 4px 0;
  }
  .bm-icon {
    display: inline-flex;
    margin-right: 6px;
    color: var(--ocre);
  }

  @media (max-width: 760px) {
    .show-on-mobile {
      display: block;
    }
    .hide-on-mobile {
      display: none !important;
    }

    .topbar-row {
      flex-wrap: wrap;
      gap: 12px;
      top: calc(8px + var(--safe-top));
      left: calc(8px + var(--safe-left));
      right: calc(8px + var(--safe-right));
    }
    .identity {
      padding: 6px 10px;
    }
    .identity-glyph {
      width: 22px;
      height: 22px;
    }
    .parcel {
      font-size: calc(14px * var(--text-scale));
    }
    .identity-text .coord {
      font-size: calc(8px * var(--text-scale));
    }
    .topbar-right {
      gap: 10px;
    }
    .icon-btn {
      padding: 6px;
      min-width: 36px;
      min-height: 36px;
    }
    .mode-switch {
      order: 3;
      justify-content: flex-start;
      flex-wrap: wrap;
    }
    .mode-switch > * {
      flex-shrink: 0;
    }
    .mobile-undo-redo {
      display: flex;
      order: 4;
      gap: 2px;
    }
    .mode-ico {
      display: none;
    }
    .mode-btn {
      padding: 6px 10px;
      font-size: calc(11px * var(--text-scale));
    }
    .view-btn {
      padding: 4px 8px;
      font-size: calc(9px * var(--text-scale));
    }
    .bm-picker-btn {
      padding: 4px 8px;
      font-size: calc(9px * var(--text-scale));
    }
  }
  @media (max-width: 420px) {
    .identity-text .coord {
      display: none;
    }
    .mode-divider {
      display: none;
    }
  }
  @media (pointer: coarse) {
    .mode-btn,
    .view-btn,
    .bm-picker-btn,
    .icon-btn {
      min-height: 44px;
    }
    .bm-drop-item {
      min-height: 44px;
    }
  }

  @media (max-width: 420px) and (pointer: coarse) {
    .mode-btn,
    .view-btn,
    .bm-picker-btn,
    .icon-btn,
    .bm-drop-item {
      min-height: 30px;
    }
  }
</style>
