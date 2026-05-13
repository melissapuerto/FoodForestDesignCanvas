<script lang="ts">
  import { listLogs, addLog, deleteLog, type LogRow } from '../../lib/db/log';
  import { putBlob, getBlob, deleteBlob } from '../../lib/db/blobs';
  import { newId } from '../../lib/utils/id';
  import { dbReady } from '../../lib/stores/appState';
  import { showToast } from '../../lib/stores/toast';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { apiFetch, authToken } from '../../lib/api';
  import { get } from 'svelte/store';

  let { landId }: { landId: string } = $props();

  let entries = $state<LogRow[]>([]);
  let title = $state('');
  let body = $state('');
  let search = $state('');
  let mediaKeys = $state<string[]>([]);
  let mediaUrls = $state<{url: string, type: string}[]>([]);

  dbReady.subscribe((ready) => { if (ready) refresh(); });

  function refresh(): void {
    try {
      entries = listLogs(landId, search).filter(e => e.kind === 'saber');
    } catch { entries = []; }
  }

  function save(): void {
    const txtTitle = title.trim();
    const text = body.trim();
    if (!txtTitle) {
      showToast({ message: 'El título es obligatorio.', tone: 'warn' });
      return;
    }
    if (!text && mediaKeys.length === 0) {
      showToast({ message: 'Escribe algo o agrega un archivo multimedia.', tone: 'warn' });
      return;
    }
    addLog({
      landId,
      kind: 'saber',
      title: txtTitle,
      body: text || undefined,
      mediaBlobKeys: mediaKeys.length > 0 ? mediaKeys : undefined
    });
    title = '';
    body = '';
    for (const m of mediaUrls) URL.revokeObjectURL(m.url);
    mediaKeys = [];
    mediaUrls = [];
    refresh();
    showToast({ message: 'Saber guardado.', tone: 'ok' });
  }

  async function remove(entry: LogRow): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Borrar este saber?',
      body: 'Se eliminará permanentemente.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    if (entry.media_blob_keys) {
      try { for (const k of JSON.parse(entry.media_blob_keys) as string[]) await deleteBlob(k); } catch {}
    }
    deleteLog(entry.id);
    refresh();
    showToast({ message: 'Saber borrado.', tone: 'ok' });
  }

  async function shareSaber(entry: LogRow): Promise<void> {
    if (!get(authToken)) {
      showToast({ message: 'Inicia sesión en Comunidad para compartir', tone: 'warn' });
      return;
    }
    try {
      const payload = {
        title: entry.title,
        body: entry.body,
        recorded_at: entry.recorded_at,
      };
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: `Saber: ${entry.title || 'Sin título'}`,
          content: entry.body || 'Sin descripción',
          category: 'saberes',
          source_type: 'saber',
          source_payload: JSON.stringify(payload),
        })
      });
      showToast({ message: 'Compartido en la Comunidad', tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || 'Error al compartir', tone: 'warn' });
    }
  }

  async function onMedia(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    
    for (const file of files) {
      const key = newId('media');
      const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'photo';
      await putBlob({ key, kind, mime: file.type || 'application/octet-stream', size: file.size, data: file });
      mediaKeys = [...mediaKeys, key];
      mediaUrls = [...mediaUrls, { url: URL.createObjectURL(file), type: kind }];
    }
    input.value = '';
  }

  async function previewMedia(rawKeys: string | null): Promise<{url: string, type: string}[]> {
    if (!rawKeys) return [];
    try {
      const keys = JSON.parse(rawKeys) as string[];
      const urls = [];
      for (const k of keys) {
        const blob = await getBlob(k);
        if (blob) urls.push({ url: URL.createObjectURL(blob.data), type: blob.kind });
      }
      return urls;
    } catch { return []; }
  }
</script>

<section class="card-warm card">
  <div class="label">Registrar saber</div>
  <p class="sub" style="margin-top: 6px;">
    Conocimientos heredados de sabedores, abuelas/os, y experiencia propia sobre la tierra.
    Estos saberes son tuyos y puedes compartirlos si lo deseas.
  </p>
  <input class="inp" style="margin-top: 10px;" placeholder="Título (ej: Cosecha con luna llena)" bind:value={title} />
  <textarea class="inp" rows="3" style="margin-top: 10px;" placeholder="Escribe lo que aprendiste de alguien, lo que observaste, una técnica ancestral..." bind:value={body}></textarea>
  <div class="row wrap" style="margin-top: 8px; gap: 6px;">
    <label class="btn btn-sm">
      <Glyph name="Camera" size={14} /> Multimedia
      <input type="file" accept="image/*,video/*,audio/*" capture="environment" multiple hidden onchange={onMedia} />
    </label>
    <button class="btn btn-primary btn-sm" onclick={save} disabled={!title.trim() || (!body.trim() && mediaKeys.length === 0)}>
      <Glyph name="Check" size={14} /> Guardar
    </button>
  </div>
  {#if mediaUrls.length > 0}
    <div class="row wrap" style="margin-top: 8px; gap: 8px;">
      {#each mediaUrls as m}
        {#if m.type === 'photo'}
          <img src={m.url} alt="Vista previa" style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line);" />
        {:else if m.type === 'video'}
          <video src={m.url} controls style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line);">
            <track kind="captions" src="" label="No captions available">
          </video>
        {:else if m.type === 'audio'}
          <audio src={m.url} controls style="max-width: 100%; border-radius: 6px; border: 1px solid var(--line);"></audio>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="row">
    <Glyph name="Help" size={14} />
    <input class="inp" type="search" placeholder="Buscar en saberes..." bind:value={search} oninput={refresh} />
  </div>
</section>

<div class="list">
  {#each entries as entry}
    <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
      <div class="row" style="justify-content: space-between;">
        <span class="chip chip-ocre">saber</span>
        <span class="coord">{new Date(entry.recorded_at).toLocaleString('es-CO')}</span>
      </div>
      {#if entry.title}
        <h3 style="margin: 0; font-family: var(--serif); font-size: 16px; color: var(--ink);">{entry.title}</h3>
      {/if}
      {#if entry.body}
        <div style="font-family: var(--serif); font-size: 15px; line-height: 1.55;">{entry.body}</div>
      {/if}
      {#if entry.media_blob_keys}
        {#await previewMedia(entry.media_blob_keys) then urls}
          {#if urls.length > 0}
            <div class="row wrap" style="gap: 8px; margin-top: 8px;">
              {#each urls as u}
                {#if u.type === 'photo'}
                  <img src={u.url} alt="Adjunto" style="max-width: 100%; border-radius: 6px;" />
                {:else if u.type === 'video'}
                  <video src={u.url} controls style="max-width: 100%; border-radius: 6px;">
                    <track kind="captions" src="" label="No captions available">
                  </video>
                {:else if u.type === 'audio'}
                  <audio src={u.url} controls style="max-width: 100%; border-radius: 6px;"></audio>
                {/if}
              {/each}
            </div>
          {/if}
        {/await}
      {/if}
      <div class="row" style="justify-content: flex-end; gap: 6px;">
        <button class="btn btn-sm" onclick={() => shareSaber(entry)}>
          <Glyph name="Sparkle" size={12} /> Compartir
        </button>
        <button class="btn btn-danger btn-sm" onclick={() => remove(entry)}>
          <Glyph name="Trash" size={12} /> Borrar
        </button>
      </div>
    </article>
  {:else}
    <div class="empty">Aún no has registrado saberes. Empieza arriba.</div>
  {/each}
</div>
