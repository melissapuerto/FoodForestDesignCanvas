<script lang="ts">
  import { onMount } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';

  let {
    open,
    title,
    subtitle,
    wide = false,
    onClose,
    children
  }: {
    open: boolean;
    title: string;
    subtitle?: string;
    wide?: boolean;
    onClose: () => void;
    children?: import('svelte').Snippet;
  } = $props();

  let drawerEl: HTMLElement | undefined = $state();
  let lastFocus: HTMLElement | null = null;

  $effect(() => {
    if (open) {
      lastFocus = document.activeElement as HTMLElement | null;
      queueMicrotask(() => {
        const focusable = drawerEl?.querySelector<HTMLElement>(
          'button, a, input, textarea, select, [tabindex="0"]'
        );
        focusable?.focus();
      });
    } else if (lastFocus && document.body.contains(lastFocus)) {
      lastFocus.focus();
    }
  });

  function onKey(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div
  class="drawer-overlay"
  class:open
  aria-hidden={!open}
  onclick={onClose}
  role="presentation"
></div>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  bind:this={drawerEl}
  class="drawer"
  class:open
  class:wide
  role="dialog"
  aria-modal="true"
  aria-labelledby="drawer-title"
  aria-hidden={!open}
  inert={!open}
>
  <button
    type="button"
    class="drawer-grab"
    aria-label="Cerrar"
    onclick={onClose}
  ><span></span></button>
  <header class="drawer-head">
    <div>
      {#if subtitle}
        <div class="label" style="margin-bottom: 6px;">{subtitle}</div>
      {/if}
      <h2 id="drawer-title">{title}</h2>
    </div>
    <button type="button" class="btn btn-ghost" aria-label="Cerrar" onclick={onClose} style="padding: 8px;">
      <Glyph name="Close" size={16} />
    </button>
  </header>
  <div class="greca" aria-hidden="true"></div>
  <div class="drawer-body">
    {@render children?.()}
  </div>
</aside>

<style>
  .drawer-grab {
    display: none;
    background: transparent;
    border: none;
    padding: 8px 0 4px;
    cursor: pointer;
  }
  .drawer-grab span {
    display: block;
    width: 38px;
    height: 4px;
    border-radius: 999px;
    background: var(--line-strong);
    margin: 0 auto;
  }
  @media (max-width: 640px) {
    .drawer-grab { display: block; }
  }
</style>
