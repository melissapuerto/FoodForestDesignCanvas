<script lang="ts">
  import {
    listAnimalSpecies,
    listObservations,
    addObservation,
    deleteObservation,
    speciesById,
    insertAnimalSpecies,
    importAnimalSpeciesFromJson,
    type AnimalSpeciesRow,
    type AnimalObservationRow
  } from '../../lib/db/animals';
  import { listRulesForSpecies } from '../../lib/rules/engine';
  import { dbReady } from '../../lib/stores/appState';
  import { showToast } from '../../lib/stores/toast';
  import { dialogConfirm } from '../../lib/stores/dialog';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { animalGlyph } from '../../lib/glyphs/mapping';
  import SelectWithOther from '../Layout/SelectWithOther.svelte';
  import { searchGbif } from '../../lib/pfaf/animalLookup';

  let { landId }: { landId: string } = $props();

  let speciesList = $state<AnimalSpeciesRow[]>([]);
  let observations = $state<AnimalObservationRow[]>([]);
  let selectedSpeciesId = $state<string | null>(null);
  let notes = $state('');

  dbReady.subscribe((ready) => { if (ready) refresh(); });

  function refresh(): void {
    speciesList = listAnimalSpecies();
    observations = listObservations(landId);
    if (!selectedSpeciesId && speciesList.length) selectedSpeciesId = speciesList[0].id;
  }

  function addObs(): void {
    if (!selectedSpeciesId) {
      showToast({ message: 'Elige primero un animal del catálogo.', tone: 'warn' });
      return;
    }
    const sp = speciesById(selectedSpeciesId);
    addObservation({ landId, speciesId: selectedSpeciesId, notes: notes.trim() || null });
    notes = '';
    refresh();
    showToast({ message: `Observación de ${sp?.common_name ?? 'animal'} guardada.`, tone: 'ok' });
  }

  async function delObs(id: string): Promise<void> {
    const ok = await dialogConfirm({
      title: '¿Borrar esta observación?',
      body: 'Se eliminará del registro local.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    deleteObservation(id);
    refresh();
    showToast({ message: 'Observación borrada.', tone: 'ok' });
  }

  function rulesFor(speciesId: string) {
    return listRulesForSpecies(speciesId, 'animal');
  }

  // ---- Nuevo animal ----
  let creating = $state(false);
  let newName = $state('');
  let newSci = $state('');
  let newRole = $state<'ayuda' | 'riesgo' | 'neutral'>('neutral');
  let newNotes = $state('');

  function startCreate(): void {
    creating = true;
    newName = '';
    newSci = '';
    newRole = 'neutral';
    newNotes = '';
  }
  function cancelCreate(): void { creating = false; }

  // ---- Search ----
  let query = $state('');
  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return speciesList;
    return speciesList.filter(sp => 
      sp.common_name.toLowerCase().includes(q) || 
      (sp.scientific_name && sp.scientific_name.toLowerCase().includes(q))
    );
  });

  let remoteResults = $state<any[]>([]);
  let remoteSearching = $state(false);

  $effect(() => {
    const q = query.trim();
    if (q.length >= 3) {
      remoteSearching = true;
      searchGbif(q).then(res => {
        const localSci = new Set(speciesList.map(s => s.scientific_name?.toLowerCase()).filter(Boolean));
        remoteResults = res.filter(r => !localSci.has(r.sci.toLowerCase()));
      }).finally(() => {
        remoteSearching = false;
      });
    } else {
      remoteResults = [];
    }
  });

  function importGbif(r: any): void {
    const id = insertAnimalSpecies({
      commonName: r.n,
      scientificName: r.sci || null,
      role: r.role || 'neutral',
      notes: r.notes || null,
      glyph: 'Sparkle'
    });
    refresh();
    selectedSpeciesId = id;
    showToast({ message: `Animal "${r.n}" importado al catálogo.`, tone: 'ok' });
    query = '';
  }

  // ---- GBIF Search ----
  let searchQuery = $state('');
  let searchResults = $state<any[]>([]);
  let searching = $state(false);

  async function runSearch(): Promise<void> {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      showToast({ message: 'Escribe al menos 3 letras para buscar.', tone: 'warn' });
      return;
    }
    searching = true;
    const res = await searchGbif(searchQuery);
    searchResults = res;
    searching = false;
    if (res.length === 0) {
      showToast({ message: 'No se encontraron resultados en GBIF.', tone: 'info' });
    }
  }

  function pickGbif(r: any): void {
    newName = r.n;
    newSci = r.sci;
    newNotes = r.notes;
    searchResults = [];
  }
  function saveCreate(): void {
    const name = newName.trim();
    if (!name) {
      showToast({ message: 'El nombre común es obligatorio.', tone: 'warn' });
      return;
    }
    const id = insertAnimalSpecies({
      commonName: name,
      scientificName: newSci.trim() || null,
      role: newRole,
      notes: newNotes.trim() || null,
      glyph: 'Sparkle'
    });
    creating = false;
    refresh();
    selectedSpeciesId = id;
    showToast({ message: `Animal "${name}" agregado al catálogo.`, tone: 'ok' });
  }

  function onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = importAnimalSpeciesFromJson(String(reader.result));
      input.value = '';
      if (r.errors && !(r.added + r.updated)) {
        showToast({ message: 'No pude leer ese archivo. Revisa que sea un JSON válido.', tone: 'error' });
      } else {
        showToast({
          message: `${r.added} agregados, ${r.updated} actualizados${r.errors ? `, ${r.errors} con error` : ''}.`,
          tone: r.errors ? 'warn' : 'ok'
        });
        refresh();
      }
    };
    reader.readAsText(file);
  }
