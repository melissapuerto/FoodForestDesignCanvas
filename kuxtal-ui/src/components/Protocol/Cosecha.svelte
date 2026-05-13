<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import { showToast } from '../../lib/stores/toast'

  import {
    listCosechas,
    addCosecha,
    deleteCosecha,
    type CosechaRow
  } from '../../lib/db/cosecha'
  import { dbReady, species, planted, getLand } from '../../lib/stores/appState'
  import { nowIso } from '../../lib/utils/id'
  import { authUser } from '../../lib/api'

  let { landId = 'land-default' }: { landId?: string } = $props()

  let harvests = $state<CosechaRow[]>([])
  let creating = $state(false)
  let newAmount = $state('')
  let newQuality = $state('Buena')
  let newDate = $state(new Date().toISOString().split('T')[0])
  let newNotes = $state('')
  let selectedPlanted = $state('')
  let newAuthor = $state('')
  let newCaptureLoc = $state(false)
  let newLat = $state<number | null>(null)
  let newLng = $state<number | null>(null)

  authUser.subscribe((u) => { if (u && !newAuthor) newAuthor = u.username })

  async function captureCosechaLoc(): Promise<void> {
    newCaptureLoc = !newCaptureLoc
    if (!newCaptureLoc) { newLat = null; newLng = null; return }
    if (!('geolocation' in navigator)) { showToast({ message: 'Geolocalización no disponible.', tone: 'warn' }); newCaptureLoc = false; return }
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 }))
      newLat = pos.coords.latitude
      newLng = pos.coords.longitude
    } catch { showToast({ message: 'No pude obtener la ubicación.', tone: 'warn' }); newCaptureLoc = false }
  }

  dbReady.subscribe((ready) => {
    if (ready) refresh()
  })

  function refresh() {
    try {
      harvests = listCosechas(landId)
    } catch {
      harvests = []
    }
  }

  let totalThisMonth = $derived.by(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    return harvests
      .filter((h) => {
        const d = new Date(h.harvest_date)
        return d.getMonth() === month && d.getFullYear() === year
      })
      .reduce((acc, h) => acc + h.amount_kg, 0)
  })

  function saveHarvest() {
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) {
      showToast({ message: 'Ingresa una cantidad válida.', tone: 'warn' })
      return
    }
    addCosecha({
      landId,
      amountKg: amt,
      harvestDate: newDate || nowIso(),
      quality: newQuality,
      plantedId: selectedPlanted || undefined,
      notes: newNotes.trim() || undefined,
      author: newAuthor.trim() || null,
      lat: newLat,
      lng: newLng,
    })
    creating = false
    newAmount = ''
    newNotes = ''
    selectedPlanted = ''
    newCaptureLoc = false
    newLat = null
    newLng = null
    refresh()
    showToast({ message: 'Cosecha registrada.', tone: 'ok' })
  }

  function delHarvest(id: string) {
    deleteCosecha(id)
    refresh()
    showToast({ message: 'Registro borrado.', tone: 'ok' })
  }

  function getPlantedName(pid: string | null) {
    if (!pid) return 'Desconocido'
    const p = $planted.find((x) => x.id === pid)
    if (!p) return 'Planta eliminada'
    const sp = $species.find((x) => x.id === p.species_id)
    return sp ? sp.common_name : 'Desconocida'
  }
</script>

