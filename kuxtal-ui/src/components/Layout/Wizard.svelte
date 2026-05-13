<script lang="ts">
  import { untrack } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { exec, selectAll } from '../../lib/db/sqlite';
  import { nowIso } from '../../lib/utils/id';
  import { showToast } from '../../lib/stores/toast';
  import { suggestPlan } from '../../lib/permaculture/engine';
  import { savePlan, materializeFromPlan } from '../../lib/permaculture/realize';
  import {
    type ClimateProfile, type SunExposure, type WaterAccess,
    type AreaUnit, type Goal, type Plan, toM2, fromM2, AREA_LABELS
  } from '../../lib/permaculture/types';
  import { reloadFromDb } from '../../lib/stores/appState';
  import LocationPicker from './LocationPicker.svelte';
  import SelectWithOther from './SelectWithOther.svelte';
  import { formatMeters } from '../../lib/utils/format';
  import { requestPushPermission, subscribeToPush, isPushEnabled, setPushEnabled } from '../../lib/push';

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

  const steps: Array<{ id: StepId; title: string; sub: string }> = [
    { id: 'name', title: '¿Cómo se llama tu tierra?', sub: 'Un nombre, una historia.' },
    { id: 'place', title: '¿Dónde está?', sub: 'Coordenadas para clima y especies.' },
    { id: 'size', title: '¿Qué tan grande es?', sub: 'Área aproximada — incluye lo que cuides directamente.' },
    { id: 'char', title: 'Características', sub: 'Sol, agua, suelo — lo que sabes hoy.' },
    { id: 'goals', title: '¿Qué te interesa cosechar?', sub: 'Opcional. Marca lo que más te importa o continúa sin elegir.' },
    { id: 'challenges', title: 'Desafíos y situación', sub: '¿Qué retos enfrenta tu tierra?' },
    { id: 'reminder', title: 'Recordatorio y presupuesto', sub: '¿Con qué frecuencia quieres recordatorios?' },
    { id: 'preview', title: 'Bosque comestible sugerido', sub: 'Una propuesta basada en permacultura.' },
    { id: 'ready', title: 'Listo para sembrar', sub: 'Tu lienzo está abierto.' }
  ];

  let step = $state(0);

  // ---- Inputs (seeded from props once, then independent) ----
  const seed = untrack(() => ({
    parcelName: initial?.parcelName ?? 'Mi finca',
    location: initial?.location ?? '',
    lat: initial?.lat ?? '',
    lng: initial?.lng ?? '',
    areaValue: initial?.areaValue ?? 1,
    areaUnit: (initial?.areaUnit ?? 'ha') as AreaUnit,
    climate: (initial?.climate ?? 'desconocido') as ClimateProfile,
    sunExposure: (initial?.sunExposure ?? 'parcial') as SunExposure,
    waterAccess: (initial?.waterAccess ?? 'lluvia') as WaterAccess,
    soil: initial?.soil ?? '',
    humidity: initial?.humidity ?? '',
    altitude: initial?.altitude ?? '',
    goals: initial?.goals ?? (['alimento'] as Goal[]),
    isEdit: mode === 'edit'
  }));
  let parcelName = $state(seed.parcelName);
  let location = $state(seed.location);
  let lat = $state(seed.lat);
  let lng = $state(seed.lng);
  let areaValue = $state(seed.areaValue);
  let areaUnit = $state<AreaUnit>(seed.areaUnit);
  let climate = $state<ClimateProfile>(seed.climate);
  let sunExposure = $state<SunExposure>(seed.sunExposure);
  let waterAccess = $state<WaterAccess>(seed.waterAccess);
  let soil = $state(seed.soil);
  let humidity = $state(seed.humidity);
  let altitude = $state(seed.altitude);
  let goals = $state<Goal[]>(seed.goals);
  let challenges = $state<string[]>([]);
  let challengeNote = $state('');
  let reminder = $state('');
  let budget = $state('');
  let createBoundary = $state(!seed.isEdit);
  let createZones = $state(!seed.isEdit);
  let pushOptIn = $state(!isPushEnabled()); // default on for first run
  let pushSupported = $state('Notification' in window && 'PushManager' in window);

  // ---- Validation per step ----
  let nameValid = $derived(parcelName.trim().length >= 1);
  let placeValid = $derived(true); // location is now optional
  let sizeValid = $derived(areaValue > 0 && Number.isFinite(areaValue));
  let goalsValid = $derived(true);

  function canAdvance(): boolean {
    const id = steps[step].id;
    if (id === 'name') return nameValid;
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
    plan = suggestPlan({
      parcelName: parcelName.trim() || 'Mi finca',
      location: location.trim(),
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
      areaValue, areaUnit,
      climate, sunExposure, waterAccess,
      soil: soil.trim(),
      humidity: humidity.trim(),
      altitude: altitude.trim(),
      goals
    });
  }

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
      ['parcel.name', JSON.stringify(parcelName.trim() || 'Mi finca')]
    );

    const existing = selectAll<{ id: string }>('SELECT id FROM land WHERE id = ?', ['land-default']);
    if (existing.length) {
      exec('UPDATE land SET name = ?, updated_at = ? WHERE id = ?', [parcelName.trim() || 'Mi finca', nowIso(), 'land-default']);
    }
  }

  function realizePlan(): { zones: number; boundary: boolean } {
    if (!plan || (!createBoundary && !createZones)) return { zones: 0, boundary: false };
    const centerLat = parseFloat(lat) || 0;
    const centerLng = parseFloat(lng) || 0;
    const result = materializeFromPlan({
      plan,
      landId: 'land-default',
      centerLat,
      centerLng,
      createBoundary,
      createZones
    });
    return { zones: result.zonesCreated, boundary: result.boundaryCreated };
  }

  function next(): void {
    if (!canAdvance()) {
      showToast({ message: 'Completa los campos obligatorios para continuar.', tone: 'warn' });
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
      if (realized.zones || realized.boundary) {
        showToast({
          message: `Sembré tu plan: ${realized.boundary ? 'contorno' : ''}${realized.boundary && realized.zones ? ' + ' : ''}${realized.zones ? `${realized.zones} zonas` : ''}.`,
          tone: 'ok',
          durationMs: 5500
        });
      } else {
        showToast({ message: 'Tu códice está listo.', tone: 'ok' });
      }
    } catch (err) {
      console.warn('persist onboarding failed', err);
      showToast({ message: 'No pude guardar todo, pero puedes empezar a usar la app.', tone: 'warn' });
    }
    if (pushOptIn && pushSupported) {
      requestPushPermission().then(granted => {
        if (granted) {
          setPushEnabled(true);
          subscribeToPush().catch(() => null);
        }
      });
    }
    onDone(parcelName.trim() || 'Mi finca');
  }

  function back(): void { if (step > 0) step -= 1; }

  function skip(): void {
    try { persistOnboarding(); } catch {}
    onDone(parcelName.trim() || 'Mi finca');
  }

  // ---- Helpers ----
  const climateOptions: Array<{ v: ClimateProfile; l: string; sub: string }> = [
    { v: 'tropical-humedo', l: 'Tropical húmedo', sub: 'Selva, bosque lluvioso' },
    { v: 'tropical-seco', l: 'Tropical seco', sub: 'Sabanas, bosque seco' },
    { v: 'subtropical', l: 'Subtropical', sub: 'Cálido con estaciones' },
    { v: 'templado', l: 'Templado', sub: 'Inviernos suaves' },
    { v: 'frio', l: 'Frío', sub: 'Andino o de altura' },
    { v: 'desconocido', l: 'No estoy seguro/a', sub: 'Lo afinaré después' }
  ];

  const sunOptions: Array<{ v: SunExposure; l: string }> = [
    { v: 'completo', l: 'Sol pleno' },
    { v: 'parcial', l: 'Sol parcial' },
    { v: 'sombra', l: 'Sombra' },
    { v: 'mixto', l: 'Mezclado' }
  ];

  const waterOptions: Array<{ v: WaterAccess; l: string }> = [
    { v: 'lluvia', l: 'Lluvia' },
    { v: 'pozo', l: 'Pozo' },
    { v: 'rio', l: 'Río o quebrada' },
    { v: 'limitada', l: 'Limitada' },
    { v: 'nada', l: 'Sin acceso' }
  ];

  const goalOptions: Array<{ v: Goal; l: string }> = [
    { v: 'alimento', l: 'Alimento' },
    { v: 'medicinal', l: 'Medicinas' },
    { v: 'sanar-suelo', l: 'Sanar la tierra' },
    { v: 'comercio', l: 'Vender' },
    { v: 'biodiversidad', l: 'Biodiversidad' }
  ];

  const totalAreaM2 = $derived(toM2(areaValue || 0, areaUnit));
  const showAreaHa = $derived(fromM2(totalAreaM2, 'ha').toFixed(2));
  const previewRadiusM = $derived(totalAreaM2 > 0 ? Math.sqrt(totalAreaM2 / Math.PI) : 0);