</script>

<section class="card" aria-label="Catálogo de animales locales">
  <div class="row" style="margin-bottom: 12px; align-items: center;">
    <div class="label" style="margin-bottom: 0;">Registro animal</div>
    <div style="flex: 1;"></div>
    {#if !creating}
      <button class="btn btn-sm btn-ghost" onclick={startCreate} aria-label="Crear nueva especie de animal">
        <Glyph name="Plus" size={14} /> Crear animal
      </button>
    {/if}
  </div>

  {#if creating}
    <section class="card creation-card">
      <div class="label" style="color: var(--ink);">Nuevo Animal</div>
      <div class="weave" style="margin: 12px 0;" aria-hidden="true"></div>

      <!-- GBIF Search -->
      <div class="field-row">
        <label for="gbif-search">Buscar en la base global GBIF</label>
        <div class="row">
          <input id="gbif-search" class="inp" style="flex: 1;" bind:value={searchQuery} placeholder="ej. Jaguar" onkeydown={(e) => { if(e.key === 'Enter') runSearch() }} />
          <button class="btn btn-primary" onclick={runSearch} disabled={searching}>
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>
      {#if searchResults.length > 0}
        <div class="search-res">
          {#each searchResults as r}
            <button class="s-item" onclick={() => pickGbif(r)}>
              <span style="font-family: var(--serif); color: var(--ink);">{r.n}</span>
              <span class="coord" style="color: var(--ink-soft);">{r.sci}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>

      <div class="field-row"><label for="na-name">Nombre común *</label>
        <input id="na-name" class="inp" bind:value={newName} placeholder="ej. Jaguar" />
      </div>
      <div class="field-row"><label for="na-sci">Nombre científico</label>
        <input id="na-sci" class="inp" bind:value={newSci} placeholder="ej. Panthera onca" />
      </div>
      <SelectWithOther
        id="na-role"
        label="Rol en el ecosistema"
        value={newRole}
        options={[
          { v: 'ayuda', l: 'Ayuda · poliniza/controla' },
          { v: 'riesgo', l: 'Riesgo · plaga' },
          { v: 'neutral', l: 'Neutral · convive' }
        ]}
        otherLabel="Otro rol…"
        placeholder="ej. depredador estacional"
        onValueChange={(v) => (newRole = v as 'ayuda' | 'riesgo' | 'neutral')}
      />
      <div class="field-row"><label for="na-notes">Notas</label>
        <textarea id="na-notes" class="inp" rows="2" bind:value={newNotes} placeholder="Cómo se comporta, dónde lo viste, qué cuida o daña."></textarea>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button class="btn btn-primary" onclick={saveCreate}>
          <Glyph name="Check" size={14} /> Guardar animal
        </button>
        <button class="btn" onclick={cancelCreate}>Cancelar</button>
      </div>
    </section>
  {/if}
  
  <div class="field-row" style="margin-bottom: 16px;">
    <input class="inp" type="search" placeholder="Buscar animal local o global..." bind:value={query} />
  </div>

  <div class="anim-grid" role="radiogroup" aria-label="Animales conocidos">
    {#each filtered as sp}
      <button
        type="button"
        class="anim-card"
        class:on={selectedSpeciesId === sp.id}
        role="radio"
        aria-checked={selectedSpeciesId === sp.id}
        onclick={() => (selectedSpeciesId = sp.id)}
      >
        <span class="anim-glyph"><Glyph name={animalGlyph(sp.id)} size={24} /></span>
        <span class="anim-name">{sp.common_name}</span>
      </button>
    {:else}
      <div class="coord" style="padding: 10px; color: var(--ink-soft); grid-column: 1 / -1;">No hay resultados locales para "{query}".</div>
    {/each}
  </div>

  {#if remoteSearching}
    <div class="coord" style="padding: 10px; color: var(--ink-soft);">Buscando en la base de datos global...</div>
  {/if}

  {#if remoteResults.length > 0}
    <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>
    <div style="font-family: var(--serif); font-size: 14px; color: var(--ink-soft); margin-bottom: 8px;">
      Resultados desde la base de datos global:
    </div>
    <div class="anim-grid">
      {#each remoteResults as r}
        <button
          type="button"
          class="anim-card"
          style="border-color: var(--jade); border-style: dashed;"
          onclick={() => importGbif(r)}
        >
          <span class="anim-glyph" style="color: var(--jade);"><Glyph name="Sparkle" size={24} /></span>
          <span class="anim-name">{r.n}</span>
          <span class="coord" style="font-size: 9px; color: var(--jade-deep);">+ Importar</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

{#if selectedSpeciesId}
  {@const sp = speciesById(selectedSpeciesId)}
  {#if sp}
    <div class="weave" aria-hidden="true"></div>
    <section class="card">
      <div class="row" style="align-items: flex-start; gap: 16px;">
        {#if sp.image_url}
          <img src={sp.image_url} alt={sp.common_name} style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);" />
        {:else}
          <button type="button" aria-label="Agregar foto de {sp.common_name}" style="width: 80px; height: 80px; border-radius: 8px; border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; background: var(--paper-warm); cursor: pointer;" onclick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  import('../../lib/db/sqlite').then(({ exec }) => {
                    exec('UPDATE animal_species SET image_url = ? WHERE id = ?', [dataUrl, sp.id]);
                    refresh();
                  });
                };
                reader.readAsDataURL(file);
              }
            };
            input.click();
          }}>
            <Glyph name={animalGlyph(sp.id)} size={32} />
          </button>
        {/if}
        <div style="flex: 1;">
          <h3 style="margin: 0; font-family: var(--serif); color: var(--ink);">{sp.common_name}</h3>
          <div class="coord" style="color: var(--ink-soft);">{sp.scientific_name || 'Desconocido'}</div>
          {#if sp.role}
            <div class="chip" style="margin-top: 6px; display: inline-block;">
              {sp.role === 'ayuda' ? 'Polinizador / Ayuda' : sp.role === 'riesgo' ? 'Riesgo / Plaga' : 'Neutral'}
            </div>
          {/if}
          {#if sp.notes}
            <p style="margin: 8px 0 0 0; font-size: 13px;">{sp.notes}</p>
          {/if}
        </div>
      </div>
    </section>
  {/if}
{/if}

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="label">Registrar observación</div>
  <div class="field-row" style="margin-top: 8px;">
    <label for="obsNotes">Notas</label>
    <textarea
      id="obsNotes"
      class="inp"
      rows="2"
      placeholder="¿Dónde lo viste? ¿Con qué planta?"
      bind:value={notes}
    ></textarea>
  </div>
  <div class="row" style="margin-top: 10px;">
    <button class="btn btn-primary" onclick={addObs} disabled={!selectedSpeciesId}>
      <Glyph name="Plus" size={14} /> Registrar
    </button>
  </div>
</section>

{#if selectedSpeciesId}
  {@const rules = rulesFor(selectedSpeciesId)}
  {#if rules.length}
    <section class="card">
      <div class="label">Relaciones conocidas</div>
      <div class="col" style="margin-top: 6px;">
        {#each rules as rule}
          <div class="banner {rule.relationship === 'harmful' || rule.relationship === 'incompatible' ? 'warn' : 'ok'}">
            {rule.message}
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<section class="anim-section">
  <div class="label">Observaciones recientes ({observations.length})</div>
  <div class="list" style="margin-top: 8px;">
    {#each observations as obs}
      {@const sp = speciesById(obs.species_id)}
      <div class="list-item" style="justify-content: space-between;">
        <div class="row">
          <span class="anim-glyph anim-glyph-sm"><Glyph name={animalGlyph(obs.species_id)} size={18} /></span>
          <div>
            <div style="font-family: var(--serif); font-size: 16px;">{sp?.common_name ?? obs.species_id}</div>
            <div class="coord">{new Date(obs.observed_at).toLocaleString('es-CO')}</div>
            {#if obs.notes}
              <div class="sub" style="margin-top: 4px;">{obs.notes}</div>
            {/if}
          </div>
        </div>
        <button class="btn btn-danger btn-sm" aria-label="Borrar observación" onclick={() => delObs(obs.id)}>
          <Glyph name="Trash" size={12} />
        </button>
      </div>
    {:else}
      <div class="empty">Aún no has registrado animales en tu tierra.</div>
    {/each}
  </div>
</section>

<style>
  .anim-section { display: flex; flex-direction: column; gap: 8px; }
  .anim-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .anim-card {
    background: var(--paper);
    border: 1.5px solid var(--line-strong);
    border-radius: 6px;
    padding: 10px 8px;
    cursor: pointer;
    color: var(--ink);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    font-family: var(--sans); font-size: 12px;
  }
  .anim-card.on { background: var(--paper-warm); border-color: var(--ocre); box-shadow: 0 0 0 2px oklch(0.62 0.16 55 / 0.2); }
  .anim-glyph { color: var(--ocre-deep); }
  .anim-glyph-sm { color: var(--ocre); }
  .anim-name { font-size: 12px; text-align: center; }
</style>
