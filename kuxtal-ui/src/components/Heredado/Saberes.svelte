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
  import { t } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/utils/dates';

  let { landId }: { landId: string } = $props();

  let entries = $state<LogRow[]>([]);
  let title = $state('');
  let body = $state('');
  let search = $state('');
  let mediaKeys = $state<string[]>([]);
  let mediaUrls = $state<{url: string, type: string}[]>([]);
  let mediaInputEl: HTMLInputElement | null = $state(null);

  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh(): void {
    try {
      entries = listLogs(landId, search).filter(e => e.kind === 'saber');
    } catch { entries = []; }
  }

  function save(): void {
    const txtTitle = title.trim();
    const text = body.trim();
    if (!txtTitle) {
      showToast({ message: t('sab_err_title'), tone: 'warn' });
      return;
    }
    if (!text && mediaKeys.length === 0) {
      showToast({ message: t('sab_err_content'), tone: 'warn' });
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
    showToast({ message: t('sab_saved'), tone: 'ok' });
  }

  async function remove(entry: LogRow): Promise<void> {
    const ok = await dialogConfirm({
      title: t('sab_delete_confirm'),
      body: t('sab_delete_body'),
      confirmLabel: t('sab_delete_btn'),
      danger: true
    });
    if (!ok) return;
    if (entry.media_blob_keys) {
      try { for (const k of JSON.parse(entry.media_blob_keys) as string[]) await deleteBlob(k); } catch {}
    }
    deleteLog(entry.id);
    refresh();
    showToast({ message: t('sab_deleted'), tone: 'ok' });
  }

  async function shareSaber(entry: LogRow): Promise<void> {
    if (!get(authToken)) {
      showToast({ message: t('sab_share_login'), tone: 'warn' });
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
          title: t('her_saber_title', { title: entry.title || t('her_untitled') }),
          content: entry.body || t('her_no_desc'),
          category: 'saberes',
          source_type: 'saber',
          source_payload: JSON.stringify(payload),
        })
      });
      showToast({ message: t('sab_shared'), tone: 'ok' });
    } catch (e: any) {
      showToast({ message: e.message || t('sab_share_err'), tone: 'warn' });
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
  <div class="label">{t('sab_save_btn')}</div>
  <p class="sub" style="margin-top: 6px;">
    {t('sab_sub')}
  </p>
  <input class="inp" style="margin-top: 10px;" aria-label={t('sab_title_placeholder')} placeholder={t('sab_title_placeholder')} bind:value={title} />
  <textarea class="inp" rows="3" style="margin-top: 10px;" aria-label={t('sab_content_placeholder')} placeholder={t('sab_content_placeholder')} bind:value={body}></textarea>
  <div class="row wrap" style="margin-top: 8px; gap: 6px;">
    <button type="button" class="btn btn-sm" onclick={() => mediaInputEl?.click()}>
      <Glyph name="Camera" size={14} /> {t('sab_multimedia')}
    </button>
    <input
      bind:this={mediaInputEl}
      type="file"
      accept="image/*,video/*,audio/*"
      capture="environment"
      multiple
      onchange={onMedia}
      style="display: none;"
      tabindex="-1"
      aria-hidden="true"
    />
    <button class="btn btn-primary btn-sm" onclick={save} disabled={!title.trim() || (!body.trim() && mediaKeys.length === 0)}>
      <Glyph name="Check" size={14} /> {t('sab_save')}
    </button>
  </div>
  {#if mediaUrls.length > 0}
    <div class="row wrap" style="margin-top: 8px; gap: 8px;">
      {#each mediaUrls as m}
        {#if m.type === 'photo'}
          <img src={m.url} alt={t('a11y_preview')} style="width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line);" />
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
    <input class="inp" type="search" aria-label={t('sab_search')} placeholder={t('sab_search')} bind:value={search} oninput={refresh} />
  </div>
</section>

<div class="list">
  {#each entries as entry}
    <article class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px;">
      <div class="row" style="justify-content: space-between;">
        <span class="chip chip-ocre">{t('sab_singular')}</span>
        <span class="coord">{formatDateTime(entry.recorded_at)}</span>
      </div>
      {#if entry.title}
        <h3 style="margin: 0; font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale)); color: var(--ink);">{entry.title}</h3>
      {/if}
      {#if entry.body}
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(15px * var(--text-scale)); line-height: 1.55;">{entry.body}</div>
      {/if}
      {#if entry.media_blob_keys}
        {#await previewMedia(entry.media_blob_keys) then urls}
          {#if urls.length > 0}
            <div class="row wrap" style="gap: 8px; margin-top: 8px;">
              {#each urls as u}
                {#if u.type === 'photo'}
                  <img src={u.url} alt={t('a11y_attachment')} style="max-width: 100%; border-radius: 6px;" />
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
        <button class="btn btn-sm" aria-label={t('sab_share_this', { title: entry.title ?? '' })} onclick={() => shareSaber(entry)}>
          <Glyph name="Sparkle" size={12} /> {t('rules_share_btn')}
        </button>
        <button class="btn btn-danger btn-sm" aria-label={t('sab_delete_this', { title: entry.title ?? '' })} onclick={() => remove(entry)}>
          <Glyph name="Trash" size={12} /> {t('common_delete')}
        </button>
      </div>
    </article>
  {:else}
    <div class="empty">{t('sab_empty')}</div>
  {/each}
</div>
