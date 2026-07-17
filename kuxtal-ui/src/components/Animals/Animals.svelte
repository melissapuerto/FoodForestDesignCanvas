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
  import { t } from '../../lib/i18n/index.svelte';
  import { localAnimalName, localAnimalNotes, localRuleMessage } from '../../lib/i18n/dataLocal';
  import { announce } from '../../lib/stores/announce';
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/utils/dates';

  let { landId }: { landId: string } = $props();

  let speciesList = $state<AnimalSpeciesRow[]>([]);
  let observations = $state<AnimalObservationRow[]>([]);
  let selectedSpeciesId = $state<string | null>(null);
  let notes = $state('');

  // Effect (auto-cleaned on unmount) instead of a manual subscription that
  // leaked once per drawer open.
  $effect(() => { if ($dbReady) untrack(refresh); });

  function refresh(): void {
    speciesList = listAnimalSpecies();
    observations = listObservations(landId);
    if (!selectedSpeciesId && speciesList.length) selectedSpeciesId = speciesList[0].id;
  }

  function addObs(): void {
    if (!selectedSpeciesId) {
      showToast({ message: t('anim_choose_first'), tone: 'warn' });
      return;
    }
    const sp = speciesById(selectedSpeciesId);
    addObservation({ landId, speciesId: selectedSpeciesId, notes: notes.trim() || null });
    notes = '';
    refresh();
    showToast({ message: t('anim_obs_saved', { name: sp ? localAnimalName(sp.id, sp.common_name) : t('anim_role_unknown') }), tone: 'ok' });
  }

  async function delObs(id: string): Promise<void> {
    const ok = await dialogConfirm({
      title: t('anim_obs_delete_q'),
      body: t('anim_obs_delete_body'),
      confirmLabel: t('common_delete'),
      danger: true
    });
    if (!ok) return;
    deleteObservation(id);
    refresh();
    showToast({ message: t('anim_obs_deleted'), tone: 'ok' });
  }

  function chooseAnimal(sp: AnimalSpeciesRow): void {
    selectedSpeciesId = sp.id;
    announce(t('anim_selected', { name: localAnimalName(sp.id, sp.common_name) }));
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
      localAnimalName(sp.id, sp.common_name).toLowerCase().includes(q) ||
      (sp.scientific_name && sp.scientific_name.toLowerCase().includes(q)) ||
      localAnimalNotes(sp.id, sp.notes).toLowerCase().includes(q)
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
    showToast({ message: t('anim_imported_toast', { name: r.n }), tone: 'ok' });
    query = '';
  }

  // ---- GBIF Search ----
  let searchQuery = $state('');
  let searchResults = $state<any[]>([]);
  let searching = $state(false);

  async function runSearch(): Promise<void> {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      showToast({ message: t('anim_min_chars'), tone: 'warn' });
      return;
    }
    searching = true;
    const res = await searchGbif(searchQuery);
    searchResults = res;
    searching = false;
    if (res.length === 0) {
      showToast({ message: t('anim_no_gbif'), tone: 'info' });
    }
  }

  function pickGbif(r: any): void {
    newName = r.n;
    newSci = r.sci;
    newNotes = r.notes;
    searchResults = [];
    showToast({ message: t('anim_gbif_filled'), tone: 'info' });
    setTimeout(() => document.getElementById('na-name')?.focus(), 50);
  }
  function saveCreate(): void {
    const name = newName.trim();
    if (!name) {
      showToast({ message: t('anim_name_required'), tone: 'warn' });
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
    showToast({ message: t('anim_added_toast', { name }), tone: 'ok' });
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
        showToast({ message: t('file_import_err'), tone: 'error' });
      } else {
        showToast({
          message: t('file_import_result', { added: String(r.added), updated: String(r.updated) }) +
            (r.errors ? t('file_import_errors_part', { n: String(r.errors) }) : ''),
          tone: r.errors ? 'warn' : 'ok'
        });
        refresh();
      }
    };
    reader.readAsText(file);
  }
</script>

