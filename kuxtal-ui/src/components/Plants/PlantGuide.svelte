<script lang="ts">
  import {
    species,
    insertPlantSpecies,
    importPlantSpeciesFromJson,
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

  let {
    onPick
  }: {
    onPick?: (id: string) => void
  } = $props()

  let allSpecies: SpeciesRow[] = $state([])
  species.subscribe((rows) => (allSpecies = rows))

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

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase()
    return allSpecies.filter((sp) => {
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
        `${sp.common_name} ${sp.scientific_name ?? ''} ${aliasesStr} ${sp.notes ?? ''}`
          .toLowerCase()
          .includes(q)
      const matchesO = sp.origin ? originFilter.has(sp.origin as any) : true
      const fns = parseList(sp.functions)
      const matchesF = functionFilter === 'all' || fns.includes(functionFilter)
      return matchesQ && matchesO && matchesF
    })
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
        message: 'Escribe al menos 2 letras para buscar.',
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
        message: 'No se encontraron resultados en PFAF.',
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

    newNotes = `Familia: ${r.f}. Resistencia térmica: ${r.hard}. Suelo: ${r.soil}. Agua: ${r.water}. Importado desde base PFAF.`
    searchResults = []
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
        showToast({
          message: 'No pude leer ese archivo. Revisa que sea un JSON válido.',
          tone: 'error'
        })
      } else {
        showToast({
          message: `${r.added} agregadas, ${r.updated} actualizadas${r.errors ? `, ${r.errors} con error` : ''}.`,
          tone: r.errors ? 'warn' : 'ok'
        })
      }
    }
    reader.readAsText(file)
  }

  function saveCreate(): void {
    const name = newName.trim()
    if (!name) {
      showToast({ message: 'El nombre común es obligatorio.', tone: 'warn' })
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
    showToast({ message: `Planta "${name}" agregada al códice.`, tone: 'ok' })
    creating = false
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
      {filtered.length} de {allSpecies.length} especies
    </div>
    <div
      class="row"
      style="gap: 6px;"
    >
      <label class="btn btn-sm">
        <Glyph
          name="ArrowRight"
          size={12}
        /> Importar JSON
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onchange={onImportFile}
        />
      </label>
      <button
        type="button"
        class="btn btn-sm btn-accent"
        onclick={startCreate}
      >
        <Glyph
          name="Plus"
          size={12}
        /> Nueva planta
      </button>
    </div>
  </div>
  <input
    class="inp"
    style="margin-top: 10px;"
    type="search"
    placeholder="Buscar planta..."
    aria-label="Buscar plantas"
    bind:value={query}
  />
  <div
    class="row wrap"
    style="margin-top: 8px;"
    role="group"
    aria-label="Filtros de origen"
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
        {o === 'native' ? 'Nativa' : o === 'adapted' ? 'Adaptada' : 'Invasora'}
      </button>
    {/each}
    <select
      class="inp"
      style="max-width: 200px; min-height: 36px;"
      bind:value={functionFilter}
      aria-label="Filtrar por función"
    >
      {#each allFunctions as f}
        <option value={f}>{f === 'all' ? 'Todas las funciones' : f}</option>
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
      <span>Nueva planta</span>
    </div>

    <div class="field-row">
      <label for="pfaf-search">Buscar en Catálogo (PFAF extendido)</label>
      <div style="display: flex; gap: 8px;">
        <input
          id="pfaf-search"
          class="inp"
          type="search"
          bind:value={searchQuery}
          placeholder="Buscar especie o nombre..."
          onkeydown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button
          type="button"
          class="btn"
          onclick={runSearch}
          disabled={searching}
        >
          {#if searching}Buscando...{:else}Buscar{/if}
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
            <strong>{r.n}</strong> <em>{r.sci}</em>
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
      <label for="np-name">Nombre común *</label>
      <input
        id="np-name"
        class="inp"
        bind:value={newName}
        placeholder="ej. Papayuela"
      />
    </div>
    <div class="field-row">
      <label for="np-sci">Nombre científico</label>
      <input
        id="np-sci"
        class="inp"
        bind:value={newSci}
        placeholder="ej. Vasconcellea pubescens"
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
        <label for="np-spacing">Espaciado (m)</label>
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
        label="Sol"
        value={newSun}
        options={[
          { v: 'completo', l: 'Sol pleno' },
          { v: 'parcial', l: 'Sol parcial' },
          { v: 'sombra', l: 'Sombra' }
        ]}
        otherLabel="Otra exposición…"
        placeholder="ej. matinal"
        onValueChange={(v) => (newSun = v)}
        width="100%"
      />
    </div>
    <SelectWithOther
      id="np-type"
      label="Tipo"
      value={newType}
      options={[
        { v: 'arbol-alto', l: 'Árbol alto' },
        { v: 'arbol-medio', l: 'Árbol medio' },
        { v: 'arbusto', l: 'Arbusto' },
        { v: 'herbaceo', l: 'Herbácea' },
        { v: 'trepadora', l: 'Trepadora' },
        { v: 'cobertura', l: 'Cobertura' }
      ]}
      otherLabel="Otro tipo…"
      placeholder="ej. palma"
      onValueChange={(v) => (newType = v)}
    />
    <SelectWithOther
      id="np-origin"
      label="Origen"
      value={newOrigin}
      options={[
        { v: 'native', l: 'Nativa' },
        { v: 'adapted', l: 'Adaptada' },
        { v: 'invasive', l: 'Invasora' }
      ]}
      otherLabel="Otro origen…"
      placeholder="ej. naturalizada"
      onValueChange={(v) => (newOrigin = v)}
    />
    <div class="field-row">
      <label for="np-fns">Funciones (separadas por coma)</label>
      <input
        id="np-fns"
        class="inp"
        bind:value={newFunctions}
        placeholder="ej. comestible, medicinal"
      />
    </div>
    <div class="field-row">
      <label for="np-notes">Notas</label>
      <textarea
        id="np-notes"
        class="inp"
        rows="2"
        bind:value={newNotes}
        placeholder="Cómo crece, sus usos, lo que sabes."
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
        /> Guardar planta
      </button>
      <button
        class="btn"
        onclick={cancelCreate}>Cancelar</button
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
        aria-label={`${sp.common_name}, ${sp.scientific_name ?? ''}, espacio ${sp.spacing_m} metros`}
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
          <span class="plant-name">{sp.common_name}</span>
          {#if sp.scientific_name}
            <span class="plant-latin">{sp.scientific_name}</span>
          {/if}
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
                alt={sp.common_name}
                style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);"
              />
            {:else}
              <button
                type="button"
                aria-label="Agregar foto"
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
                style="margin: 0; font-family: var(--serif); color: var(--ink);"
              >
                {sp.common_name}
              </h3>
              <div
                class="coord"
                style="color: var(--ink-soft);"
              >
                {sp.scientific_name || 'Desconocido'}
              </div>
            </div>
          </div>
          {#if sp.aliases}
            {@const aliases = parseList(sp.aliases)}
            {#if aliases.length > 0}
              <div class="detail-row">
                <span class="detail-label">También conocida como:</span>
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
                <span class="detail-label">Partes comestibles:</span>
                <span class="detail-value">{parts.join(', ')}</span>
              </div>
            {/if}
          {/if}
          {#if sp.notes}
            <p class="plant-note">{sp.notes}</p>
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
                  ? 'nativa'
                  : sp.origin === 'adapted'
                    ? 'adaptada'
                    : 'invasora'}
              </span>
            {/if}
            {#if sp.sun}
              <span class="chip"
                ><Glyph
                  name="Sun"
                  size={12}
                />
                {sp.sun}</span
              >
            {/if}
            {#each parseList(sp.functions) as fn}
              <span class="chip chip-jade">{fn}</span>
            {/each}
          </div>
          {#each rulesFor(sp.id) as rule}
            <div
              class="banner {rule.relationship === 'incompatible' ||
              rule.relationship === 'harmful'
                ? 'warn'
                : 'ok'}"
            >
              {rule.message}
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
              /> Sembrar esta especie
            </button>
          {/if}
        </div>
      {/if}
    </article>
  {:else}
    <div class="empty">
      No hay plantas locales para "{query}". Prueba buscar en el registro global
      usando el botón "Crear especie".
    </div>
  {/each}

  {#if remoteSearching}
    <div class="empty">Buscando en registros en línea...</div>
  {/if}

  {#if remoteResults.length > 0}
    <div
      class="weave"
      style="margin: 16px 0;"
      aria-hidden="true"
    ></div>
    <div
      style="font-family: var(--serif); font-size: 14px; color: var(--ink-soft); margin-bottom: 8px;"
    >
      Resultados desde la base de datos global:
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
              notes: `Familia: ${r.f}. Resistencia térmica: ${r.hard}. Suelo: ${r.soil}. Agua: ${r.water}. Importado desde base global.`,
              glyph: 'Seed'
            })
            showToast({
              message: `Especie "${r.n}" importada y seleccionada.`,
              tone: 'ok'
            })
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
            style="font-size: 11px;"
          >
            <Glyph
              name="ArrowRight"
              size={12}
            /> Importar y sembrar
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
    font-family: var(--serif);
    font-size: 18px;
    line-height: 1.1;
  }
  .plant-latin {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    color: var(--ink-soft);
  }
  .plant-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--line);
  }
  .plant-note {
    font-family: var(--serif);
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .detail-row {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: 13px;
  }
  .detail-label {
    font-family: var(--mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
    white-space: nowrap;
  }
  .detail-value {
    font-family: var(--serif);
    color: var(--ink);
  }
</style>
