<script lang="ts">
  import { persistenceMode, exec } from '../../lib/db/sqlite';
  import { dialogConfirm, dialogAlert, dialogPrompt } from '../../lib/stores/dialog';
  import { showToast } from '../../lib/stores/toast';
  import { installAvailable, isStandalone, triggerInstall } from '../../lib/stores/install';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import PlanCard from './PlanCard.svelte';
  import Wizard from '../Layout/Wizard.svelte';
  import MigrationModal from './MigrationModal.svelte';
  import AccessibilityControls from '../Layout/AccessibilityControls.svelte';
  import { selectAll } from '../../lib/db/sqlite';
  import { loadPlan } from '../../lib/permaculture/realize';
  import { autoLogPlants, planted, zones, persistence, lands, activeLandId, createLand, renameLand, deleteLand, setActiveLand } from '../../lib/stores/appState';
  import type { AreaUnit, ClimateProfile, Goal, SunExposure, WaterAccess } from '../../lib/permaculture/types';
  import { getLocale, setLocale, t, LOCALE_NAMES } from '../../lib/i18n/index.svelte';
  import { PRACTITIONERS, TESTERS, pick } from '../../lib/ack/participants';
  import { localLandName } from '../../lib/i18n/dataLocal';
  import { announce } from '../../lib/stores/announce';
  import { downloadCsvExport, downloadExport, importAllData, isValidExport } from '../../lib/db/exportData';
  import { palette, setPalette } from '../../lib/stores/palette';
  import { structuralConditions, clearConditions, type StructuralCondition } from '../../lib/stores/conditions';
  import { loadRemindersConfig, saveRemindersConfig, REMINDER_CATEGORIES, anyEnabled, requestNotificationPermission, notificationsGranted, type ReminderCategory, type RemindersConfig } from '../../lib/reminders/reminders';

  let activeSection = $state<'plan' | 'a11y' | 'datos' | 'acerca' | 'ack'>('plan');
  let importInput: HTMLInputElement | null = $state(null);
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
      parcelName: localLandName(inputs?.parcelName ?? structPart.parcelName ?? parcelName),
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
    showToast({ message: t('set_plan_updated'), tone: 'ok' });
  }


  // External dependencies + project links surfaced on the About / Acknowledgements
  // tabs (T1.1). Links are language-neutral.
  const ACK_LINKS = {
    // TODO(maintainer): set the real public repository URL before evaluation.
    source: 'https://github.com/melissapuerto',
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    osm: 'https://www.openstreetmap.org/copyright',
    openfreemap: 'https://openfreemap.org/',
    pfaf: 'https://pfaf.org/',
    maplibre: 'https://maplibre.org/',
    sqlite: 'https://sqlite.org/wasm/'
  };
  // Everyone who shared knowledge, and how to give something back to them.
  // Consent handling lives with the data (lib/ack/participants.ts, ICK-07/R10).

  async function clearAllData(): Promise<void> {
    const ok = await dialogConfirm({
      title: t('set_clear_q'),
      body: t('set_clear_body'),
      confirmLabel: t('set_clear_ok'),
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
      showToast({ message: t('set_cleared'), tone: 'ok' });
    } catch {
      showToast({ message: t('set_clear_err'), tone: 'error' });
    }
  }

  // ---- Live data-flow panel (T2.2): real counts of what is stored locally ----
  let dataPanelCounts = $state({ logs: 0, resources: 0 });
  function refreshDataCounts(): void {
    const q = (sql: string) => selectAll<{ n: number }>(sql)[0]?.n ?? 0;
    dataPanelCounts = {
      logs: q('SELECT COUNT(*) AS n FROM log_entry'),
      resources: q('SELECT COUNT(*) AS n FROM resource_item')
    };
  }
  $effect(() => {
    if (activeSection === 'datos') refreshDataCounts();
  });

  function condLabel(c: StructuralCondition): string {
    return c === 'supply-restricted'
      ? t('cond_supply')
      : c === 'intermittent-connection'
        ? t('cond_connection')
        : t('cond_land');
  }
  function onClearConditions(): void {
    clearConditions();
    showToast({ message: t('cond_cleared_toast'), tone: 'ok' });
  }

  // ---- Local reminders (REM-01..03) ----
  let reminders = $state<RemindersConfig>(loadRemindersConfig());
  let notifGranted = $state(notificationsGranted());
  function setReminder(cat: ReminderCategory, patch: Partial<{ enabled: boolean; everyDays: number }>): void {
    reminders = { ...reminders, [cat]: { ...reminders[cat], ...patch } };
    saveRemindersConfig(reminders);
  }
  async function askNotif(): Promise<void> {
    const p = await requestNotificationPermission();
    notifGranted = p === 'granted';
    showToast({ message: p === 'granted' ? t('rem_notif_on') : t('rem_notif_off'), tone: p === 'granted' ? 'ok' : 'info' });
  }

  // ---- Multiple canvases / lands (DC-08) ----
  async function createLandPrompt(): Promise<void> {
    const name = await dialogPrompt({ title: t('lands_new'), placeholder: t('lands_name_ph'), confirmLabel: t('lands_create'), allowEmpty: false });
    if (name == null) return;
    const id = createLand(name);
    setActiveLand(id);
    showToast({ message: t('lands_created'), tone: 'ok' });
  }
  async function renameLandPrompt(id: string, current: string): Promise<void> {
    const name = await dialogPrompt({ title: t('lands_rename'), defaultValue: current, confirmLabel: t('common_save'), allowEmpty: false });
    if (name == null) return;
    renameLand(id, name);
  }
  async function deleteLandConfirm(id: string, name: string): Promise<void> {
    const ok = await dialogConfirm({ title: t('lands_delete_q', { name }), body: t('lands_delete_body'), confirmLabel: t('common_delete'), danger: true });
    if (!ok) return;
    const wasActive = $activeLandId === id;
    deleteLand(id);
    if (wasActive) setActiveLand('land-default');
    showToast({ message: t('lands_deleted'), tone: 'ok' });
  }
  function switchLand(id: string): void {
    setActiveLand(id);
    showToast({ message: t('lands_switched'), tone: 'info' });
  }

  async function onExport(): Promise<void> {
    try {
      await downloadExport();
      showToast({ message: t('settings_data_export_ok'), tone: 'ok' });
    } catch {
      showToast({ message: t('settings_data_export_err'), tone: 'error' });
    }
  }

  async function onImportFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ok = await dialogConfirm({
      title: t('settings_data_import_confirm_title'),
      body: t('settings_data_import_confirm_body'),
      confirmLabel: t('settings_data_import_confirm_ok'),
      danger: true
    });
    if (!ok) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidExport(parsed)) {
        showToast({ message: t('settings_data_import_invalid'), tone: 'error' });
        return;
      }
      await importAllData(parsed);
      showToast({ message: t('settings_data_import_ok'), tone: 'ok' });
      setTimeout(() => location.reload(), 900);
    } catch {
      showToast({ message: t('settings_data_import_err'), tone: 'error' });
    }
  }

  function showStorageInfo(): void {
    dialogAlert({
      title: t('set_storage_title'),
      body:
        persistenceMode() === 'opfs'
          ? t('set_storage_opfs')
          : persistenceMode() === 'idb'
          ? t('set_storage_idb')
          : t('set_storage_memory')
    });
  }

  async function onInstall(): Promise<void> {
    const r = await triggerInstall();
    if (r === 'accepted') showToast({ message: t('set_install_accepted'), tone: 'ok' });
    else if (r === 'dismissed') showToast({ message: t('set_install_later'), tone: 'info' });
    else {
      await dialogAlert({
        title: t('set_install_title'),
        body: t('set_install_how')
      });
    }
  }
