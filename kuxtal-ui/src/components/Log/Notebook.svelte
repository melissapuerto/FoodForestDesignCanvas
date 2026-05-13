<script lang="ts">
  import { onMount } from 'svelte';
  import { listLogs, addLog, deleteLog, type LogRow } from '../../lib/db/log';
  import { putBlob, getBlob, deleteBlob } from '../../lib/db/blobs';
  import { newId } from '../../lib/utils/id';
  import { dbReady } from '../../lib/stores/appState';
  import { showToast } from '../../lib/stores/toast';
  import { dialogConfirm, dialogAlert } from '../../lib/stores/dialog';
  import { authUser } from '../../lib/api';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let { landId }: { landId: string } = $props();

  let entries = $state<LogRow[]>([]);
  let body = $state('');
  let search = $state('');
  let recording = $state(false);
  let pendingPhotoKey = $state<string | null>(null);
  let pendingPhotoUrl = $state<string | null>(null);
  let pendingAudioKey = $state<string | null>(null);
  let pendingAudioUrl = $state<string | null>(null);
  let kind = $state<'note' | 'observation' | 'harvest' | 'task' | 'intention'>('note');
  let entryTitle = $state('');

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  // Author / datetime / location
  function nowLocal(): string {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  }
  let authorName = $state('');
  let entryAt = $state(nowLocal());
  let captureLocation = $state(false);
  let pendingLat = $state<number | null>(null);
  let pendingLng = $state<number | null>(null);

  authUser.subscribe((u) => { if (u && !authorName) authorName = u.username; });

  dbReady.subscribe((ready) => { if (ready) refresh(); });

  function refresh(): void { entries = listLogs(landId, search); }

  function save(): void {
    const trimmed = body.trim();
    if (!trimmed && !pendingPhotoKey && !pendingAudioKey) {
      showToast({ message: 'Escribe algo, graba un audio o agrega una foto antes de guardar.', tone: 'warn' });
      return;
    }
    if (pendingPhotoKey && !trimmed) {
      showToast({
        message: 'Agrega una descripción a la foto para encontrarla después en la búsqueda.',
        tone: 'warn'
      });
      return;
    }
    const mediaKeys: string[] = [];
    if (pendingPhotoKey) mediaKeys.push(pendingPhotoKey);
    if (pendingAudioKey) mediaKeys.push(pendingAudioKey);
    addLog({
      landId, kind,
      body: (entryTitle.trim() ? `[${entryTitle.trim()}] ` : '') + (trimmed || ''),
      mediaBlobKeys: mediaKeys,
      author: authorName.trim() || null,
      recordedAt: entryAt ? new Date(entryAt).toISOString() : undefined,
      lat: pendingLat ?? undefined,
      lng: pendingLng ?? undefined,
    });
    body = '';
    entryTitle = '';
    if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    pendingPhotoKey = null;
    pendingPhotoUrl = null;
    pendingAudioKey = null;
    pendingAudioUrl = null;
    pendingLat = null;
    pendingLng = null;
    captureLocation = false;
    entryAt = nowLocal();
    refresh();
    showToast({ message: 'Entrada guardada.', tone: 'ok' });
  }

  async function remove(entry: LogRow): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Borrar esta entrada?',
      body: 'Se eliminarán también las fotos adjuntas.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    if (entry.media_blob_keys) {
      try {
        for (const k of JSON.parse(entry.media_blob_keys) as string[]) await deleteBlob(k);
      } catch {}
    }
    deleteLog(entry.id);
    refresh();
    showToast({ message: 'Entrada borrada.', tone: 'ok' });
  }

  async function startVoice(): Promise<void> {
    if (mediaRecorder && recording) {
      try { mediaRecorder.stop(); } catch {}
      return;
    }
    if (!window.isSecureContext) {
      showToast({ message: 'La grabación solo funciona en HTTPS o localhost.', tone: 'warn' });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      await dialogAlert({
        title: 'Grabación no disponible',
        body: 'Tu navegador no soporta grabación de audio. Prueba Chrome, Edge o Firefox actualizados.'
      });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        await dialogAlert({ title: 'Permiso de micrófono denegado', body: 'Activa el micrófono y vuelve a intentarlo.' });
      } else if (name === 'NotFoundError') {
        showToast({ message: 'No encontré ningún micrófono conectado.', tone: 'warn' });
      } else {
        showToast({ message: `No pude acceder al micrófono (${name || 'error'}).`, tone: 'error' });
      }
      return;
    }

    audioChunks = [];
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch (err: any) {
      showToast({ message: `No pude iniciar la grabación (${err?.message ?? 'error'}).`, tone: 'error' });
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunks, { type: mr.mimeType || 'audio/webm' });
      audioChunks = [];
      try {
        const key = newId('voice');
        await putBlob({ key, kind: 'voice', mime: blob.type, size: blob.size, data: blob });
        if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
        pendingAudioKey = key;
        pendingAudioUrl = URL.createObjectURL(blob);
        showToast({ message: 'Audio grabado.', tone: 'ok' });
      } catch (err: any) {
        showToast({ message: `No pude guardar el audio (${err?.message ?? 'error'}).`, tone: 'error' });
      } finally {
        recording = false;
        mediaRecorder = null;
      }
    };
    try {
      mr.start();
      mediaRecorder = mr;
      recording = true;
      showToast({ message: 'Grabando audio... toca de nuevo para detener.', tone: 'info', durationMs: 2000 });
    } catch (err: any) {
      stream.getTracks().forEach((t) => t.stop());
      showToast({ message: `No pude iniciar la grabación (${err?.message ?? 'error'}).`, tone: 'error' });
      recording = false;
      mediaRecorder = null;
    }
  }

  function cancelAudio(): void {
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    if (pendingAudioKey) { void deleteBlob(pendingAudioKey).catch(() => {}); }
    pendingAudioKey = null;
    pendingAudioUrl = null;
  }

  async function captureCurrentPosition(): Promise<void> {
    if (!('geolocation' in navigator)) {
      showToast({ message: 'Geolocalización no disponible en este navegador.', tone: 'warn' });
      captureLocation = false;
      return;
    }
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
      });
      pendingLat = pos.coords.latitude;
      pendingLng = pos.coords.longitude;
    } catch {
      showToast({ message: 'No pude obtener la ubicación.', tone: 'warn' });
      captureLocation = false;
    }
  }

  function toggleLocation(): void {
    captureLocation = !captureLocation;
    if (captureLocation) void captureCurrentPosition();
    else { pendingLat = null; pendingLng = null; }
  }

  async function onPhotoChosen(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const key = newId('photo');
    await putBlob({ key, kind: 'photo', mime: file.type || 'image/jpeg', size: file.size, data: file });
    pendingPhotoKey = key;
    pendingPhotoUrl = URL.createObjectURL(file);
    input.value = '';
  }

  async function previewMedia(rawKeys: string | null): Promise<string | null> {
    if (!rawKeys) return null;
    try {
      const keys = JSON.parse(rawKeys) as string[];
      const blob = keys[0] ? await getBlob(keys[0]) : null;
      return blob ? URL.createObjectURL(blob.data) : null;
    } catch { return null; }
  }

  async function previewAudios(rawKeys: string | null): Promise<string[]> {
    if (!rawKeys) return [];
    try {
      const keys = JSON.parse(rawKeys) as string[];
      const out: string[] = [];
      for (const k of keys) {
        const b = await getBlob(k);
        if (b && (b.kind === 'voice' || b.kind === 'audio' || (b.mime || '').startsWith('audio/'))) {
          out.push(URL.createObjectURL(b.data));
        }
      }
      return out;
    } catch { return []; }
  }

  function locationFromGeoJson(s: string | null): string | null {
    if (!s) return null;
    try {
      const g = JSON.parse(s);
      if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
        const [lng, lat] = g.coordinates;
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } catch {}
    return null;
  }

  onMount(() => {
    return () => {
      if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
      if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    };
  });

  const kinds: Array<{ id: typeof kind; label: string }> = [
    { id: 'note', label: 'Nota' },
    { id: 'observation', label: 'Observación' },
    { id: 'harvest', label: 'Cosecha' },
    { id: 'task', label: 'Tarea' },
    { id: 'intention', label: 'Intención' }
  ];
