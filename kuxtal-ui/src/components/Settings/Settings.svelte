<script lang="ts">
  import { prefs, setPref, type AccessibilityPrefs } from '../../lib/stores/prefs';
  import { palette, setPalette, type Palette } from '../../lib/stores/palette';
  import { persistenceMode, exec } from '../../lib/db/sqlite';
  import { dialogConfirm, dialogAlert } from '../../lib/stores/dialog';
  import { showToast } from '../../lib/stores/toast';
  import { installAvailable, isStandalone, triggerInstall } from '../../lib/stores/install';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import PlanCard from './PlanCard.svelte';
  import Wizard from '../Layout/Wizard.svelte';
  import MigrationModal from './MigrationModal.svelte';
  import { selectAll } from '../../lib/db/sqlite';
  import { loadPlan } from '../../lib/permaculture/realize';
  import { autoLogPlants } from '../../lib/stores/appState';
  import type { AreaUnit, ClimateProfile, Goal, SunExposure, WaterAccess } from '../../lib/permaculture/types';

  let activeSection = $state<'plan' | 'paleta' | 'a11y' | 'datos' | 'acerca'>('plan');
  let editing = $state(false);
  let editingInitial = $state<any>(null);
  let showMigrationModal = $state(false);

  function loadOnboardingDraft(): void {
    let parcelName = 'Mi finca';
    try {
      const rows = selectAll<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['parcel.name']);
      if (rows[0]?.value) parcelName = JSON.parse(rows[0].value) as string;
    } catch {}

    const plan = loadPlan();
    const inputs = plan?.inputs;

    type StructEntry = {
      parcelName?: string;
      coordinates?: string | null;
      sun?: SunExposure;
      water?: WaterAccess;
      soil?: string;
      humidity?: string;
      altitude?: string;
    };

    let structPart: StructEntry = {};
    let location = '';
    let climate: ClimateProfile = 'desconocido';
    let areaValue = 1;
    let areaUnit: AreaUnit = 'ha';
    let goals: Goal[] = ['alimento'];

    try {
      const orow = selectAll<{
        location: string | null;
        size_value: string | null;
        size_unit: string | null;
        climate: string | null;
        goals: string | null;
        structural: string | null;
      }>('SELECT location, size_value, size_unit, climate, goals, structural FROM onboarding WHERE id = 1');
      const o = orow[0];
      if (o) {
        location = o.location ?? '';
        if (o.size_value) areaValue = parseFloat(o.size_value) || areaValue;
        if (o.size_unit === 'm2' || o.size_unit === 'ha' || o.size_unit === 'acre') areaUnit = o.size_unit;
        if (o.climate) {
          const arr = JSON.parse(o.climate) as string[];
          if (arr[0]) climate = arr[0] as ClimateProfile;
        }
        if (o.goals) goals = (JSON.parse(o.goals) as Goal[]) ?? goals;
        if (o.structural) {
          const arr = JSON.parse(o.structural) as StructEntry[];
          if (arr[0]) structPart = arr[0];
        }
      }
    } catch {}

    let lat = '';
    let lng = '';
    if (inputs?.lat != null && inputs?.lng != null) {
      lat = String(inputs.lat);
      lng = String(inputs.lng);
    } else if (structPart.coordinates) {
      const m = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/.exec(structPart.coordinates);
      if (m) { lat = m[1]; lng = m[2]; }
    }

    editingInitial = {
      parcelName: inputs?.parcelName ?? structPart.parcelName ?? parcelName,
      location: inputs?.location ?? location,
      lat: inputs?.lat != null ? String(inputs.lat) : lat,
      lng: inputs?.lng != null ? String(inputs.lng) : lng,
      areaValue: inputs?.areaValue ?? areaValue,
      areaUnit: (inputs?.areaUnit ?? areaUnit) as AreaUnit,
      climate: (inputs?.climate ?? climate) as ClimateProfile,
      sunExposure: (inputs?.sunExposure ?? structPart.sun ?? 'parcial') as SunExposure,
      waterAccess: (inputs?.waterAccess ?? structPart.water ?? 'lluvia') as WaterAccess,
      soil: inputs?.soil ?? structPart.soil ?? '',
      humidity: inputs?.humidity ?? structPart.humidity ?? '',
      altitude: inputs?.altitude ?? structPart.altitude ?? '',
      goals: (inputs?.goals ?? goals) as Goal[]
    };
  }

  function startEditOnboarding(): void {
    loadOnboardingDraft();
    editing = true;
  }

  function finishEdit(): void {
    editing = false;
    editingInitial = null;
    showToast({ message: 'Tu plan se actualizó.', tone: 'ok' });
  }

  type Toggle = { key: keyof AccessibilityPrefs; label: string; description: string };

  const toggles: Toggle[] = [
    { key: 'largeText', label: 'Texto grande', description: 'Aumenta el tamaño de letra en toda la app.' },
    { key: 'highContrast', label: 'Alto contraste', description: 'Más contraste para baja visión.' },
    { key: 'reducedMotion', label: 'Reducir animaciones', description: 'Desactiva transiciones para reducir mareo.' },
    { key: 'dyslexiaFont', label: 'Fuente para dislexia', description: 'Tipografía con espaciado amplio y caracteres claros.' },
    { key: 'screenReaderHints', label: 'Pistas para lector de pantalla', description: 'Añade descripciones extra para tecnología asistiva.' },
    { key: 'showTutorialOnStart', label: 'Mostrar tutorial al abrir', description: 'Muestra el tutorial breve cada vez que abres la app.' }
  ];

  const palettes: Array<{ v: Palette; l: string; c: string }> = [
    { v: 'codice', l: 'Códice', c: 'oklch(0.62 0.16 55)' },
    { v: 'tierra', l: 'Tierra', c: 'oklch(0.58 0.16 45)' },
    { v: 'cartografico', l: 'Cartográfico', c: 'oklch(0.50 0.16 30)' },
    { v: 'botanico', l: 'Botánico', c: 'oklch(0.65 0.15 95)' }
  ];

  async function clearAllData(): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Borrar todos los datos?',
      body: 'Esta acción no se puede deshacer. Eliminará plantas, zonas, notas, recursos y reglas que hayas creado.',
      confirmLabel: 'Sí, borrar todo',
      danger: true
    });
    if (!ok) return;
    try {
      exec('DELETE FROM planted');
      exec('DELETE FROM zone');
      exec('DELETE FROM animal_observation');
      exec('DELETE FROM log_entry');
      exec('DELETE FROM biodiversity_note');
      exec('DELETE FROM resource_item');
      exec('DELETE FROM rule WHERE is_user_owned = 1');
      exec('UPDATE land SET boundary_geojson = NULL, boundary_closed = 0');
      showToast({ message: 'Datos borrados. Recarga la app para empezar de cero.', tone: 'ok' });
    } catch {
      showToast({ message: 'No pude borrar los datos.', tone: 'error' });
    }
  }

  function showStorageInfo(): void {
    dialogAlert({
      title: 'Almacenamiento local',
      body:
        persistenceMode() === 'opfs'
          ? 'Tus datos se guardan en el almacenamiento persistente del navegador (OPFS). Funciona sin conexión y se mantiene entre sesiones.'
          : 'Tu navegador no soporta OPFS, así que estamos en modo memoria. Los datos se borrarán al cerrar la pestaña. Para persistir, instala la app o usa Chrome/Firefox actualizados.'
    });
  }

  async function onInstall(): Promise<void> {
    const r = await triggerInstall();
    if (r === 'accepted') showToast({ message: 'Instalando Kuxtal en tu dispositivo.', tone: 'ok' });
    else if (r === 'dismissed') showToast({ message: 'Puedes instalar más tarde desde el menú del navegador.', tone: 'info' });
    else {
      await dialogAlert({
        title: 'Instalación',
        body: 'Busca "Instalar app" o "Agregar a pantalla de inicio" en el menú de tu navegador.'
      });
    }
  }