</script>

<div class="wiz" role="dialog" aria-modal="true" aria-labelledby="wiz-title">
  <header class="wiz-head">
    <div class="label">Bienvenida · {step + 1} / {steps.length}</div>
    <div class="wiz-progress" aria-hidden="true">
      {#each steps as _, i}
        <span class="dot" class:on={i === step} class:past={i < step}></span>
      {/each}
    </div>
    <button type="button" class="btn btn-ghost" onclick={skip} style="font-family: var(--mono); font-size: 11px;">
      {seed.isEdit ? 'Cancelar' : 'Saltar'}
    </button>
  </header>

  <main class="wiz-body">
    <div class="wiz-grid">
      <div class="wiz-text">
        <div class="label" style="margin-bottom: 12px;">Paso {step + 1} · {steps[step].id}</div>
        <h1 id="wiz-title" class="handline" style="display: inline-block; margin-bottom: 14px; font-size: clamp(30px, 5vw, 48px);">
          {steps[step].title}
        </h1>
        <p style="font-family: var(--serif); font-size: 17px; font-style: italic; color: var(--ink-soft); margin-bottom: 20px;">
          {steps[step].sub}
        </p>

        {#if steps[step].id === 'name'}
          <input
            class="wiz-name-input"
            bind:value={parcelName}
            placeholder="Mi finca"
            aria-label="Nombre de tu tierra"
            required
          />
          <div class="coord" style="margin-top: 12px;">Puedes cambiarlo después en Ajustes.</div>
          {#if !nameValid}
            <div class="banner warn" style="margin-top: 10px;">Escribe al menos un nombre.</div>
          {/if}

        {:else if steps[step].id === 'place'}
          <div class="field-row" style="margin-bottom: 12px;">
            <label for="loc">Lugar (opcional)</label>
            <input id="loc" class="inp" bind:value={location} placeholder="Yucatán, México" />
          </div>
          <LocationPicker
            bind:lat
            bind:lng
            label="Opcional: Ubica el terreno en el mapa (puedes dejarlo en blanco para usar un lienzo infinito)"
            height="300px"
          />

        {:else if steps[step].id === 'size'}
          <div class="row" style="gap: 8px; align-items: flex-end;">
            <div class="field-row" style="flex: 1;"><label for="area">Tamaño aproximado</label>
              <input id="area" class="inp" type="number" min="0" step="0.1" bind:value={areaValue} />
            </div>
            <div class="field-row" style="width: 200px;">
              <SelectWithOther
                id="unit"
                label="Unidad"
                value={areaUnit}
                options={Object.entries(AREA_LABELS).map(([v, l]) => ({ v, l }))}
                hideOther
                onValueChange={(v) => (areaUnit = v as AreaUnit)}
              />
            </div>
          </div>
          <div class="coord" style="margin-top: 10px;">
            Equivale a ≈ {totalAreaM2.toLocaleString('es-CO', { maximumFractionDigits: 0 })} m² · {showAreaHa} ha · radio ~{Math.round(previewRadiusM)} m
          </div>
          <div style="margin-top: 12px;">
            <LocationPicker
              bind:lat
              bind:lng
              radiusM={previewRadiusM}
              label="Vista previa del área alrededor del punto"
              height="280px"
            />
          </div>
          {#if !sizeValid}
            <div class="banner warn" style="margin-top: 10px;">El área debe ser mayor que cero.</div>
          {/if}

        {:else if steps[step].id === 'char'}
          <div class="field-row" style="margin-bottom: 10px;">
            <SelectWithOther
              id="climate"
              label="Clima"
              value={climate}
              options={climateOptions.map((c) => ({ v: c.v, l: `${c.l} — ${c.sub}` }))}
              otherLabel="Otro clima…"
              placeholder="ej. páramo, semiárido"
              onValueChange={(v) => (climate = v as ClimateProfile)}
            />
          </div>
          <div class="row" style="gap: 8px;">
            <div class="field-row" style="flex: 1;">
              <SelectWithOther
                id="sun"
                label="Sol"
                value={sunExposure}
                options={sunOptions.map((o) => ({ v: o.v, l: o.l }))}
                otherLabel="Otra exposición…"
                placeholder="ej. matinal, vespertino"
                onValueChange={(v) => (sunExposure = v as SunExposure)}
              />
            </div>
            <div class="field-row" style="flex: 1;">
              <SelectWithOther
                id="water"
                label="Agua"
                value={waterAccess}
                options={waterOptions.map((o) => ({ v: o.v, l: o.l }))}
                otherLabel="Otro acceso…"
                placeholder="ej. acueducto, cisterna"
                onValueChange={(v) => (waterAccess = v as WaterAccess)}
              />
            </div>
          </div>
          <div class="row" style="gap: 8px; margin-top: 10px;">
            <div class="field-row" style="flex: 1;"><label for="soil">Suelo</label>
              <input id="soil" class="inp" bind:value={soil} placeholder="Arcilloso, rojizo" />
            </div>
            <div class="field-row" style="flex: 1;"><label for="hum">Humedad</label>
              <input id="hum" class="inp" bind:value={humidity} placeholder="68 %" />
            </div>
            <div class="field-row" style="flex: 1;"><label for="alt">Altitud</label>
              <input id="alt" class="inp" bind:value={altitude} placeholder="38 m" />
            </div>
          </div>

        {:else if steps[step].id === 'goals'}
          <div class="row wrap" role="group" aria-label="Objetivos">
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
          {#if !goalsValid}
            <div class="banner warn" style="margin-top: 10px;">Marca al menos un objetivo.</div>
          {/if}

        {:else if steps[step].id === 'challenges'}
          {@const challengeOptions = [
            { v: 'plagas', l: 'Plagas o enfermedades' },
            { v: 'erosion', l: 'Erosión del suelo' },
            { v: 'sequia', l: 'Sequía o falta de agua' },
            { v: 'inundacion', l: 'Inundaciones' },
            { v: 'viento', l: 'Vientos fuertes' },
            { v: 'suelo-pobre', l: 'Suelo pobre o compactado' },
            { v: 'animales', l: 'Daño por animales' },
            { v: 'espacio', l: 'Espacio limitado' },
            { v: 'tiempo', l: 'Poco tiempo disponible' },
            { v: 'conocimiento', l: 'Falta de conocimiento' }
          ]}
          <div class="row wrap" role="group" aria-label="Desafíos">
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
            <label for="challenge-note">Notas sobre tu situación (opcional)</label>
            <textarea id="challenge-note" class="inp" rows="2" bind:value={challengeNote} placeholder="Describe los retos principales de tu terreno..."></textarea>
          </div>
          <div class="coord" style="margin-top: 8px;">Puedes saltarte este paso — no es obligatorio.</div>

        {:else if steps[step].id === 'reminder'}
          <div class="label">¿Con qué frecuencia quieres recordatorios?</div>
          <div class="row wrap" role="radiogroup" aria-label="Frecuencia de recordatorio" style="margin-top: 10px;">
            {#each [
              { v: 'diario', l: 'Diario' },
              { v: 'semanal', l: 'Semanal' },
              { v: 'quincenal', l: 'Quincenal' },
              { v: 'mensual', l: 'Mensual' },
              { v: 'ninguno', l: 'Sin recordatorio' }
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
          <div class="label">Presupuesto (opcional)</div>
          <div class="field-row" style="margin-top: 8px;">
            <label for="budget">¿Cuánto puedes invertir por mes?</label>
            <input id="budget" class="inp" bind:value={budget} placeholder="ej. $50 USD, voluntariado, trueque..." />
          </div>
          <div class="coord" style="margin-top: 8px;">Esto nos ayuda a sugerir técnicas adaptadas a tus recursos.</div>

        {:else if steps[step].id === 'preview'}
          {#if plan}
            <div class="codex-card-soft" style="padding: 14px 16px;">
              <div class="label">Resumen</div>
              <div class="row" style="gap: 18px; margin-top: 8px; flex-wrap: wrap;">
                <div><div style="font-family: var(--serif); font-size: 26px;">{plan.totalAreaM2.toFixed(0)}</div><div class="coord">m²</div></div>
                <div><div style="font-family: var(--serif); font-size: 26px;">{plan.zones.length}</div><div class="coord">zonas</div></div>
                <div><div style="font-family: var(--serif); font-size: 26px;">{plan.strata.length}</div><div class="coord">estratos</div></div>
              </div>
            </div>

            <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>

            <div class="label">Zonas de permacultura</div>
            <ol class="zone-list" style="margin-top: 8px;">
              {#each plan.zones as z}
                <li class="zone-item">
                  <div class="zone-head">
                    <span class="zone-tag">Zona {z.zone}</span>
                    <span class="zone-name">{z.name}</span>
                    <span class="coord">{z.areaPercent}% · {z.density}</span>
                  </div>
                  <div class="sub" style="font-family: var(--serif); margin-top: 4px;">{z.intent}</div>
                  {#if z.suggestedSpecies.length}
                    <div class="tag-row" style="margin-top: 6px;">
                      {#each z.suggestedSpecies as s}
                        <span class="chip chip-ocre">{s}</span>
                      {/each}
                    </div>
                  {/if}
                  <div class="coord" style="margin-top: 4px;">radio ~{formatMeters(z.ringRadiusM)} · {z.notes}</div>
                </li>
              {/each}
            </ol>

            <div class="weave" style="margin: 18px 0;" aria-hidden="true"></div>

            <div class="label">Estratos del bosque comestible</div>
            <ul class="strata-list" style="margin-top: 8px;">
              {#each plan.strata as s}
                <li class="stratum-item">
                  <div style="font-family: var(--serif); font-size: 17px;">{s.name}</div>
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
            <div class="label">¿Quieres que genere el contorno y las zonas en el lienzo?</div>
            <p class="sub" style="margin-top: 6px;">
              Se crearán polígonos circulares concéntricos alrededor de tus coordenadas. Podrás moverlos o borrarlos después.
            </p>
            {#if !lat || !lng}
              <div class="banner" style="margin-top: 8px;">
                Necesito coordenadas para dibujar — vuelve al paso 2 si quieres autogenerar la geometría.
              </div>
            {:else}
              <label class="row" style="margin-top: 8px;">
                <input type="checkbox" bind:checked={createBoundary} />
                <span>Crear contorno aproximado</span>
              </label>
              <label class="row" style="margin-top: 4px;">
                <input type="checkbox" bind:checked={createZones} />
                <span>Crear zonas concéntricas</span>
              </label>
            {/if}
          {:else}
            <div class="empty">Vuelve al paso anterior para calcular tu plan.</div>
          {/if}

        {:else if steps[step].id === 'ready'}
          <p style="font-family: var(--serif); font-size: 17px; line-height: 1.6; color: var(--ink-soft);">
            Tu códice está listo. Las plantas que siembres, las observaciones que registres, las
            relaciones que descubras — todo queda guardado en tu dispositivo.
          </p>
          <div class="weave" style="margin: 22px 0;" aria-hidden="true"></div>
          <ul class="ready-list">
            <li><Glyph name="Check" size={14} /> Plan guardado en Ajustes</li>
            <li><Glyph name="Check" size={14} /> Almacenamiento local activado</li>
            <li><Glyph name="Check" size={14} /> Reglas de compañerismo cargadas</li>
            <li><Glyph name="Check" size={14} /> Funciona sin conexión</li>
          </ul>
          {#if pushSupported}
            <div class="weave" style="margin: 22px 0;" aria-hidden="true"></div>
            <label class="row" style="gap: 10px; align-items: flex-start;">
              <input type="checkbox" bind:checked={pushOptIn} style="margin-top: 2px;" />
              <span>
                <strong>Activar notificaciones push</strong><br />
                <span class="sub">Recibirás alertas en este dispositivo cuando tu evento sea aprobado o alguien comente tu publicación.</span>
              </span>
            </label>
          {/if}
        {/if}
      </div>

      <div class="wiz-visual" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <defs>
            <pattern id="wgrain" width="2" height="2" patternUnits="userSpaceOnUse">
              <rect width="2" height="2" fill="oklch(0.92 0.04 80)" />
              <circle cx="1" cy="1" r="0.2" fill="oklch(0.5 0.04 60 / 0.2)" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#wgrain)" />
          {#if steps[step].id === 'name'}
            <text x="50" y="46" text-anchor="middle" font-family="DM Serif Display" font-size="9" fill="var(--ink)">Kuxtal</text>
            <text x="50" y="56" text-anchor="middle" font-family="DM Serif Display" font-size="3" font-style="italic" fill="var(--ink-soft)">vida · en maya yucateco</text>
          {:else if steps[step].id === 'place'}
            <circle cx="50" cy="50" r="22" fill="none" stroke="var(--ocre)" stroke-width="0.4" stroke-dasharray="1 0.5" />
            <circle cx="50" cy="50" r="2" fill="var(--ocre)" />
            <path d="M50 50 V 25" stroke="var(--ocre)" stroke-width="0.3" />
            <text x="50" y="22" text-anchor="middle" font-family="JetBrains Mono" font-size="2.5" fill="var(--ink)">N</text>
          {:else if steps[step].id === 'size'}
            <rect x="20" y="22" width="60" height="56" fill="oklch(0.62 0.16 55 / 0.20)" stroke="var(--ocre)" stroke-width="0.5" />
            <text x="50" y="80" text-anchor="middle" font-family="JetBrains Mono" font-size="3" fill="var(--ink-soft)">{showAreaHa} ha</text>
          {:else if steps[step].id === 'char'}
            <rect x="10" y="55" width="80" height="35" fill="oklch(0.52 0.07 50 / 0.5)" />
            <rect x="10" y="40" width="80" height="15" fill="oklch(0.6 0.05 60 / 0.3)" />
            <text x="14" y="50" font-family="JetBrains Mono" font-size="2.5" fill="var(--ink-soft)">capa orgánica</text>
            <text x="14" y="68" font-family="JetBrains Mono" font-size="2.5" fill="var(--paper)">{soil || 'arcilla rojiza'}</text>
          {:else if steps[step].id === 'goals'}
            <g transform="translate(50 50)">
              {#each goals as _, i}
                <circle cx={Math.cos((i / goals.length) * 2 * Math.PI) * 25} cy={Math.sin((i / goals.length) * 2 * Math.PI) * 25} r="3" fill="var(--ocre)" />
              {/each}
              <circle cx="0" cy="0" r="2" fill="var(--jade)" />
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
                    stroke-width="0.6"
                    stroke-opacity={0.4 + i * 0.12}
                  />
                  <text x="0" y={-6 - i * 7} text-anchor="middle" font-family="JetBrains Mono" font-size="2.2" fill="var(--ink-soft)">{z.zone}</text>
                {/each}
              </g>
            {/if}
          {:else}
            <polygon points="20,28 70,18 84,42 78,72 50,82 22,68 18,46" fill="oklch(0.62 0.16 55 / 0.20)" stroke="var(--ocre)" stroke-width="0.5" />
            <circle cx="40" cy="40" r="2" fill="var(--jade)" />
            <circle cx="55" cy="48" r="2" fill="var(--maiz)" />
            <circle cx="50" cy="60" r="2" fill="var(--ocre)" />
            <circle cx="65" cy="55" r="2" fill="var(--jade)" />
          {/if}
        </svg>
        <div class="greca wiz-greca"></div>
      </div>
    </div>
  </main>

  <footer class="wiz-foot">
    <button type="button" class="btn btn-ghost" onclick={back} disabled={step === 0}>← Atrás</button>
    <button type="button" class="btn btn-primary" onclick={next} disabled={!canAdvance()}>
      {#if step === steps.length - 1 || steps[step].id === 'preview'}
        {seed.isEdit ? 'Guardar cambios' : 'Entrar al lienzo'}
      {:else}
        Continuar
      {/if}
      <Glyph name="ArrowRight" size={14} />
    </button>
  </footer>
</div>

<style>
  .wiz {
    position: fixed;
    inset: 0;
    z-index: 150;
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
    font-family: var(--serif);
    font-size: 26px;
    color: var(--ink);
    outline: none;
  }
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

  .ready-list { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 0; font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em; color: var(--ink-soft); }
  .ready-list li { display: flex; gap: 8px; align-items: center; }

  .zone-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .zone-item { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
  .zone-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .zone-tag { display: inline-block; background: var(--ocre); color: var(--paper); font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
  .zone-name { font-family: var(--serif); font-size: 18px; }

  .strata-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .stratum-item { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
</style>
