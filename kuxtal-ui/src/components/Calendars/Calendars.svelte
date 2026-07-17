<script lang="ts">
  import { thunForDate, thunLabel, thunShort, thunAdvice, type ThunDay } from '../../lib/calendars/thun';
  import { lunarPhaseForDate, phaseLabel, type LunarPhase } from '../../lib/calendars/sinodico';
  import { mayaForDate } from '../../lib/calendars/maya';
  import { ANDINO_MARKERS, andinoDescription, nextAndinoMarker, andinoMarkerDate } from '../../lib/calendars/andino';
  import { t } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';
  import { localeTag } from '../../lib/utils/dates';
  import { exec, selectAll } from '../../lib/db/sqlite';
  import { dbReady } from '../../lib/stores/appState';
  import { dialogAlert } from '../../lib/stores/dialog';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  // Plain-language "why?" behind a calendar recommendation (BIO-05 / EXP).
  function whyCalendar(which: 'biodynamic' | 'lunar'): void {
    dialogAlert({
      title: t('cal_why_title'),
      body: which === 'biodynamic' ? t('cal_why_biodynamic') : t('cal_why_lunar')
    });
  }

  type Cal = 'biodinamico' | 'sinodico' | 'maya' | 'andino';
  type View = 'day' | 'week' | 'month' | 'year';

  let active = $state<Cal>('biodinamico');
  let view = $state<View>('week');
  let date = $state(new Date());
  let dateString = $state(toIso(new Date()));
  // BIO-04: calendars are opt-in. Default everything OFF so the app never pushes
  // lunar/biodynamic traditions on a user who didn't ask for them; loadPrefs()
  // restores whatever a returning user previously enabled.
  let enabled = $state<{ thun: boolean; sinodico: boolean; maya: boolean; andino: boolean }>({
    thun: false, sinodico: false, maya: false, andino: false
  });
  const activeKey = $derived<keyof typeof enabled>(
    active === 'biodinamico' ? 'thun' : active === 'sinodico' ? 'sinodico' : active === 'maya' ? 'maya' : 'andino'
  );
  const activeEnabled = $derived(enabled[activeKey]);

  $effect(() => { if ($dbReady) untrack(loadPrefs); });

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
    if (view === 'day') return date.toLocaleDateString(localeTag(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'week') {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (view === 'month') return date.toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' });
    return String(date.getFullYear());
  }

  // ---- Reactive derived ----
  let thun = $derived(thunForDate(date));
  let phase = $derived(lunarPhaseForDate(date));
  let maya = $derived(mayaForDate(date));
  let andino = $derived(nextAndinoMarker(date));
  let cells = $derived(rangeDates());

  const calendars: Array<{ id: Cal; name: string; sub: string; key: keyof typeof enabled }> = $derived([
    { id: 'biodinamico', name: t('cal_tab_thun_name'), sub: t('cal_tab_thun_sub'), key: 'thun' },
    { id: 'maya', name: t('cal_tab_maya_name'), sub: t('cal_tab_maya_sub'), key: 'maya' },
    { id: 'andino', name: t('cal_tab_andino_name'), sub: t('cal_tab_andino_sub'), key: 'andino' },
    { id: 'sinodico', name: t('cal_tab_sinodico_name'), sub: t('cal_tab_sinodico_sub'), key: 'sinodico' }
  ]);

  const THUN_KINDS: ThunDay[] = ['raiz', 'hoja', 'flor', 'fruto'];

  // Monday-first weekday initials in the active locale.
  const dayHeaders = $derived.by(() => {
    const fmt = new Intl.DateTimeFormat(localeTag(), { weekday: 'narrow' });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))));
  });

  function fmtDate(d: Date): string {
    return d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'long' });
  }
</script>