</script>

{#if editing && editingInitial}
  <Wizard initial={editingInitial} mode="edit" onDone={finishEdit} />
{/if}

<nav class="set-index" aria-label="Secciones de ajustes">
  {#each [
    { id: 'plan', label: 'Mi plan', glyph: 'Sparkle' },
    { id: 'paleta', label: 'Paleta', glyph: 'Layers' },
    { id: 'a11y', label: 'Accesibilidad', glyph: 'Help' },
    { id: 'datos', label: 'Datos', glyph: 'Box' },
    { id: 'acerca', label: 'Acerca', glyph: 'Compass' }
  ] as s}
    <button
      type="button"
      class="set-tab"
      class:on={activeSection === s.id}
      aria-pressed={activeSection === s.id}
      onclick={() => (activeSection = s.id as any)}
    >
      <Glyph name={s.glyph as any} size={14} />
      {s.label}
    </button>
  {/each}
</nav>

{#if activeSection === 'plan'}
  <PlanCard onEdit={startEditOnboarding} />
{/if}

{#if activeSection === 'paleta'}
  <section class="card-warm card">
    <div class="label">Paleta del códice</div>
    <p class="sub" style="margin-top: 6px;">Elige el aire visual de Kuxtal.</p>
    <div class="palette-grid" role="radiogroup" aria-label="Paleta de colores">
      {#each palettes as p}
        <button
          type="button"
          class="palette-card"
          class:on={$palette === p.v}
          role="radio"
          aria-checked={$palette === p.v}
          onclick={() => setPalette(p.v)}
        >
          <span class="palette-swatch" style="background: {p.c};"></span>
          <span>{p.l}</span>
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if activeSection === 'a11y'}
  <section class="card">
    <div class="label">Accesibilidad</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <div class="toggle-list">
      {#each toggles as tg}
        <label class="toggle-row">
          <div class="toggle-text">
            <b>{tg.label}</b>
            <span class="sub">{tg.description}</span>
          </div>
          <button
            type="button"
            class="switch"
            class:on={$prefs[tg.key]}
            role="switch"
            aria-checked={$prefs[tg.key]}
            aria-label={tg.label}
            onclick={() => setPref(tg.key, !$prefs[tg.key])}
          >
            <span class="knob"></span>
          </button>
        </label>
      {/each}
    </div>
  </section>
{/if}

{#if activeSection === 'datos'}
  {#if !$isStandalone}
    <section class="card">
      <div class="label">Instalar Kuxtal</div>
      <p class="sub" style="margin-top: 6px;">
        Instala la app en tu pantalla de inicio para abrirla con un toque y usarla sin conexión.
      </p>
      <button class="btn btn-primary" style="margin-top: 8px;" onclick={onInstall}>
        <Glyph name="ArrowRight" size={14} />
        {$installAvailable ? 'Instalar app' : 'Cómo instalar en este navegador'}
      </button>
    </section>
  {/if}

  <section class="card">
    <div class="label">Datos locales</div>
    <div class="row" style="gap: 8px; margin-top: 8px; flex-wrap: wrap;">
      <button class="btn" onclick={showStorageInfo}>
        <Glyph name="Help" size={14} /> Estado de almacenamiento
      </button>
      <button class="btn btn-accent" onclick={() => (showMigrationModal = true)}>
        <Glyph name="Map" size={14} /> Migrar tipo de lienzo
      </button>
      <button class="btn btn-danger" onclick={clearAllData}>
        <Glyph name="Trash" size={14} /> Borrar todos mis datos
      </button>
    </div>
  </section>

  <section class="card">
    <div class="label">Registro automático</div>
    <p class="sub" style="margin-top: 6px;">
      Si lo activas, cada vez que siembres o quites una planta se creará una entrada en el cuaderno con la especie, fecha y ubicación.
    </p>
    <label class="row" style="gap: 8px; margin-top: 8px; align-items: center; cursor: pointer;">
      <input type="checkbox" checked={$autoLogPlants} onchange={(e) => autoLogPlants.set((e.currentTarget as HTMLInputElement).checked)} />
      <span>Registrar siembras y eliminaciones en el Cuaderno</span>
    </label>
  </section>
{/if}

{#if showMigrationModal}
  <MigrationModal onClose={() => (showMigrationModal = false)} />
{/if}

{#if activeSection === 'acerca'}
  <section class="card">
    <div class="label">Acerca de Kuxtal</div>
    <p class="sub" style="margin-top: 6px; font-family: var(--serif); line-height: 1.6;">
      Kuxtal es un códice viviente para que cualquier persona pueda registrar y cuidar su tierra,
      incluso sin conexión. Todo lo que guardas vive en tu dispositivo.
    </p>
  </section>

  <section class="card" style="margin-top: 12px;">
    <div class="label">Enviar comentarios</div>
    <p class="sub" style="margin-top: 6px;">
      ¿Algo no funciona, falta una función, o quieres dejar de usar la app? Avísanos —
      tu comentario nos ayuda a decidir qué simplificar o quitar.
    </p>
    <a
      href="mailto:hola@kuxtal.example?subject=Comentarios%20Kuxtal"
      class="btn btn-ghost"
      style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;"
    >
      Escribir comentarios
    </a>
  </section>
{/if}

<style>
  .set-index {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    gap: 4px;
    padding: 8px 0;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
    margin: -4px 0 6px;
    min-height: 44px;
    flex-shrink: 0;
  }
  .set-tab {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ink-soft);
    padding: 6px 11px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .set-tab:hover { background: var(--paper-warm); }
  .set-tab.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .palette-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 10px; }
  .palette-card {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; cursor: pointer; text-align: left;
    background: var(--paper); border: 1.4px solid var(--line);
    color: var(--ink); border-radius: 4px;
    font-family: var(--sans); font-size: 13px;
  }
  .palette-card:hover { background: var(--paper-warm); }
  .palette-card.on { border-color: var(--ink); background: var(--paper-warm); }
  .palette-swatch { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--ink); flex-shrink: 0; }

  .toggle-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .toggle-text b { font-family: var(--serif); font-weight: 400; font-size: 16px; color: var(--ink); }
  .switch {
    width: 44px; height: 24px; border-radius: 999px;
    background: var(--line-strong); border: none; position: relative; cursor: pointer; flex-shrink: 0; padding: 0;
  }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--paper); box-shadow: 0 1px 2px oklch(0.2 0.04 60 / 0.3); transition: left 0.2s var(--ease-codex); }
  .switch.on { background: var(--ocre); }
  .switch.on .knob { left: 22px; }
  :global(.a11y-reduced-motion) .switch .knob { transition: none !important; }
</style>
