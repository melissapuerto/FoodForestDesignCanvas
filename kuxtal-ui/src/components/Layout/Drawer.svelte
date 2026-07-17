<script module lang="ts">
  // Shared across all Drawer instances so each gets a unique title id — every
  // drawer is mounted at once in App.svelte, so a hardcoded id would collide
  // and break aria-labelledby resolution.
  let drawerUid = 0;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import { t } from '../../lib/i18n/index.svelte';

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
  let titleEl: HTMLElement | undefined = $state();
  let lastFocus: HTMLElement | null = null;
  const titleId = `drawer-title-${drawerUid++}`;

  /** Visible, enabled, focusable descendants — used for initial focus and the
   *  focus trap. Filters out hidden elements (e.g. the mobile-only grab handle,
   *  which is display:none on desktop). */
  function focusableEls(): HTMLElement[] {
    if (!drawerEl) return [];
    const sel =
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(drawerEl.querySelectorAll<HTMLElement>(sel)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  $effect(() => {
    if (open) {
      lastFocus = document.activeElement as HTMLElement | null;
      // Move focus to the panel's heading (not the first button) so a screen
      // reader actually *enters* the panel and announces what it is — landing
      // on a control like "Close" made testers feel they were "still on a
      // button" and had not entered the flow. From the heading, Tab steps
      // forward into the panel's controls.
      queueMicrotask(() => {
        (titleEl ?? drawerEl)?.focus();
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
      return;
    }
    if (e.key === 'Tab') {
      // Trap focus inside the dialog while open — the aria-modal="true"
      // contract requires focus not to escape to the backdrop content.
      const els = focusableEls();
      if (els.length === 0) {
        e.preventDefault();
        drawerEl?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !drawerEl?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
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

<div
  bind:this={drawerEl}
  class="drawer"
  class:open
  class:wide
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  aria-describedby={subtitle ? `${titleId}-desc` : undefined}
  aria-hidden={!open}
  inert={!open}
  tabindex="-1"
>
  <button
    type="button"
    class="drawer-grab"
    aria-label={t('drawer_close')}
    onclick={onClose}
  ><span></span></button>
  <header class="drawer-head">
    <div>
      {#if subtitle}
        <div class="label" style="margin-bottom: 6px;" id={`${titleId}-desc`}>{subtitle}</div>
      {/if}
      <h2 id={titleId} bind:this={titleEl} tabindex="-1" class="drawer-title">{title}</h2>
    </div>
    <button type="button" class="btn btn-ghost" aria-label={t('drawer_close')} onclick={onClose} style="padding: 8px;">
      <Glyph name="Close" size={16} />
    </button>
  </header>
  <div class="greca" aria-hidden="true"></div>
  <div class="drawer-body">
    {@render children?.()}
  </div>
</div>

<style>
  /* The heading is a programmatic focus target (tabindex=-1), not a Tab stop,
     so it should not show a focus ring. */
  .drawer-title:focus { outline: none; }
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
