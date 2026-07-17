<script lang="ts">
  import { onMount } from 'svelte';
  import CodexTopBar from './components/Layout/CodexTopBar.svelte';
  import NotificationBell from './components/Layout/NotificationBell.svelte';
  import ModuleBar, { type ModuleId } from './components/Layout/ModuleBar.svelte';
  import Drawer from './components/Layout/Drawer.svelte';
  import Toaster from './components/Layout/Toaster.svelte';
  import DialogHost from './components/Layout/DialogHost.svelte';
  import RuleMessageStack from './components/Layout/RuleMessageStack.svelte';
  import Splash from './components/Layout/Splash.svelte';
  import TTSButton from './components/Layout/TTSButton.svelte';

  // Feature modules are code-split (Use Small and Slow Solutions / low-bandwidth
  // users): the shell ships without MapLibre, the plant catalog, or any module.
  // Each drawer body loads its chunk on first open; the canvas and (on first
  // run) the wizard are preloaded as soon as the phase is known.
  const loadPlantGuide = () => import('./components/Plants/PlantGuide.svelte');
  const loadCanvasInventory = () => import('./components/Canvas/CanvasInventory.svelte');
  const loadAnimals = () => import('./components/Animals/Animals.svelte');
  const loadNotebook = () => import('./components/Log/Notebook.svelte');
  const loadRulesEditor = () => import('./components/Heredado/RulesEditor.svelte');
  const loadSaberes = () => import('./components/Heredado/Saberes.svelte');
  const loadStock = () => import('./components/Resources/Stock.svelte');
  const loadCalendars = () => import('./components/Calendars/Calendars.svelte');
  const loadDashboard = () => import('./components/Analysis/Dashboard.svelte');
  const loadComunidad = () => import('./components/Comunidad/ComunidadPlaceholder.svelte');
  const loadProtocolo = () => import('./components/Protocol/Protocolo.svelte');
  const loadCosecha = () => import('./components/Protocol/Cosecha.svelte');
  const loadSettings = () => import('./components/Settings/Settings.svelte');
  const loadSuggestions = () => import('./components/Recommend/SuggestionsPanel.svelte');

  let MapCanvasC = $state<typeof import('./components/Canvas/MapCanvas.svelte').default | null>(null);
  let WizardC = $state<typeof import('./components/Layout/Wizard.svelte').default | null>(null);
  let CanvasInventoryC = $state<typeof import('./components/Canvas/CanvasInventory.svelte').default | null>(null);
  let FloatingContextC = $state<typeof import('./components/Layout/FloatingContext.svelte').default | null>(null);
  let SuggestionsPanelC = $state<typeof import('./components/Recommend/SuggestionsPanel.svelte').default | null>(null);

  async function preloadCanvas(): Promise<void> {
    const [mc, fc, ci] = await Promise.all([
      import('./components/Canvas/MapCanvas.svelte'),
      import('./components/Layout/FloatingContext.svelte'),
      loadCanvasInventory()
    ]);
    MapCanvasC = mc.default;
    FloatingContextC = fc.default;
    CanvasInventoryC = ci.default;
    // The suggestions rail is one click away on the canvas — warm it too.
    loadSuggestions().then((m) => (SuggestionsPanelC = m.default));
  }
  import { suggestionsOpen, isMobile } from './lib/stores/layout';
  import { tourCompleted } from './lib/tour/tourFlag';
  import { announce, liveMessage } from './lib/stores/announce';
  import { prefs } from './lib/stores/prefs';

  import { initDb, exec, selectAll } from './lib/db/sqlite';
  import {
    reloadFromDb, activeLandId, dbReady, planted, zones, type PlantedRow, type ZoneRow
  } from './lib/stores/appState';
  import { runLegacyImport } from './lib/db/legacyImport';
  import { showToast } from './lib/stores/toast';
  import { loadPrefs } from './lib/stores/prefs';
  import { loadPalette } from './lib/stores/palette';
  import { loadConditions } from './lib/stores/conditions';
  import { dueCategories, loadRemindersConfig, loadLastShown, markShown, notificationsGranted } from './lib/reminders/reminders';
  import { nowIso } from './lib/utils/id';
  import { loadRecents, addRecentPlant } from './lib/stores/recents';
  import {
    t, getLocale, setLocale, browserLocale, savedLocaleChoice, LOCALE_NAMES, type Locale
  } from './lib/i18n/index.svelte';
  import { localLandName } from './lib/i18n/landName';

  type Phase = 'splash' | 'wizard' | 'app';

  let phase = $state<Phase>('splash');
  let initError = $state<string | null>(null);
  let initDone = $state(false);

  let parcelName = $state('Mi finca');
  let mapMode = $state<'2d' | '3d'>('2d');
  let activeModule = $state<ModuleId | null>(null);
  let canvasRef: any = $state(null);
  // The SR-home CanvasInventory instance — the accessible target for catalog
  // picks when the map can't be used.
  let inventoryRef: any = $state(null);

  let currentBasemap = $state<'streets' | 'satellite' | 'paper' | 'blank'>('paper');
  let hasRealCoordinates = $state(false);
  // Screen-reader mode (the Settings → Accessibility toggle). When on, the
  // visual map is unusable, so we take it out of the accessibility tree and tab
  // order, skip the visual guided tour, and steer focus to the main menu.
  const srMode = $derived($prefs.screenReaderHints);

  // Store mirrors as auto-subscriptions (consistent with the drawer panels;
  // App mounts once, but this also keeps values in one reactive idiom).
  const landId = $derived($activeLandId);
  // The seeded default land name follows the language until the user renames it.
  const displayParcelName = $derived(localLandName(parcelName));
  const plantedRows = $derived($planted);
  const zoneRows = $derived($zones);

  const FLAG_KEY = 'wizard.completed';

  onMount(async () => {
    try {
      await initDb();
      loadPrefs();
      loadPalette();
      loadRecents();
      loadConditions();

      const report = runLegacyImport(landId);
      if (report.imported) {
        const counts: string[] = [];
        if (report.zones) counts.push(t('legacy_zones', { n: String(report.zones) }));
        if (report.plants) counts.push(t('legacy_plants', { n: String(report.plants) }));
        if (report.biodiversity) counts.push(t('legacy_notes', { n: String(report.biodiversity) }));
        if (counts.length) {
          showToast({
            tone: 'ok',
            message: t('app_legacy_import', { parts: counts.join(', ') }),
            durationMs: 6000
          });
        }
      }
      reloadFromDb(landId);
      parcelName = loadParcelName();
      initDone = true;
      dbReady.set(true);
    } catch (err: any) {
      console.error('[kuxtal] init failed', err);
      initError = err?.message ?? t('app_db_init_err');
      initDone = true;
    }
  });

  function loadParcelName(): string {
    try {
      const rows = selectAll<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        ['parcel.name']
      );
      if (rows[0]?.value) return JSON.parse(rows[0].value) as string;
    } catch {}
    return 'Mi finca';
  }

  function wizardCompleted(): boolean {
    try {
      const rows = selectAll<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        [FLAG_KEY]
      );
      return !!rows[0]?.value;
    } catch { return false; }
  }

  function onSplashEnter(): void {
    if (!initDone) {
      showToast({ message: t('app_loading_db'), tone: 'info' });
      return;
    }
    if (initError) {
      phase = 'app';
      return;
    }
    if (wizardCompleted()) phase = 'app';
    else phase = 'wizard';
  }

  // Warm the chunk the next phase needs. While the user reads the splash we
  // already know whether the wizard or the canvas comes next; while they fill
  // the wizard, the canvas loads in the background — so on a 2G connection the
  // heavy code downloads during the minutes the user is busy, not after.
  $effect(() => {
    if (!initDone) return;
    if (phase === 'wizard' || (phase === 'splash' && !wizardCompleted())) {
      import('./components/Layout/Wizard.svelte').then((m) => (WizardC = m.default));
      preloadCanvas();
    } else {
      preloadCanvas();
    }
  });

  function onWizardDone(name: string): void {
    parcelName = name;
    try {
      exec(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [FLAG_KEY, JSON.stringify(nowIso())]
      );
    } catch (err) {
      console.warn('persist wizard flag failed', err);
    }
    phase = 'app';
  }

  let switchingMode = $state(false);

  function setMode(m: '2d' | '3d'): void {
    if (m === mapMode || switchingMode) return;
    switchingMode = true;
    mapMode = m;
    canvasRef?.setModeExternal?.(m);
    setTimeout(() => { switchingMode = false; }, 800);
  }

  function setBasemap(b: 'streets' | 'satellite' | 'paper' | 'blank'): void {
    currentBasemap = b;
    canvasRef?.setBasemapExternal?.(b);
  }

  function fitBoundary(): void {
    canvasRef?.fitToBoundaryExternal?.();
  }

  function locateMe(): void {
    canvasRef?.locateMeExternal?.();
  }

  // Sync basemap/coordinates state from canvas
  $effect(() => {
    if (canvasRef) {
      const interval = setInterval(() => {
        currentBasemap = canvasRef?.getBasemap?.() ?? currentBasemap;
        hasRealCoordinates = canvasRef?.getHasRealCoordinates?.() ?? false;
      }, 1000);
      return () => clearInterval(interval);
    }
  });

  // Chaac guided tour. Auto-runs once on the first visit to the canvas; the
  // help button in the top bar replays it on demand.
  let tourStarted = false;
  function launchTour(): void {
    announce(t('tour_sr_hint'));
    // driver.js loads only when a tour actually starts.
    import('./lib/tour/chaacTour').then(({ startChaacTour }) => startChaacTour({ onDone: focusMainMenu }));
  }
  function focusMainMenu(): void {
    // Land a screen-reader user on the first real feature button in the bottom
    // menu — never in the (now hidden) map tools.
    const nav = document.getElementById('module-nav');
    const btn = nav?.querySelector<HTMLElement>('button:not([tabindex="-1"])');
    (btn ?? document.getElementById('main-content'))?.focus();
  }
  $effect(() => {
    if (phase === 'app' && !initError && !tourStarted) {
      tourStarted = true;
      // The visual guided tour traps and disorients screen-reader users, so it
      // never auto-runs in screen-reader mode (still available from the help
      // button for sighted users).
      if (!tourCompleted() && !srMode) {
        // Even for a user on a device screen reader who hasn't enabled SR mode,
        // announce how to leave the tour and return focus to the menu when it
        // closes, so the tour is never a dead end.
        setTimeout(() => {
          announce(t('tour_sr_hint'));
          import('./lib/tour/chaacTour').then(({ startChaacTour }) => startChaacTour({ onDone: focusMainMenu }));
        }, 700);
      }
      // Spoken welcome on first run, and every launch in screen-reader mode, so
      // a blind user is always oriented. Polite, so it waits its turn;
      // replayable anytime from Settings.
      if (!tourCompleted() || srMode) {
        setTimeout(() => announce(t('a11y_welcome')), 1000);
      }
      // In screen-reader mode, land on the accessible home heading — the main
      // feature — not the map or a buried menu.
      if (srMode) setTimeout(() => {
        (document.getElementById('sr-home-h') ?? document.getElementById('main-content'))?.focus();
      }, 1200);
      setTimeout(checkReminders, 1500);
    }
  });

  // Local reminders (REM-01..03): surface due, opt-in reminders on foreground.
  function checkReminders(): void {
    try {
      const due = dueCategories(loadRemindersConfig(), loadLastShown(), Date.now());
      if (!due.length) return;
      for (const cat of due) {
        const msg = t(('rem_due_' + cat) as any);
        showToast({ message: msg, tone: 'info', durationMs: 7000 });
        if (notificationsGranted()) {
          try { new Notification('Kuxtal', { body: msg, tag: `kuxtal-${cat}` }); } catch {}
        }
      }
      markShown(due, Date.now());
    } catch (err) {
      console.warn('[reminders] check failed', err);
    }
  }

  onMount(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && phase === 'app') checkReminders();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });

  // First visit on a non-Spanish device: the app already started in the browser's
  // language (see i18n/index.svelte.ts). Say so, and offer one tap back to Spanish.
  onMount(() => {
    if (savedLocaleChoice() !== null || browserLocale() === 'es') return;
    const other: Locale = getLocale() === 'en' ? 'es' : 'en';
    showToast({
      message: t('app_lang_auto'),
      tone: 'info',
      durationMs: 8000,
      action: { label: LOCALE_NAMES[other], onAction: () => setLocale(other) }
    });
  });

  function openModule(id: ModuleId | null): void {
    activeModule = id;
    // Heavy screen-reader orientation: on opening a panel, speak where you are
    // and what you can do there in natural language; on closing, confirm the
    // return to the canvas (there is no focus cue for that on its own).
    if (id) announce(t(`intro_${id}` as any));
    else announce(t('a11y_back_to_canvas'));
  }

  function onPickFromCatalog(id: string): void {
    addRecentPlant(id);
    canvasRef?.selectSpecies?.(id);
    activeModule = null;
    if (srMode) {
      // "Tap the map" is a dead end without sight: the map is inert in
      // screen-reader mode. Route the pick into the accessible home instead —
      // select it in "Place a plant" and put focus on the Place button (after
      // the drawer's own close-focus-restore has run), then say what happened.
      setTimeout(() => {
        inventoryRef?.chooseSpeciesById?.(id);
        announce(t('app_species_selected_sr'));
      }, 120);
    } else {
      showToast({ message: t('app_species_selected'), tone: 'info' });
    }
  }

  // Non-visual placement from the CanvasInventory panel. Routes through the
  // map's placeSpeciesAt so plant placement, companion rules and undo behave
  // identically to a map tap — just without needing to see the canvas.
  function onPlaceFromInventory(speciesId: string, lat: number, lng: number) {
    addRecentPlant(speciesId);
    return canvasRef?.placeSpeciesAt?.(speciesId, lat, lng) ?? null;
  }

  function onPickSuggestion(id: string): void {
    addRecentPlant(id);
    canvasRef?.selectSpecies?.(id);
    if ($isMobile) suggestionsOpen.set(false);
    showToast({ message: t('app_species_selected'), tone: 'info' });
  }
