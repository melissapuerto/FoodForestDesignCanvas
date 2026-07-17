<script lang="ts">
  import { untrack, tick } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { exec, selectAll } from '../../lib/db/sqlite';
  import { nowIso } from '../../lib/utils/id';
  import { showToast } from '../../lib/stores/toast';
  import { suggestPlan } from '../../lib/permaculture/engine';
  import { savePlan, materializeFromPlan } from '../../lib/permaculture/realize';
  import { inferClimateFromLat, siteUsdaZone } from '../../lib/climate/hardiness';
  import {
    type ClimateProfile, type SunExposure, type WaterAccess,
    type AreaUnit, type Goal, type Plan, toM2, fromM2, AREA_UNITS, areaLabel, densityLabel
  } from '../../lib/permaculture/types';
  import { reloadFromDb } from '../../lib/stores/appState';
  import LocationPicker from './LocationPicker.svelte';
  import LocationSearch from './LocationSearch.svelte';
  import { reverseGeocode } from '../../lib/map/geocode';
  import SelectWithOther from './SelectWithOther.svelte';
  import { formatMeters } from '../../lib/utils/format';
  import { requestPushPermission, subscribeToPush, isPushEnabled, setPushEnabled } from '../../lib/push';
  import { persistenceMode } from '../../lib/db/sqlite';
  import { t, type TranslationKey } from '../../lib/i18n/index.svelte';
  import { canonicalLandName, localLandName } from '../../lib/i18n/dataLocal';
  import { formatNumber } from '../../lib/utils/dates';
  import { announce } from '../../lib/stores/announce';
  import { prefs } from '../../lib/stores/prefs';
  import { get } from 'svelte/store';
  import { structuralConditions, saveConditions, type StructuralCondition } from '../../lib/stores/conditions';

  let {
    onDone,
    initial,
    mode = 'first-run'
  }: {
    onDone: (parcelName: string) => void;
    initial?: Partial<{
      parcelName: string;
      location: string;
      lat: string;
      lng: string;
      areaValue: number;
      areaUnit: AreaUnit;
      climate: ClimateProfile;
      sunExposure: SunExposure;
      waterAccess: WaterAccess;
      soil: string;
      humidity: string;
      altitude: string;
      goals: Goal[];
    }>;
    mode?: 'first-run' | 'edit';
  } = $props();

  type StepId = 'name' | 'place' | 'size' | 'char' | 'goals' | 'challenges' | 'reminder' | 'preview' | 'ready';

  const steps: Array<{ id: StepId; title: string; sub: string }> = $derived([
    { id: 'name', title: t('wiz_st_name_title'), sub: t('wiz_st_name_sub') },
    { id: 'place', title: t('wiz_st_place_title'), sub: t('wiz_st_place_sub') },
    { id: 'size', title: t('wiz_st_size_title'), sub: t('wiz_st_size_sub') },
    { id: 'char', title: t('wiz_st_char_title'), sub: t('wiz_st_char_sub') },
    { id: 'goals', title: t('wiz_st_goals_title'), sub: t('wiz_st_goals_sub') },
    { id: 'challenges', title: t('wiz_st_challenges_title'), sub: t('wiz_st_challenges_sub') },
    { id: 'reminder', title: t('wiz_st_reminder_title'), sub: t('wiz_st_reminder_sub') },
    { id: 'preview', title: t('wiz_st_preview_title'), sub: t('wiz_st_preview_sub') },
    { id: 'ready', title: t('wiz_st_ready_title'), sub: t('wiz_st_ready_sub') }
  ]);

  let step = $state(0);
  // In screen-reader mode the embedded maps are unusable, so the onboarding
  // drops them and relies on the accessible place search, GPS and coordinates.
  const srMode = $derived($prefs.screenReaderHints);

  // ---- Inputs (seeded from props once, then independent) ----
  const seed = untrack(() => ({
    parcelName: localLandName(initial?.parcelName ?? 'Mi finca'),
    location: initial?.location ?? '',
    lat: initial?.lat ?? '',
    lng: initial?.lng ?? '',
    areaValue: initial?.areaValue ?? 1,
    areaUnit: (initial?.areaUnit ?? 'ha') as AreaUnit,
    climate: (initial?.climate ?? 'desconocido') as ClimateProfile,
    sunExposure: (initial?.sunExposure ?? 'parcial') as SunExposure,
    waterAccess: (initial?.waterAccess ?? 'lluvia') as WaterAccess,
    region: (initial as any)?.region ?? '',
    microclimates: (initial as any)?.microclimates ?? ([] as string[]),
    soil: initial?.soil ?? '',
    humidity: initial?.humidity ?? '',
    altitude: initial?.altitude ?? '',
    goals: initial?.goals ?? (['alimento'] as Goal[]),
    isEdit: mode === 'edit'
  }));
  let parcelName = $state(seed.parcelName);
  let location = $state(seed.location);

  // Tester bug #2: dragging the pin (or tapping the map / using GPS) moved the
  // geopoint but the address text kept describing the old place. Refresh the
  // address from wherever the pin actually lands; offline it falls back to
  // plain coordinates, which is still true.
  let pinMoveSeq = 0;
  async function onPinMoved(c: { lat: number; lng: number }): Promise<void> {
    const seq = ++pinMoveSeq;
    const name = await reverseGeocode(c.lat, c.lng);
    // A newer drag may have finished while we awaited — keep only the latest.
    if (seq === pinMoveSeq) location = name;
  }
  let lat = $state(seed.lat);
  let lng = $state(seed.lng);
  let areaValue = $state(seed.areaValue);
  let areaUnit = $state<AreaUnit>(seed.areaUnit);
  let climate = $state<ClimateProfile>(seed.climate);
  let sunExposure = $state<SunExposure>(seed.sunExposure);
  let waterAccess = $state<WaterAccess>(seed.waterAccess);
  let region = $state<string>(seed.region);
  let microclimates = $state<string[]>(seed.microclimates);
  let soil = $state(seed.soil);
  let humidity = $state(seed.humidity);
  let altitude = $state(seed.altitude);
  let goals = $state<Goal[]>(seed.goals);
  let challenges = $state<string[]>([]);
  let challengeNote = $state('');
  // Structural-condition flags (ONB-06). Prefilled from the local store so the
  // edit flow shows what was previously declared.
  let conditions = $state<StructuralCondition[]>(get(structuralConditions));
  let reminder = $state('');
  let budget = $state('');
  let createBoundary = $state(!seed.isEdit);
  let createZones = $state(!seed.isEdit);
  let createPlants = $state(!seed.isEdit);
  let pushOptIn = $state(!isPushEnabled()); // default on for first run
  let pushSupported = $state('Notification' in window && 'PushManager' in window);

  // ---- Validation per step ----
  let placeValid = $derived(true); // location is now optional
  let sizeValid = $derived(areaValue > 0 && Number.isFinite(areaValue));
  let goalsValid = $derived(true);

  function canAdvance(): boolean {
    const id = steps[step].id;
    if (id === 'place') return placeValid;
    if (id === 'size') return sizeValid;
    if (id === 'goals') return goalsValid;
    return true;
  }

  function toggleGoal(g: Goal): void {
    goals = goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g];
  }

  // ---- Computed plan (only when entering preview) ----
  let plan = $state<Plan | null>(null);
  function recomputePlan(): void {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    let effectiveClimate = climate;
    if (Number.isFinite(la) && climate === 'desconocido') {
      effectiveClimate = inferClimateFromLat(la);
    }
    plan = suggestPlan({
      parcelName: canonicalLandName(parcelName),
      location: location.trim(),
      lat: Number.isFinite(la) ? la : null,
      lng: Number.isFinite(ln) ? ln : null,
      areaValue, areaUnit,
      climate: effectiveClimate, sunExposure, waterAccess,
      region: region.trim(),
      microclimates,
      soil: soil.trim(),
      humidity: humidity.trim(),
      altitude: altitude.trim(),
      goals,
      challenges,
      budget: budget || undefined
    });
  }

  const inferredUsdaZone = $derived.by(() => {
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (!Number.isFinite(la)) return null;
    let effectiveClimate = climate;
    if (climate === 'desconocido') effectiveClimate = inferClimateFromLat(la);
    return siteUsdaZone({
      parcelName: '',
      location: '',
      lat: la,
      lng: Number.isFinite(ln) ? ln : null,
      areaValue: 1,
      areaUnit: 'ha',
      climate: effectiveClimate,
      sunExposure,
      waterAccess,
      region: '',
      microclimates: [],
      soil,
      humidity,
      altitude,
      goals
    });
  });

  function persistOnboarding(): void {
    exec(
      `INSERT OR REPLACE INTO onboarding (
         id, location, size_value, size_unit, climate, climate_note,
         goals, goal_note, challenges, challenge_note,
         structural, reminder, budget, updated_at
       ) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        location || null,
        String(areaValue),
        areaUnit,
        JSON.stringify([climate]),
        null,
        JSON.stringify(goals),
        null,
        JSON.stringify(challenges), challengeNote || null,
        JSON.stringify([{
          parcelName,
          coordinates: lat && lng ? `${lat}, ${lng}` : null,
          sun: sunExposure, water: waterAccess,
          soil, humidity, altitude
        }]),
        reminder || null, budget || null, nowIso()
      ]
    );

    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['parcel.name', JSON.stringify(canonicalLandName(parcelName))]
    );

    const existing = selectAll<{ id: string }>('SELECT id FROM land WHERE id = ?', ['land-default']);
    if (existing.length) {
      exec('UPDATE land SET name = ?, updated_at = ? WHERE id = ?', [canonicalLandName(parcelName), nowIso(), 'land-default']);
    }

    // ONB-06: persist the structural-condition flags locally (never sent).
    saveConditions(conditions);
  }

  function realizePlan(): { zones: number; boundary: boolean; plants: number } {
    if (!plan || (!createBoundary && !createZones && !createPlants)) {
      return { zones: 0, boundary: false, plants: 0 };
    }
    const centerLat = parseFloat(lat) || 0;
    const centerLng = parseFloat(lng) || 0;
    const result = materializeFromPlan({
      plan,
      landId: 'land-default',
      centerLat,
      centerLng,
      createBoundary,
      createZones,
      createPlants
    });
    return {
      zones: result.zonesCreated,
      boundary: result.boundaryCreated,
      plants: result.plantsCreated
    };
  }

  function next(): void {
    if (!canAdvance()) {
      showToast({ message: t('wiz_toast_required'), tone: 'warn' });
      return;
    }
    const cur = steps[step].id;
    if (cur === 'reminder') recomputePlan();
    if (cur === 'ready') {
      finishWizard();
      return;
    }
    if (cur === 'preview') {
      finishWizard();
      return;
    }
    step += 1;
  }

  function finishWizard(): void {
    try {
      persistOnboarding();
      if (plan) savePlan(plan);
      const realized = realizePlan();
      reloadFromDb('land-default');
      if (realized.zones || realized.boundary || realized.plants) {
        const parts: string[] = [];
        if (realized.boundary) parts.push(t('wiz_part_boundary'));
        if (realized.zones) parts.push(t('wiz_part_zones', { n: String(realized.zones) }));
        if (realized.plants) parts.push(t('wiz_part_plants', { n: String(realized.plants) }));
        const message = t('wiz_toast_planted', { parts: parts.join(' + ') });
        showToast({ message, tone: 'ok', durationMs: 5500 });
        announce(message);
      } else {
        showToast({ message: t('wiz_toast_ready'), tone: 'ok' });
      }
    } catch (err) {
      console.warn('persist onboarding failed', err);
      showToast({ message: t('wiz_toast_partial'), tone: 'warn' });
    }
    if (pushOptIn && pushSupported) {
      requestPushPermission().then(granted => {
        if (granted) {
          setPushEnabled(true);
          subscribeToPush().catch(() => null);
        }
      });
    }
    onDone(canonicalLandName(parcelName));
  }

  function back(): void { if (step > 0) step -= 1; }

  function skip(): void {
    try { persistOnboarding(); } catch {}
    onDone(canonicalLandName(parcelName));
  }

  // ---- Helpers (reactive to locale) ----
  const climateOptions = $derived<Array<{ v: ClimateProfile; l: string; sub: string }>>([
    { v: 'tropical-humedo', l: t('climate_tropical_humedo'), sub: t('climate_tropical_humedo_sub') },
    { v: 'tropical-seco', l: t('climate_tropical_seco'), sub: t('climate_tropical_seco_sub') },
    { v: 'subtropical', l: t('climate_subtropical'), sub: t('climate_subtropical_sub') },
    { v: 'templado', l: t('climate_templado'), sub: t('climate_templado_sub') },
    { v: 'frio', l: t('climate_frio'), sub: t('climate_frio_sub') },
    { v: 'desconocido', l: t('climate_desconocido'), sub: t('climate_desconocido_sub') }
  ]);

  const sunOptions = $derived<Array<{ v: SunExposure; l: string }>>([
    { v: 'completo', l: t('sun_completo') },
    { v: 'parcial', l: t('sun_parcial') },
    { v: 'sombra', l: t('sun_sombra') },
    { v: 'mixto', l: t('sun_mixto') }
  ]);

  const waterOptions = $derived<Array<{ v: WaterAccess; l: string }>>([
    { v: 'lluvia', l: t('water_lluvia') },
    { v: 'pozo', l: t('water_pozo') },
    { v: 'rio', l: t('water_rio') },
    { v: 'limitada', l: t('water_limitada') },
    { v: 'nada', l: t('water_nada') }
  ]);

  const goalOptions = $derived<Array<{ v: Goal; l: string }>>([
    { v: 'alimento', l: t('goal_alimento') },
    { v: 'medicinal', l: t('goal_medicinal') },
    { v: 'sanar-suelo', l: t('goal_sanar_suelo') },
    { v: 'comercio', l: t('goal_comercio') },
    { v: 'biodiversidad', l: t('goal_biodiversidad') }
  ]);

  const totalAreaM2 = $derived(toM2(areaValue || 0, areaUnit));
  const showAreaHa = $derived(fromM2(totalAreaM2, 'ha').toFixed(2));
  const previewRadiusM = $derived(totalAreaM2 > 0 ? Math.sqrt(totalAreaM2 / Math.PI) : 0);

  function stepT(id: StepId, field: 'title' | 'sub'): string {
    return t(`step_${id}_${field}` as TranslationKey);
  }

  // Heavy screen-reader narration + focus: on entering each step (including the
  // first and any Back/Continue move), move focus to the step heading so the
  // screen reader follows the flow forward — testers reported staying on the
  // Continue button — then speak the position and what to do, in natural
  // language ("Step 1 of 9. <what to do here>").
  let titleEl: HTMLElement | undefined = $state();
  $effect(() => {
    const id = steps[step].id;
    const where = t('wiz_progress_natural', { n: String(step + 1), total: String(steps.length) });
    const help = t(`wiz_help_${id}` as TranslationKey);
    tick().then(() => titleEl?.focus());
    announce(`${where}. ${help}`);
  });
</script>

<div class="wiz" role="dialog" aria-modal="true" aria-labelledby="wiz-title">
  <header class="wiz-head">
    <div class="label">{t('wiz_welcome')} · {t('wiz_progress_natural', { n: String(step + 1), total: String(steps.length) })}</div>
    <div class="wiz-progress" aria-hidden="true">
      {#each steps as _, i}
        <span class="dot" class:on={i === step} class:past={i < step}></span>
      {/each}
    </div>
    <button type="button" class="btn btn-ghost" onclick={skip} style="font-family: var(--mono); font-size: calc(11px * var(--text-scale));">
      {seed.isEdit ? t('wiz_cancel') : t('wiz_skip')}
    </button>
  </header>

  <main class="wiz-body">
    <div class="wiz-grid">
      <div class="wiz-text">
        <div class="label" style="margin-bottom: 12px;">{t('wiz_progress_natural', { n: String(step + 1), total: String(steps.length) })}</div>
        <h1 id="wiz-title" bind:this={titleEl} tabindex="-1" class="handline" style="display: inline-block; margin-bottom: 14px; font-size: calc(clamp(30px, 5vw, 48px) * var(--text-scale)); outline: none;">
          {stepT(steps[step].id, 'title')}
        </h1>
        <p style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale)); font-style: italic; color: var(--ink-soft); margin-bottom: 20px;">
          {stepT(steps[step].id, 'sub')}
        </p>

        {#if steps[step].id === 'name'}
          <input
            class="wiz-name-input"
            bind:value={parcelName}
            placeholder={t('name_placeholder')}
            aria-label={t('step_name_title')}
          />
          <div class="coord" style="margin-top: 12px;">{t('name_hint')}</div>

        {:else if steps[step].id === 'place'}
          <!-- Accessible place search: type, pick a real result, coordinates set. -->
          <LocationSearch onSelect={(r) => { location = r.label; lat = r.lat.toFixed(6); lng = r.lng.toFixed(6); }} />
          <div class="field-row" style="margin: 12px 0;">
            <label for="loc">{t('place_label')}</label>
            <input id="loc" class="inp" bind:value={location} placeholder={t('place_placeholder')} />
          </div>
          {#if !srMode}
            <LocationPicker
              bind:lat
              bind:lng
              label={t('place_map_hint')}
              height="300px"
              onUserMove={onPinMoved}
            />
          {/if}

        {:else if steps[step].id === 'size'}
          <div class="row" style="gap: 8px; align-items: flex-end;">
            <div class="field-row" style="flex: 1;"><label for="area">{t('size_label')}</label>
              <input id="area" class="inp" type="number" min="0" step="0.1" bind:value={areaValue} />
            </div>
            <div class="field-row" style="width: 200px;">
              <SelectWithOther
                id="unit"
                label={t('size_unit_label')}
                value={areaUnit}
                options={AREA_UNITS.map((v) => ({ v, l: areaLabel(v) }))}
                hideOther
                onValueChange={(v) => (areaUnit = v as AreaUnit)}
              />
            </div>
          </div>
          <div class="coord" style="margin-top: 10px;">
            {t('size_equiv', { m2: formatNumber(totalAreaM2, { maximumFractionDigits: 0 }), ha: showAreaHa, r: String(Math.round(previewRadiusM)) })}
          </div>
          {#if !srMode}
            <div style="margin-top: 12px;">
              <LocationPicker
                bind:lat
                bind:lng
                radiusM={previewRadiusM}
                label={t('size_preview_label')}
                height="280px"
                onUserMove={onPinMoved}
              />
            </div>
          {/if}
          {#if !sizeValid}
            <div class="banner warn" style="margin-top: 10px;">{t('size_error')}</div>
          {/if}

        {:else if steps[step].id === 'char'}
          <div class="field-row" style="margin-bottom: 10px;">
            <SelectWithOther
              id="climate"
              label={t('char_climate_label')}
              value={climate}
              options={climateOptions.map((c) => ({ v: c.v, l: `${c.l}: ${c.sub}` }))}
              otherLabel={t('climate_other')}
              placeholder={t('climate_other_placeholder')}
              onValueChange={(v) => (climate = v as ClimateProfile)}
            />
          </div>
          <div class="row" style="gap: 8px; margin-bottom: 10px;">
            {#if inferredUsdaZone != null}
              <div class="banner ok" style="flex: 1;">
                {t('char_usda_ok', { zone: String(inferredUsdaZone) })}
              </div>
            {:else}
              <div class="banner warn" style="flex: 1;">
                {t('char_usda_warn')}
              </div>
            {/if}
          </div>
          <div class="row" style="gap: 8px;">
            <div class="field-row" style="flex: 1;">
              <SelectWithOther
                id="sun"
                label={t('char_sun_label')}
                value={sunExposure}
                options={sunOptions.map((o) => ({ v: o.v, l: o.l }))}
                otherLabel={t('sun_other')}
                placeholder={t('sun_other_placeholder')}
                onValueChange={(v) => (sunExposure = v as SunExposure)}
              />
            </div>
            <div class="field-row" style="flex: 1;">
              <SelectWithOther
                id="water"
                label={t('char_water_label')}
                value={waterAccess}
                options={waterOptions.map((o) => ({ v: o.v, l: o.l }))}
                otherLabel={t('water_other')}
                placeholder={t('water_other_placeholder')}
                onValueChange={(v) => (waterAccess = v as WaterAccess)}
              />
            </div>
          </div>
          <div class="row" style="gap: 8px; margin-top: 10px;">
            <div class="field-row" style="flex: 1;"><label for="soil">{t('char_soil_label')}</label>
              <input id="soil" class="inp" bind:value={soil} placeholder={t('char_soil_placeholder')} />
            </div>
            <div class="field-row" style="flex: 1;"><label for="hum">{t('char_humidity_label')}</label>
              <input id="hum" class="inp" bind:value={humidity} placeholder={t('char_humidity_placeholder')} />
            </div>
            <div class="field-row" style="flex: 1;"><label for="alt">{t('char_altitude_label')}</label>
              <input id="alt" class="inp" bind:value={altitude} placeholder={t('char_altitude_placeholder')} />
            </div>
          </div>

        {:else if steps[step].id === 'goals'}
          <div class="row wrap" role="group" aria-label={t('step_goals_title')}>
            {#each goalOptions as g}
              <button
                type="button"
                class="chip {goals.includes(g.v) ? 'chip-jade' : ''}"
                aria-pressed={goals.includes(g.v)}
                onclick={() => toggleGoal(g.v)}
              >
                {g.l}
              </button>
            {/each}
          </div>

        {:else if steps[step].id === 'challenges'}
          {@const challengeOptions = [
            { v: 'plagas', l: t('challenge_plagas') },
            { v: 'erosion', l: t('challenge_erosion') },
            { v: 'sequia', l: t('challenge_sequia') },
            { v: 'inundacion', l: t('challenge_inundacion') },
            { v: 'viento', l: t('challenge_viento') },
            { v: 'suelo-pobre', l: t('challenge_suelo_pobre') },
            { v: 'animales', l: t('challenge_animales') },
            { v: 'espacio', l: t('challenge_espacio') },
            { v: 'tiempo', l: t('challenge_tiempo') },
            { v: 'conocimiento', l: t('challenge_conocimiento') }
          ]}
          <div class="row wrap" role="group" aria-label={t('step_challenges_title')}>
            {#each challengeOptions as ch}
              <button
                type="button"
                class="chip {challenges.includes(ch.v) ? 'chip-cinabrio' : ''}"
                aria-pressed={challenges.includes(ch.v)}
                onclick={() => { challenges = challenges.includes(ch.v) ? challenges.filter(x => x !== ch.v) : [...challenges, ch.v]; }}
              >
                {ch.l}
              </button>
            {/each}
          </div>
          <div class="field-row" style="margin-top: 12px;">
            <label for="challenge-note">{t('challenge_note_label')}</label>
            <textarea id="challenge-note" class="inp" rows="2" bind:value={challengeNote} placeholder={t('challenge_note_placeholder')}></textarea>
          </div>
          <div class="coord" style="margin-top: 8px;">{t('challenge_skip_hint')}</div>

          <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>
          <div class="label">{t('cond_title')}</div>
          <p class="sub" style="margin-top: 6px;">{t('cond_intro')}</p>
          <div class="cond-list" role="group" aria-label={t('cond_title')}>
            {#each [
              { v: 'supply-restricted', l: t('cond_supply'), d: t('cond_supply_desc') },
              { v: 'intermittent-connection', l: t('cond_connection'), d: t('cond_connection_desc') },
              { v: 'land-insecure', l: t('cond_land'), d: t('cond_land_desc') }
            ] as c}
              <label class="cond-row">
                <input
                  type="checkbox"
                  checked={conditions.includes(c.v as StructuralCondition)}
                  onchange={() => {
                    const v = c.v as StructuralCondition;
                    conditions = conditions.includes(v) ? conditions.filter((x) => x !== v) : [...conditions, v];
                  }}
                />
                <span class="cond-text"><b>{c.l}</b><span class="sub">{c.d}</span></span>
              </label>
            {/each}
          </div>
          <div class="banner" style="margin-top: 10px;">{t('cond_privacy_note')}</div>

        {:else if steps[step].id === 'reminder'}
          <div class="label">{t('reminder_freq_label')}</div>
          <div class="row wrap" role="radiogroup" aria-label={t('reminder_freq_label')} style="margin-top: 10px;">
            {#each [
              { v: 'diario', l: t('reminder_diario') },
              { v: 'semanal', l: t('reminder_semanal') },
              { v: 'quincenal', l: t('reminder_quincenal') },
              { v: 'mensual', l: t('reminder_mensual') },
              { v: 'ninguno', l: t('reminder_ninguno') }
            ] as r}
              <button
                type="button"
                class="chip {reminder === r.v ? 'chip-jade' : ''}"
                role="radio"
                aria-checked={reminder === r.v}
                onclick={() => (reminder = r.v)}
              >
                {r.l}
              </button>
            {/each}
          </div>
          <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>
          <div class="label">{t('budget_label')}</div>
          <div class="row wrap" role="radiogroup" aria-label={t('budget_label')} style="margin-top: 10px;">
            {#each [
              { v: 'ninguno', l: t('budget_ninguno'), sub: t('budget_ninguno_sub') },
              { v: 'bajo', l: t('budget_bajo'), sub: t('budget_bajo_sub') },
              { v: 'medio', l: t('budget_medio'), sub: t('budget_medio_sub') },
              { v: 'alto', l: t('budget_alto'), sub: t('budget_alto_sub') }
            ] as b}
              <button
                type="button"
                class="chip {budget === b.v ? 'chip-ocre' : ''}"
                role="radio"
                aria-checked={budget === b.v}
                onclick={() => (budget = b.v)}
                title={b.sub}
              >
                {b.l}
              </button>
            {/each}
          </div>
          <div class="coord" style="margin-top: 8px;">{t('budget_hint')}</div>

        {:else if steps[step].id === 'preview'}
          {#if plan}
            <div class="codex-card-soft" style="padding: 14px 16px;">
              <div class="label">{t('preview_summary')}</div>
              <div class="row" style="gap: 18px; margin-top: 8px; flex-wrap: wrap;">
                <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(26px * var(--text-scale));">{plan.totalAreaM2.toFixed(0)}</div><div class="coord">{t('preview_m2')}</div></div>
                <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(26px * var(--text-scale));">{plan.zones.length}</div><div class="coord">{t('preview_zones')}</div></div>
                <div><div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(26px * var(--text-scale));">{plan.strata.length}</div><div class="coord">{t('preview_strata')}</div></div>
              </div>
            </div>

            <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>

            <div class="label">{t('preview_zones_title')}</div>
            <ol class="zone-list" style="margin-top: 8px;">
              {#each plan.zones as z}
                <li class="zone-item">
                  <div class="zone-head">
                    <span class="zone-tag">{t('zone_intent_prefix')} {z.zone}</span>
                    <span class="zone-name">{z.name}</span>
                    <span class="coord">{z.areaPercent}% · {densityLabel(z.density)}</span>
                  </div>
                  <div class="sub" style="font-family: var(--serif); font-weight: var(--display-weight); margin-top: 4px;">{z.intent}</div>
                  {#if z.suggestedSpecies.length}
                    <div class="tag-row" style="margin-top: 6px;">
                      {#each z.suggestedSpecies as s}
                        <span class="chip chip-ocre">{s}</span>
                      {/each}
                    </div>
                  {/if}
                  <div class="coord" style="margin-top: 4px;">{t('zone_radius_prefix')} ~{formatMeters(z.ringRadiusM)} · {z.notes}</div>
                </li>
              {/each}
            </ol>

            <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>

            <div class="label">{t('preview_strata_title')}</div>
            <ul class="strata-list" style="margin-top: 8px;">
              {#each plan.strata as s}
                <li class="stratum-item">
                  <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale));">{s.name}</div>
                  <div class="sub">{s.role}</div>
                  <div class="tag-row" style="margin-top: 4px;">
                    {#each s.speciesIds as id}<span class="chip chip-jade">{id}</span>{/each}
                  </div>
                </li>
              {/each}
            </ul>

            {#if plan.warnings.length}
              <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>
              {#each plan.warnings as w}
                <div class="banner warn" style="margin-top: 6px;">{w}</div>
              {/each}
            {/if}

            <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>
            <div class="label">{t('preview_plant_q')}</div>
            <p class="sub" style="margin-top: 6px;">{t('preview_plant_desc')}</p>
            {#if !lat || !lng}
              <div class="banner" style="margin-top: 8px;">{t('preview_no_coords')}</div>
            {:else}
              <label class="row" style="margin-top: 8px;">
                <input type="checkbox" bind:checked={createBoundary} />
                <span>{t('preview_boundary')}</span>
              </label>
              <label class="row" style="margin-top: 4px;">
                <input type="checkbox" bind:checked={createZones} />
                <span>{t('preview_zones_check')}</span>
              </label>
              <label class="row" style="margin-top: 4px;">
                <input type="checkbox" bind:checked={createPlants} />
                <span>{t('preview_plants_check')}</span>
              </label>
            {/if}
          {:else}
            <div class="empty">{t('preview_empty')}</div>
          {/if}

        {:else if steps[step].id === 'ready'}
          {@const pMode = persistenceMode()}
          {@const configuredName = parcelName.trim() || t('name_placeholder')}
          {@const configuredGoals = goals.length ? goals.map(g => goalOptions.find(o => o.v === g)?.l ?? g).join(', ') : null}
          {@const configuredLocation = location.trim() || (lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : null)}
          <p style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale)); line-height: 1.6; color: var(--ink-soft);">
            <strong style="color: var(--ink);">{configuredName}</strong>.
            {#if configuredGoals}
              {configuredGoals}.
            {/if}
          </p>
          <div class="weave" style="margin: 22px 0;" aria-hidden="true"></div>
          <ul class="ready-list">
            <li><Glyph name="Check" size={14} /> {t('ready_plan_saved')}</li>
            {#if pMode === 'opfs' || pMode === 'idb'}
              <li><Glyph name="Check" size={14} /> {t('ready_storage_opfs')}</li>
            {:else}
              <li style="color: var(--cinabrio);"><Glyph name="Warning" size={14} /> {t('ready_storage_memory')}</li>
            {/if}
            {#if configuredLocation}
              <li><Glyph name="Check" size={14} /> {t('ready_location_prefix')}: {configuredLocation}</li>
            {/if}
            <li><Glyph name="Check" size={14} /> {t('ready_rules_loaded')}</li>
            <li><Glyph name="Check" size={14} /> {t('ready_offline')}</li>
          </ul>
          {#if pushSupported}
            <div class="weave" style="margin: 22px 0;" aria-hidden="true"></div>
            <label class="row" style="gap: 10px; align-items: flex-start;">
              <input type="checkbox" bind:checked={pushOptIn} style="margin-top: 2px;" />
              <span>
                <strong>{t('ready_push_title')}</strong><br />
                <span class="sub">{t('ready_push_desc')}</span>
              </span>
            </label>
          {/if}
        {/if}
      </div>

      <div class="wiz-visual" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <pattern id="wgrain" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="oklch(0.91 0.04 78)" />
              <circle cx="1" cy="1" r="0.3" fill="oklch(0.5 0.06 55 / 0.15)" />
              <circle cx="3" cy="3" r="0.3" fill="oklch(0.5 0.06 55 / 0.15)" />
            </pattern>
            <!-- Maya cartouche clip -->
            <clipPath id="wclip"><rect x="0" y="0" width="100" height="100"/></clipPath>
          </defs>
          <rect width="100" height="100" fill="url(#wgrain)" />
          <!-- Corner cartouche glyphs (all steps) -->
          <rect x="3" y="3" width="12" height="12" rx="1" fill="none" stroke="var(--ocre)" stroke-width="0.5" opacity="0.5"/>
          <rect x="4.5" y="4.5" width="9" height="9" rx="0.5" fill="none" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
          <circle cx="9" cy="9" r="2.2" fill="none" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
          <rect x="85" y="3" width="12" height="12" rx="1" fill="none" stroke="var(--ocre)" stroke-width="0.5" opacity="0.5"/>
          <rect x="86.5" y="4.5" width="9" height="9" rx="0.5" fill="none" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
          <circle cx="91" cy="9" r="2.2" fill="none" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
          <rect x="3" y="85" width="12" height="12" rx="1" fill="none" stroke="var(--ocre)" stroke-width="0.5" opacity="0.5"/>
          <rect x="85" y="85" width="12" height="12" rx="1" fill="none" stroke="var(--ocre)" stroke-width="0.5" opacity="0.5"/>
          <!-- Dot border pattern -->
          {#each [20,30,40,50,60,70,80] as px}
            <circle cx={px} cy="1.5" r="0.4" fill="var(--ocre)" opacity="0.35"/>
            <circle cx={px} cy="98.5" r="0.4" fill="var(--ocre)" opacity="0.35"/>
            <circle cx="1.5" cy={px} r="0.4" fill="var(--ocre)" opacity="0.35"/>
            <circle cx="98.5" cy={px} r="0.4" fill="var(--ocre)" opacity="0.35"/>
          {/each}

          {#if steps[step].id === 'name'}
            <!-- Ixchel-inspired Maya codex figure -->
            <!-- Corn / maize (left) -->
            <path d="M22 82 Q21 62 22 42" stroke="var(--jade)" stroke-width="0.8" fill="none" stroke-linecap="round"/>
            <path d="M22 58 Q27 54 30 57" stroke="var(--jade)" stroke-width="0.5" fill="none"/>
            <path d="M22 68 Q18 64 16 67" stroke="var(--jade)" stroke-width="0.5" fill="none"/>
            <ellipse cx="22" cy="40" rx="3.5" ry="6.5" fill="var(--maiz)" opacity="0.85"/>
            <line x1="22" y1="34" x2="22" y2="33.5" stroke="var(--jade)" stroke-width="0.5"/>
            <!-- Cacao pod (right) -->
            <ellipse cx="76" cy="60" rx="5.5" ry="9" fill="var(--ocre-deep)" opacity="0.75"/>
            <path d="M76 51 Q79 48 82 50" stroke="var(--jade)" stroke-width="0.5" fill="none"/>
            <path d="M71 58 L81 58" stroke="oklch(0.4 0.05 55 / 0.4)" stroke-width="0.3"/>
            <path d="M71 63 L81 63" stroke="oklch(0.4 0.05 55 / 0.4)" stroke-width="0.3"/>
            <!-- Ixchel figure (center) -->
            <!-- Head profile facing left -->
            <circle cx="55" cy="30" r="7" fill="oklch(0.72 0.07 50)"/>
            <!-- Serpent headdress -->
            <path d="M51 23 Q56 16 62 20 Q67 14 72 18" stroke="oklch(0.52 0.18 28)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
            <circle cx="72" cy="18" r="2" fill="oklch(0.52 0.18 28)"/>
            <circle cx="71" cy="17" r="0.8" fill="oklch(0.85 0.12 80)"/>
            <!-- Red dress / body -->
            <path d="M50 37 Q48 68 50 78 L63 78 Q65 68 62 37 Z" fill="oklch(0.50 0.18 28)" opacity="0.85"/>
            <!-- Gold belt -->
            <rect x="48" y="50" width="16" height="3" rx="1" fill="var(--maiz)" opacity="0.8"/>
            <!-- Jade necklace -->
            <circle cx="50" cy="39" r="1.4" fill="var(--jade)"/>
            <circle cx="54" cy="37" r="1.4" fill="var(--jade)"/>
            <circle cx="58" cy="37" r="1.4" fill="var(--jade)"/>
            <circle cx="62" cy="38" r="1.4" fill="var(--jade)"/>
            <!-- Arm + vessel -->
            <path d="M50 47 Q42 50 38 55" stroke="oklch(0.72 0.07 50)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <!-- Blue vessel (water/medicine) -->
            <ellipse cx="36" cy="57" rx="5.5" ry="7.5" fill="oklch(0.52 0.13 220)" opacity="0.85"/>
            <ellipse cx="36" cy="53" rx="3.5" ry="2" fill="oklch(0.65 0.10 220)" opacity="0.8"/>
            <!-- Steam/essence dots from vessel -->
            <circle cx="34" cy="65" r="0.5" fill="var(--ocre)" opacity="0.6"/>
            <circle cx="36" cy="67" r="0.4" fill="var(--ocre)" opacity="0.5"/>
            <circle cx="38" cy="65" r="0.5" fill="var(--ocre)" opacity="0.6"/>
            <!-- Kuxtal text -->
            <text x="50" y="92" text-anchor="middle" font-family="DM Serif Display, Georgia, serif" font-size="8" fill="var(--ink)" opacity="0.85">Kuxtal</text>
            <text x="50" y="97" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="2.5" fill="var(--ink-soft)" letter-spacing="0.3">vida · maya yucateco</text>

          {:else if steps[step].id === 'place'}
            <!-- Maya world map / cosmic turtle motif -->
            <circle cx="50" cy="50" r="28" fill="none" stroke="var(--ocre)" stroke-width="0.4" stroke-dasharray="1.5 0.8" opacity="0.7"/>
            <circle cx="50" cy="50" r="18" fill="none" stroke="var(--ocre)" stroke-width="0.3" stroke-dasharray="1 0.5" opacity="0.5"/>
            <circle cx="50" cy="50" r="2.5" fill="var(--ocre)" opacity="0.9"/>
            <!-- Cardinal directions -->
            <path d="M50 50 V 22" stroke="var(--ocre)" stroke-width="0.4" opacity="0.7"/>
            <path d="M50 50 V 78" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
            <path d="M50 50 H 22" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
            <path d="M50 50 H 78" stroke="var(--ocre)" stroke-width="0.3" opacity="0.5"/>
            <text x="50" y="20" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">N</text>
            <text x="50" y="82" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">S</text>
            <text x="20" y="51" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">O</text>
            <text x="80" y="51" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">E</text>
            <!-- Maya spiral sun glyph -->
            <path d="M50 44 Q54 46 52 50 Q50 54 46 52 Q42 50 44 46 Q46 42 50 44" fill="none" stroke="var(--maiz)" stroke-width="0.6" opacity="0.8"/>

          {:else if steps[step].id === 'size'}
            <!-- Land plot with permaculture zone rings -->
            <polygon points="22,30 72,22 80,70 55,80 20,72" fill="oklch(0.62 0.14 78 / 0.18)" stroke="var(--ocre)" stroke-width="0.7"/>
            <!-- Scale marker -->
            <line x1="25" y1="88" x2="65" y2="88" stroke="var(--ocre-deep)" stroke-width="0.6"/>
            <line x1="25" y1="86" x2="25" y2="90" stroke="var(--ocre-deep)" stroke-width="0.6"/>
            <line x1="65" y1="86" x2="65" y2="90" stroke="var(--ocre-deep)" stroke-width="0.6"/>
            <text x="45" y="95" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">{showAreaHa} ha</text>

          {:else if steps[step].id === 'char'}
            <!-- Soil layers with Maya earth symbol -->
            <rect x="10" y="52" width="80" height="38" rx="2" fill="oklch(0.52 0.08 48 / 0.5)"/>
            <rect x="10" y="38" width="80" height="14" rx="1" fill="oklch(0.62 0.07 58 / 0.35)"/>
            <rect x="10" y="28" width="80" height="10" rx="1" fill="oklch(0.70 0.06 70 / 0.25)"/>
            <!-- Sun glyph top -->
            <circle cx="50" cy="16" r="7" fill="none" stroke="var(--maiz)" stroke-width="0.6" opacity="0.8"/>
            {#each [0,45,90,135,180,225,270,315] as deg}
              <line
                x1={50 + Math.cos(deg * Math.PI/180) * 7}
                y1={16 + Math.sin(deg * Math.PI/180) * 7}
                x2={50 + Math.cos(deg * Math.PI/180) * 9.5}
                y2={16 + Math.sin(deg * Math.PI/180) * 9.5}
                stroke="var(--maiz)" stroke-width="0.5" opacity="0.8"
              />
            {/each}
            <text x="50" y="45" text-anchor="middle" font-family="JetBrains Mono" font-size="2.2" fill="var(--ink-soft)" opacity="0.8">{soil || 'suelo'}</text>

          {:else if steps[step].id === 'goals'}
            <!-- Goals as Maya flower / cardinal directions -->
            <g transform="translate(50 50)">
              {#each goals as _, i}
                {@const angle = (i / Math.max(goals.length, 1)) * 2 * Math.PI - Math.PI / 2}
                <circle cx={Math.cos(angle) * 26} cy={Math.sin(angle) * 26} r="4" fill="var(--ocre)" opacity="0.8"/>
                <line x1="0" y1="0" x2={Math.cos(angle) * 22} y2={Math.sin(angle) * 22} stroke="var(--ocre)" stroke-width="0.4" opacity="0.5"/>
              {/each}
              <circle cx="0" cy="0" r="6" fill="var(--jade)" opacity="0.8"/>
              <circle cx="0" cy="0" r="3" fill="var(--maiz)" opacity="0.9"/>
            </g>

          {:else if steps[step].id === 'preview'}
            {#if plan}
              <g transform="translate(50 50)">
                {#each plan.zones as z, i}
                  <circle
                    cx="0" cy="0"
                    r={Math.max(2, Math.min(40, 6 + i * 7))}
                    fill="none"
                    stroke="var(--ocre)"
                    stroke-width="0.7"
                    stroke-opacity={0.5 + i * 0.1}
                  />
                  <text x="0" y={-8 - i * 7} text-anchor="middle" font-family="JetBrains Mono" font-size="2.5" fill="var(--ink-soft)">{z.zone}</text>
                {/each}
              </g>
            {/if}
          {:else}
            <!-- Challenges/reminder/ready: planted land -->
            <polygon points="20,28 70,18 84,42 78,72 50,82 22,68 18,46" fill="oklch(0.62 0.16 55 / 0.20)" stroke="var(--ocre)" stroke-width="0.5" />
            <circle cx="40" cy="40" r="2.5" fill="var(--jade)" />
            <circle cx="55" cy="48" r="2.5" fill="var(--maiz)" />
            <circle cx="50" cy="60" r="2" fill="var(--ocre)" />
            <circle cx="65" cy="55" r="2.5" fill="var(--jade)" />
            <circle cx="35" cy="60" r="2" fill="var(--cinabrio)" opacity="0.7"/>
            <!-- Small corn glyph -->
            <path d="M72 30 Q71 22 72 16" stroke="var(--jade)" stroke-width="0.6" fill="none"/>
            <ellipse cx="72" cy="14" rx="2.2" ry="4" fill="var(--maiz)" opacity="0.8"/>
          {/if}
        </svg>
        <div class="greca wiz-greca"></div>
      </div>
    </div>
  </main>

  <footer class="wiz-foot">
    <button type="button" class="btn btn-ghost" onclick={back} disabled={step === 0}>{t('wiz_back')}</button>
    <button type="button" class="btn btn-primary" onclick={next} disabled={!canAdvance()}>
      {#if step === steps.length - 1 || steps[step].id === 'preview'}
        {seed.isEdit ? t('wiz_save') : t('wiz_enter')}
      {:else}
        {t('wiz_continue')}
      {/if}
      <Glyph name="ArrowRight" size={14} />
    </button>
  </footer>
</div>

<style>
  .wiz {
    position: fixed;
    inset: 0;
    z-index: var(--z-wizard);
    background: var(--paper);
    display: grid;
    grid-template-rows: auto 1fr auto;
    animation: inkBloom 0.7s var(--ease-codex) both;
  }
  .wiz-head {
    padding: 22px 28px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .wiz-progress { display: flex; gap: 6px; flex: 1; justify-content: center; }
  .wiz-progress .dot { width: 12px; height: 4px; border-radius: 2px; background: var(--line); transition: all 0.4s var(--ease-codex); }
  .wiz-progress .dot.on { width: 32px; background: var(--ocre); }
  .wiz-progress .dot.past { background: var(--ocre-deep); }

  .wiz-body { padding: 14px 28px; overflow: auto; display: grid; place-items: start center; }
  .wiz-grid { width: 100%; max-width: 920px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; padding: 12px 0; }
  @media (max-width: 760px) {
    .wiz-grid { grid-template-columns: 1fr; gap: 16px; }
    .wiz-visual { display: none; }
    .wiz-head { padding: 16px 16px 0; }
    .wiz-body { padding: 12px 16px; }
    .wiz-foot { padding: 12px 16px; }
  }
  .wiz-text { display: flex; flex-direction: column; max-width: 520px; }
  .wiz-name-input {
    width: 100%;
    padding: 14px 0;
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--ocre);
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(26px * var(--text-scale));
    color: var(--ink);
  }
  /* Keyboard focus needs a clearly visible indicator beyond the always-present
     underline (WCAG 2.4.7). */
  .wiz-name-input:focus-visible {
    outline: 2px solid var(--ocre);
    outline-offset: 4px;
    border-radius: 4px;
  }
  .cond-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .cond-row { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; padding: 6px 0; }
  .cond-row input { margin-top: 3px; width: 18px; height: 18px; flex-shrink: 0; }
  .cond-text { display: flex; flex-direction: column; gap: 2px; }
  .cond-text b { font-family: var(--serif); font-weight: 400; font-size: calc(15px * var(--text-scale)); color: var(--ink); }
  .wiz-visual {
    aspect-ratio: 1; width: 100%; max-width: 460px;
    border-radius: 8px; position: relative; overflow: hidden;
    background: var(--paper-warm); border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-md);
    position: sticky;
    top: 0;
  }
  .wiz-greca { position: absolute; bottom: 0; left: 0; right: 0; }

  .wiz-foot { padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); background: var(--paper-warm); }

  .ready-list { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 0; font-family: var(--mono); font-size: calc(12px * var(--text-scale)); letter-spacing: 0.04em; color: var(--ink-soft); }
  .ready-list li { display: flex; gap: 8px; align-items: center; }

  .zone-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .zone-item { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
  .zone-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .zone-tag { display: inline-block; background: var(--ocre); color: var(--paper); font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
  .zone-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); }

  .strata-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .stratum-item { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
</style>
