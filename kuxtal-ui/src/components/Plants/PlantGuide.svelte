<script lang="ts">
  import {
    species,
    insertPlantSpecies,
    importPlantSpeciesFromJson,
    dbReady,
    type SpeciesRow
  } from '../../lib/stores/appState'
  import { listRulesForSpecies } from '../../lib/rules/engine'
  import type { Rule } from '../../lib/rules/types'
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping'
  import { formatMeters } from '../../lib/utils/format'
  import SelectWithOther from '../Layout/SelectWithOther.svelte'
  import { showToast } from '../../lib/stores/toast'
  import { addRecentPlant } from '../../lib/stores/recents'
  import { searchPfaf, type PfafEntry } from '../../lib/pfaf/pfafLookup'
  import { isDbReady } from '../../lib/db/sqlite'
  import { getSiteContext } from '../../lib/pfaf/siteContext'
  import { filterSpeciesForSite, sortSpeciesForSite } from '../../lib/pfaf/catalogSort'
  import { bioregionLabel } from '../../lib/climate/region'
  import { localSpeciesName, localSpeciesNotes, localPfafField, localFunction, localEdiblePart, localRuleMessage } from '../../lib/i18n/dataLocal'
  import { t, type TranslationKey } from '../../lib/i18n/index.svelte'
  import { dialogAlert } from '../../lib/stores/dialog'
  import { classifyProvenance, provenanceLabelKey, provenanceGlyph, isCommunityKnowledge } from '../../lib/pfaf/provenance'
  import type { GlyphName } from '../../lib/glyphs/glyph-data'

  let {
    onPick
  }: {
    onPick?: (id: string) => void
  } = $props()

  // ---- Provenance (PD-10) ----
  function provLabel(source: string | null): string {
    return t(provenanceLabelKey(classifyProvenance(source)) as TranslationKey)
  }
  function provIcon(source: string | null): GlyphName {
    return provenanceGlyph(classifyProvenance(source)) as GlyphName
  }
  function explainProvenance(): void {
    dialogAlert({ title: t('prov_explain_title'), body: t('prov_explain_body') })
  }

  let importInputEl: HTMLInputElement | null = $state(null)
  let newPlantBtnEl: HTMLButtonElement | null = $state(null)
  // Auto-subscriptions: the catalog remounts on every drawer open, and manual
  // .subscribe() calls leaked once per open.
  const allSpecies = $derived($species)
  const catalogDbReady = $derived($dbReady)

  let query = $state('')
  let originFilter = $state<Set<'native' | 'adapted' | 'invasive'>>(
    new Set(['native', 'adapted'])
  )
  let functionFilter = $state<string>('all')
  let openId = $state<string | null>(null)

  function toggleOrigin(o: 'native' | 'adapted' | 'invasive'): void {
    const next = new Set(originFilter)
    if (next.has(o)) next.delete(o)
    else next.add(o)
    originFilter = next
  }

  let allFunctions = $derived.by(() => {
    const set = new Set<string>()
    for (const sp of allSpecies)
      for (const f of parseList(sp.functions)) set.add(f)
    return ['all', ...Array.from(set).sort()]
  })

  const siteCtx = $derived(catalogDbReady && isDbReady() ? getSiteContext() : null)

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase()
    const base = filterSpeciesForSite(allSpecies, siteCtx)
    const rows = base.filter((sp) => {
      const aliasesStr = sp.aliases
        ? (() => {
            try {
              return JSON.parse(sp.aliases).join(' ')
            } catch {
              return ''
            }
          })()
        : ''
      const matchesQ =
        !q ||
        // Match the name shown in the active language as well as the stored
        // Spanish one, so an English user can search "avocado" or "aguacate".
        `${sp.common_name} ${localSpeciesName(sp.common_name, sp.scientific_name)} ${sp.scientific_name ?? ''} ${aliasesStr} ${sp.notes ?? ''} ${localSpeciesNotes(sp.id, sp.notes)}`
          .toLowerCase()
          .includes(q)
      const matchesO = sp.origin ? originFilter.has(sp.origin as any) : true
      const fns = parseList(sp.functions)
      const matchesF = functionFilter === 'all' || fns.includes(functionFilter)
      return matchesQ && matchesO && matchesF
    })
    return sortSpeciesForSite(rows, siteCtx)
  })

  let remoteResults = $state<PfafEntry[]>([])
  let remoteSearching = $state(false)
  $effect(() => {
    const q = query.trim()
    if (q.length >= 3) {
      remoteSearching = true
      searchPfaf(q)
        .then((res) => {
          // filter out species we already have locally by scientific name
          const localSci = new Set(
            allSpecies
              .map((s) => s.scientific_name?.toLowerCase())
              .filter(Boolean)
          )
          remoteResults = res.filter((r) => !localSci.has(r.sci.toLowerCase()))
        })
        .finally(() => {
          remoteSearching = false
        })
    } else {
      remoteResults = []
    }
  })

  function parseList(raw: string | null): string[] {
    if (!raw) return []
    try {
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  }

  function rulesFor(speciesId: string): Rule[] {
    return listRulesForSpecies(speciesId, 'plant')
  }

  function resetFilters(): void {
    query = ''
    originFilter = new Set(['native', 'adapted'])
    functionFilter = 'all'
  }

  // ---- Nueva planta form ----
  let creating = $state(false)
  let newName = $state('')
  let newSci = $state('')
  let newType = $state<string>('arbusto')
  let newOrigin = $state<string>('native')
  let newSun = $state<string>('completo')
  let newSpacing = $state<number>(1)
  let newNotes = $state('')
  let newFunctions = $state('')

  function startCreate(): void {
    creating = true
    newName = ''
    newSci = ''
    newType = 'arbusto'
    newOrigin = 'native'
    newSun = 'completo'
    newSpacing = 1
    newNotes = ''
    newFunctions = ''
    searchQuery = ''
    searchResults = []
  }

  function cancelCreate(): void {
    creating = false
  }

  // ---- PFAF Search ----
  let searchQuery = $state('')
  let searchResults = $state<PfafEntry[]>([])
  let searching = $state(false)

  async function runSearch(): Promise<void> {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      showToast({
        message: t('plant_min_chars'),
        tone: 'warn'
      })
      return
    }
    searching = true
    const res = await searchPfaf(searchQuery)
    searchResults = res
    searching = false
    if (res.length === 0) {
      showToast({
        message: t('plant_no_results'),
        tone: 'info'
      })
    }
  }

  function pickPfaf(r: PfafEntry): void {
    newName = r.n
    newSci = r.sci
    newSpacing = r.space || 1
    newSun = r.sun.toLowerCase().includes('pleno')
      ? 'completo'
      : r.sun.toLowerCase().includes('sombra')
        ? 'sombra'
        : 'parcial'
    newType = r.type

    const fns: string[] = []
    if (r.edible > 3) fns.push('Comestible')
    if (r.med > 3) fns.push('Medicinal')
    if (r.other > 3) fns.push('Soporte/Otros')
    if (r.hab) fns.push(r.hab)
    newFunctions = fns.join(', ')

    newNotes = t('pg_import_notes_pfaf', { family: r.f, hard: String(r.hard), soil: r.soil, water: r.water })
    searchResults = []
    showToast({ message: t('plant_pfaf_filled'), tone: 'info' })
    setTimeout(() => document.getElementById('np-name')?.focus(), 50)
  }

  function onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const r = importPlantSpeciesFromJson(String(reader.result))
      input.value = ''
      if (r.errors && !(r.added + r.updated)) {
        showToast({ message: t('file_import_err'), tone: 'error' })
      } else {
        showToast({
          message: t('file_import_result', { added: String(r.added), updated: String(r.updated) }) +
            (r.errors ? t('file_import_errors_part', { n: String(r.errors) }) : ''),
          tone: r.errors ? 'warn' : 'ok'
        })
      }
    }
    reader.readAsText(file)
  }

  function saveCreate(): void {
    const name = newName.trim()
    if (!name) {
      showToast({ message: t('plant_name_required'), tone: 'warn' })
      return
    }
    const fns = newFunctions
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
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
    })
    showToast({ message: t('plant_saved_toast', { name }), tone: 'ok' })
    creating = false
    setTimeout(() => newPlantBtnEl?.focus(), 50)
  }
