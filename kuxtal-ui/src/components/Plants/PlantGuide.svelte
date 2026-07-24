<script lang="ts">
  import {
    species,
    insertPlantSpecies,
    importPlantSpeciesFromJson,
    dbReady
  } from '../../lib/stores/appState'
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import { plantGlyph, plantTone } from '../../lib/glyphs/mapping'
  import { formatMeters } from '../../lib/utils/format'
  import { showToast } from '../../lib/stores/toast'
  import { searchPfaf, type PfafEntry } from '../../lib/pfaf/pfafLookup'
  import { isDbReady } from '../../lib/db/sqlite'
  import { getSiteContext } from '../../lib/pfaf/siteContext'
  import { filterSpeciesForSite, sortSpeciesForSite } from '../../lib/pfaf/catalogSort'
  import { bioregionLabel } from '../../lib/climate/region'
  import { localSpeciesName, localSpeciesNotes } from '../../lib/i18n/dataLocal'
  import { t, type TranslationKey } from '../../lib/i18n/index.svelte'
  import { classifyProvenance, provenanceLabelKey, provenanceGlyph, isCommunityKnowledge } from '../../lib/pfaf/provenance'
  import type { GlyphName } from '../../lib/glyphs/glyph-data'
  import { parseList, sunFromPfaf, functionsFromPfaf } from '../../lib/plants/guide'
  import NewPlantForm from './NewPlantForm.svelte'
  import PlantDetail from './PlantDetail.svelte'

  let { onPick }: { onPick?: (id: string) => void } = $props()

  // ---- Provenance (row header badge) ----
  const provLabel = (source: string | null): string =>
    t(provenanceLabelKey(classifyProvenance(source)) as TranslationKey)
  const provIcon = (source: string | null): GlyphName =>
    provenanceGlyph(classifyProvenance(source)) as GlyphName

  let importInputEl: HTMLInputElement | null = $state(null)
  let newPlantBtnEl: HTMLButtonElement | null = $state(null)
  const allSpecies = $derived($species)
  const catalogDbReady = $derived($dbReady)

  let query = $state('')
  let originFilter = $state<Set<'native' | 'adapted' | 'invasive'>>(new Set(['native', 'adapted']))
  let functionFilter = $state<string>('all')
  let openId = $state<string | null>(null)
  let creating = $state(false)

  function toggleOrigin(o: 'native' | 'adapted' | 'invasive'): void {
    const next = new Set(originFilter)
    if (next.has(o)) next.delete(o)
    else next.add(o)
    originFilter = next
  }

  let allFunctions = $derived.by(() => {
    const set = new Set<string>()
    for (const sp of allSpecies) for (const f of parseList(sp.functions)) set.add(f)
    return ['all', ...Array.from(set).sort()]
  })

  const siteCtx = $derived(catalogDbReady && isDbReady() ? getSiteContext() : null)

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase()
    const base = filterSpeciesForSite(allSpecies, siteCtx)
    const rows = base.filter((sp) => {
      const aliasesStr = parseList(sp.aliases).join(' ')
      const matchesQ =
        !q ||
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

  // ---- Remote PFAF suggestions as the user types ----
  let remoteResults = $state<PfafEntry[]>([])
  let remoteSearching = $state(false)
  $effect(() => {
    const q = query.trim()
    if (q.length >= 3) {
      remoteSearching = true
      searchPfaf(q)
        .then((res) => {
          const localSci = new Set(
            allSpecies.map((s) => s.scientific_name?.toLowerCase()).filter(Boolean)
          )
          remoteResults = res.filter((r) => !localSci.has(r.sci.toLowerCase()))
        })
        .finally(() => { remoteSearching = false })
    } else {
      remoteResults = []
    }
  })

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

  function importRemote(r: PfafEntry): void {
    const id = insertPlantSpecies({
      commonName: r.n,
      scientificName: r.sci,
      plantType: r.type,
      origin: 'adapted',
      spacingM: r.space || 1,
      sun: sunFromPfaf(r.sun),
      functions: functionsFromPfaf(r),
      notes: t('pg_import_notes_global', { family: r.f, hard: String(r.hard), soil: r.soil, water: r.water }),
      glyph: 'Seed'
    })
    showToast({ message: t('plant_remote_imported', { name: r.n }), tone: 'ok' })
    onPick?.(id)
  }

  function onFormSaved(): void { creating = false; setTimeout(() => newPlantBtnEl?.focus(), 50) }
  function onFormCancel(): void { creating = false; setTimeout(() => newPlantBtnEl?.focus(), 50) }
</script>

<div class="card-warm card">
  <div class="row" style="justify-content: space-between; align-items: center; gap: 8px;">
    <div class="label" aria-live="polite">
      {t('pg_count', { n: String(filtered.length), total: String(allSpecies.length) })}
      {#if siteCtx?.bioregion}· {t('pg_priority', { region: bioregionLabel(siteCtx.bioregion) })}{/if}
    </div>
    <div class="row" style="gap: 6px;">
      <button type="button" class="btn btn-sm" onclick={() => importInputEl?.click()}>
        <Glyph name="ArrowRight" size={12} /> {t('plant_import_json')}
      </button>
      <input bind:this={importInputEl} type="file" accept="application/json,.json" onchange={onImportFile} style="display: none;" tabindex="-1" aria-hidden="true" />
      <button type="button" class="btn btn-sm btn-accent" bind:this={newPlantBtnEl} onclick={() => (creating = true)}>
        <Glyph name="Plus" size={12} /> {t('plant_new_btn')}
      </button>
    </div>
  </div>
  <input class="inp" style="margin-top: 10px;" type="search" placeholder={t('plant_filter_placeholder')} aria-label={t('plant_filter_aria')} bind:value={query} />
  <div class="row wrap" style="margin-top: 8px;" role="group" aria-label={t('a11y_pg_filter_origin')}>
    {#each ['native', 'adapted', 'invasive'] as o}
      <button type="button" class="chip"
        class:chip-jade={originFilter.has(o as any) && o === 'native'}
        class:chip-ocre={originFilter.has(o as any) && o === 'adapted'}
        class:chip-cinabrio={originFilter.has(o as any) && o === 'invasive'}
        aria-pressed={originFilter.has(o as any)} onclick={() => toggleOrigin(o as any)}>
        {o === 'native' ? t('plant_origin_native') : o === 'adapted' ? t('plant_origin_adapted') : t('plant_origin_invasive')}
      </button>
    {/each}
    <select class="inp" style="max-width: 200px; min-height: 36px;" bind:value={functionFilter} aria-label={t('a11y_pg_filter_function')}>
      {#each allFunctions as f}<option value={f}>{f === 'all' ? t('plant_all_functions') : f}</option>{/each}
    </select>
  </div>
</div>

<div class="weave" aria-hidden="true"></div>

{#if creating}
  <NewPlantForm onSaved={onFormSaved} onCancel={onFormCancel} />
{/if}

<div class="list">
  {#each filtered as sp}
    {@const isOpen = openId === sp.id}
    <article class="plant-row" class:open={isOpen}>
      <button type="button" class="plant-head" aria-expanded={isOpen}
        aria-label={t('pg_plant_aria', { name: localSpeciesName(sp.common_name, sp.scientific_name), sci: sp.scientific_name ?? '', m: String(sp.spacing_m) })}
        onclick={() => (openId = isOpen ? null : sp.id)}>
        <span class="plant-glyph" style="color: {plantTone(sp.id)};">
          <Glyph name={plantGlyph(sp.id)} size={28} />
        </span>
        <span class="plant-text">
          <span class="plant-name">{localSpeciesName(sp.common_name, sp.scientific_name)}</span>
          {#if sp.scientific_name}<span class="plant-latin">{sp.scientific_name}</span>{/if}
          <span class="plant-prov" class:community={isCommunityKnowledge(sp.source)}>
            <Glyph name={provIcon(sp.source)} size={10} /> {provLabel(sp.source)}
          </span>
        </span>
        <span class="coord">{formatMeters(sp.spacing_m)}</span>
      </button>
      {#if isOpen}
        <PlantDetail {sp} {onPick} />
      {/if}
    </article>
  {:else}
    <div class="empty">{t('plant_local_empty', { query })}</div>
  {/each}

  {#if remoteSearching}
    <div class="empty" role="status">{t('plant_remote_searching')}</div>
  {/if}

  {#if remoteResults.length > 0}
    <div class="weave" style="margin: 16px 0;" aria-hidden="true"></div>
    <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(14px * var(--text-scale)); color: var(--ink-soft); margin-bottom: 8px;">
      {t('plant_remote_heading')}
    </div>
    {#each remoteResults as r}
      <article class="plant-row">
        <button class="plant-head" style="cursor: pointer;" onclick={() => importRemote(r)}>
          <span class="plant-glyph" style="color: var(--jade);"><Glyph name="Seed" size={28} /></span>
          <span class="plant-text">
            <span class="plant-name">{r.n}</span>
            <span class="plant-latin">{r.sci}</span>
          </span>
          <span class="chip chip-jade" style="font-size: calc(11px * var(--text-scale));">
            <Glyph name="ArrowRight" size={12} /> {t('plant_remote_import')}
          </span>
        </button>
      </article>
    {/each}
  {/if}
</div>

<style>
  .plant-row { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); }
  .plant-row.open { background: var(--paper-warm); border-color: var(--line-strong); }
  .plant-head { background: none; border: none; padding: 0; cursor: pointer; color: var(--ink); display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; text-align: left; }
  .plant-glyph { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .plant-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .plant-name { font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(18px * var(--text-scale)); line-height: 1.1; }
  .plant-latin { font-family: var(--serif); font-weight: var(--display-weight); font-style: italic; font-size: calc(12px * var(--text-scale)); color: var(--ink-soft); }
  .plant-prov { display: inline-flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: calc(9px * var(--text-scale)); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); margin-top: 2px; }
  /* Community knowledge is distinguished by the icon + this weight, not colour alone. */
  .plant-prov.community { color: var(--jade-deep); font-weight: 600; }
</style>
