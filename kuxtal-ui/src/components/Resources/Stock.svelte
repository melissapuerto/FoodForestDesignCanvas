<script lang="ts">
  import {
    listResources, upsertResource, deleteResource, adjustQuantity, type ResourceRow
  } from '../../lib/db/resources';
  import { dbReady } from '../../lib/stores/appState';
  import { showToast } from '../../lib/stores/toast';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let items = $state<ResourceRow[]>([]);
  let editing = $state<Partial<ResourceRow> | null>(null);

  dbReady.subscribe((ready) => { if (ready) refresh(); });

  function refresh(): void { items = listResources(); }

  function newItem(): void { editing = { name: '', category: 'Insumo', quantity: 0, unit: 'kg', notes: '' }; }

  function save(): void {
    if (!editing?.name?.trim()) { showToast({ message: 'Escribe un nombre antes de guardar.', tone: 'warn' }); return; }
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
    showToast({ message: isNew ? 'Recurso agregado.' : 'Recurso actualizado.', tone: 'ok' });
  }

  async function askDelete(item: ResourceRow): Promise<void> {
    const ok = await dialogConfirm({
      title: `¿Borrar "${item.name}"?`,
      body: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Borrar', danger: true
    });
    if (!ok) return;
    deleteResource(item.id);
    refresh();
    showToast({ message: 'Recurso borrado.', tone: 'ok' });
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
      <div class="label">Inventario</div>
      <div class="sub">Semillas, herramientas, abonos y materiales.</div>
    </div>
    <button class="btn btn-primary" onclick={newItem}><Glyph name="Plus" size={14} /> Nuevo</button>
  </div>
</section>

{#if editing}
  <section class="card">
    <div class="label">{editing.id ? 'Editar recurso' : 'Nuevo recurso'}</div>
    <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
    <div class="field-row"><label for="rName">Nombre</label>
      <input id="rName" class="inp" bind:value={editing.name} />
    </div>
    <div class="row" style="gap: 8px;">
      <div class="field-row" style="flex: 1;"><label for="rCat">Categoría</label>
        <input id="rCat" class="inp" bind:value={editing.category} placeholder="Semilla, herramienta, abono..." />
      </div>
      <div class="field-row" style="width: 110px;"><label for="rUnit">Unidad</label>
        <input id="rUnit" class="inp" bind:value={editing.unit} placeholder="kg, l, u" />
      </div>
    </div>
    <div class="field-row"><label for="rQty">Cantidad</label>
      <input id="rQty" class="inp" type="number" step="0.1" bind:value={editing.quantity} />
    </div>
    <div class="field-row"><label for="rNotes">Notas</label>
      <textarea id="rNotes" class="inp" rows="2" bind:value={editing.notes}></textarea>
    </div>
    <div class="row" style="margin-top: 10px;">
      <button class="btn btn-primary" onclick={save}><Glyph name="Check" size={14} /> Guardar</button>
      <button class="btn" onclick={() => (editing = null)}>Cancelar</button>
    </div>
  </section>
{/if}

{#each [...groups.entries()] as [cat, list]}
  <section class="cat-block">
    <div class="cat-head">
      <span class="cat-name">{cat}</span>
      <span class="coord">{list.length} {list.length === 1 ? 'recurso' : 'recursos'}</span>
    </div>
    <div class="list">
      {#each list as it}
        <article class="list-item" style="justify-content: space-between;">
          <div>
            <div style="font-family: var(--serif); font-size: 16px;">{it.name}</div>
            <div class="coord">
              {it.quantity} {it.unit ?? ''} · actualizado {new Date(it.last_updated).toLocaleDateString('es-CO')}
            </div>
            {#if it.notes}
              <div class="sub" style="margin-top: 4px;">{it.notes}</div>
            {/if}
          </div>
          <div class="row" style="gap: 4px;">
            <button class="btn btn-sm" aria-label={`Restar uno de ${it.name}`} onclick={() => { adjustQuantity(it.id, -1); refresh(); }}>−1</button>
            <button class="btn btn-sm" aria-label={`Sumar uno a ${it.name}`} onclick={() => { adjustQuantity(it.id, 1); refresh(); }}>+1</button>
            <button class="btn btn-sm" onclick={() => (editing = { ...it })}>Editar</button>
            <button class="btn btn-danger btn-sm" aria-label={`Borrar ${it.name}`} onclick={() => askDelete(it)}><Glyph name="Trash" size={12} /></button>
          </div>
        </article>
      {/each}
    </div>
  </section>
{:else}
  <div class="empty">
    <Glyph name="Box" size={28} decorative={false} title="Sin recursos" />
    <div style="margin-top: 8px;">Sin recursos registrados.</div>
    <button class="btn btn-sm btn-accent" style="margin-top: 10px;" onclick={newItem}>
      <Glyph name="Plus" size={12} /> Agregar el primero
    </button>
  </div>
{/each}

<style>
  .cat-block { display: flex; flex-direction: column; gap: 8px; }
  .cat-head { display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px; }
  .cat-name { font-family: var(--serif); font-size: 18px; }
</style>
