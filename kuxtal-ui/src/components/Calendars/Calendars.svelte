<script lang="ts">
  import { thunForDate, THUN_LABELS, type ThunDay } from '../../lib/calendars/thun';
  import { lunarPhaseForDate, PHASE_LABELS, type LunarPhase } from '../../lib/calendars/sinodico';
  import { mayaForDate } from '../../lib/calendars/maya';
  import { ANDINO_MARKERS, nextAndinoMarker } from '../../lib/calendars/andino';
  import { exec, selectAll } from '../../lib/db/sqlite';
  import { dbReady } from '../../lib/stores/appState';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  type Cal = 'biodinamico' | 'sinodico' | 'maya' | 'andino';
  type View = 'day' | 'week' | 'month' | 'year';

  let active = $state<Cal>('biodinamico');
  let view = $state<View>('week');
  let date = $state(new Date());
  let dateString = $state(toIso(new Date()));
  let enabled = $state<{ thun: boolean; sinodico: boolean; maya: boolean; andino: boolean }>({
    thun: true, sinodico: true, maya: true, andino: true
  });

  dbReady.subscribe((ready) => { if (ready) loadPrefs(); });

  function toIso(d: Date): string { return d.toISOString().slice(0, 10); }
  function setDate(): void {
    const parsed = new Date(dateString + 'T12:00:00');
    if (!isNaN(parsed.getTime())) date = parsed;
  }
  function shiftDate(days: number): void {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    date = d;
    dateString = toIso(d);
  }
  function shiftMonths(n: number): void {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    date = d;
    dateString = toIso(d);
  }
  function shiftYears(n: number): void {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + n);
    date = d;
    dateString = toIso(d);
  }
  function step(direction: 1 | -1): void {
    if (view === 'day') shiftDate(direction);
    else if (view === 'week') shiftDate(direction * 7);
    else if (view === 'month') shiftMonths(direction);
    else shiftYears(direction);
  }
  function goToday(): void {
    const d = new Date();
    date = d;
    dateString = toIso(d);
  }

  function toggle(key: keyof typeof enabled): void {
    enabled = { ...enabled, [key]: !enabled[key] };
    persistPrefs();
  }
  function persistPrefs(): void {
    exec(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['calendars.enabled', JSON.stringify(enabled)]
    );
  }
  function loadPrefs(): void {
    const rows = selectAll<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'calendars.enabled'`);
    if (rows[0]?.value) {
      try { enabled = { ...enabled, ...JSON.parse(rows[0].value) }; } catch {}
    }
  }

  // ---- Range helpers ----
  function startOfWeek(d: Date): Date {
    const r = new Date(d);
    const dow = (r.getDay() + 6) % 7; // monday-first
    r.setDate(r.getDate() - dow);
    r.setHours(0, 0, 0, 0);
    return r;
  }
  function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function rangeDates(): Date[] {
    if (view === 'day') return [date];
    if (view === 'week') {
      const start = startOfWeek(date);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    if (view === 'month') {
      const start = startOfMonth(date);
      const offset = (start.getDay() + 6) % 7;
      const total = daysInMonth(date);
      const out: Date[] = [];
      // Pad with previous-month days to start on Monday
      for (let i = 0; i < offset; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() - (offset - i));
        out.push(d);
      }
      for (let i = 0; i < total; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
      }
      while (out.length % 7 !== 0) {
        const last = out[out.length - 1];
        const d = new Date(last);
        d.setDate(d.getDate() + 1);
        out.push(d);
      }
      return out;
    }
    // year view: 12 months × midpoint
    return Array.from({ length: 12 }, (_, i) => new Date(date.getFullYear(), i, 15));
  }

  // ---- Day-tone helpers ----
  const THUN_COLOR: Record<ThunDay, string> = {
    raiz: 'var(--ocre-deep)',
    hoja: 'var(--jade)',
    flor: 'var(--cinabrio)',
    fruto: 'var(--maiz)'
  };
  const PHASE_COLOR: Record<LunarPhase, string> = {
    nueva: 'var(--ink)',
    creciente: 'var(--jade)',
    llena: 'var(--maiz)',
    menguante: 'var(--ocre-deep)'
  };

  function thunColorFor(d: Date): string {
    return THUN_COLOR[thunForDate(d).kind];
  }
  function phaseColorFor(d: Date): string {
    return PHASE_COLOR[lunarPhaseForDate(d).phase];
  }

  // ---- Header label ----
  function headerLabel(): string {
    if (view === 'day') return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'week') {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (view === 'month') return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return String(date.getFullYear());
  }

  // ---- Reactive derived ----
  let thun = $derived(thunForDate(date));
  let phase = $derived(lunarPhaseForDate(date));
  let maya = $derived(mayaForDate(date));
  let andino = $derived(nextAndinoMarker(date));
  let cells = $derived(rangeDates());

  const calendars: Array<{ id: Cal; name: string; sub: string; key: keyof typeof enabled }> = [
    { id: 'biodinamico', name: 'Biodinámico (Thun)', sub: 'Hoja · Raíz · Flor · Fruto', key: 'thun' },
    { id: 'maya', name: "Maya · Tzolk'in", sub: 'Cuenta sagrada de 260 días', key: 'maya' },
    { id: 'andino', name: 'Andino', sub: 'Pachakuti agrícola', key: 'andino' },
    { id: 'sinodico', name: 'Sinódico lunar', sub: 'Fases de la luna', key: 'sinodico' }
  ];

  const dayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function monthName(m: number): string {
    return new Date(2024, m - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
  }
</script>

<section class="card-warm card">
  <div class="row" style="justify-content: space-between; gap: 8px; flex-wrap: wrap;">
    <div>
      <div class="label">Cuatro saberes del tiempo</div>
      <div class="sub">Activa los calendarios y elige una vista (día, semana, mes, año).</div>
    </div>
    <div class="row" style="gap: 6px; flex-wrap: wrap;">
      {#each [{ v: 'day', l: 'Día' }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }, { v: 'year', l: 'Año' }] as opt}
        <button
          type="button"
          class="cb-shape"
          class:on={view === opt.v}
          aria-pressed={view === opt.v}
          onclick={() => (view = opt.v as View)}
        >
          {opt.l}
        </button>
      {/each}
    </div>
  </div>

  <div class="row" style="margin-top: 12px; gap: 8px; align-items: center; flex-wrap: wrap;">
    <button class="btn btn-sm" onclick={() => step(-1)} aria-label="Periodo anterior"><Glyph name="ArrowRight" size={12} /></button>
    <div class="cal-header" style="flex: 1; min-width: 200px; text-align: center;">{headerLabel()}</div>
    <button class="btn btn-sm" onclick={() => step(1)} aria-label="Periodo siguiente">
      <span style="display: inline-flex; transform: scaleX(-1);"><Glyph name="ArrowRight" size={12} /></span>
    </button>
    <button class="btn btn-sm" onclick={goToday}>Hoy</button>
    <input class="inp" type="date" bind:value={dateString} oninput={setDate} style="max-width: 170px;" aria-label="Saltar a fecha" />
  </div>
</section>

<section class="cal-grid">
  <aside class="cal-side">
    {#each calendars as c}
      {@const isOn = enabled[c.key]}
      <div class="cal-tab" class:on={active === c.id}>
        <button
          type="button"
          class="cal-tab-main"
          aria-pressed={active === c.id}
          onclick={() => (active = c.id)}
        >
          <span class="cal-tab-name">{c.name}</span>
          <span class="coord">{c.sub}</span>
        </button>
        <button
          type="button"
          class="chip {isOn ? 'chip-jade' : ''}"
          aria-label={`${isOn ? 'Desactivar' : 'Activar'} ${c.name}`}
          aria-pressed={isOn}
          onclick={() => toggle(c.key)}
        >
          {isOn ? 'activo' : 'inactivo'}
        </button>
      </div>
    {/each}
  </aside>

  <div class="cal-body">
    {#if active === 'biodinamico'}
      {#if view === 'day'}
        <div class="label">Hoy · {THUN_LABELS[thun.kind].label}</div>
        <div class="row" style="gap: 14px; align-items: flex-start; margin-top: 8px;">
          <div class="cal-disc" style="background: {THUN_COLOR[thun.kind]};"></div>
          <div>
            <div style="font-family: var(--serif); font-size: 24px;">{THUN_LABELS[thun.kind].label}</div>
            <p class="sub" style="font-family: var(--serif); margin-top: 6px;">
              {THUN_LABELS[thun.kind].advice}
            </p>
          </div>
        </div>
      {:else if view === 'week'}
        <div class="day-grid week">
          {#each dayHeaders as h}<div class="dh">{h}</div>{/each}
          {#each cells as d}
            {@const k = thunForDate(d).kind}
            <button
              type="button"
              class="dcell"
              class:today={sameDay(d, new Date())}
              class:selected={sameDay(d, date)}
              style="--accent: {THUN_COLOR[k]};"
              onclick={() => { date = d; dateString = toIso(d); view = 'day'; }}
              aria-label={`${d.toLocaleDateString('es-CO')} — ${THUN_LABELS[k].label}`}
            >
              <span class="dn">{d.getDate()}</span>
              <span class="dl">{THUN_LABELS[k].label.replace('Día ', '')}</span>
            </button>
          {/each}
        </div>
      {:else if view === 'month'}
        <div class="day-grid month">
          {#each dayHeaders as h}<div class="dh">{h}</div>{/each}
          {#each cells as d}
            {@const k = thunForDate(d).kind}
            {@const inMonth = d.getMonth() === date.getMonth()}
            <button
              type="button"
              class="dcell sm"
              class:today={sameDay(d, new Date())}
              class:selected={sameDay(d, date)}
              class:dim={!inMonth}
              style="--accent: {THUN_COLOR[k]};"
              onclick={() => { date = d; dateString = toIso(d); view = 'day'; }}
              aria-label={`${d.toLocaleDateString('es-CO')} — ${THUN_LABELS[k].label}`}
            >
              <span class="dn">{d.getDate()}</span>
            </button>
          {/each}
        </div>
        <div class="legend">
          {#each Object.entries(THUN_LABELS) as [k, v]}
            <span class="lg"><span class="lg-dot" style="background: {THUN_COLOR[k as ThunDay]}"></span> {v.label}</span>
          {/each}
        </div>
      {:else}
        <div class="year-grid">
          {#each cells as d}
            {@const k = thunForDate(d).kind}
            <button
              type="button"
              class="ycell"
              style="--accent: {THUN_COLOR[k]};"
              onclick={() => { date = d; dateString = toIso(d); view = 'month'; }}
            >
              <div class="ym">{d.toLocaleDateString('es-CO', { month: 'long' })}</div>
              <div class="yk">día central · {THUN_LABELS[k].label}</div>
            </button>
          {/each}
        </div>
      {/if}

    {:else if active === 'sinodico'}
      {#if view === 'day'}
        <div class="label">Hoy · {PHASE_LABELS[phase.phase]}</div>
        <div class="row" style="gap: 14px; align-items: flex-start; margin-top: 8px;">
          <div class="cal-disc" style="background: {PHASE_COLOR[phase.phase]};"></div>
          <div>
            <div style="font-family: var(--serif); font-size: 24px;">{PHASE_LABELS[phase.phase]}</div>
            <div class="coord" style="margin-top: 6px;">
              edad lunar {phase.ageDays.toFixed(1)} días · iluminación {(phase.illumination * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      {:else if view === 'week' || view === 'month'}
        <div class="day-grid {view}">
          {#each dayHeaders as h}<div class="dh">{h}</div>{/each}
          {#each cells as d}
            {@const ph = lunarPhaseForDate(d)}
            {@const inMonth = view === 'month' ? d.getMonth() === date.getMonth() : true}
            <button
              type="button"
              class="dcell"
              class:sm={view === 'month'}
              class:today={sameDay(d, new Date())}
              class:selected={sameDay(d, date)}
              class:dim={!inMonth}
              style="--accent: {PHASE_COLOR[ph.phase]};"
              onclick={() => { date = d; dateString = toIso(d); view = 'day'; }}
              aria-label={`${d.toLocaleDateString('es-CO')} — ${PHASE_LABELS[ph.phase]}`}
            >
              <span class="dn">{d.getDate()}</span>
              {#if view === 'week'}
                <span class="dl">{Math.round(ph.illumination * 100)}%</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="year-grid">
          {#each cells as d}
            {@const ph = lunarPhaseForDate(d)}
            <button
              type="button"
              class="ycell"
              style="--accent: {PHASE_COLOR[ph.phase]};"
              onclick={() => { date = d; dateString = toIso(d); view = 'month'; }}
            >
              <div class="ym">{d.toLocaleDateString('es-CO', { month: 'long' })}</div>
              <div class="yk">día central · {PHASE_LABELS[ph.phase]}</div>
            </button>
          {/each}
        </div>
      {/if}

    {:else if active === 'maya'}
      {#if view === 'day'}
        <div class="label">Hoy</div>
        <div class="card" style="margin-top: 8px;">
          <div style="font-family: var(--serif); font-size: 22px;"><b>Tzolk'in:</b> {maya.tzolkin.number} {maya.tzolkin.day}</div>
          <div style="font-family: var(--serif); font-size: 18px; margin-top: 6px;"><b>Haab:</b> {maya.haab.day} {maya.haab.month}</div>
        </div>
      {:else}
        <div class="day-grid {view === 'month' ? 'month' : view === 'week' ? 'week' : ''}">
          {#if view !== 'year'}
            {#each dayHeaders as h}<div class="dh">{h}</div>{/each}
          {/if}
          {#each cells as d}
            {@const m = mayaForDate(d)}
            {@const inMonth = view === 'month' ? d.getMonth() === date.getMonth() : true}
            <button
              type="button"
              class={view === 'year' ? 'ycell' : 'dcell'}
              class:sm={view === 'month'}
              class:today={sameDay(d, new Date())}
              class:selected={sameDay(d, date)}
              class:dim={!inMonth}
              style="--accent: var(--ocre);"
              onclick={() => { date = d; dateString = toIso(d); view = view === 'year' ? 'month' : 'day'; }}
            >
              {#if view === 'year'}
                <div class="ym">{d.toLocaleDateString('es-CO', { month: 'long' })}</div>
                <div class="yk">{m.tzolkin.number} {m.tzolkin.day}</div>
              {:else}
                <span class="dn">{d.getDate()}</span>
                <span class="dl">{m.tzolkin.number} {m.tzolkin.day}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}

    {:else if active === 'andino'}
      <div class="label">Próximo marcador</div>
      <div class="card" style="margin-top: 8px;">
        <div style="font-family: var(--serif); font-size: 22px;">{andino.marker.name}</div>
        <div class="coord" style="margin-top: 6px;">en {andino.daysUntil} días</div>
        <p class="sub" style="margin-top: 8px; font-family: var(--serif);">{andino.marker.description}</p>
      </div>
      <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
      <div class="label">Marcadores del año</div>
      <div class="andino-list">
        {#each ANDINO_MARKERS as m}
          <div class="andino-row">
            <span class="chip chip-ocre">{m.approxDate.day} {monthName(m.approxDate.month)}</span>
            <div>
              <div style="font-family: var(--serif); font-size: 17px;">{m.name}</div>
              <div class="sub">{m.description}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .cal-grid { display: grid; grid-template-columns: 220px 1fr; gap: 12px; }
  @media (max-width: 640px) { .cal-grid { grid-template-columns: 1fr; } }

  .cal-side { display: flex; flex-direction: column; gap: 6px; }
  .cal-tab {
    background: var(--paper);
    border: 1px solid var(--line);
    border-left: 3px solid transparent;
    padding: 12px 14px;
    color: var(--ink);
    text-align: left;
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    border-radius: 4px;
    transition: all 0.15s var(--ease-codex);
  }
  .cal-tab:hover { background: var(--paper-warm); }
  .cal-tab.on { background: var(--paper-warm); border-left-color: var(--ocre); }
  .cal-tab-main {
    background: none; border: none; padding: 0; cursor: pointer; color: var(--ink);
    display: flex; flex-direction: column; gap: 2px; min-width: 0; text-align: left; flex: 1;
  }
  .cal-tab-name { font-family: var(--serif); font-size: 16px; }

  .cal-body { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 16px; min-height: 220px; }
  .cal-disc { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px var(--paper), 0 0 0 4px var(--line); }

  .cal-header { font-family: var(--serif); font-size: 18px; text-transform: capitalize; }

  .cb-shape {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 9px; border: 1px solid var(--line); background: var(--paper);
    color: var(--ink-soft); border-radius: 4px;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer;
  }
  .cb-shape.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .day-grid.month { gap: 4px; }
  .dh {
    text-align: center;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-soft);
    text-transform: uppercase;
  }
  .dcell {
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-left: 3px solid var(--accent, var(--line));
    border-radius: 4px;
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: var(--ink);
  }
  .dcell.sm { padding: 6px 4px; min-height: 44px; }
  .dcell:hover { background: var(--paper); }
  .dcell.today { box-shadow: 0 0 0 2px var(--ocre) inset; }
  .dcell.selected { background: var(--paper); border-color: var(--ink); }
  .dcell.dim { opacity: 0.45; }
  .dn { font-family: var(--serif); font-size: 16px; line-height: 1; }
  .dl { font-family: var(--mono); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); }

  .year-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .ycell {
    background: var(--paper-warm);
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent, var(--line));
    border-radius: 6px;
    padding: 12px 14px;
    cursor: pointer;
    color: var(--ink);
    text-align: left;
  }
  .ycell:hover { background: var(--paper); }
  .ym { font-family: var(--serif); font-size: 16px; text-transform: capitalize; line-height: 1.1; }
  .yk { font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); margin-top: 4px; }

  .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
  .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-soft); }
  .lg-dot { width: 10px; height: 10px; border-radius: 50%; }

  .andino-list { display: flex; flex-direction: column; gap: 8px; }
  .andino-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
  .andino-row:last-child { border-bottom: none; }
</style>
