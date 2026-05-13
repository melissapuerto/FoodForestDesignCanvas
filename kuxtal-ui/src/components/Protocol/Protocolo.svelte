<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { showToast } from '../../lib/stores/toast';

  import { listTasks, addTask, toggleTaskDone, deleteTask, type TaskRow } from '../../lib/db/tasks';
  import { dbReady } from '../../lib/stores/appState';
  import { authUser } from '../../lib/api';

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

  authUser.subscribe((u) => { if (u && !newTaskAuthor) newTaskAuthor = u.username; });

  async function captureTaskLocation(): Promise<void> {
    newTaskCaptureLoc = !newTaskCaptureLoc;
    if (!newTaskCaptureLoc) { newTaskLat = null; newTaskLng = null; return; }
    if (!('geolocation' in navigator)) { showToast({ message: 'Geolocalización no disponible.', tone: 'warn' }); newTaskCaptureLoc = false; return; }
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 }));
      newTaskLat = pos.coords.latitude;
      newTaskLng = pos.coords.longitude;
    } catch { showToast({ message: 'No pude obtener la ubicación.', tone: 'warn' }); newTaskCaptureLoc = false; }
  }

  dbReady.subscribe(ready => { if(ready) refresh(); });

  function refresh() {
    try { tasks = listTasks(landId); } catch { tasks = []; }
  }

  function toggleTask(t: TaskRow): void {
    toggleTaskDone(t.id, t.done);
    refresh();
    showToast({ message: !t.done ? 'Tarea completada' : 'Tarea pendiente', tone: 'ok' });
  }

  function saveTask(): void {
    const title = newTaskTitle.trim();
    if(!title) {
      showToast({ message: 'Escribe el nombre de la tarea.', tone: 'warn' });
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
    showToast({ message: 'Tarea creada', tone: 'ok' });
  }

  function delTask(id: string): void {
    deleteTask(id);
    refresh();
    showToast({ message: 'Tarea borrada', tone: 'ok' });
  }
</script>

<section class="card-warm card">
  <div class="label">Protocolo y Planeación</div>
  <p class="sub" style="margin-top: 6px;">
    Listas de tareas, mantenimientos y acciones a realizar en tus zonas y plantas.
  </p>
  <div class="row wrap" style="margin-top: 10px;">
    {#if !creating}
      <button class="btn btn-primary" onclick={() => creating = true}>
        <Glyph name="Plus" size={14} /> Nueva Tarea
      </button>
    {/if}
  </div>
  {#if creating}
    <div class="weave" style="margin: 14px 0;" aria-hidden="true"></div>
    <div class="field-row">
      <label for="pt-title">Tarea</label>
      <input id="pt-title" class="inp" placeholder="ej. Regar almácigos" bind:value={newTaskTitle} />
    </div>
    <div class="field-row">
      <label for="pt-type">Tipo</label>
      <select id="pt-type" class="inp" bind:value={newTaskType}>
        <option value="Mantenimiento">Mantenimiento</option>
        <option value="Inspección">Inspección</option>
        <option value="Nutrición">Nutrición</option>
        <option value="Cosecha">Cosecha</option>
        <option value="Otro">Otro</option>
      </select>
    </div>
    <div class="field-row">
      <label for="pt-target">Objetivo / Lugar (Opcional)</label>
      <input id="pt-target" class="inp" placeholder="ej. Zona Norte" bind:value={newTaskTarget} />
    </div>
    <div class="field-row">
      <label for="pt-author">Autor</label>
      <input id="pt-author" class="inp" placeholder="Tu nombre" bind:value={newTaskAuthor} />
    </div>
    <div class="field-row">
      <label for="pt-when">Programada para</label>
      <input id="pt-when" class="inp" type="datetime-local" bind:value={newTaskWhen} />
    </div>
    <div class="row" style="margin-top: 8px;">
      <button type="button" class="btn btn-sm" aria-pressed={newTaskCaptureLoc} onclick={captureTaskLocation}>
        <Glyph name="Map" size={12} />
        {newTaskLat != null ? `${newTaskLat.toFixed(3)}, ${newTaskLng?.toFixed(3)}` : 'Adjuntar ubicación'}
      </button>
    </div>
    <div class="row" style="margin-top: 10px; gap: 8px;">
      <button class="btn btn-primary" onclick={saveTask}>Guardar</button>
      <button class="btn" onclick={() => creating = false}>Cancelar</button>
    </div>
  {/if}
</section>

<div class="weave" aria-hidden="true" style="margin: 14px 0;"></div>

<section class="card" style="padding: 12px 16px; margin-bottom: 12px;">
  <div class="row wrap" style="gap: 4px;" role="tablist">
    <button type="button" class="chip {tab === 'pendientes' ? 'chip-jade' : ''}" onclick={() => (tab = 'pendientes')}>
      Pendientes
    </button>
    <button type="button" class="chip {tab === 'completadas' ? 'chip-jade' : ''}" onclick={() => (tab = 'completadas')}>
      Completadas
    </button>
  </div>
</section>

<div class="list">
  {#each tasks.filter(t => (t.done === 1) === (tab === 'completadas')) as task}
    <article class="list-item" style="flex-direction: row; align-items: center; gap: 12px;">
      <button 
        type="button" 
        class="cb-check {task.done ? 'done' : ''}"
        onclick={() => toggleTask(task)}
        aria-label="Marcar tarea"
      >
        {#if task.done}<Glyph name="Check" size={12} />{/if}
      </button>
      
      <div style="flex: 1;">
        <div class="row" style="justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="font-family: var(--serif); font-size: 16px;" class:strike={task.done}>{task.title}</div>
          <div class="row" style="gap: 4px;">
            <span class="chip chip-ocre" style="font-size: 9px;">{task.type}</span>
            <button class="btn btn-ghost" style="padding: 2px;" onclick={() => delTask(task.id)}><Glyph name="Trash" size={12} /></button>
          </div>
        </div>
        {#if task.target_id}
          <div class="row" style="gap: 8px;">
            <span class="sub"><Glyph name="Map" size={10} /> {task.target_id}</span>
          </div>
        {/if}
        <div class="row wrap" style="gap: 8px;">
          {#if task.author}<span class="sub">@{task.author}</span>{/if}
          {#if task.scheduled_at}<span class="sub">{new Date(task.scheduled_at).toLocaleString('es-CO')}</span>{/if}
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
    <div class="empty">No hay tareas en esta vista.</div>
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