</script>

<section class="card-warm card">
  <div class="label">Nueva entrada</div>
  <div class="row wrap" style="margin-top: 8px;" role="radiogroup" aria-label="Tipo de entrada">
    {#each kinds as k}
      <button
        type="button"
        class="chip"
        class:chip-jade={kind === k.id}
        role="radio"
        aria-checked={kind === k.id}
        onclick={() => (kind = k.id)}
      >
        {k.label}
      </button>
    {/each}
  </div>
  {#if kind === 'intention'}
    <input class="inp" style="margin-top: 8px;" placeholder="Título de la intención (ej. 'Sembrar frutales en zona norte')" bind:value={entryTitle} />
  {/if}
  <textarea
    class="inp"
    rows="3"
    style="margin-top: 8px;"
    placeholder="Escribe lo que viste, lo que cosechaste o lo que quieres recordar..."
    bind:value={body}
  ></textarea>
  <div class="row wrap" style="margin-top: 8px; gap: 8px;">
    <div class="field-row" style="flex: 1; min-width: 140px;">
      <label for="lg-author" class="coord">Autor</label>
      <input id="lg-author" class="inp" placeholder="Tu nombre" bind:value={authorName} />
    </div>
    <div class="field-row" style="flex: 1; min-width: 180px;">
      <label for="lg-when" class="coord">Cuándo</label>
      <input id="lg-when" class="inp" type="datetime-local" bind:value={entryAt} />
    </div>
    <div class="field-row" style="flex: 0 0 auto; align-self: flex-end;">
      <button type="button" class="btn btn-sm" aria-pressed={captureLocation} onclick={toggleLocation}>
        <Glyph name="Map" size={12} />
        {pendingLat != null ? `${pendingLat.toFixed(3)}, ${pendingLng?.toFixed(3)}` : 'Adjuntar ubicación'}
      </button>
    </div>
  </div>
  <div class="row wrap" style="margin-top: 8px;">
    <button class="btn" onclick={startVoice} aria-pressed={recording}>
      <Glyph name="Mic" size={14} /> {recording ? 'Detener grabación' : (pendingAudioKey ? 'Regrabar' : 'Grabar audio')}
    </button>
    {#if pendingAudioKey}
      <button type="button" class="btn btn-sm btn-ghost" onclick={cancelAudio} aria-label="Quitar audio">
        <Glyph name="Close" size={12} /> Quitar audio
      </button>
    {/if}
    <label class="btn">
      <Glyph name="Camera" size={14} /> Foto
      <input type="file" accept="image/*" capture="environment" hidden onchange={onPhotoChosen} />
    </label>
    <button
      class="btn btn-primary"
      onclick={save}
      disabled={(!body.trim() && !pendingPhotoKey && !pendingAudioKey) || (pendingPhotoKey != null && !body.trim())}
    >
      <Glyph name="Check" size={14} /> Guardar
    </button>
  </div>
  {#if pendingAudioUrl}
    <audio controls src={pendingAudioUrl} style="width: 100%; margin-top: 10px;"></audio>
  {/if}
  {#if pendingPhotoUrl}
    <img src={pendingPhotoUrl} alt="Vista previa de la foto" style="margin-top: 10px; max-width: 100%; border-radius: 6px; border: 1px solid var(--line);" />
    {#if !body.trim()}
      <div class="banner warn" style="margin-top: 8px;">
        Describe esta foto para poder encontrarla luego (planta, lugar, fecha, observación).
      </div>
    {/if}
  {/if}
</section>

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="row">
    <Glyph name="Help" size={14} />
    <input class="inp" type="search" placeholder="Buscar en cuaderno..." bind:value={search} oninput={refresh} />
  </div>
</section>

<div class="list">
  {#each entries as entry}
    <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
      <div class="row" style="justify-content: space-between; flex-wrap: wrap; gap: 4px;">
        <span class="chip {entry.kind === 'intention' ? 'chip-jade' : 'chip-ocre'}">{entry.kind === 'intention' ? 'intención' : entry.kind}</span>
        <span class="coord">
          {#if entry.author}@{entry.author} · {/if}
          {new Date(entry.recorded_at).toLocaleString('es-CO')}
          {#if locationFromGeoJson(entry.location_geojson)} · {locationFromGeoJson(entry.location_geojson)}{/if}
        </span>
      </div>
      {#if entry.body}
        <div style="font-family: var(--serif); font-size: 15px; line-height: 1.55;">{entry.body}</div>
      {/if}
      {#if entry.media_blob_keys}
        {#await previewMedia(entry.media_blob_keys) then url}
          {#if url}
            <img src={url} alt="Adjunto del cuaderno" style="max-width: 100%; border-radius: 6px;" />
          {/if}
        {/await}
        {#await previewAudios(entry.media_blob_keys) then urls}
          {#each urls as au}
            <audio controls src={au} style="width: 100%;"></audio>
          {/each}
        {/await}
      {/if}
      <div class="row" style="justify-content: flex-end;">
        <button class="btn btn-danger btn-sm" onclick={() => remove(entry)}>
          <Glyph name="Trash" size={12} /> Borrar
        </button>
      </div>
    </article>
  {:else}
    <div class="empty">Aún no hay entradas. Escribe la primera arriba.</div>
  {/each}
</div>
