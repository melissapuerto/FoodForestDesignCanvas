<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { showToast } from '../../lib/stores/toast';

  import { listTasks, addTask, toggleTaskDone, deleteTask, type TaskRow } from '../../lib/db/tasks';
  import { dbReady } from '../../lib/stores/appState';
  import { authUser } from '../../lib/api';
  import { t } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/utils/dates';
  import { captureCurrentPosition as geolocate } from '../../lib/utils/geolocate';

  let { landId = 'land-default' }: { landId?: string } = $props();

  let tab = $state<'pendientes' | 'completadas'>('pendientes');
  let tasks = $state<TaskRow[]>([]);

  let creating = $state(false);
  let newTaskTitle = $state('');
  let newTaskType = $state('Mantenimiento');
  let newTaskTarget = $state('');
  let newTaskAuthor = $state('');
  function nowLocal(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  let newTaskWhen = $state(nowLocal());
  let newTaskCaptureLoc = $state(false);
  let newTaskLat = $state<number | null>(null);
  let newTaskLng = $state<number | null>(null);

  $effect(() => {
    const u = $authUser;
    untrack(() => { if (u && !newTaskAuthor) newTaskAuthor = u.username; });
  });

  async function captureTaskLocation(): Promise<void> {
    newTaskCaptureLoc = !newTaskCaptureLoc;
    if (!newTaskCaptureLoc) { newTaskLat = null; newTaskLng = null; return; }
    const r = await geolocate();
    if (!r.ok) {
      showToast({ message: t(r.reason === 'unsupported' ? 'nb_geo_unavailable' : 'nb_geo_failed'), tone: 'warn' });
      newTaskCaptureLoc = false;
      return;
    }
    newTaskLat = r.lat;
    newTaskLng = r.lng;
  }

  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh() {
    try { tasks = listTasks(landId); } catch { tasks = []; }
  }

  function toggleTask(tk: TaskRow): void {
    toggleTaskDone(tk.id, tk.done);
    refresh();
    showToast({ message: !tk.done ? t('proto_completed') : t('proto_uncompleted'), tone: 'ok' });
  }

  function saveTask(): void {
    const title = newTaskTitle.trim();
    if(!title) {
      showToast({ message: t('proto_err_name'), tone: 'warn' });
      return;
    }
    addTask({
      landId, title, type: newTaskType,
      targetId: newTaskTarget.trim() || undefined,
      author: newTaskAuthor.trim() || null,
      lat: newTaskLat, lng: newTaskLng,
      scheduledAt: newTaskWhen ? new Date(newTaskWhen).toISOString() : null,
    });
    creating = false;
    newTaskTitle = '';
    newTaskTarget = '';
    newTaskWhen = nowLocal();
    newTaskCaptureLoc = false;
    newTaskLat = null;
    newTaskLng = null;
    refresh();
    showToast({ message: t('proto_created'), tone: 'ok' });
  }

  function delTask(id: string): void {
    deleteTask(id);
    refresh();
    showToast({ message: t('proto_deleted'), tone: 'ok' });
  }
</script>

<section class="card-warm card">
  <div class="label">{t('proto_title')}</div>
  <p class="sub" style="margin-top: 6px;">
    {t('proto_sub')}
  </p>
  <div class="row wrap" style="margin-top: 10px;">
    {#if !creating}
      <button class="btn btn-primary" onclick={() => creating = true}>
        <Glyph name="Plus" size={14} /> {t('proto_new')}
      </button>
    {/if}
  </div>
  {#if creating}
    <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
    <div class="field-row">
      <label for="pt-title">{t('proto_task_label')}</label>
      <input id="pt-title" class="inp" placeholder={t('proto_task_placeholder')} bind:value={newTaskTitle} />
    </div>
    <div class="field-row">
      <label for="pt-type">{t('proto_type_label')}</label>
      <select id="pt-type" class="inp" bind:value={newTaskType}>
        <option value="Mantenimiento">{t('proto_type_maintenance')}</option>
        <option value="Inspección">{t('proto_type_inspection')}</option>
        <option value="Nutrición">{t('proto_type_nutrition')}</option>
        <option value="Cosecha">{t('proto_type_harvest')}</option>
        <option value="Otro">{t('proto_type_other')}</option>
      </select>
    </div>
    <div class="field-row">
      <label for="pt-target">{t('proto_location_label')}</label>
      <input id="pt-target" class="inp" placeholder={t('proto_location_placeholder')} bind:value={newTaskTarget} />
    </div>
    <div class="field-row">
      <label for="pt-author">{t('proto_author_label')}</label>
      <input id="pt-author" class="inp" placeholder={t('proto_author_placeholder')} bind:value={newTaskAuthor} />
    </div>
    <div class="field-row">
      <label for="pt-when">{t('proto_scheduled_label')}</label>
      <input id="pt-when" class="inp" type="datetime-local" bind:value={newTaskWhen} />
    </div>
    <div class="row" style="margin-top: 8px;">
      <button type="button" class="btn btn-sm" aria-pressed={newTaskCaptureLoc} onclick={captureTaskLocation}>
        <Glyph name="Map" size={12} />
        {newTaskLat != null ? `${newTaskLat.toFixed(3)}, ${newTaskLng?.toFixed(3)}` : t('proto_attach_location')}
      </button>
    </div>
    <div class="row" style="margin-top: 10px; gap: 8px;">
      <button class="btn btn-primary" onclick={saveTask}>{t('proto_save')}</button>
      <button class="btn" onclick={() => creating = false}>{t('proto_cancel')}</button>
    </div>
  {/if}
</section>

<div class="weave" aria-hidden="true" style="margin: 14px 0;"></div>

<section class="card" style="padding: 12px 16px; margin-bottom: 12px;">
  <div class="row wrap" style="gap: 4px;" role="group" aria-label={t('proto_title')}>
    <button type="button" class="chip {tab === 'pendientes' ? 'chip-jade' : ''}" aria-pressed={tab === 'pendientes'} onclick={() => (tab = 'pendientes')}>
      {t('proto_pending')}
    </button>
    <button type="button" class="chip {tab === 'completadas' ? 'chip-jade' : ''}" aria-pressed={tab === 'completadas'} onclick={() => (tab = 'completadas')}>
      {t('proto_done')}
    </button>
  </div>
</section>

<div class="list">
  {#each tasks.filter(tk => (tk.done === 1) === (tab === 'completadas')) as task}
    <article class="list-item" style="flex-direction: row; align-items: center; gap: 12px;">
      <button
        type="button"
        class="cb-check {task.done ? 'done' : ''}"
        onclick={() => toggleTask(task)}
        aria-label={task.done ? t('proto_toggle_undone_aria', { title: task.title }) : t('proto_toggle_done_aria', { title: task.title })}
      >
        {#if task.done}<Glyph name="Check" size={12} />{/if}
      </button>

      <div style="flex: 1;">
        <div class="row" style="justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale));" class:strike={task.done}>{task.title}</div>
          <div class="row" style="gap: 4px;">
            <span class="chip chip-ocre" style="font-size: calc(9px * var(--text-scale));">{task.type}</span>
            <button class="btn btn-ghost" style="padding: 2px;" aria-label={t('proto_delete_aria', { title: task.title })} onclick={() => delTask(task.id)}><Glyph name="Trash" size={12} /></button>
          </div>
        </div>
        {#if task.target_id}
          <div class="row" style="gap: 8px;">
            <span class="sub"><Glyph name="Map" size={10} /> {task.target_id}</span>
          </div>
        {/if}
        <div class="row wrap" style="gap: 8px;">
          {#if task.author}<span class="sub">@{task.author}</span>{/if}
          {#if task.scheduled_at}<span class="sub">{formatDateTime(task.scheduled_at)}</span>{/if}
          {#if task.location_geojson}
            {#await Promise.resolve(JSON.parse(task.location_geojson)) then g}
              {#if g?.coordinates}
                <span class="sub">{g.coordinates[1].toFixed(3)}, {g.coordinates[0].toFixed(3)}</span>
              {/if}
            {/await}
          {/if}
        </div>
      </div>
    </article>
  {:else}
    <div class="empty">{t('proto_empty')}</div>
  {/each}
</div>

<style>
  .cb-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--paper);
    cursor: pointer;
    transition: all 0.2s;
  }
  .cb-check.done {
    background: var(--jade-deep);
    border-color: var(--jade-deep);
  }
  .strike {
    text-decoration: line-through;
    opacity: 0.6;
  }
</style>
