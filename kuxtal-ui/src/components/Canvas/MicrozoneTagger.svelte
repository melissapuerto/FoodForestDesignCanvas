<script lang="ts">
  import { updateZone, type ZoneRow } from '../../lib/stores/appState';
  import { MICROZONE_PRESETS, microzoneLabel, type MicrozonePreset } from '../../lib/recommend/microzone';
  import { t } from '../../lib/i18n/index.svelte';

  let { zone }: { zone: ZoneRow } = $props();

  const presetKeys = Object.keys(MICROZONE_PRESETS) as MicrozonePreset[];

  function onChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    updateZone(zone.id, { microzone_preset: value === '' ? null : value });
  }
</script>

<div class="mz-row">
  <span class="mz-name" title={zone.name}>{zone.name}</span>
  <select
    class="inp mz-select"
    aria-label={t('microzone_of', { name: zone.name })}
    value={zone.microzone_preset ?? ''}
    onchange={onChange}
  >
    <option value="">{t('microzone_none')}</option>
    {#each presetKeys as key}
      <option value={key}>{microzoneLabel(key)}</option>
    {/each}
  </select>
</div>

<style>
  .mz-row {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }
  .mz-name {
    font-size: calc(12px * var(--text-scale));
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 45%;
  }
  .mz-select {
    flex: 1;
    min-height: 30px;
    font-size: calc(12px * var(--text-scale));
    padding: 4px 8px;
  }
</style>