</script>

<a class="skip-link" href="#main-content">{t('app_skip_content')}</a>

<!-- Global screen-reader announcements (navigation + context). -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{$liveMessage}</div>

{#if phase === 'splash'}
  <Splash onEnter={onSplashEnter} />
{:else if phase === 'wizard'}
  {#if WizardC}
    <WizardC onDone={onWizardDone} />
  {:else}
    <div class="lazy-fill" aria-hidden="true"></div>
  {/if}
{:else}
  {#if initError}
    <main id="main-content" style="padding: 32px;">
      <div class="codex-card" style="padding: 22px;" role="alert">
        <h2>{t('app_init_error')}</h2>
        <p class="sub" style="margin-top: 10px;">{initError}</p>
        <button class="btn btn-primary" style="margin-top: 14px;" onclick={() => location.reload()}>{t('app_retry')}</button>
      </div>
    </main>
  {:else}
    {#if !srMode}
      <CodexTopBar
        parcelName={displayParcelName}
        mode={mapMode}
        {switchingMode}
        basemap={currentBasemap}
        {hasRealCoordinates}
        {setMode}
        setBasemap={setBasemap}
        onFitBoundary={fitBoundary}
        onLocateMe={locateMe}
        onTweaks={() => openModule('ajustes')}
        tweaksOpen={activeModule === 'ajustes'}
        onStartTour={launchTour}
      />
    {/if}

    <main id="main-content" tabindex="-1" aria-label={t('a11y_main_label')}>
      <!-- The visual map (and its drawing tools) is unusable without sight, so
           in screen-reader mode it is made inert (removed from the tab order +
           accessibility tree) and covered by the accessible home below. The map
           stays mounted and its methods still work, so the Canvas panel drives
           it. -->
      <div class="canvas-wrap" inert={srMode}>
        {#if MapCanvasC}
          <MapCanvasC
            bind:this={canvasRef}
            {landId}
            onOpenPlantasCatalog={() => openModule('plantas')}
          />
        {:else}
          <div class="lazy-fill" aria-hidden="true"></div>
        {/if}
      </div>

      {#if srMode}
        <!-- Screen-reader-first home: the land-management feature IS the main
             screen, not a panel hidden behind the map. Opaque, so the map never
             shows through. -->
        <section class="sr-home" aria-labelledby="sr-home-h">
          <div class="sr-home-inner">
            <div class="sr-home-head">
              <h1 id="sr-home-h" tabindex="-1">{t('a11y_sr_home_heading', { name: displayParcelName })}</h1>
              <!-- The visual top bar (and its notification bell) is hidden in
                   SR mode, so reminders surface here instead — same feature,
                   reachable without sight. -->
              <NotificationBell />
            </div>
            <p class="sr-home-intro">{t('a11y_sr_home_intro')}</p>
            {#if CanvasInventoryC}
              <CanvasInventoryC bind:this={inventoryRef} {landId} onPlace={onPlaceFromInventory} />
            {/if}
          </div>
        </section>
      {:else}
        <h1 class="sr-only">{t('a11y_app_h1', { name: displayParcelName })}</h1>
        <p class="sr-only">{t('a11y_canvas_intro')}</p>

        {#if !$suggestionsOpen}
          {#if FloatingContextC}
            <FloatingContextC
              {plantedRows}
              zonesCount={zoneRows.length}
              onOpenAnimales={() => openModule('animales')}
            />
          {/if}
        {/if}

        {#if $suggestionsOpen && !$isMobile}
          <aside class="sug-rail codex-card" aria-label={t('dw_sug_t')}>
            {#if SuggestionsPanelC}
              <SuggestionsPanelC onPick={onPickSuggestion} onClose={() => suggestionsOpen.set(false)} />
            {/if}
          </aside>
        {/if}

        <RuleMessageStack />
      {/if}
    </main>

    <ModuleBar active={activeModule} onOpen={openModule} {srMode} />

    <Drawer
      open={activeModule === 'plantas'}
      title={t('dw_plants_t')}
      subtitle={t('dw_plants_s')}
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'plantas'}
        {#await loadPlantGuide() then { default: C }}
          <C onPick={onPickFromCatalog} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'lienzo'}
      title={t('dw_canvas_t')}
      subtitle={t('dw_canvas_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'lienzo'}
        {#await loadCanvasInventory() then { default: C }}
          <C {landId} onPlace={onPlaceFromInventory} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'animales'}
      title={t('dw_animals_t')}
      subtitle={t('dw_animals_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'animales'}
        {#await loadAnimals() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'cuaderno'}
      title={t('dw_log_t')}
      subtitle={t('dw_log_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'cuaderno'}
        {#await loadNotebook() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'calendarios'}
      title={t('dw_cal_t')}
      subtitle={t('dw_cal_s')}
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'calendarios'}
        {#await loadCalendars() then { default: C }}
          <C />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'heredado'}
      title={t('dw_her_t')}
      subtitle={t('dw_her_s')}
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'heredado'}
        {#await loadSaberes() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'saberes'}
      title={t('dw_rules_t')}
      subtitle={t('dw_rules_s')}
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'saberes'}
        {#await loadRulesEditor() then { default: C }}
          <C />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'recursos'}
      title={t('dw_res_t')}
      subtitle={t('dw_res_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'recursos'}
        {#await loadStock() then { default: C }}
          <C />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'analisis'}
      title={t('dw_ana_t')}
      subtitle={t('dw_ana_s')}
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'analisis'}
        {#await loadDashboard() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'comunidad'}
      title={t('dw_com_t')}
      subtitle={t('dw_com_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'comunidad'}
        {#await loadComunidad() then { default: C }}
          <C />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'protocolo'}
      title={t('dw_proto_t')}
      subtitle={t('dw_proto_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'protocolo'}
        {#await loadProtocolo() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'cosecha'}
      title={t('dw_cos_t')}
      subtitle={t('dw_cos_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'cosecha'}
        {#await loadCosecha() then { default: C }}
          <C {landId} />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'ajustes'}
      title={t('dw_set_t')}
      subtitle={t('dw_set_s')}
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'ajustes'}
        {#await loadSettings() then { default: C }}
          <C />
        {/await}
      {/if}
    </Drawer>

    <Drawer
      open={$suggestionsOpen && $isMobile}
      title={t('dw_sug_t')}
      subtitle={t('dw_sug_s')}
      onClose={() => suggestionsOpen.set(false)}
    >
      {#if $suggestionsOpen && $isMobile}
        {#if SuggestionsPanelC}
          <SuggestionsPanelC onPick={onPickSuggestion} />
        {/if}
      {/if}
    </Drawer>
  {/if}
{/if}

<Toaster />
<TTSButton />
<DialogHost />

<style>
  /* Placeholder that keeps layout stable while a code-split chunk loads. */
  .lazy-fill { position: absolute; inset: 0; background: var(--paper); }

  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  /* Transparent wrapper: no box of its own (layout unchanged), but it can carry
     `inert` to take the whole map subtree out of the a11y tree + tab order. */
  .canvas-wrap { display: contents; }

  /* Screen-reader-first home: opaque full-area panel that replaces the map view
     and stops above the bottom menu so the nav stays reachable. */
  .sr-home {
    position: absolute;
    inset: 0;
    bottom: calc(var(--nav-h, 64px) + var(--safe-bottom, 0px));
    z-index: var(--z-canvas-rail, 30);
    background: var(--paper);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .sr-home-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: calc(18px + var(--safe-top, 0px)) 18px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sr-home-inner h1 {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(clamp(24px, 5vw, 34px) * var(--text-scale));
    margin: 0;
    outline: none;
  }
  .sr-home-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .sr-home-intro {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(15px * var(--text-scale));
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 0;
  }

  /* Suggestions panel shares the right rail with FloatingContext (mutually
     exclusive — see {#if !$suggestionsOpen} guard) so the two never overlap. */
  .sug-rail {
    position: absolute;
    right: calc(14px + var(--safe-right));
    top: calc(var(--topbar-h, 64px) + 12px);
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 16px);
    z-index: var(--z-bar);
    width: 340px;
    max-width: calc(100vw - 28px);
    padding: 14px 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
