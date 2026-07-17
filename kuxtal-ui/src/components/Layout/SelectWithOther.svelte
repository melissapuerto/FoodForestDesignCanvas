<script lang="ts">
  /**
   * Drop-in <select> replacement that lets the user pick from a fixed list
   * or pick "Otro…" and type a custom value. Bound `value` is always the
   * final string the parent stores (preset id OR free-text).
   */
  import { untrack } from 'svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let {
    value = $bindable<string>(''),
    options,
    label,
    id,
    placeholder,
    otherLabel,
    allowEmpty = false,
    hideOther = false,
    width = 'auto',
    onValueChange
  }: {
    value?: string;
    options: Array<{ v: string; l: string }>;
    label?: string;
    id?: string;
    placeholder?: string;
    otherLabel?: string;
    allowEmpty?: boolean;
    hideOther?: boolean;
    width?: string;
    onValueChange?: (v: string) => void;
  } = $props();

  const OTHER = '__other__';

  // Seed once from incoming props.
  const seed = untrack(() => {
    const v = value;
    const matches = options.some((o) => o.v === v);
    return {
      isOther: v !== '' && !matches,
      custom: !matches ? v : '',
      selected: matches || v === '' ? v : OTHER
    };
  });
  let isOther = $state(seed.isOther);
  let custom = $state(seed.custom);
  let selected = $state(seed.selected);

  function emit(next: string): void {
    value = next;
    onValueChange?.(next);
  }

  function onChange(): void {
    if (selected === OTHER) {
      isOther = true;
      emit(custom);
    } else {
      isOther = false;
      emit(selected);
    }
  }

  function onCustomInput(): void {
    if (isOther) emit(custom);
  }
</script>

<div class="swo" style="width: {width};">
  {#if label}
    <label for={id} class="swo-label">{label}</label>
  {/if}
  <div class="swo-row">
    <select {id} class="inp swo-select" bind:value={selected} onchange={onChange}>
      {#if allowEmpty}<option value="">—</option>{/if}
      {#each options as o}
        <option value={o.v}>{o.l}</option>
      {/each}
      {#if !hideOther}<option value={OTHER}>{otherLabel ?? t('select_other_label')}</option>{/if}
    </select>
    {#if isOther}
      <input
        type="text"
        class="inp swo-other"
        bind:value={custom}
        oninput={onCustomInput}
        placeholder={placeholder ?? t('select_write_value')}
        aria-label={`${label ?? t('select_custom_aria')}`}
      />
    {/if}
  </div>
</div>

<style>
  .swo { display: flex; flex-direction: column; gap: 6px; }
  .swo-label {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .swo-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .swo-select { flex: 1; min-width: 140px; }
  .swo-other { flex: 1.4; min-width: 160px; }
</style>