</script>

<div class="card-warm card">
  <div
    class="row"
    style="justify-content: space-between; align-items: center; gap: 8px;"
  >
    <div
      class="label"
      aria-live="polite"
    >
      {t('pg_count', { n: String(filtered.length), total: String(allSpecies.length) })}
      {#if siteCtx?.bioregion}
        · {t('pg_priority', { region: bioregionLabel(siteCtx.bioregion) })}
      {/if}
    </div>
    <div
      class="row"
      style="gap: 6px;"
    >
      <button type="button" class="btn btn-sm" onclick={() => importInputEl?.click()}>
        <Glyph
          name="ArrowRight"
          size={12}
        /> {t('plant_import_json')}
      </button>
      <input
        bind:this={importInputEl}
        type="file"
        accept="application/json,.json"
        onchange={onImportFile}
        style="display: none;"
        tabindex="-1"
        aria-hidden="true"
      />
      <button
        type="button"
        class="btn btn-sm btn-accent"
        bind:this={newPlantBtnEl}
        onclick={startCreate}
      >
        <Glyph
          name="Plus"
          size={12}
        /> {t('plant_new_btn')}
      </button>
    </div>
  </div>
  <input
    class="inp"
    style="margin-top: 10px;"
    type="search"
    placeholder={t('plant_filter_placeholder')}
    aria-label={t('plant_filter_aria')}
    bind:value={query}
  />
  <div
    class="row wrap"
    style="margin-top: 8px;"
    role="group"
    aria-label={t('a11y_pg_filter_origin')}
  >
    {#each ['native', 'adapted', 'invasive'] as o}
      <button
        type="button"
        class="chip"
        class:chip-jade={originFilter.has(o as any) && o === 'native'}
        class:chip-ocre={originFilter.has(o as any) && o === 'adapted'}
        class:chip-cinabrio={originFilter.has(o as any) && o === 'invasive'}
        aria-pressed={originFilter.has(o as any)}
        onclick={() => toggleOrigin(o as any)}
      >
        {o === 'native' ? t('plant_origin_native') : o === 'adapted' ? t('plant_origin_adapted') : t('plant_origin_invasive')}
      </button>
    {/each}
    <select
      class="inp"
      style="max-width: 200px; min-height: 36px;"
      bind:value={functionFilter}
      aria-label={t('a11y_pg_filter_function')}
    >
      {#each allFunctions as f}
        <option value={f}>{f === 'all' ? t('plant_all_functions') : f}</option>
      {/each}
    </select>
  </div>
</div>

<div
  class="weave"
  aria-hidden="true"
></div>

{#if creating}
  <section class="card">
    <div
      class="label"
      style="display:flex; justify-content:space-between; align-items:center;"
    >
      <span>{t('plant_new_btn')}</span>
    </div>

    <div class="field-row">
      <label for="pfaf-search">{t('plant_catalog_label')}</label>
      <div style="display: flex; gap: 8px;">
        <input
          id="pfaf-search"
          class="inp"
          type="search"
          bind:value={searchQuery}
          placeholder={t('plant_catalog_placeholder')}
          onkeydown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button
          type="button"
          class="btn"
          onclick={runSearch}
          disabled={searching}
        >
          {#if searching}{t('anim_searching')}{:else}{t('anim_search_btn')}{/if}
        </button>
      </div>
    </div>
    {#if searchResults.length > 0}
      <div
        class="col"
        style="gap: 4px; margin-top: 8px; margin-bottom: 12px; max-height: 150px; overflow-y: auto; background: var(--paper-warm); padding: 8px; border-radius: 4px;"
      >
        {#each searchResults as r}
          <button
            class="list-item"
            style="text-align: left; padding: 4px; border: 1px solid var(--line); border-radius: 4px; background: var(--paper);"
            onclick={() => pickPfaf(r)}
          >
            <strong>{localSpeciesName(r.n, r.sci)}</strong> <em>{r.sci}</em>
          </button>
        {/each}
      </div>
    {/if}

    <div
      class="weave"
      style="margin: 8px 0;"
      aria-hidden="true"
    ></div>
    <div class="field-row">
      <label for="np-name">{t('plant_common_name')}</label>
      <input
        id="np-name"
        class="inp"
        bind:value={newName}
        placeholder={t('a11y_pg_ex_common')}
      />
    </div>
    <div class="field-row">
      <label for="np-sci">{t('anim_sci_name')}</label>
      <input
        id="np-sci"
        class="inp"
        bind:value={newSci}
        placeholder={t('a11y_pg_ex_scientific')}
      />
    </div>
    <div
      class="row"
      style="gap: 8px;"
    >
      <div
        class="field-row"
        style="flex: 1;"
      >
        <label for="np-spacing">{t('plant_spacing_label')}</label>
        <input
          id="np-spacing"
          class="inp"
          type="number"
          min="0"
          step="0.1"
          bind:value={newSpacing}
        />
      </div>
      <SelectWithOther
        id="np-sun"
        label={t('plant_sun_label')}
        value={newSun}
        options={[
          { v: 'completo', l: t('sun_completo') },
          { v: 'parcial', l: t('sun_parcial') },
          { v: 'sombra', l: t('sun_sombra') }
        ]}
        otherLabel={t('sun_other')}
        placeholder={t('sun_other_placeholder')}
        onValueChange={(v) => (newSun = v)}
        width="100%"
      />
    </div>
    <SelectWithOther
      id="np-type"
      label={t('plant_type_label')}
      value={newType}
      options={[
        { v: 'arbol-alto', l: t('plant_type_tall_tree') },
        { v: 'arbol-medio', l: t('plant_type_mid_tree') },
        { v: 'arbusto', l: t('plant_type_shrub') },
        { v: 'herbaceo', l: t('plant_type_herbaceous') },
        { v: 'trepadora', l: t('plant_type_vine') },
        { v: 'cobertura', l: t('plant_type_cover') }
      ]}
      otherLabel={t('plant_type_other')}
      placeholder={t('plant_type_placeholder')}
      onValueChange={(v) => (newType = v)}
    />
    <SelectWithOther
      id="np-origin"
      label={t('plant_origin_label')}
      value={newOrigin}
      options={[
        { v: 'native', l: t('plant_origin_native') },
        { v: 'adapted', l: t('plant_origin_adapted') },
        { v: 'invasive', l: t('plant_origin_invasive') }
      ]}
      otherLabel={t('plant_origin_other')}
      placeholder={t('plant_origin_placeholder')}
      onValueChange={(v) => (newOrigin = v)}
    />
    <div class="field-row">
      <label for="np-fns">{t('plant_functions_label')}</label>
      <input
        id="np-fns"
        class="inp"
        bind:value={newFunctions}
        placeholder={t('plant_functions_placeholder')}
      />
    </div>
    <div class="field-row">
      <label for="np-notes">{t('plant_notes_label')}</label>
      <textarea
        id="np-notes"
        class="inp"
        rows="2"
        bind:value={newNotes}
        placeholder={t('plant_notes_placeholder')}
      ></textarea>
    </div>
    <div
      class="row"
      style="margin-top: 10px;"
    >
      <button
        class="btn btn-primary"
        onclick={saveCreate}
      >
        <Glyph
          name="Check"
          size={14}
        /> {t('plant_save_btn')}
      </button>
      <button
        class="btn"
        onclick={cancelCreate}>{t('common_cancel')}</button
      >
    </div>
  </section>
{/if}

<div class="list">
  {#each filtered as sp}
    {@const isOpen = openId === sp.id}
    <article
      class="plant-row"
      class:open={isOpen}
    >
      <button
        type="button"
        class="plant-head"
        aria-expanded={isOpen}
        aria-label={t('pg_plant_aria', { name: localSpeciesName(sp.common_name, sp.scientific_name), sci: sp.scientific_name ?? '', m: String(sp.spacing_m) })}
        onclick={() => (openId = isOpen ? null : sp.id)}
      >
        <span
          class="plant-glyph"
          style="color: {plantTone(sp.id)};"
        >
          <Glyph
            name={plantGlyph(sp.id)}
            size={28}
          />
        </span>
        <span class="plant-text">
          <span class="plant-name">{localSpeciesName(sp.common_name, sp.scientific_name)}</span>
          {#if sp.scientific_name}
            <span class="plant-latin">{sp.scientific_name}</span>
          {/if}
          <span class="plant-prov" class:community={isCommunityKnowledge(sp.source)}>
            <Glyph name={provIcon(sp.source)} size={10} />
            {provLabel(sp.source)}
          </span>
        </span>
        <span class="coord">{formatMeters(sp.spacing_m)}</span>
      </button>
      {#if isOpen}
        <div class="plant-body">
          <div
            class="row"
            style="gap: 12px; margin-bottom: 12px; align-items: flex-start;"
          >
            {#if sp.image_url}
              <img
                src={sp.image_url}
                alt={localSpeciesName(sp.common_name, sp.scientific_name)}
                style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);"
              />
            {:else}
              <button
                type="button"
                aria-label={t('a11y_add_photo')}
                style="width: 80px; height: 80px; border-radius: 8px; border: 1px dashed var(--line); display: flex; align-items: center; justify-content: center; background: var(--paper-warm); cursor: pointer;"
                onclick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = () => {
                        const dataUrl = reader.result as string
                        import('../../lib/db/sqlite').then(({ exec }) => {
                          exec(
                            'UPDATE plant_species SET image_url = ? WHERE id = ?',
                            [dataUrl, sp.id]
                          )
                          import('../../lib/stores/appState').then((m) =>
                            m.reloadFromDb('land-default')
                          )
                        })
                      }
                      reader.readAsDataURL(file)
                    }
                  }
                  input.click()
                }}
              >
                <Glyph
                  name={plantGlyph(sp.id)}
                  size={32}
                />
              </button>
            {/if}
            <div style="flex: 1;">
              <h3
                style="margin: 0; font-family: var(--serif); font-weight: var(--display-weight); color: var(--ink);"
              >
                {localSpeciesName(sp.common_name, sp.scientific_name)}
              </h3>
              <div
                class="coord"
                style="color: var(--ink-soft);"
              >
                {sp.scientific_name || t('plant_unknown_sci')}
              </div>
            </div>
          </div>
          <div class="detail-row" style="align-items: center;">
            <span class="detail-label">{t('prov_source_label')}</span>
            <span class="detail-value" style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <Glyph name={provIcon(sp.source)} size={13} />
              {provLabel(sp.source)}
              {#if isCommunityKnowledge(sp.source)}
                <span class="chip chip-jade">{t('prov_community_tag')}</span>
              {/if}
              <button type="button" class="prov-q" onclick={explainProvenance} aria-label={t('prov_explain_aria')}>
                {t('prov_explain_btn')}
              </button>
            </span>
          </div>
          {#if sp.aliases}
            {@const aliases = parseList(sp.aliases)}
            {#if aliases.length > 0}
              <div class="detail-row">
                <span class="detail-label">{t('pg_aka')}</span>
                <span class="detail-value">{aliases.join(', ')}</span>
              </div>
            {/if}
          {/if}
          {#if sp.plant_type}
            <div class="detail-row">
              <span class="detail-label">Tipo:</span>
              <span class="detail-value">{sp.plant_type}</span>
            </div>
          {/if}
          {#if sp.spacing_m}
            <div class="detail-row">
              <span class="detail-label">Espacio:</span>
              <span class="detail-value"
                >{formatMeters(sp.spacing_m)} entre plantas</span
              >
            </div>
          {/if}
          {#if sp.edible_parts}
            {@const parts = parseList(sp.edible_parts)}
            {#if parts.length > 0}
              <div class="detail-row">
                <span class="detail-label">{t('pg_edible_parts')}</span>
                <span class="detail-value">{parts.map(localEdiblePart).join(', ')}</span>
              </div>
            {/if}
          {/if}
          {#if sp.notes}
            <p class="plant-note">{localSpeciesNotes(sp.id, sp.notes)}</p>
          {/if}
          <div class="tag-row">
            {#if sp.origin}
              <span
                class="chip {sp.origin === 'native'
                  ? 'chip-jade'
                  : sp.origin === 'invasive'
                    ? 'chip-cinabrio'
                    : 'chip-ocre'}"
              >
                {sp.origin === 'native'
                  ? t('pg_origin_native')
                  : sp.origin === 'adapted'
                    ? t('pg_origin_adapted')
                    : t('pg_origin_invasive')}
              </span>
            {/if}
            {#if sp.sun}
              <span class="chip"
                ><Glyph
                  name="Sun"
                  size={12}
                />
                {localPfafField(sp.sun)}</span
              >
            {/if}
            {#each parseList(sp.functions) as fn}
              <span class="chip chip-jade">{localFunction(fn)}</span>
            {/each}
          </div>
          {#each rulesFor(sp.id) as rule}
            <div
              class="banner {rule.relationship === 'incompatible' ||
              rule.relationship === 'harmful'
                ? 'warn'
                : 'ok'}"
            >
              {localRuleMessage(rule)}
            </div>
          {/each}
          {#if onPick}
            <button
              class="btn btn-accent"
              style="align-self: flex-start;"
              onclick={() => {
                addRecentPlant(sp.id)
                onPick(sp.id)
              }}
            >
              <Glyph
                name="Plus"
                size={14}
              /> {t('plant_pick_btn')}
            </button>
          {/if}
        </div>
      {/if}
    </article>
  {:else}
    <div class="empty">
      {t('plant_local_empty', { query })}
    </div>
  {/each}

  {#if remoteSearching}
    <div class="empty" role="status">{t('plant_remote_searching')}</div>
  {/if}

  {#if remoteResults.length > 0}
    <div
      class="weave"
      style="margin: 16px 0;"
      aria-hidden="true"
    ></div>
    <div
      style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); color: var(--ink-soft); margin-bottom: 8px;"
    >
      {t('plant_remote_heading')}
    </div>
    {#each remoteResults as r}
      <article class="plant-row">
        <button
          class="plant-head"
          style="cursor: pointer;"
          onclick={() => {
            const fns: string[] = []
            if (r.edible > 3) fns.push('Comestible')
            if (r.med > 3) fns.push('Medicinal')
            if (r.other > 3) fns.push('Soporte/Otros')
            if (r.hab) fns.push(r.hab)

            const id = insertPlantSpecies({
              commonName: r.n,
              scientificName: r.sci,
              plantType: r.type,
              origin: 'adapted',
              spacingM: r.space || 1,
              sun: r.sun.toLowerCase().includes('pleno')
                ? 'completo'
                : r.sun.toLowerCase().includes('sombra')
                  ? 'sombra'
                  : 'parcial',
              functions: fns,
              notes: t('pg_import_notes_global', { family: r.f, hard: String(r.hard), soil: r.soil, water: r.water }),
              glyph: 'Seed'
            })
            showToast({ message: t('plant_remote_imported', { name: r.n }), tone: 'ok' })
            if (onPick) onPick(id)
          }}
        >
          <span
            class="plant-glyph"
            style="color: var(--jade);"
          >
            <Glyph
              name="Seed"
              size={28}
            />
          </span>
          <span class="plant-text">
            <span class="plant-name">{r.n}</span>
            <span class="plant-latin">{r.sci}</span>
          </span>
          <span
            class="chip chip-jade"
            style="font-size: calc(11px * var(--text-scale));"
          >
            <Glyph
              name="ArrowRight"
              size={12}
            /> {t('plant_remote_import')}
          </span>
        </button>
      </article>
    {/each}
  {/if}
</div>

<style>
  .plant-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
  }
  .plant-row.open {
    background: var(--paper-warm);
    border-color: var(--line-strong);
  }
  .plant-head {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--ink);
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
    text-align: left;
  }
  .plant-glyph {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .plant-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .plant-name {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(18px * var(--text-scale));
    line-height: 1.1;
  }
  .plant-latin {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-style: italic;
    font-size: calc(12px * var(--text-scale));
    color: var(--ink-soft);
  }
  .plant-prov {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--mono);
    font-size: calc(9px * var(--text-scale));
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-top: 2px;
  }
  /* Community knowledge is distinguished by the icon + this weight, not colour alone. */
  .plant-prov.community { color: var(--jade-deep); font-weight: 600; }
  .prov-q {
    background: transparent;
    border: 1px solid var(--line-strong);
    color: var(--ocre-deep);
    border-radius: 999px;
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    padding: 2px 8px;
    cursor: pointer;
    min-height: 28px;
  }
  .prov-q:hover { background: var(--paper-warm); }
  .plant-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--line);
  }
  .plant-note {
    font-family: var(--serif); font-weight: var(--display-weight);
    font-size: calc(14px * var(--text-scale));
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .detail-row {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: calc(13px * var(--text-scale));
  }
  .detail-label {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .detail-value {
    font-family: var(--serif); font-weight: var(--display-weight);
    color: var(--ink);
  }
</style>
