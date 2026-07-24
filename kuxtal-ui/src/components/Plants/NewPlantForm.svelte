<script lang="ts">
  /**
   * The "Nueva planta" creation form, with its PFAF catalog search. Extracted
   * from PlantGuide.svelte (Use Small and Slow Solutions: split the oversize
   * core). Owns its own form + search state; tells the parent when it saves or
   * cancels so the parent can restore focus.
   */
  import { insertPlantSpecies } from '../../lib/stores/appState';
  import { searchPfaf, type PfafEntry } from '../../lib/pfaf/pfafLookup';
  import { localSpeciesName } from '../../lib/i18n/dataLocal';
  import { t } from '../../lib/i18n/index.svelte';
  import { showToast } from '../../lib/stores/toast';
  import { sunFromPfaf, functionsFromPfaf } from '../../lib/plants/guide';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import SelectWithOther from '../Layout/SelectWithOther.svelte';

  let { onSaved, onCancel }: { onSaved?: () => void; onCancel: () => void } = $props();

  let newName = $state('');
  let newSci = $state('');
  let newType = $state<string>('arbusto');
  let newOrigin = $state<string>('native');
  let newSun = $state<string>('completo');
  let newSpacing = $state<number>(1);
  let newNotes = $state('');
  let newFunctions = $state('');

  let searchQuery = $state('');
  let searchResults = $state<PfafEntry[]>([]);
  let searching = $state(false);

  async function runSearch(): Promise<void> {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      showToast({ message: t('plant_min_chars'), tone: 'warn' });
      return;
    }
    searching = true;
    const res = await searchPfaf(searchQuery);
    searchResults = res;
    searching = false;
    if (res.length === 0) showToast({ message: t('plant_no_results'), tone: 'info' });
  }

  function pickPfaf(r: PfafEntry): void {
    newName = r.n;
    newSci = r.sci;
    newSpacing = r.space || 1;
    newSun = sunFromPfaf(r.sun);
    newType = r.type;
    newFunctions = functionsFromPfaf(r).join(', ');
    newNotes = t('pg_import_notes_pfaf', { family: r.f, hard: String(r.hard), soil: r.soil, water: r.water });
    searchResults = [];
    showToast({ message: t('plant_pfaf_filled'), tone: 'info' });
    setTimeout(() => document.getElementById('np-name')?.focus(), 50);
  }

  function saveCreate(): void {
    const name = newName.trim();
    if (!name) {
      showToast({ message: t('plant_name_required'), tone: 'warn' });
      return;
    }
    const fns = newFunctions.split(',').map((s) => s.trim()).filter(Boolean);
    insertPlantSpecies({
      commonName: name,
      scientificName: newSci.trim() || null,
      spacingM: Number.isFinite(newSpacing) && newSpacing > 0 ? newSpacing : 1,
      sun: newSun || null,
      plantType: newType || null,
      origin: newOrigin || 'adapted',
      functions: fns,
      notes: newNotes.trim() || null,
      glyph: 'Seed'
    });
    showToast({ message: t('plant_saved_toast', { name }), tone: 'ok' });
    onSaved?.();
  }
</script>

<section class="card">
  <div class="label" style="display:flex; justify-content:space-between; align-items:center;">
    <span>{t('plant_new_btn')}</span>
  </div>

  <div class="field-row">
    <label for="pfaf-search">{t('plant_catalog_label')}</label>
    <div style="display: flex; gap: 8px;">
      <input id="pfaf-search" class="inp" type="search" bind:value={searchQuery}
        placeholder={t('plant_catalog_placeholder')}
        onkeydown={(e) => e.key === 'Enter' && runSearch()} />
      <button type="button" class="btn" onclick={runSearch} disabled={searching}>
        {#if searching}{t('anim_searching')}{:else}{t('anim_search_btn')}{/if}
      </button>
    </div>
  </div>
  {#if searchResults.length > 0}
    <div class="col" style="gap: 4px; margin-top: 8px; margin-bottom: 12px; max-height: 150px; overflow-y: auto; background: var(--paper-warm); padding: 8px; border-radius: 4px;">
      {#each searchResults as r}
        <button class="list-item" style="text-align: left; padding: 4px; border: 1px solid var(--line); border-radius: 4px; background: var(--paper);" onclick={() => pickPfaf(r)}>
          <strong>{localSpeciesName(r.n, r.sci)}</strong> <em>{r.sci}</em>
        </button>
      {/each}
    </div>
  {/if}

  <div class="weave" style="margin: 8px 0;" aria-hidden="true"></div>
  <div class="field-row">
    <label for="np-name">{t('plant_common_name')}</label>
    <input id="np-name" class="inp" bind:value={newName} placeholder={t('a11y_pg_ex_common')} />
  </div>
  <div class="field-row">
    <label for="np-sci">{t('anim_sci_name')}</label>
    <input id="np-sci" class="inp" bind:value={newSci} placeholder={t('a11y_pg_ex_scientific')} />
  </div>
  <div class="row" style="gap: 8px;">
    <div class="field-row" style="flex: 1;">
      <label for="np-spacing">{t('plant_spacing_label')}</label>
      <input id="np-spacing" class="inp" type="number" min="0" step="0.1" bind:value={newSpacing} />
    </div>
    <SelectWithOther id="np-sun" label={t('plant_sun_label')} value={newSun}
      options={[{ v: 'completo', l: t('sun_completo') }, { v: 'parcial', l: t('sun_parcial') }, { v: 'sombra', l: t('sun_sombra') }]}
      otherLabel={t('sun_other')} placeholder={t('sun_other_placeholder')}
      onValueChange={(v) => (newSun = v)} width="100%" />
  </div>
  <SelectWithOther id="np-type" label={t('plant_type_label')} value={newType}
    options={[{ v: 'arbol-alto', l: t('plant_type_tall_tree') }, { v: 'arbol-medio', l: t('plant_type_mid_tree') }, { v: 'arbusto', l: t('plant_type_shrub') }, { v: 'herbaceo', l: t('plant_type_herbaceous') }, { v: 'trepadora', l: t('plant_type_vine') }, { v: 'cobertura', l: t('plant_type_cover') }]}
    otherLabel={t('plant_type_other')} placeholder={t('plant_type_placeholder')}
    onValueChange={(v) => (newType = v)} />
  <SelectWithOther id="np-origin" label={t('plant_origin_label')} value={newOrigin}
    options={[{ v: 'native', l: t('plant_origin_native') }, { v: 'adapted', l: t('plant_origin_adapted') }, { v: 'invasive', l: t('plant_origin_invasive') }]}
    otherLabel={t('plant_origin_other')} placeholder={t('plant_origin_placeholder')}
    onValueChange={(v) => (newOrigin = v)} />
  <div class="field-row">
    <label for="np-fns">{t('plant_functions_label')}</label>
    <input id="np-fns" class="inp" bind:value={newFunctions} placeholder={t('plant_functions_placeholder')} />
  </div>
  <div class="field-row">
    <label for="np-notes">{t('plant_notes_label')}</label>
    <textarea id="np-notes" class="inp" rows="2" bind:value={newNotes} placeholder={t('plant_notes_placeholder')}></textarea>
  </div>
  <div class="row" style="margin-top: 10px;">
    <button class="btn btn-primary" onclick={saveCreate}>
      <Glyph name="Check" size={14} /> {t('plant_save_btn')}
    </button>
    <button class="btn" onclick={onCancel}>{t('common_cancel')}</button>
  </div>
</section>
