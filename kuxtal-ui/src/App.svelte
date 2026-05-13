<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from './components/Canvas/MapCanvas.svelte';
  import CodexTopBar from './components/Layout/CodexTopBar.svelte';
  import ModuleBar, { type ModuleId } from './components/Layout/ModuleBar.svelte';
  import FloatingContext from './components/Layout/FloatingContext.svelte';
  import Drawer from './components/Layout/Drawer.svelte';
  import Toaster from './components/Layout/Toaster.svelte';
  import DialogHost from './components/Layout/DialogHost.svelte';
  import RuleMessageStack from './components/Layout/RuleMessageStack.svelte';
  import Splash from './components/Layout/Splash.svelte';
  import Wizard from './components/Layout/Wizard.svelte';

  import PlantGuide from './components/Plants/PlantGuide.svelte';
  import Animals from './components/Animals/Animals.svelte';
  import Notebook from './components/Log/Notebook.svelte';
  import RulesEditor from './components/Heredado/RulesEditor.svelte';
  import Saberes from './components/Heredado/Saberes.svelte';
  import Stock from './components/Resources/Stock.svelte';
  import Calendars from './components/Calendars/Calendars.svelte';
  import Dashboard from './components/Analysis/Dashboard.svelte';
  import ComunidadPlaceholder from './components/Comunidad/ComunidadPlaceholder.svelte';
  import Protocolo from './components/Protocol/Protocolo.svelte';
  import Cosecha from './components/Protocol/Cosecha.svelte';
  import Settings from './components/Settings/Settings.svelte';
  import TTSButton from './components/Layout/TTSButton.svelte';

  import { initDb, exec, selectAll } from './lib/db/sqlite';
  import {
    reloadFromDb, activeLandId, dbReady, planted, zones, type PlantedRow, type ZoneRow
  } from './lib/stores/appState';
  import { runLegacyImport } from './lib/db/legacyImport';
  import { showToast } from './lib/stores/toast';
  import { loadPrefs } from './lib/stores/prefs';
  import { loadPalette } from './lib/stores/palette';
  import { nowIso } from './lib/utils/id';
  import { loadRecents, addRecentPlant } from './lib/stores/recents';

  type Phase = 'splash' | 'wizard' | 'app';

  let phase = $state<Phase>('splash');
  let initError = $state<string | null>(null);
  let landId = $state('land-default');
  let parcelName = $state('Mi finca');
  let mapMode = $state<'2d' | '3d'>('2d');
  let activeModule = $state<ModuleId | null>(null);
  let canvasRef: any = $state(null);
  let plantedRows = $state<PlantedRow[]>([]);
  let zoneRows = $state<ZoneRow[]>([]);
  let currentBasemap = $state<'streets' | 'satellite' | 'paper' | 'blank'>('paper');
  let hasRealCoordinates = $state(false);

  activeLandId.subscribe((v) => (landId = v));
  planted.subscribe((rows) => (plantedRows = rows));
  zones.subscribe((rows) => (zoneRows = rows));

  const FLAG_KEY = 'wizard.completed';

  onMount(async () => {
    try {
      await initDb();
      loadPrefs();
      loadPalette();
      loadRecents();

      const report = runLegacyImport(landId);
      if (report.imported) {
        const counts: string[] = [];
        if (report.zones) counts.push(`${report.zones} zonas`);
        if (report.plants) counts.push(`${report.plants} plantas`);
        if (report.biodiversity) counts.push(`${report.biodiversity} notas`);
        if (counts.length) {
          showToast({
            tone: 'ok',
            message: `Importé del prototipo: ${counts.join(', ')}.`,
            durationMs: 6000
          });
        }
      }
      reloadFromDb(landId);
      parcelName = loadParcelName();
      dbReady.set(true);
    } catch (err: any) {
      console.error('[kuxtal] init failed', err);
      initError = err?.message ?? 'Error al iniciar la base de datos.';
      dbReady.set(true);
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
    if (initError) {
      phase = 'app';
      return;
    }
    if (wizardCompleted()) phase = 'app';
    else phase = 'wizard';
  }

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

  function openModule(id: ModuleId | null): void {
    activeModule = id;
  }

  function onPickFromCatalog(id: string): void {
    addRecentPlant(id);
    canvasRef?.selectSpecies?.(id);
    activeModule = null;
    showToast({ message: 'Especie seleccionada. Toca el mapa para sembrarla.', tone: 'info' });
  }
</script>

<a class="skip-link" href="#main-content">Saltar al contenido</a>

{#if phase === 'splash'}
  <Splash onEnter={onSplashEnter} />
{:else if phase === 'wizard'}
  <Wizard onDone={onWizardDone} />
{:else}
  {#if initError}
    <main id="main-content" style="padding: 32px;">
      <div class="codex-card" style="padding: 22px;" role="alert">
        <h2>No pude iniciar la app</h2>
        <p class="sub" style="margin-top: 10px;">{initError}</p>
        <button class="btn btn-primary" style="margin-top: 14px;" onclick={() => location.reload()}>Reintentar</button>
      </div>
    </main>
  {:else}
    <main id="main-content" tabindex="-1">
      <MapCanvas
        bind:this={canvasRef}
        {landId}
        onOpenPlantasCatalog={() => openModule('plantas')}
      />

      <CodexTopBar
        {parcelName}
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
      />

      <FloatingContext
        {plantedRows}
        zonesCount={zoneRows.length}
        onOpenAnimales={() => openModule('animales')}
      />

      <RuleMessageStack />

      <ModuleBar active={activeModule} onOpen={openModule} />
    </main>

    <Drawer
      open={activeModule === 'plantas'}
      title="Códice de plantas"
      subtitle="Catálogo · funciones · reglas"
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'plantas'}
        <PlantGuide onPick={onPickFromCatalog} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'animales'}
      title="Animales"
      subtitle="Lo que vive en tu tierra"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'animales'}
        <Animals {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'cuaderno'}
      title="Cuaderno"
      subtitle="Voz · foto · texto"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'cuaderno'}
        <Notebook {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'calendarios'}
      title="Calendarios"
      subtitle="Cuatro saberes del tiempo"
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'calendarios'}
        <Calendars />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'heredado'}
      title="Conocimiento heredado"
      subtitle="Conocimientos tradicionales"
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'heredado'}
        <Saberes {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'saberes'}
      title="Saberes"
      subtitle="Reglas · atribución · retracción"
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'saberes'}
        <RulesEditor />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'recursos'}
      title="Recursos"
      subtitle="Inventario y materiales"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'recursos'}
        <Stock />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'analisis'}
      title="Análisis"
      subtitle="Métricas del códice"
      wide
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'analisis'}
        <Dashboard {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'comunidad'}
      title="Comunidad"
      subtitle="Próximamente"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'comunidad'}
        <ComunidadPlaceholder />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'protocolo'}
      title="Protocolo"
      subtitle="Planeación y tareas"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'protocolo'}
        <Protocolo {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'cosecha'}
      title="Cosecha"
      subtitle="Registro de producción"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'cosecha'}
        <Cosecha {landId} />
      {/if}
    </Drawer>

    <Drawer
      open={activeModule === 'ajustes'}
      title="Ajustes"
      subtitle="Paleta · accesibilidad · datos"
      onClose={() => openModule(null)}
    >
      {#if activeModule === 'ajustes'}
        <Settings />
      {/if}
    </Drawer>
  {/if}
{/if}

<Toaster />
<TTSButton />
<DialogHost />

<style>
  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
</style>
