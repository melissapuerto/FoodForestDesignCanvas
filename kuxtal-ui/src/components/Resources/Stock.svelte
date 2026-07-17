<script lang="ts">
  import {
    listResources, upsertResource, deleteResource, adjustQuantity, type ResourceRow
  } from '../../lib/db/resources';
  import { dbReady } from '../../lib/stores/appState';
  import { showToast } from '../../lib/stores/toast';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { untrack } from 'svelte';
  import { formatDate } from '../../lib/utils/dates';

  let items = $state<ResourceRow[]>([]);
  let editing = $state<Partial<ResourceRow> | null>(null);

  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh(): void { items = listResources(); }

  function newItem(): void { editing = { name: '', category: 'Insumo', quantity: 0, unit: 'kg', notes: '' }; }

  function save(): void {
    if (!editing?.name?.trim()) { showToast({ message: t('stock_err_name'), tone: 'warn' }); return; }
    const isNew = !editing.id;
    upsertResource({
      id: editing.id,
      name: editing.name.trim(),
      category: editing.category ?? null,
      quantity: editing.quantity ?? 0,
      unit: editing.unit ?? null,
      notes: editing.notes ?? null
    });
    editing = null;
    refresh();
    showToast({ message: isNew ? t('stock_added') : t('stock_updated'), tone: 'ok' });
  }

  async function askDelete(item: ResourceRow): Promise<void> {
    const ok = await dialogConfirm({
      title: t('stock_delete_confirm', { name: item.name }),
      body: t('stock_delete_body'),
      confirmLabel: t('common_delete'), danger: true
    });
    if (!ok) return;
    deleteResource(item.id);
    refresh();
    showToast({ message: t('stock_deleted'), tone: 'ok' });
  }

  let groups = $derived.by(() => {
    const out = new Map<string, ResourceRow[]>();
    for (const it of items) {
      const cat = it.category || 'Otros';
      if (!out.has(cat)) out.set(cat, []);
      out.get(cat)!.push(it);
    }
    return out;
  });
</script>

<section class="card-warm card">
  <div class="row" style="justify-content: space-between; align-items: center;">
    <div>
      <div class="label">{t('stock_title')}</div>
      <div class="sub">{t('stock_sub')}</div>
    </div>
    <button class="btn btn-primary" onclick={newItem}><Glyph name="Plus" size={14} /> {t('stock_new')}</button>
  </div>
</section>

{#if editing}
  <section class="card">
    <div class="label">{editing.id ? t('stock_edit_title') : t('stock_new_title')}</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <div class="field-row"><label for="rName">{t('stock_name_label')}</label>
      <input id="rName" class="inp" bind:value={editing.name} />
    </div>
    <div class="row" style="gap: 8px;">
      <div class="field-row" style="flex: 1;"><label for="rCat">{t('stock_category_label')}</label>
        <input id="rCat" class="inp" bind:value={editing.category} placeholder={t('stock_category_placeholder')} />
      </div>
      <div class="field-row" style="width: 110px;"><label for="rUnit">{t('stock_unit_label')}</label>
        <input id="rUnit" class="inp" bind:value={editing.unit} placeholder={t('stock_unit_placeholder')} />
      </div>
    </div>
    <div class="field-row"><label for="rQty">{t('stock_qty_label')}</label>
      <input id="rQty" class="inp" type="number" step="0.1" bind:value={editing.quantity} />
    </div>
    <div class="field-row"><label for="rNotes">{t('stock_notes_label')}</label>
      <textarea id="rNotes" class="inp" rows="2" bind:value={editing.notes}></textarea>
    </div>
    <div class="row" style="margin-top: 10px;">
      <button class="btn btn-primary" onclick={save}><Glyph name="Check" size={14} /> {t('stock_save')}</button>
      <button class="btn" onclick={() => (editing = null)}>{t('stock_cancel')}</button>
    </div>
  </section>
{/if}

{#each [...groups.entries()] as [cat, list]}
  <section class="cat-block">
    <div class="cat-head">
      <span class="cat-name">{cat}</span>
      <span class="coord">{list.length === 1 ? t('stock_count', { n: String(list.length) }) : t('stock_count_plural', { n: String(list.length) })}</span>
    </div>
    <div class="list">
      {#each list as it}
        <article class="list-item" style="justify-content: space-between;">
          <div>
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale));">{it.name}</div>
            <div class="coord">
              {it.quantity} {it.unit ?? ''} · {t('stock_updated_on', { date: formatDate(it.last_updated) })}
            </div>
            {#if it.notes}
              <div class="sub" style="margin-top: 4px;">{it.notes}</div>
            {/if}
          </div>
          <div class="row" style="gap: 4px;">
            <button class="btn btn-sm" aria-label={t('stock_subtract_aria', { name: it.name })} onclick={() => { adjustQuantity(it.id, -1); refresh(); }}>−1</button>
            <button class="btn btn-sm" aria-label={t('stock_add_aria', { name: it.name })} onclick={() => { adjustQuantity(it.id, 1); refresh(); }}>+1</button>
            <button class="btn btn-sm" aria-label={t('stock_edit_aria', { name: it.name })} onclick={() => (editing = { ...it })}>{t('stock_edit_btn')}</button>
            <button class="btn btn-danger btn-sm" aria-label={t('stock_delete_aria', { name: it.name })} onclick={() => askDelete(it)}><Glyph name="Trash" size={12} /></button>
          </div>
        </article>
      {/each}
    </div>
  </section>
{:else}
  <div class="empty">
    <Glyph name="Box" size={28} decorative={false} title={t('a11y_stock_empty')} />
    <div style="margin-top: 8px;">{t('stock_empty')}</div>
    <button class="btn btn-sm btn-accent" style="margin-top: 10px;" onclick={newItem}>
      <Glyph name="Plus" size={12} /> {t('stock_add_first')}
    </button>
  </div>
{/each}

<style>
  .cat-block { display: flex; flex-direction: column; gap: 8px; }
  .cat-head { display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px; }
  .cat-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); }
</style>