<section class="card" aria-label={t('a11y_animals_catalog')}>
  <div class="row" style="margin-bottom: 12px; align-items: center;">
    <div class="label" style="margin-bottom: 0;">{t('anim_record_label')}</div>
    <div style="flex: 1;"></div>
    {#if !creating}
      <button class="btn btn-sm btn-ghost" onclick={startCreate} aria-label={t('anim_create')}>
        <Glyph name="Plus" size={14} /> {t('anim_create')}
      </button>
    {/if}
  </div>

  {#if creating}
    <section class="card creation-card">
      <div class="label" style="color: var(--ink);">{t('anim_new')}</div>
      <div class="weave" style="margin: 12px 0;" aria-hidden="true"></div>

      <!-- GBIF Search -->
      <div class="field-row">
        <label for="gbif-search">{t('anim_gbif_search')}</label>
        <div class="row">
          <input id="gbif-search" class="inp" style="flex: 1;" bind:value={searchQuery} placeholder={t('anim_name_placeholder')} onkeydown={(e) => { if(e.key === 'Enter') runSearch() }} />
          <button class="btn btn-primary" onclick={runSearch} disabled={searching}>
            {searching ? t('anim_searching') : t('anim_search_btn')}
          </button>
        </div>
      </div>
      {#if searchResults.length > 0}
        <div class="search-res">
          {#each searchResults as r}
            <button class="s-item" onclick={() => pickGbif(r)}>
              <span style="font-family: var(--serif); font-weight: var(--display-weight); color: var(--ink);">{r.n}</span>
              <span class="coord" style="color: var(--ink-soft);">{r.sci}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>

      <div class="field-row"><label for="na-name">{t('anim_common_name')}</label>
        <input id="na-name" class="inp" bind:value={newName} placeholder={t('anim_name_placeholder')} />
      </div>
      <div class="field-row"><label for="na-sci">{t('anim_sci_name')}</label>
        <input id="na-sci" class="inp" bind:value={newSci} placeholder={t('anim_sci_placeholder')} />
      </div>
      <SelectWithOther
        id="na-role"
        label={t('anim_role')}
        value={newRole}
        options={[
          { v: 'ayuda', l: t('anim_role_benefit') },
          { v: 'riesgo', l: t('anim_role_risk') },
          { v: 'neutral', l: t('anim_role_neutral') }
        ]}
        otherLabel={t('anim_role_other')}
        placeholder={t('anim_role_other_placeholder')}
        onValueChange={(v) => (newRole = v as 'ayuda' | 'riesgo' | 'neutral')}
      />
      <div class="field-row"><label for="na-notes">{t('anim_notes')}</label>
        <textarea id="na-notes" class="inp" rows="2" bind:value={newNotes} placeholder={t('anim_notes_placeholder')}></textarea>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button class="btn btn-primary" onclick={saveCreate}>
          <Glyph name="Check" size={14} /> {t('anim_save')}
        </button>
        <button class="btn" onclick={cancelCreate}>{t('anim_cancel')}</button>
      </div>
    </section>
  {/if}

  <div class="field-row" style="margin-bottom: 16px;">
    <input class="inp" type="search" aria-label={t('anim_search_local')} placeholder={t('anim_search_local')} bind:value={query} />
  </div>

  <div class="anim-grid" role="group" aria-label={t('anim_known')}>
    {#each filtered as sp}
      <button
        type="button"
        class="anim-card"
        class:on={selectedSpeciesId === sp.id}
        aria-pressed={selectedSpeciesId === sp.id}
        onclick={() => chooseAnimal(sp)}
      >
        <span class="anim-glyph"><Glyph name={animalGlyph(sp.id)} size={24} /></span>
        <span class="anim-name">{localAnimalName(sp.id, sp.common_name)}</span>
      </button>
    {:else}
      <div class="coord" style="padding: 10px; color: var(--ink-soft); grid-column: 1 / -1;">{t('anim_no_local', { query })}</div>
    {/each}
  </div>

  {#if remoteSearching}
    <div class="coord" style="padding: 10px; color: var(--ink-soft);">{t('anim_global_loading')}</div>
  {/if}

  {#if remoteResults.length > 0}
    <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>
    <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); color: var(--ink-soft); margin-bottom: 8px;">
      {t('anim_global_results')}
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
          <span class="coord" style="font-size: calc(9px * var(--text-scale)); color: var(--jade-deep);">{t('anim_import')}</span>
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
          <img src={sp.image_url} alt={localAnimalName(sp.id, sp.common_name)} style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);" />
        {:else}
          <button type="button" aria-label={t('a11y_add_photo_of', { name: localAnimalName(sp.id, sp.common_name) })} style="width: 80px; height: 80px; border-radius: 8px; border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; background: var(--paper-warm); cursor: pointer;" onclick={() => {
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
          <h3 style="margin: 0; font-family: var(--serif); font-weight: var(--display-weight); color: var(--ink);">{localAnimalName(sp.id, sp.common_name)}</h3>
          <div class="coord" style="color: var(--ink-soft);">{sp.scientific_name || t('anim_role_unknown')}</div>
          {#if sp.role}
            <div class="chip" style="margin-top: 6px; display: inline-block;">
              {sp.role === 'ayuda' ? t('anim_role_pollinator') : sp.role === 'riesgo' ? t('anim_role_pest') : t('anim_role_neutral_label')}
            </div>
          {/if}
          {#if sp.notes}
            <p style="margin: 8px 0 0 0; font-size: calc(13px * var(--text-scale));">{localAnimalNotes(sp.id, sp.notes)}</p>
          {/if}
        </div>
      </div>
    </section>
  {/if}
{/if}

<div class="weave" aria-hidden="true"></div>

<section class="card">
  <div class="label">{t('anim_observe')}</div>
  <div class="field-row" style="margin-top: 8px;">
    <label for="obsNotes">{t('anim_notes')}</label>
    <textarea
      id="obsNotes"
      class="inp"
      rows="2"
      placeholder={t('anim_obs_placeholder')}
      bind:value={notes}
    ></textarea>
  </div>
  <div class="row" style="margin-top: 10px;">
    <button class="btn btn-primary" onclick={addObs} disabled={!selectedSpeciesId}>
      <Glyph name="Plus" size={14} /> {t('anim_obs_save')}
    </button>
  </div>
</section>

{#if selectedSpeciesId}
  {@const rules = rulesFor(selectedSpeciesId)}
  {#if rules.length}
    <section class="card">
      <div class="label">{t('anim_relations')}</div>
      <div class="col" style="margin-top: 6px;">
        {#each rules as rule}
          <div class="banner {rule.relationship === 'harmful' || rule.relationship === 'incompatible' ? 'warn' : 'ok'}">
            {localRuleMessage(rule)}
          </div>
        {/each}
      </div>
    </section>
  {/if}
{/if}

<section class="anim-section">
  <div class="label">{t('anim_obs_recent', { n: String(observations.length) })}</div>
  <div class="list" style="margin-top: 8px;">
    {#each observations as obs}
      {@const sp = speciesById(obs.species_id)}
      <div class="list-item" style="justify-content: space-between;">
        <div class="row">
          <span class="anim-glyph anim-glyph-sm"><Glyph name={animalGlyph(obs.species_id)} size={18} /></span>
          <div>
            <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(16px * var(--text-scale));">{sp ? localAnimalName(sp.id, sp.common_name) : obs.species_id}</div>
            <div class="coord">{formatDateTime(obs.observed_at)}</div>
            {#if obs.notes}
              <div class="sub" style="margin-top: 4px;">{obs.notes}</div>
            {/if}
          </div>
        </div>
        <button class="btn btn-danger btn-sm" aria-label={t('a11y_delete_observation')} onclick={() => delObs(obs.id)}>
          <Glyph name="Trash" size={12} />
        </button>
      </div>
    {:else}
      <div class="empty">{t('anim_empty')}</div>
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
    font-family: var(--sans); font-size: calc(12px * var(--text-scale));
  }
  .anim-card.on { background: var(--paper-warm); border-color: var(--ocre); box-shadow: 0 0 0 2px oklch(0.62 0.16 55 / 0.2); }
  .anim-glyph { color: var(--ocre-deep); }
  .anim-glyph-sm { color: var(--ocre); }
  .anim-name { font-size: calc(12px * var(--text-scale)); text-align: center; }
</style>