<section class="card-warm card">
  <div class="label">Cosecha y Producción</div>
  <p
    class="sub"
    style="margin-top: 6px;"
  >
    Lleva un registro de lo que la tierra te entrega. Mide el rendimiento de tus
    zonas y especies.
  </p>
  <div
    class="row wrap"
    style="margin-top: 10px;"
  >
    {#if !creating}
      <button
        class="btn btn-primary"
        onclick={() => (creating = true)}
      >
        <Glyph
          name="Plus"
          size={14}
        /> Registrar Cosecha
      </button>
    {/if}
  </div>
  {#if creating}
    <div
      class="weave"
      style="margin: 14px 0;"
      aria-hidden="true"
    ></div>
    <div class="field-row">
      <label for="cos-plant">Planta cultivada (Opcional)</label>
      <select
        id="cos-plant"
        class="inp"
        bind:value={selectedPlanted}
      >
        <option value="">Selecciona una planta...</option>
        {#each $planted as p}
          {@const sp = $species.find((x) => x.id === p.species_id)}
          <option value={p.id}>{sp ? sp.common_name : 'Desconocida'}</option>
        {/each}
      </select>
    </div>
    <div
      class="row"
      style="gap: 8px;"
    >
      <div
        class="field-row"
        style="flex: 1;"
      >
        <label for="cos-amount">Cantidad (kg)</label>
        <input
          id="cos-amount"
          class="inp"
          type="number"
          step="0.1"
          placeholder="ej. 12"
          bind:value={newAmount}
        />
      </div>
      <div
        class="field-row"
        style="flex: 1;"
      >
        <label for="cos-quality">Calidad</label>
        <select
          id="cos-quality"
          class="inp"
          bind:value={newQuality}
        >
          <option value="Excelente">Excelente</option>
          <option value="Buena">Buena</option>
          <option value="Regular">Regular</option>
          <option value="Mala">Mala</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <label for="cos-date">Fecha</label>
      <input
        id="cos-date"
        class="inp"
        type="date"
        bind:value={newDate}
      />
    </div>
    <div class="field-row">
      <label for="cos-notes">Notas (Opcional)</label>
      <input
        id="cos-notes"
        class="inp"
        placeholder="ej. Lluvia el día anterior..."
        bind:value={newNotes}
      />
    </div>
    <div class="field-row">
      <label for="cos-author">Autor</label>
      <input id="cos-author" class="inp" placeholder="Tu nombre" bind:value={newAuthor} />
    </div>
    <div class="row" style="margin-top: 8px;">
      <button type="button" class="btn btn-sm" aria-pressed={newCaptureLoc} onclick={captureCosechaLoc}>
        <Glyph name="Map" size={12} />
        {newLat != null ? `${newLat.toFixed(3)}, ${newLng?.toFixed(3)}` : 'Adjuntar ubicación'}
      </button>
    </div>
    <div
      class="row"
      style="margin-top: 10px; gap: 8px;"
    >
      <button
        class="btn btn-primary"
        onclick={saveHarvest}>Guardar</button
      >
      <button
        class="btn"
        onclick={() => (creating = false)}>Cancelar</button
      >
    </div>
  {/if}
</section>

<div
  class="weave"
  aria-hidden="true"
  style="margin: 14px 0;"
></div>

<section
  class="card"
  style="margin-bottom: 12px; display: flex; gap: 16px; align-items: center;"
>
  <div style="flex: 1;">
    <div class="label">Este mes</div>
    <div style="font-family: var(--serif); font-size: 28px; margin-top: 4px;">
      {totalThisMonth}
      <span style="font-size: 16px; color: var(--ink-soft);">kg</span>
    </div>
  </div>
  <Glyph
    name="Basket"
    size={32}
  />
</section>

<div class="list">
  {#each harvests as h}
    <article
      class="list-item"
      style="flex-direction: column; align-items: stretch; gap: 6px;"
    >
      <div
        class="row"
        style="justify-content: space-between;"
      >
        <span class="chip chip-jade">{getPlantedName(h.planted_id)}</span>
        <span class="coord"
          >{new Date(h.harvest_date).toLocaleDateString('es-CO')}</span
        >
      </div>
      <div
        class="row"
        style="justify-content: space-between; align-items: baseline; margin-top: 4px;"
      >
        <div style="font-family: var(--serif); font-size: 20px;">
          {h.amount_kg} kg
        </div>
        {#if h.notes}
          <div class="sub">
            <Glyph
              name="Wind"
              size={10}
            />
            {h.notes}
          </div>
        {/if}
      </div>
      <div
        class="row wrap"
        style="gap: 8px;"
      >
        {#if h.author}<span class="sub">@{h.author}</span>{/if}
        {#if h.location_geojson}
          {#await Promise.resolve(JSON.parse(h.location_geojson)) then g}
            {#if g?.coordinates}
              <span class="sub">{g.coordinates[1].toFixed(3)}, {g.coordinates[0].toFixed(3)}</span>
            {/if}
          {/await}
        {/if}
      </div>
      <div
        class="row"
        style="margin-top: 4px; justify-content: space-between;"
      >
        <span class="coord">Calidad: {h.quality}</span>
        <button
          class="btn btn-ghost"
          style="padding: 2px;"
          onclick={() => delHarvest(h.id)}
          ><Glyph
            name="Trash"
            size={12}
          /></button
        >
      </div>
    </article>
  {:else}
    <div class="empty">Aún no hay registros de cosecha.</div>
  {/each}
</div>
