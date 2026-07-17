<script lang="ts">
  import { localSpeciesName } from '../../lib/i18n/dataLocal'
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import { showToast } from '../../lib/stores/toast'

  import {
    listCosechas,
    addCosecha,
    deleteCosecha,
    type CosechaRow
  } from '../../lib/db/cosecha'
  import { dbReady, species, planted, getLand } from '../../lib/stores/appState'
  import { dialogConfirm } from '../../lib/stores/dialog'
  import { nowIso } from '../../lib/utils/id'
  import { authUser } from '../../lib/api'
  import { t } from '../../lib/i18n/index.svelte'
  import { untrack } from 'svelte'
  import { formatDate } from '../../lib/utils/dates'
  import { captureCurrentPosition as geolocate } from '../../lib/utils/geolocate'

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

  $effect(() => {
    const u = $authUser
    untrack(() => { if (u && !newAuthor) newAuthor = u.username })
  })

  async function captureCosechaLoc(): Promise<void> {
    newCaptureLoc = !newCaptureLoc
    if (!newCaptureLoc) { newLat = null; newLng = null; return }
    const r = await geolocate()
    if (!r.ok) {
      showToast({ message: t(r.reason === 'unsupported' ? 'nb_geo_unavailable' : 'nb_geo_failed'), tone: 'warn' })
      newCaptureLoc = false
      return
    }
    newLat = r.lat
    newLng = r.lng
  }

  $effect(() => { if ($dbReady) untrack(refresh) })

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
      showToast({ message: t('harvest_err_qty'), tone: 'warn' })
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
    showToast({ message: t('harvest_saved'), tone: 'ok' })
  }

  async function delHarvest(id: string): Promise<void> {
    const ok = await dialogConfirm({
      title: t('harvest_delete_q'),
      body: t('harvest_delete_body'),
      confirmLabel: t('common_delete'),
      danger: true
    })
    if (!ok) return
    deleteCosecha(id)
    refresh()
    showToast({ message: t('harvest_deleted'), tone: 'ok' })
  }

  function getPlantedName(pid: string | null) {
    if (!pid) return t('harvest_unknown')
    const p = $planted.find((x) => x.id === pid)
    if (!p) return t('harvest_plant_deleted')
    const sp = $species.find((x) => x.id === p.species_id)
    return sp ? localSpeciesName(sp.common_name, sp.scientific_name) : t('harvest_unknown_f')
  }
</script>

<section class="card-warm card">
  <div class="label">{t('harvest_title')}</div>
  <p
    class="sub"
    style="margin-top: 6px;"
  >
    {t('harvest_sub')}
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
        /> {t('harvest_new')}
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
      <label for="cos-plant">{t('harvest_plant_label')}</label>
      <select
        id="cos-plant"
        class="inp"
        bind:value={selectedPlanted}
      >
        <option value="">{t('harvest_plant_placeholder')}</option>
        {#each $planted as p}
          {@const sp = $species.find((x) => x.id === p.species_id)}
          <option value={p.id}>{sp ? localSpeciesName(sp.common_name, sp.scientific_name) : t('harvest_unknown_f')}</option>
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
        <label for="cos-amount">{t('harvest_amount_label')}</label>
        <input
          id="cos-amount"
          class="inp"
          type="number"
          step="0.1"
          placeholder={t('harvest_amount_placeholder')}
          bind:value={newAmount}
        />
      </div>
      <div
        class="field-row"
        style="flex: 1;"
      >
        <label for="cos-quality">{t('harvest_quality')}</label>
        <select
          id="cos-quality"
          class="inp"
          bind:value={newQuality}
        >
          <option value="Excelente">{t('harvest_q_excellent')}</option>
          <option value="Buena">{t('harvest_q_good')}</option>
          <option value="Regular">{t('harvest_q_fair')}</option>
          <option value="Mala">{t('harvest_q_poor')}</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <label for="cos-date">{t('harvest_date')}</label>
      <input
        id="cos-date"
        class="inp"
        type="date"
        bind:value={newDate}
      />
    </div>
    <div class="field-row">
      <label for="cos-notes">{t('harvest_notes')}</label>
      <input
        id="cos-notes"
        class="inp"
        placeholder={t('harvest_notes_placeholder')}
        bind:value={newNotes}
      />
    </div>
    <div class="field-row">
      <label for="cos-author">{t('nb_author_label')}</label>
      <input id="cos-author" class="inp" placeholder={t('nb_author_placeholder')} bind:value={newAuthor} />
    </div>
    <div class="row" style="margin-top: 8px;">
      <button type="button" class="btn btn-sm" aria-pressed={newCaptureLoc} onclick={captureCosechaLoc}>
        <Glyph name="Map" size={12} />
        {newLat != null ? `${newLat.toFixed(3)}, ${newLng?.toFixed(3)}` : t('nb_attach_location')}
      </button>
    </div>
    <div
      class="row"
      style="margin-top: 10px; gap: 8px;"
    >
      <button
        class="btn btn-primary"
        onclick={saveHarvest}>{t('common_save')}</button
      >
      <button
        class="btn"
        onclick={() => (creating = false)}>{t('common_cancel')}</button
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
    <div class="label">{t('harvest_this_month')}</div>
    <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(28px * var(--text-scale)); margin-top: 4px;">
      {totalThisMonth}
      <span style="font-size: calc(16px * var(--text-scale)); color: var(--ink-soft);">kg</span>
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
        <span class="coord">{formatDate(h.harvest_date)}</span>
      </div>
      <div
        class="row"
        style="justify-content: space-between; align-items: baseline; margin-top: 4px;"
      >
        <div style="font-family: var(--serif); font-weight: var(--display-weight); font-size: calc(20px * var(--text-scale));">
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
        <span class="coord">{t('harvest_quality_prefix')} {h.quality}</span>
        <button
          class="btn btn-ghost"
          style="padding: 2px;"
          aria-label={t('harvest_delete_aria', { name: getPlantedName(h.planted_id) })}
          onclick={() => delHarvest(h.id)}
          ><Glyph
            name="Trash"
            size={12}
          /></button
        >
      </div>
    </article>
  {:else}
    <div class="empty">{t('harvest_empty')}</div>
  {/each}
</div>