<section class="card-warm card">
  <div class="row" style="justify-content: space-between; gap: 8px; flex-wrap: wrap;">
    <div>
      <h3 class="label">{t('cal_title')}</h3>
      <div class="sub">{t('cal_sub')}</div>
    </div>
    <div class="row" style="gap: 6px; flex-wrap: wrap;">
      {#each [{ v: 'day', lk: 'cal_view_day' }, { v: 'week', lk: 'cal_view_week' }, { v: 'month', lk: 'cal_view_month' }, { v: 'year', lk: 'cal_view_year' }] as opt}
        <button
          type="button"
          class="cb-shape"
          class:on={view === opt.v}
          aria-pressed={view === opt.v}
          onclick={() => (view = opt.v as View)}
        >
          {t(opt.lk as any)}
        </button>
      {/each}
    </div>
  </div>

  <div class="row" style="margin-top: 12px; gap: 8px; align-items: center; flex-wrap: wrap;">
    <button class="btn btn-sm" onclick={() => step(-1)} aria-label={t('cal_prev_aria')}><Glyph name="ArrowRight" size={12} /></button>
    <div class="cal-header" style="flex: 1; min-width: 200px; text-align: center;">{headerLabel()}</div>
    <button class="btn btn-sm" onclick={() => step(1)} aria-label={t('cal_next_aria')}>
      <span style="display: inline-flex; transform: scaleX(-1);"><Glyph name="ArrowRight" size={12} /></span>
    </button>
    <button class="btn btn-sm" onclick={goToday}>{t('cal_today')}</button>
    <input class="inp" type="date" bind:value={dateString} oninput={setDate} style="max-width: 170px;" aria-label={t('cal_jump_aria')} />
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
          aria-label={isOn ? t('cal_deactivate', { name: c.name }) : t('cal_activate', { name: c.name })}
          aria-pressed={isOn}
          onclick={() => toggle(c.key)}
        >
          {isOn ? t('cal_active') : t('cal_inactive')}
        </button>
      </div>
    {/each}
  </aside>

  <div class="cal-body">
    {#if !activeEnabled}
      <div class="cal-optin">
        <div class="label">{t('cal_optin_title')}</div>
        <p class="sub" style="margin-top: 6px;">{t('cal_optin_body')}</p>
        <button type="button" class="btn btn-accent" style="margin-top: 12px;" onclick={() => toggle(activeKey)}>
          {t('cal_optin_enable')}
        </button>
      </div>
    {:else}
    {#if active === 'biodinamico'}
      {#if view === 'day'}
        <div class="label">{t('cal_today')} · {thunLabel(thun.kind)}</div>
        <div class="row" style="gap: 14px; align-items: flex-start; margin-top: 8px;">
          <div class="cal-disc" style="background: {THUN_COLOR[thun.kind]};"></div>
          <div>
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(24px * var(--text-scale));">{thunLabel(thun.kind)}</div>
            <p class="sub" style="font-family: var(--serif); font-weight: var(--display-weight); margin-top: 6px;">
              {thunAdvice(thun.kind)}
            </p>
            <button type="button" class="cal-why" onclick={() => whyCalendar('biodynamic')}>
              <Glyph name="Help" size={12} /> {t('cal_why_btn')}
            </button>
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
              aria-current={sameDay(d, new Date()) ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString(localeTag())} — ${thunLabel(k)}`}
            >
              <span class="dn">{d.getDate()}</span>
              <span class="dl">{thunShort(k)}</span>
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
              aria-current={sameDay(d, new Date()) ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString(localeTag())} — ${thunLabel(k)}`}
            >
              <span class="dn">{d.getDate()}</span>
            </button>
          {/each}
        </div>
        <div class="legend">
          {#each THUN_KINDS as k}
            <span class="lg"><span class="lg-dot" style="background: {THUN_COLOR[k]}"></span> {thunLabel(k)}</span>
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
              <div class="ym">{d.toLocaleDateString(localeTag(), { month: 'long' })}</div>
              <div class="yk">{t('cal_central_day')} · {thunLabel(k)}</div>
            </button>
          {/each}
        </div>
      {/if}

    {:else if active === 'sinodico'}
      {#if view === 'day'}
        <div class="label">{t('cal_today')} · {phaseLabel(phase.phase)}</div>
        <div class="row" style="gap: 14px; align-items: flex-start; margin-top: 8px;">
          <div class="cal-disc" style="background: {PHASE_COLOR[phase.phase]};"></div>
          <div>
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(24px * var(--text-scale));">{phaseLabel(phase.phase)}</div>
            <div class="coord" style="margin-top: 6px;">
              {t('cal_lunar_age', { age: phase.ageDays.toFixed(1), pct: (phase.illumination * 100).toFixed(0) })}
            </div>
            <button type="button" class="cal-why" onclick={() => whyCalendar('lunar')}>
              <Glyph name="Help" size={12} /> {t('cal_why_btn')}
            </button>
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
              aria-current={sameDay(d, new Date()) ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString(localeTag())} — ${phaseLabel(ph.phase)}`}
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
              <div class="ym">{d.toLocaleDateString(localeTag(), { month: 'long' })}</div>
              <div class="yk">{t('cal_central_day')} · {phaseLabel(ph.phase)}</div>
            </button>
          {/each}
        </div>
      {/if}

    {:else if active === 'maya'}
      {#if view === 'day'}
        <div class="label">{t('cal_today')}</div>
        <div class="card" style="margin-top: 8px;">
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale));"><b>Tzolk'in:</b> {maya.tzolkin.number} {maya.tzolkin.day}</div>
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); margin-top: 6px;"><b>Haab:</b> {maya.haab.day} {maya.haab.month}</div>
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
                <div class="ym">{d.toLocaleDateString(localeTag(), { month: 'long' })}</div>
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
      <div class="label">{t('cal_next_marker')}</div>
      <div class="card" style="margin-top: 8px;">
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(22px * var(--text-scale));">{andino.marker.name}</div>
        <div class="coord" style="margin-top: 6px;">
          {t('cal_days_until', { date: fmtDate(andino.date), n: String(andino.daysUntil) })}
        </div>
        <p class="sub" style="margin-top: 8px; font-family: var(--serif); font-weight: var(--display-weight);">{andinoDescription(andino.marker)}</p>
      </div>
      <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
      <div class="label">{t('cal_year_markers', { year: String(date.getFullYear()) })}</div>
      <div class="andino-list">
        {#each ANDINO_MARKERS as m}
          {@const markerDate = andinoMarkerDate(m, date.getFullYear())}
          <div class="andino-row">
            <span class="chip chip-ocre">{fmtDate(markerDate)}</span>
            <div>
              <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(17px * var(--text-scale));">{m.name}</div>
              <div class="sub">{andinoDescription(m)}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
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
  .cal-tab-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); }

  .cal-body { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 16px; min-height: 220px; }
  .cal-disc { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px var(--paper), 0 0 0 4px var(--line); }
  .cal-why {
    margin-top: 8px;
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ocre-deep);
    border-radius: 999px;
    font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.08em; text-transform: uppercase;
    padding: 5px 12px; min-height: 32px; cursor: pointer;
  }
  .cal-why:hover { background: var(--paper-warm); }

  .cal-header { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); text-transform: capitalize; }

  .cb-shape {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 9px; border: 1px solid var(--line); background: var(--paper);
    color: var(--ink-soft); border-radius: 4px;
    font-family: var(--mono); font-size: calc(10px * var(--text-scale)); letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer;
  }
  .cb-shape.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .day-grid.month { gap: 4px; }
  .dh {
    text-align: center;
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
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
  .dn { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); line-height: 1; }
  .dl { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); }

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
  .ym { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); text-transform: capitalize; line-height: 1.1; }
  .yk { font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); margin-top: 4px; }

  .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
  .lg { display: inline-flex; align-items: center; gap: 6px; font-size: calc(11px * var(--text-scale)); color: var(--ink-soft); }
  .lg-dot { width: 10px; height: 10px; border-radius: 50%; }

  .andino-list { display: flex; flex-direction: column; gap: 8px; }
  .andino-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
  .andino-row:last-child { border-bottom: none; }
</style>