</script>

{#if editing && editingInitial}
  <Wizard initial={editingInitial} mode="edit" onDone={finishEdit} />
{/if}

  <nav class="set-index" aria-label={t('a11y_settings_sections')}>
  {#each [
    { id: 'plan',   lk: 'settings_tab_plan',    glyph: 'Sparkle' },
    { id: 'a11y',   lk: 'settings_tab_a11y',     glyph: 'Help'    },
    { id: 'ack',    lk: 'settings_tab_ack',       glyph: 'People'    },
    { id: 'datos',  lk: 'settings_tab_data',      glyph: 'Box'     },
    { id: 'acerca', lk: 'settings_tab_about',     glyph: 'Compass' }
  ] as s}
    <button
      type="button"
      class="set-tab"
      class:on={activeSection === s.id}
      aria-pressed={activeSection === s.id}
      onclick={() => { activeSection = s.id as any; announce(t('a11y_now_in', { name: t(s.lk as any) })); }}
    >
      <Glyph name={s.glyph as any} size={14} />
      {t(s.lk as any)}
    </button>
  {/each}
</nav>

{#if activeSection === "plan"}
  <PlanCard onEdit={startEditOnboarding} />

  <section class="card" style="margin-top: 12px;">
    <div class="label">{t('lands_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('lands_sub')}</p>
    <div class="list" style="margin-top: 8px;">
      {#each $lands as land (land.id)}
        <div class="list-item" style="justify-content: space-between; gap: 8px;">
          <button
            type="button"
            class="land-pick"
            class:on={$activeLandId === land.id}
            aria-pressed={$activeLandId === land.id}
            onclick={() => switchLand(land.id)}
          >
            <Glyph name={$activeLandId === land.id ? 'Pin' : 'Map'} size={14} />
            <span>{land.name}</span>
            {#if $activeLandId === land.id}<span class="coord">· {t('lands_active')}</span>{/if}
          </button>
          <div class="row" style="gap: 4px;">
            <button type="button" class="btn btn-sm btn-ghost" aria-label={t('lands_rename')} title={t('lands_rename')} onclick={() => renameLandPrompt(land.id, land.name)}>
              <Glyph name="Sparkle" size={12} />
            </button>
            {#if $lands.length > 1}
              <button type="button" class="btn btn-sm btn-danger" aria-label={t('lands_delete')} title={t('lands_delete')} onclick={() => deleteLandConfirm(land.id, land.name)}>
                <Glyph name="Trash" size={12} />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <button type="button" class="btn btn-accent" style="margin-top: 10px;" onclick={createLandPrompt}>
      <Glyph name="Plus" size={12} /> {t('lands_new')}
    </button>
  </section>
{/if}

{#if activeSection === 'ack'}
  <section class="card">
    <div class="label">{t('settings_ack_title')}</div>
    <p class="sub" style="margin-top: 6px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
      {t('settings_ack_text')}
    </p>

    <div class="label" style="margin-top: 14px;">{t('settings_ack_practitioners')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_ack_practitioners_intro')}</p>
    <ul class="ack-list ack-people">
      {#each PRACTITIONERS as p}
        <li>
          <span class="ack-name">{pick(p.name, getLocale())}</span>{#if p.project}<span class="ack-project"> · {pick(p.project, getLocale())}</span>{/if}
          <span class="ack-country"> ({pick(p.country, getLocale())})</span>
          {#if p.support}
            <div class="ack-support">
              {#if p.link}
                <a href={p.link} target="_blank" rel="noopener noreferrer">{pick(p.support, getLocale())}</a>
              {:else}
                {pick(p.support, getLocale())}
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="label" style="margin-top: 14px;">{t('settings_ack_testers')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_ack_testers_intro')}</p>
    <ul class="ack-list ack-people">
      {#each TESTERS as p}
        <li>
          <span class="ack-name">{pick(p.name, getLocale())}</span>{#if p.project}<span class="ack-project"> · {pick(p.project, getLocale())}</span>{/if}
          <span class="ack-country"> ({pick(p.country, getLocale())})</span>
          {#if p.support}<div class="ack-support">{pick(p.support, getLocale())}</div>{/if}
        </li>
      {/each}
    </ul>

    <div class="label" style="margin-top: 14px;">{t('settings_ack_sources')}</div>
    <ul class="ack-list">
      <li><a href={ACK_LINKS.pfaf} target="_blank" rel="noopener noreferrer">Plants For A Future</a> — {t('settings_ack_src_pfaf')}</li>
      <li>{t('settings_ack_src_regional')}</li>
      <li><a href={ACK_LINKS.osm} target="_blank" rel="noopener noreferrer">OpenStreetMap</a> — {t('settings_ack_src_osm')}</li>
    </ul>
  </section>
{/if}

{#if activeSection === 'a11y'}
  <section class="card">
    <div class="label">{t('settings_a11y_title')}</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <AccessibilityControls />
  </section>
  <section class="card" style="margin-top: 12px;">
    <div class="label">{t('settings_palette_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_palette_sub')}</p>
    <div class="row" style="margin-top: 10px; gap: 8px; flex-wrap: wrap;" role="group" aria-label={t('settings_palette_title')}>
      {#each (['codice', 'noche', 'tierra', 'cartografico', 'botanico'] as const) as pv}
        <button
          type="button"
          class="lang-opt"
          class:on={$palette === pv}
          aria-pressed={$palette === pv}
          onclick={() => setPalette(pv)}
        >
          {t(`palette_${pv}`)}
        </button>
      {/each}
    </div>
  </section>
  <section class="card" style="margin-top: 12px;">
    <div class="label">{t('settings_lang_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_lang_sub')}</p>
    <div class="row" style="margin-top: 10px; gap: 8px;" role="group" aria-label={t('settings_lang_title')}>
      {#each (['es', 'en'] as const).map((v) => ({ v, l: LOCALE_NAMES[v] })) as opt}
        <button
          type="button"
          class="lang-opt"
          class:on={getLocale() === opt.v}
          aria-pressed={getLocale() === opt.v}
          onclick={() => setLocale(opt.v as 'es' | 'en')}
        >
          {opt.l}
        </button>
      {/each}
    </div>
  </section>
{/if}

{#if activeSection === 'datos'}
  <section class="card card-warm" aria-labelledby="dataflow-h">
    <div class="label" id="dataflow-h">{t('settings_dataflow_title')}</div>
    <div class="df-grid" style="margin-top: 8px;">
      <div class="df-stat"><div class="df-n">{$planted.length}</div><div class="coord">{t('settings_dataflow_plants')}</div></div>
      <div class="df-stat"><div class="df-n">{$zones.length}</div><div class="coord">{t('settings_dataflow_zones')}</div></div>
      <div class="df-stat"><div class="df-n">{dataPanelCounts.logs}</div><div class="coord">{t('settings_dataflow_logs')}</div></div>
      <div class="df-stat"><div class="df-n">{dataPanelCounts.resources}</div><div class="coord">{t('settings_dataflow_resources')}</div></div>
    </div>
    <p class="sub" style="margin-top: 10px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
      {$persistence === 'memory' ? t('settings_dataflow_statement_memory') : t('settings_dataflow_statement')}
    </p>
    <p class="sub" style="margin-top: 6px;">{t('settings_dataflow_external')}</p>
  </section>

  {#if !$isStandalone}
    <section class="card">
      <div class="label">{t('settings_data_install_title')}</div>
      <p class="sub" style="margin-top: 6px;">{t('settings_data_install_sub')}</p>
      <button class="btn btn-primary" style="margin-top: 8px;" onclick={onInstall}>
        <Glyph name="ArrowRight" size={14} />
        {$installAvailable ? t('settings_data_install_btn') : t('settings_data_install_how')}
      </button>
    </section>
  {/if}

  <section class="card">
    <div class="label">{t('settings_data_local_title')}</div>
    <div class="row" style="gap: 8px; margin-top: 8px; flex-wrap: wrap;">
      <button class="btn" onclick={showStorageInfo}>
        <Glyph name="Help" size={14} /> {t('settings_data_storage_btn')}
      </button>
      <button class="btn btn-accent" onclick={() => (showMigrationModal = true)}>
        <Glyph name="Map" size={14} /> {t('settings_data_migrate_btn')}
      </button>
      <button class="btn btn-danger" onclick={clearAllData}>
        <Glyph name="Trash" size={14} /> {t('settings_data_delete_btn')}
      </button>
    </div>
  </section>

  <section class="card">
    <div class="label">{t('settings_data_portability_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_data_portability_sub')}</p>
    <div class="row" style="gap: 8px; margin-top: 8px; flex-wrap: wrap;">
      <button class="btn" onclick={onExport}>
        <Glyph name="ArrowRight" size={14} /> {t('settings_data_export_btn')}
      </button>
      <button class="btn" onclick={() => downloadCsvExport()}>
        <Glyph name="ArrowRight" size={14} /> {t('settings_data_export_csv_btn')}
      </button>
      <button class="btn" onclick={() => importInput?.click()}>
        <Glyph name="Box" size={14} /> {t('settings_data_import_btn')}
      </button>
      <input
        bind:this={importInput}
        type="file"
        accept="application/json,.json"
        onchange={onImportFile}
        style="display: none;"
        tabindex="-1"
        aria-hidden="true"
      />
    </div>
  </section>

  <section class="card">
    <div class="label">{t('cond_settings_title')}</div>
    {#if $structuralConditions.length}
      <ul class="ack-list">
        {#each $structuralConditions as c}<li>{condLabel(c)}</li>{/each}
      </ul>
      <button class="btn btn-danger btn-sm" style="margin-top: 8px;" onclick={onClearConditions}>
        <Glyph name="Trash" size={12} /> {t('cond_settings_clear')}
      </button>
    {:else}
      <p class="sub" style="margin-top: 6px;">{t('cond_settings_none')}</p>
    {/if}
  </section>

  <section class="card">
    <div class="label">{t('rem_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('rem_sub')}</p>
    <div class="toggle-list">
      {#each REMINDER_CATEGORIES as cat}
        <div class="toggle-row">
          <div class="toggle-text">
            <b>{t(('rem_cat_' + cat) as any)}</b>
            <span class="sub">{t(('rem_cat_' + cat + '_desc') as any)}</span>
          </div>
          <div class="row" style="gap: 8px; align-items: center;">
            {#if reminders[cat].enabled}
              <input
                class="inp"
                style="width: 60px; min-height: 36px;"
                type="number"
                min="1"
                max="60"
                value={reminders[cat].everyDays}
                onchange={(e) => setReminder(cat, { everyDays: Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1) })}
                aria-label={t('rem_every_days')}
              />
              <span class="coord">{t('rem_days')}</span>
            {/if}
            <button
              type="button"
              class="switch"
              class:on={reminders[cat].enabled}
              role="switch"
              aria-checked={reminders[cat].enabled}
              aria-label={t(('rem_cat_' + cat) as any)}
              onclick={() => setReminder(cat, { enabled: !reminders[cat].enabled })}
            >
              <span class="knob"></span>
            </button>
          </div>
        </div>
      {/each}
    </div>
    {#if anyEnabled(reminders) && !notifGranted}
      <button type="button" class="btn btn-sm" style="margin-top: 8px;" onclick={askNotif}>{t('rem_enable_notif')}</button>
    {/if}
    <div class="banner" style="margin-top: 8px;">{t('rem_note')}</div>
  </section>

  <section class="card">
    <div class="label">{t('settings_autolog_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_autolog_sub')}</p>
    <label class="row" style="gap: 8px; margin-top: 8px; align-items: center; cursor: pointer;">
      <input type="checkbox" checked={$autoLogPlants} onchange={(e) => autoLogPlants.set((e.currentTarget as HTMLInputElement).checked)} />
      <span>{t('settings_autolog_label')}</span>
    </label>
  </section>
{/if}

{#if showMigrationModal}
  <MigrationModal onClose={() => (showMigrationModal = false)} />
{/if}

{#if activeSection === 'acerca'}
  <section class="card">
    <div class="label">{t('settings_about_title')}</div>
    <p class="sub" style="margin-top: 6px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
      {t('settings_about_text')}
    </p>
    <p class="sub" style="margin-top: 8px; font-family: var(--serif); font-weight: var(--display-weight); line-height: 1.6;">
      {t('settings_about_dataflow')}
    </p>
  </section>
  <section class="card" style="margin-top: 12px;">
    <div class="label">{t('settings_about_deps_title')}</div>
    <ul class="ack-list">
      <li>{t('settings_about_dep_map')}: <a href={ACK_LINKS.osm} target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href={ACK_LINKS.openfreemap} target="_blank" rel="noopener noreferrer">OpenFreeMap</a></li>
      <li>{t('settings_about_dep_plants')}: <a href={ACK_LINKS.pfaf} target="_blank" rel="noopener noreferrer">Plants For A Future</a></li>
      <li>{t('settings_about_dep_engine')}: <a href={ACK_LINKS.maplibre} target="_blank" rel="noopener noreferrer">MapLibre</a> · <a href={ACK_LINKS.sqlite} target="_blank" rel="noopener noreferrer">SQLite WASM</a></li>
    </ul>
    <p class="sub" style="margin-top: 10px;">
      {t('settings_about_license')} <a href={ACK_LINKS.license} target="_blank" rel="noopener noreferrer">AGPL-3.0</a>
    </p>
    <a class="btn btn-ghost" href={ACK_LINKS.source} target="_blank" rel="noopener noreferrer" style="margin-top: 8px; display: inline-flex; align-items: center; gap: 6px;">
      <Glyph name="ArrowRight" size={14} /> {t('settings_about_source_btn')}
    </a>
  </section>
  <section class="card" style="margin-top: 12px;">
    <div class="label">{t('settings_feedback_title')}</div>
    <p class="sub" style="margin-top: 6px;">{t('settings_feedback_sub')}</p>
    <a
      href="mailto:melissapuerto@hotmail.com?subject=Comentarios%20Kuxtal"
      class="btn btn-ghost"
      style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;"
    >
      {t('settings_feedback_btn')}
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
    font-size: calc(10px * var(--text-scale));
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
  .toggle-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .toggle-text b { font-family: var(--serif); font-weight: 400; font-size: calc(16px * var(--text-scale)); color: var(--ink); }
  .switch {
    width: 44px; height: 24px; border-radius: 999px;
    background: var(--line-strong); border: none; position: relative; cursor: pointer; flex-shrink: 0; padding: 0;
  }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--paper); box-shadow: 0 1px 2px oklch(0.2 0.04 60 / 0.3); transition: left 0.2s var(--ease-codex); }
  .switch.on { background: var(--ocre); }
  .switch.on .knob { left: 22px; }
  :global(.a11y-reduced-motion) .switch .knob { transition: none !important; }

  .lang-opt {
    padding: 8px 20px;
    border: 1.5px solid var(--line-strong);
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink-soft);
    font-family: var(--mono);
    font-size: calc(11px * var(--text-scale));
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s var(--ease-codex);
  }
  .lang-opt:hover { background: var(--paper-warm); color: var(--ink); }
  .lang-opt.on { background: var(--ocre); border-color: var(--ocre); color: var(--paper); }

  .df-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .df-stat { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 8px 6px; text-align: center; }
  .df-n { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(26px * var(--text-scale)); line-height: 1; color: var(--ink); }
  @media (max-width: 480px) { .df-grid { grid-template-columns: repeat(2, 1fr); } }

  .ack-list { margin: 8px 0 0; padding-left: 20px; }
  .ack-list li { font-size: calc(13px * var(--text-scale)); color: var(--ink-soft); line-height: 1.6; margin: 3px 0; }
  .ack-people li { margin: 8px 0; }
  .ack-name { color: var(--ink); font-weight: 600; }
  .ack-project { color: var(--ink-soft); }
  .ack-country { color: var(--ink-soft); opacity: 0.85; }
  .ack-support { font-size: calc(12.5px * var(--text-scale)); color: var(--ink-soft); font-style: italic; margin-top: 1px; }
  /* Underline so links are distinguishable by more than colour (WCAG 1.4.1). */
  .ack-list a { color: var(--ocre-deep); text-decoration: underline; }

  .land-pick {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--ink);
    cursor: pointer; font-family: var(--sans); font-size: calc(14px * var(--text-scale));
    padding: 4px 6px; border-radius: 4px; text-align: left; min-height: 32px;
  }
  .land-pick:hover { background: var(--paper-warm); }
  .land-pick.on { font-weight: 600; }
</style>
