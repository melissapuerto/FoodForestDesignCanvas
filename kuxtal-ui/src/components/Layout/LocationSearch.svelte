<script lang="ts">
  /**
   * Accessible place search. Type a place name, get real results (geocoded via
   * OpenStreetMap / Nominatim, the same map data the app already uses), and
   * choosing one sets the coordinates.
   *
   * The results are an ARIA combobox popup anchored to the input: they overlay
   * the content below instead of pushing it, so the list can't end up off-screen
   * or detached from the field it belongs to. Arrow keys move through it, Enter
   * picks, Escape closes — so it works without a mouse.
   *
   * Search runs as you type (debounced), which makes the old Search button dead
   * weight. In its place is "My location", which is the thing people actually
   * need next to a place field and the only way to set coordinates offline.
   */
  import { tick } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t, getLocale } from '../../lib/i18n/index.svelte';
  import { reverseGeocode } from '../../lib/map/geocode';
  import { announce } from '../../lib/stores/announce';
  import { showToast } from '../../lib/stores/toast';

  type Result = { lat: number; lng: number; label: string };

  let { onSelect }: { onSelect: (r: Result) => void } = $props();

  let query = $state('');
  let results = $state<Result[]>([]);
  let searching = $state(false);
  let locating = $state(false);
  let status = $state('');
  let open = $state(false);
  let active = $state(-1); // index of the highlighted option, -1 = none
  let inputEl: HTMLInputElement | undefined = $state();
  let rootEl: HTMLDivElement | undefined = $state();

  const listId = 'locsearch-results';
  const optId = (i: number) => `locsearch-opt-${i}`;

  async function runSearch(): Promise<void> {
    const q = query.trim();
    if (!q || searching) return;
    searching = true;
    status = t('locsearch_searching');
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': getLocale() } }
      );
      const data = await resp.json();
      results = (Array.isArray(data) ? data : [])
        .map((d: any) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: String(d.display_name ?? '') }))
        .filter((r: Result) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.label);
      status = results.length ? t('locsearch_results_count', { n: String(results.length) }) : t('locsearch_no_results');
      open = results.length > 0;
      active = -1;
    } catch {
      results = [];
      open = false;
      status = t('locsearch_error');
    } finally {
      searching = false;
      announce(status);
    }
  }

  function choose(r: Result): void {
    suppressSearch = true; // don't immediately re-search for the label we just filled in
    onSelect(r);
    query = r.label;
    results = [];
    open = false;
    active = -1;
    status = t('locsearch_selected', { name: r.label });
    announce(status);
    inputEl?.focus();
  }

  /** GPS. Reverse-geocode for a human label, but still set coordinates if that fails. */
  function useGps(): void {
    if (!navigator.geolocation) {
      showToast({ message: t('geo_gps_unavailable'), tone: 'warn' });
      return;
    }
    locating = true;
    status = t('locsearch_locating');
    announce(status);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const label = await reverseGeocode(lat, lng);
        suppressSearch = true;
        query = label;
        results = [];
        open = false;
        locating = false;
        onSelect({ lat, lng, label });
        status = t('locsearch_selected', { name: label });
        announce(status);
      },
      (err) => {
        locating = false;
        status = err.code === err.PERMISSION_DENIED ? t('geo_denied') : t('geo_gps_unavailable');
        showToast({ message: status, tone: 'warn' });
        announce(status);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function onKey(e: KeyboardEvent): Promise<void> {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
      active = -1;
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      open = true;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + delta + results.length) % results.length;
      await tick();
      // scrollIntoView doesn't exist in jsdom (unit tests); guard the call.
      rootEl?.querySelector<HTMLElement>(`#${optId(active)}`)?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && results[active]) choose(results[active]);
      else runSearch();
    }
  }

  // Auto-search as the user types (debounced). Min length keeps requests
  // reasonable for the geocoder.
  let suppressSearch = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const q = query.trim();
    if (suppressSearch) { suppressSearch = false; return; }
    if (debounceTimer) clearTimeout(debounceTimer);
    if (q.length < 3) { results = []; open = false; return; }
    debounceTimer = setTimeout(() => runSearch(), 500);
    return () => { if (debounceTimer) clearTimeout(debounceTimer); };
  });

  function onBlur(e: FocusEvent): void {
    // Close only when focus actually leaves the widget, so clicking a result works.
    const next = e.relatedTarget as Node | null;
    if (next && rootEl?.contains(next)) return;
    open = false;
    active = -1;
  }
</script>

<div class="locsearch" bind:this={rootEl} onfocusout={onBlur}>
  <label for="locsearch-input">{t('locsearch_label')}</label>
  <div class="locsearch-row">
    <div class="locsearch-field">
      <input
        bind:this={inputEl}
        id="locsearch-input"
        class="inp"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
        bind:value={query}
        onkeydown={onKey}
        placeholder={t('locsearch_placeholder')}
        aria-describedby="locsearch-status"
        autocomplete="off"
      />
      {#if open && results.length}
        <ul id={listId} class="locsearch-results" role="listbox" aria-label={t('locsearch_results_label')}>
          {#each results as r, i (r.label)}
            <li role="none">
              <button
                type="button"
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                class="locsearch-result"
                class:active={i === active}
                onmouseenter={() => (active = i)}
                onclick={() => choose(r)}
              >
                {r.label}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <button
      type="button"
      class="btn locsearch-gps"
      onclick={useGps}
      disabled={locating}
      aria-label={t('locsearch_gps_aria')}
    >
      <Glyph name="Pin" size={14} />
      {locating ? t('locsearch_locating_short') : t('locsearch_gps')}
    </button>
  </div>

  <!-- Spoken + visible status: "Searching…", "5 results…", "You chose …". -->
  <p id="locsearch-status" class="locsearch-status" role="status" aria-live="polite">{status}</p>
</div>

<style>
  .locsearch { display: flex; flex-direction: column; gap: 6px; }
  .locsearch label {
    font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ink-soft);
  }
  .locsearch-row { display: flex; gap: 8px; align-items: flex-start; }
  /* Anchor for the popup: the list is positioned against the field, not the page. */
  .locsearch-field { position: relative; flex: 1; min-width: 0; }
  .locsearch-field .inp { width: 100%; }
  .locsearch-gps { min-height: 44px; white-space: nowrap; flex-shrink: 0; }
  .locsearch-status { margin: 2px 0 0; font-size: calc(13px * var(--text-scale)); color: var(--ink-soft); min-height: 1.1em; }
  .locsearch-status:empty { display: none; }

  .locsearch-results {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: var(--z-popover);
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    box-shadow: var(--shadow-md);
    max-height: 240px;
    overflow-y: auto;
  }
  .locsearch-result {
    display: block; width: 100%; text-align: left;
    padding: 10px 12px; min-height: 44px;
    background: transparent; border: none; border-bottom: 1px solid var(--line);
    color: var(--ink); font-size: calc(14px * var(--text-scale)); cursor: pointer;
  }
  .locsearch-result:last-child { border-bottom: none; }
  .locsearch-result:hover,
  .locsearch-result.active { background: var(--paper-warm); }
  .locsearch-result:focus-visible { outline: 2px solid var(--ocre-deep); outline-offset: -2px; }
</style>
