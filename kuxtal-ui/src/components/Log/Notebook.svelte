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
  import { t, getLocale } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/utils/dates';
  import { captureCurrentPosition as geolocate } from '../../lib/utils/geolocate';

  let { landId }: { landId: string } = $props();

  let entries = $state<LogRow[]>([]);
  let body = $state('');
  let search = $state('');
  let recording = $state(false);
  let pendingPhotoKey = $state<string | null>(null);
  let pendingPhotoUrl = $state<string | null>(null);
  let pendingAudioKey = $state<string | null>(null);
  let pendingAudioUrl = $state<string | null>(null);
  let kind = $state<'note' | 'observation' | 'harvest' | 'task' | 'intention' | 'inherited'>('note');
  let entryTitle = $state('');
  // Inherited-knowledge fields (HAL-10): who shared this knowledge.
  let teacher = $state('');
  let relationship = $state('');
  // Voice dictation / speech-to-text (HAL-02). Audio recording is the fallback.
  let dictating = $state(false);
  let recognition: any = null;

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let photoInputEl: HTMLInputElement | null = $state(null);

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

  // Effects (auto-cleaned on unmount) instead of manual subscriptions that
  // leaked once per drawer open.
  $effect(() => {
    const u = $authUser;
    untrack(() => { if (u && !authorName) authorName = u.username; });
  });
  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh(): void { entries = listLogs(landId, search); }

  function save(): void {
    const trimmed = body.trim();
    if (!trimmed && !pendingPhotoKey && !pendingAudioKey) {
      showToast({ message: t('nb_err_empty'), tone: 'warn' });
      return;
    }
    if (pendingPhotoKey && !trimmed) {
      showToast({
        message: t('nb_err_photo_desc'),
        tone: 'warn'
      });
      return;
    }
    const mediaKeys: string[] = [];
    if (pendingPhotoKey) mediaKeys.push(pendingPhotoKey);
    if (pendingAudioKey) mediaKeys.push(pendingAudioKey);
    let composedBody = (entryTitle.trim() ? `[${entryTitle.trim()}] ` : '') + (trimmed || '');
    if (kind === 'inherited' && teacher.trim()) {
      const relLabel = relationship ? t(('rel_' + relationship) as any) : '';
      composedBody += ` · ${relLabel ? relLabel + ': ' : ''}${teacher.trim()}`;
    }
    addLog({
      landId, kind,
      body: composedBody,
      mediaBlobKeys: mediaKeys,
      author: authorName.trim() || null,
      recordedAt: entryAt ? new Date(entryAt).toISOString() : undefined,
      lat: pendingLat ?? undefined,
      lng: pendingLng ?? undefined,
    });
    body = '';
    entryTitle = '';
    teacher = '';
    relationship = '';
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
    showToast({ message: t('nb_saved'), tone: 'ok' });
  }

  async function remove(entry: LogRow): Promise<void> {
    const ok = await dialogConfirm({
      title: t('nb_delete_title'),
      body: t('nb_delete_body'),
      confirmLabel: t('common_delete'),
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
    showToast({ message: t('nb_deleted'), tone: 'ok' });
  }

  async function startVoice(): Promise<void> {
    if (mediaRecorder && recording) {
      try { mediaRecorder.stop(); } catch {}
      return;
    }
    if (!window.isSecureContext) {
      showToast({ message: t('nb_rec_https'), tone: 'warn' });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      await dialogAlert({
        title: t('nb_rec_unavailable'),
        body: t('nb_rec_no_support')
      });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      const name = err?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        await dialogAlert({ title: t('nb_rec_denied'), body: t('nb_rec_denied_hint') });
      } else if (name === 'NotFoundError') {
        showToast({ message: t('nb_rec_no_mic'), tone: 'warn' });
      } else {
        showToast({ message: t('nb_rec_mic_err', { err: name || 'error' }), tone: 'error' });
      }
      return;
    }

    audioChunks = [];
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream);
    } catch (err: any) {
      showToast({ message: t('nb_rec_start_err', { err: err?.message ?? 'error' }), tone: 'error' });
      stream.getTracks().forEach((tr) => tr.stop());
      return;
    }
    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(audioChunks, { type: mr.mimeType || 'audio/webm' });
      audioChunks = [];
      try {
        const key = newId('voice');
        await putBlob({ key, kind: 'voice', mime: blob.type, size: blob.size, data: blob });
        if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
        pendingAudioKey = key;
        pendingAudioUrl = URL.createObjectURL(blob);
        showToast({ message: t('nb_audio_saved'), tone: 'ok' });
      } catch (err: any) {
        showToast({ message: t('nb_audio_save_err', { err: err?.message ?? 'error' }), tone: 'error' });
      } finally {
        recording = false;
        mediaRecorder = null;
      }
    };
    try {
      mr.start();
      mediaRecorder = mr;
      recording = true;
      showToast({ message: t('nb_recording_hint'), tone: 'info', durationMs: 2000 });
    } catch (err: any) {
      stream.getTracks().forEach((tr) => tr.stop());
      showToast({ message: t('nb_rec_start_err', { err: err?.message ?? 'error' }), tone: 'error' });
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

  // Speech-to-text dictation (HAL-02). Transcribes into the body field in the
  // current locale. Where the browser lacks the Web Speech API, the user falls
  // back to the audio recording above.
  function startDictation(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showToast({ message: t('nb_dictate_unavailable'), tone: 'info' });
      return;
    }
    if (dictating && recognition) {
      try { recognition.stop(); } catch {}
      return;
    }
    const rec = new SR();
    rec.lang = getLocale() === 'en' ? 'en-US' : 'es-MX';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      text = text.trim();
      if (text) body = body ? `${body} ${text}` : text;
    };
    rec.onend = () => { dictating = false; recognition = null; };
    rec.onerror = () => { dictating = false; recognition = null; };
    try {
      rec.start();
      recognition = rec;
      dictating = true;
      showToast({ message: t('nb_dictating'), tone: 'info', durationMs: 2000 });
    } catch {
      dictating = false;
      recognition = null;
    }
  }

  async function captureCurrentPosition(): Promise<void> {
    const r = await geolocate();
    if (!r.ok) {
      showToast({ message: t(r.reason === 'unsupported' ? 'nb_geo_unavailable' : 'nb_geo_failed'), tone: 'warn' });
      captureLocation = false;
      return;
    }
    pendingLat = r.lat;
    pendingLng = r.lng;
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

  const kinds = $derived<Array<{ id: typeof kind; label: string }>>([
    { id: 'note', label: t('nb_kind_note') },
    { id: 'observation', label: t('nb_kind_observation') },
    { id: 'harvest', label: t('nb_kind_harvest') },
    { id: 'task', label: t('nb_kind_task') },
    { id: 'intention', label: t('nb_kind_intention') },
    { id: 'inherited', label: t('nb_kind_inherited') },
  ]);

  const RELATIONSHIPS = ['grandmother', 'grandfather', 'parent', 'neighbor', 'elder', 'other'] as const;

  /** Chip label for an entry kind — translated, never the raw db value. */
  function kindChip(kind: string): string {
    if (kind === 'intention') return t('nb_kind_intention_chip');
    if (kind === 'inherited') return t('nb_kind_inherited_chip');
    if (kind === 'saber') return t('chip_saber');
    return t(('nb_kind_' + kind) as any);
  }
</script>

<section class="card-warm card">
  <h3 class="label">{t('nb_new_entry')}</h3>
  <div class="row wrap" style="margin-top: 8px;" role="group" aria-label={t('nb_entry_type')}>
    {#each kinds as k}
      <button
        type="button"
        class="chip"
        class:chip-jade={kind === k.id}
        aria-pressed={kind === k.id}
        onclick={() => (kind = k.id)}
      >
        {k.label}
      </button>
    {/each}
  </div>
  {#if kind === 'intention' || kind === 'inherited'}
    <input class="inp" style="margin-top: 8px;" aria-label={t('nb_title_label')} placeholder={kind === 'inherited' ? t('nb_inherited_placeholder') : t('nb_intention_placeholder')} bind:value={entryTitle} />
  {/if}
  {#if kind === 'inherited'}
    <div class="row wrap" style="margin-top: 8px; gap: 8px;">
      <div class="field-row" style="flex: 1; min-width: 150px;">
        <label for="lg-teacher" class="coord">{t('nb_inherited_teacher')}</label>
        <input id="lg-teacher" class="inp" placeholder={t('nb_inherited_teacher_ph')} bind:value={teacher} />
      </div>
      <div class="field-row" style="flex: 1; min-width: 150px;">
        <label for="lg-rel" class="coord">{t('nb_inherited_relationship')}</label>
        <select id="lg-rel" class="inp" bind:value={relationship}>
          <option value="">{t('nb_inherited_rel_none')}</option>
          {#each RELATIONSHIPS as r}
            <option value={r}>{t(('rel_' + r) as any)}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
  <textarea
    class="inp"
    rows="3"
    style="margin-top: 8px;"
    aria-label={t('nb_body_label')}
    placeholder={t('nb_body_placeholder')}
    bind:value={body}
  ></textarea>
  <div class="row wrap" style="margin-top: 8px; gap: 8px;">
    <div class="field-row" style="flex: 1; min-width: 140px;">
      <label for="lg-author" class="coord">{t('nb_author_label')}</label>
      <input id="lg-author" class="inp" placeholder={t('nb_author_placeholder')} bind:value={authorName} />
    </div>
    <div class="field-row" style="flex: 1; min-width: 180px;">
      <label for="lg-when" class="coord">{t('nb_when_label')}</label>
      <input id="lg-when" class="inp" type="datetime-local" bind:value={entryAt} />
    </div>
    <div class="field-row" style="flex: 0 0 auto; align-self: flex-end;">
      <button type="button" class="btn btn-sm" aria-pressed={captureLocation} onclick={toggleLocation}>
        <Glyph name="Map" size={12} />
        {pendingLat != null ? `${pendingLat.toFixed(3)}, ${pendingLng?.toFixed(3)}` : t('nb_attach_location')}
      </button>
    </div>
  </div>
  <div class="row wrap" style="margin-top: 8px;">
    <button class="btn" class:dictating onclick={startDictation} aria-pressed={dictating}>
      <Glyph name="Mic" size={14} /> {dictating ? t('nb_dictating_btn') : t('nb_dictate')}
    </button>
    <button class="btn" onclick={startVoice} aria-pressed={recording}>
      <Glyph name="Mic" size={14} /> {recording ? t('nb_stop_recording') : (pendingAudioKey ? t('nb_re_record') : t('nb_record_audio'))}
    </button>
    {#if pendingAudioKey}
      <button type="button" class="btn btn-sm btn-ghost" onclick={cancelAudio} aria-label={t('nb_remove_audio')}>
        <Glyph name="Close" size={12} /> {t('nb_remove_audio')}
      </button>
    {/if}
    <button type="button" class="btn" onclick={() => photoInputEl?.click()}>
      <Glyph name="Camera" size={14} /> {t('nb_photo_btn')}
    </button>
    <input
      bind:this={photoInputEl}
      type="file"
      accept="image/*"
      capture="environment"
      onchange={onPhotoChosen}
      style="display: none;"
      tabindex="-1"
      aria-hidden="true"
    />
    <button
      class="btn btn-primary"
      onclick={save}
      disabled={(!body.trim() && !pendingPhotoKey && !pendingAudioKey) || (pendingPhotoKey != null && !body.trim())}
    >
      <Glyph name="Check" size={14} /> {t('common_save')}
    </button>
  </div>
  {#if pendingAudioUrl}
    <audio controls src={pendingAudioUrl} style="width: 100%; margin-top: 10px;"></audio>
  {/if}
  {#if pendingPhotoUrl}
    <img src={pendingPhotoUrl} alt={t('nb_photo_preview_alt')} style="margin-top: 10px; max-width: 100%; border-radius: 6px; border: 1px solid var(--line);" />
    {#if !body.trim()}
      <div class="banner warn" style="margin-top: 8px;">
        {t('nb_photo_desc_hint')}
      </div>
    {/if}
  {/if}
</section>

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="row">
    <Glyph name="Help" size={14} />
    <input class="inp" type="search" aria-label={t('nb_search_placeholder')} placeholder={t('nb_search_placeholder')} bind:value={search} oninput={refresh} />
  </div>
</section>

<div class="list">
  {#each entries as entry}
    <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
      <div class="row" style="justify-content: space-between; flex-wrap: wrap; gap: 4px;">
        <span class="chip {entry.kind === 'intention' ? 'chip-jade' : entry.kind === 'inherited' ? 'chip-cinabrio' : 'chip-ocre'}">
          {kindChip(entry.kind)}
        </span>
        <span class="coord">
          {#if entry.author}@{entry.author} · {/if}
          {formatDateTime(entry.recorded_at)}
          {#if locationFromGeoJson(entry.location_geojson)} · {locationFromGeoJson(entry.location_geojson)}{/if}
        </span>
      </div>
      {#if entry.body}
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale)); line-height: 1.55;">{entry.body}</div>
      {/if}
      {#if entry.media_blob_keys}
        {#await previewMedia(entry.media_blob_keys) then url}
          {#if url}
            <img src={url} alt={t('a11y_nb_attachment')} style="max-width: 100%; border-radius: 6px;" />
          {/if}
        {/await}
        {#await previewAudios(entry.media_blob_keys) then urls}
          {#each urls as au}
            <audio controls src={au} style="width: 100%;"></audio>
          {/each}
        {/await}
      {/if}
      <div class="row" style="justify-content: flex-end;">
        <button
          class="btn btn-danger btn-sm"
          aria-label={t('nb_delete_entry_aria', { what: `${entry.kind} · ${new Date(entry.recorded_at).toLocaleString()}` })}
          onclick={() => remove(entry)}
        >
          <Glyph name="Trash" size={12} /> {t('common_delete')}
        </button>
      </div>
    </article>
  {:else}
    <div class="empty">{t('nb_empty')}</div>
  {/each}
</div>

<style>
  /* Active dictation indicator (deep ocre keeps paper text at AA contrast). */
  .dictating { background: var(--ocre-deep); color: var(--paper); border-color: var(--ocre-deep); }
  .dictating :global(svg) { animation: pulse 1.2s ease-in-out infinite; }
</style>
