<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import type { GlyphName } from '../../lib/glyphs/glyph-data';
  import { onMount, tick, untrack } from 'svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { navCollapsed, toggleNav } from '../../lib/stores/chrome';

  export type ModuleId =
    | 'plantas'
    | 'lienzo'
    | 'animales'
    | 'cuaderno'
    | 'calendarios'
    | 'heredado'
    | 'saberes'
    | 'protocolo'
    | 'cosecha'
    | 'recursos'
    | 'analisis'
    | 'comunidad'
    | 'ajustes';

  type GroupId = 'tierra' | 'bitacora' | 'saberes-grp' | 'comunidad-grp' | 'codice';

  type Item = { id: ModuleId; label: string; icon: GlyphName; sub?: string };

  type Group = {
    id: GroupId;
    label: string;
    icon: GlyphName;
    items: Item[];
  };

  let {
    active,
    onOpen,
    srMode = false
  }: {
    active: ModuleId | null;
    onOpen: (id: ModuleId | null) => void;
    srMode?: boolean;
  } = $props();

  // In screen-reader mode the collapse handle is a confusing visual-only space
  // saver, so it's hidden and the menu stays permanently expanded.
  const collapsed = $derived(!srMode && $navCollapsed);

  const groups = $derived<Group[]>([
    {
      id: 'tierra',
      label: t('module_grp_tierra'),
      icon: 'Mountain',
      items: [
        { id: 'plantas',   label: t('module_plants'),    icon: 'Seed',     sub: t('module_plants_sub')    },
        { id: 'lienzo',    label: t('module_lienzo'),    icon: 'Map',      sub: t('module_lienzo_sub')    },
        { id: 'animales',  label: t('module_animals'),   icon: 'Mariposa', sub: t('module_animals_sub')   },
        { id: 'recursos',  label: t('module_resources'), icon: 'Box',      sub: t('module_resources_sub') },
      ],
    },
    {
      id: 'bitacora',
      label: t('module_grp_log'),
      icon: 'Book',
      items: [
        { id: 'cuaderno',  label: t('module_log'),      icon: 'Mic',    sub: t('module_log_sub')      },
        { id: 'protocolo', label: t('module_protocol'), icon: 'List',   sub: t('module_protocol_sub') },
        { id: 'cosecha',   label: t('module_harvest'),  icon: 'Basket', sub: t('module_harvest_sub')  },
      ],
    },
    {
      id: 'saberes-grp',
      label: t('module_grp_knowledge'),
      icon: 'Sparkle',
      items: [
        { id: 'heredado',   label: t('module_heredado'),  icon: 'Book',    sub: t('module_heredado_sub')  },
        { id: 'saberes',    label: t('module_rules'),     icon: 'Sparkle', sub: t('module_saberes_sub')   },
        { id: 'calendarios',label: t('module_calendars'), icon: 'Sun',     sub: t('module_calendars_sub') },
      ],
    },
    {
      id: 'comunidad-grp',
      label: t('module_grp_community'),
      icon: 'People',
      items: [
        { id: 'comunidad', label: t('module_community'), icon: 'People', sub: t('module_community_sub') },
      ],
    },
    {
      id: 'codice',
      label: t('module_grp_codex'),
      icon: 'Compass',
      items: [
        { id: 'analisis', label: t('module_codex'),   icon: 'Chart',    sub: t('module_codex_sub')    },
        { id: 'ajustes',  label: t('topbar_tweaks'),  icon: 'Settings', sub: t('module_settings_sub') },
      ],
    },
  ]);

  let openGroup = $state<GroupId | null>(null);
  let containerEl: HTMLElement | undefined = $state();
  let nudgeX = $state<Partial<Record<GroupId, number>>>({});
  let arrowPct = $state<Partial<Record<GroupId, number>>>({});

  function activeGroupId(): GroupId | null {
    if (!active) return null;
    return groups.find((g) => g.items.some((i) => i.id === active))?.id ?? null;
  }

  function chooseModule(id: ModuleId): void {
    openGroup = null;
    onOpen(active === id ? null : id);
  }

  async function openPopoverGroup(g: Group): Promise<void> {
    openGroup = g.id;
    await tick();
    const pop = document.getElementById(`popover-${g.id}`);
    const btn = document.getElementById(`group-${g.id}`);
    if (!pop || !btn) return;
    const pr = pop.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const PAD = 8;
    let nudge = 0;
    if (pr.left < PAD) nudge = PAD - pr.left;
    else if (pr.right > vw - PAD) nudge = vw - PAD - pr.right;
    const btnCenter = br.left + br.width / 2;
    const finalPopLeft = pr.left + nudge;
    const arrow = Math.min(80, Math.max(20, ((btnCenter - finalPopLeft) / pr.width) * 100));
    nudgeX = { ...nudgeX, [g.id]: nudge };
    arrowPct = { ...arrowPct, [g.id]: arrow };
  }

  function clickGroup(g: Group): void {
    if (g.items.length === 1) {
      chooseModule(g.items[0].id);
      return;
    }
    if (openGroup === g.id) openGroup = null;
    else openPopoverGroup(g);
  }

  function onKeyGroup(e: KeyboardEvent, g: Group, idx: number): void {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + dir + groups.length) % groups.length;
      const el = document.getElementById(`group-${groups[next].id}`);
      el?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (g.items.length === 1) chooseModule(g.items[0].id);
      else if (openGroup === g.id) openGroup = null;
      else openPopoverGroup(g);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (g.items.length > 1 && openGroup !== g.id) openPopoverGroup(g);
    } else if (e.key === 'Escape' && openGroup) {
      e.preventDefault();
      openGroup = null;
    }
  }

  function onKeyItem(e: KeyboardEvent, group: Group, item: Item, idx: number): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = (idx + dir + group.items.length) % group.items.length;
      const el = document.getElementById(`item-${group.items[next].id}`);
      el?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      openGroup = null;
      const groupBtn = document.getElementById(`group-${group.id}`);
      groupBtn?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      chooseModule(item.id);
    }
  }

  function onDocClick(e: MouseEvent): void {
    if (!openGroup || !containerEl) return;
    const target = e.target as Node | null;
    if (target && !containerEl.contains(target)) {
      openGroup = null;
    }
  }

  // Close any open popover when the active module changes externally
  // (e.g. opened by another component / keyboard shortcut).
  $effect(() => {
    const a = active;
    untrack(() => {
      if (!a) return;
      const grp = groups.find((g) => g.items.some((i) => i.id === a))?.id ?? null;
      if (openGroup && openGroup !== grp) openGroup = null;
    });
  });

  function onToggleNav(): void {
    // Always close any open group popover when collapsing/expanding the bar
    // so a hidden popover can't keep stealing pointer/focus.
    openGroup = null;
    toggleNav();
  }

  // If the bar is collapsed by any path, make sure no popover stays open.
  $effect(() => {
    if ($navCollapsed) openGroup = null;
  });

  // Publish the real height the bottom nav cluster occupies (nav + pull-handle
  // + safe area) into --nav-h, so canvas overlays anchored to it (tool rail,
  // map controls, side rails) clear it on every screen. Mirrors CodexTopBar's
  // --topbar-h. Collapsing shrinks it, freeing space for the tool rail too.
  function setNavHeight(node: HTMLElement): void {
    const occupied = Math.max(48, Math.round(window.innerHeight - node.getBoundingClientRect().top));
    document.documentElement.style.setProperty('--nav-h', `${occupied}px`);
  }
  function publishNavHeight(node: HTMLElement) {
    const update = () => requestAnimationFrame(() => setNavHeight(node));
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(node);
    }
    window.addEventListener('resize', update);
    return {
      destroy() {
        ro?.disconnect();
        window.removeEventListener('resize', update);
      }
    };
  }
  // Recompute after a collapse/expand transition (a CSS transform does not
  // trigger ResizeObserver).
  $effect(() => {
    $navCollapsed; // track
    const el = containerEl;
    if (!el) return;
    const tid = setTimeout(() => setNavHeight(el), 460);
    return () => clearTimeout(tid);
  });

  onMount(() => {
    document.addEventListener('click', onDocClick);
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') openGroup = null; };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  });
</script>

<div class="module-bar-shell" class:collapsed={collapsed} bind:this={containerEl} use:publishNavHeight>
  {#if !srMode}
    <button
      type="button"
      class="nav-handle"
      aria-expanded={!$navCollapsed}
      aria-controls="module-nav"
      aria-label={$navCollapsed ? t('nav_show_menu') : t('nav_hide_menu')}
      title={$navCollapsed ? t('nav_show_menu') : t('nav_hide_menu')}
      onclick={onToggleNav}
    >
      <span class="nav-handle-ico" aria-hidden="true">{$navCollapsed ? '▴' : '▾'}</span>
      {#if $navCollapsed}<span class="nav-handle-lbl">{t('nav_menu')}</span>{/if}
    </button>
  {/if}
  <nav
    id="module-nav"
    class="module-bar codex-card"
    aria-label={t('nav_aria_modules')}
    data-tour="nav"
    inert={collapsed}
  >
    {#each groups as g, i (g.id)}
      {@const isActiveGrp = activeGroupId() === g.id}
      {@const isOpen = openGroup === g.id}
      {@const single = g.items.length === 1}
      <div class="mod-wrap" role="presentation">
        <button
          type="button"
          id="group-{g.id}"
          class="mod-btn"
          class:on={isActiveGrp}
          class:expanded={isOpen}
          aria-haspopup={single ? undefined : 'menu'}
          aria-expanded={single ? undefined : isOpen}
          aria-controls={single ? undefined : `popover-${g.id}`}
          aria-label={g.label + (single ? '' : t('bar_group_suffix'))}
          onclick={() => clickGroup(g)}
          onkeydown={(e) => onKeyGroup(e, g, i)}
        >
          <span class="mod-ico">
            <Glyph name={g.icon} size={20} />
          </span>
          <span class="mod-lbl">{g.label}</span>
          {#if !single}
            <span class="caret" aria-hidden="true">▾</span>
          {/if}
        </button>

        {#if !single && isOpen}
          <div
            id="popover-{g.id}"
            class="popover"
            role="menu"
            aria-label="{g.label}{t('bar_modules_suffix')}"
            style:--nudge-x="{nudgeX[g.id] ?? 0}px"
            style:--arrow-left="{arrowPct[g.id] != null ? arrowPct[g.id] + '%' : '50%'}"
          >
            <div class="popover-arrow" aria-hidden="true"></div>
            <div class="popover-inner">
              <div class="popover-head label">{g.label}</div>
              {#each g.items as it, j (it.id)}
                <button
                  type="button"
                  id="item-{it.id}"
                  class="popover-item"
                  class:on={active === it.id}
                  role="menuitem"
                  aria-current={active === it.id ? 'page' : undefined}
                  onclick={() => chooseModule(it.id)}
                  onkeydown={(e) => onKeyItem(e, g, it, j)}
                >
                  <span class="popover-ico"><Glyph name={it.icon} size={18} /></span>
                  <span class="popover-text">
                    <span class="popover-label">{it.label}</span>
                    {#if it.sub}<span class="popover-sub">{it.sub}</span>{/if}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </nav>
</div>

<style>
  .module-bar-shell {
    position: fixed;
    bottom: calc(14px + var(--safe-bottom));
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-bar);
    max-width: calc(100vw - 28px - var(--safe-left) - var(--safe-right));
    /* Allow popovers to escape the bar */
    overflow: visible;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    transition: transform 0.42s var(--ease-codex);
    --nav-handle-h: 28px;
  }
  /* Collapsed: slide the cluster down until only the pull-handle peeks above
     the bottom edge, freeing the map. The <nav> is `inert` while collapsed, so
     it leaves the tab order and the accessibility tree entirely. */
  .module-bar-shell.collapsed {
    transform: translateX(-50%) translateY(calc(100% - var(--nav-handle-h)));
  }

  /* Pull-handle: collapses / restores the bottom nav. Sits as a tab on top of
     the bar and remains tappable when the bar is tucked away. */
  .nav-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--nav-handle-h);
    padding: 4px 16px;
    border: 1.5px solid var(--ink);
    border-bottom: none;
    border-radius: 10px 10px 0 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 -2px 8px oklch(0.2 0.04 60 / 0.12);
  }
  .nav-handle:hover { background: var(--paper-warm); }
  .nav-handle-ico { font-size: calc(12px * var(--text-scale)); line-height: 1; }
  .module-bar-shell.collapsed .nav-handle {
    border-bottom: 1.5px solid var(--ink);
    border-radius: 10px;
  }
  .module-bar {
    padding: 6px;
    display: flex;
    gap: 4px;
    /* No horizontal scroll for 5 groups – they should always fit */
  }
  .mod-wrap { position: relative; }
  .mod-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink);
    border-radius: 6px;
    cursor: pointer;
    min-width: 78px;
    font-family: var(--sans);
    font-size: calc(11px * var(--text-scale));
    letter-spacing: 0.04em;
    transition: background 0.18s var(--ease-codex), color 0.18s var(--ease-codex);
    position: relative;
  }
  .mod-btn:hover, .mod-btn.expanded { background: var(--paper-warm); }
  .mod-btn.on {
    background: var(--ocre-deep);
    color: var(--paper);
    border-color: var(--ocre-deep);
  }
  .mod-btn.on .mod-ico { color: var(--paper); }
  .mod-ico {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
  }
  .mod-lbl { white-space: nowrap; }
  .caret {
    position: absolute;
    top: 4px; right: 6px;
    font-size: calc(8px * var(--text-scale));
    opacity: 0.6;
  }

  /* Popover above the bar */
  .popover {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(calc(-50% + var(--nudge-x, 0px)));
    min-width: 220px;
    max-width: 290px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    z-index: var(--z-popover);
    animation: popUp 0.18s var(--ease-codex);
  }
  @keyframes popUp {
    from { opacity: 0; transform: translateX(calc(-50% + var(--nudge-x, 0px))) translateY(4px); }
    to   { opacity: 1; transform: translateX(calc(-50% + var(--nudge-x, 0px))) translateY(0); }
  }
  .popover-arrow {
    position: absolute;
    bottom: -7px;
    left: var(--arrow-left, 50%);
    transform: translateX(-50%) rotate(45deg);
    width: 14px; height: 14px;
    background: var(--paper);
    border-right: 1px solid var(--line-strong);
    border-bottom: 1px solid var(--line-strong);
  }
  .popover-inner {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .popover-head {
    padding: 4px 10px 8px;
    font-size: calc(10px * var(--text-scale));
  }
  .popover-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: var(--ink);
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-height: 44px;
    transition: background 0.12s var(--ease-codex);
  }
  .popover-item:hover, .popover-item:focus-visible { background: var(--paper-warm); }
  .popover-item.on { background: var(--ocre-deep); color: var(--paper); }
  .popover-ico {
    width: 28px; height: 28px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .popover-text { display: flex; flex-direction: column; min-width: 0; }
  .popover-label { font-family: var(--sans); font-size: calc(14px * var(--text-scale)); font-weight: 500; }
  .popover-sub {
    font-family: var(--mono);
    font-size: calc(10px * var(--text-scale));
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    margin-top: 2px;
  }
  .popover-item.on .popover-sub { color: oklch(0.92 0.05 70); }

  :global(.a11y-large-text) .mod-btn { font-size: calc(12px * var(--text-scale)); padding: 10px 16px; min-width: 84px; }
  :global(.a11y-large-text) .popover-label { font-size: calc(15px * var(--text-scale)); }
  :global(.a11y-large-text) .popover-sub { font-size: calc(11px * var(--text-scale)); }

  @media (max-width: 760px) {
    .module-bar-shell {
      bottom: calc(8px + var(--safe-bottom));
      max-width: calc(100vw - 16px - var(--safe-left) - var(--safe-right));
      width: calc(100vw - 16px - var(--safe-left) - var(--safe-right));
    }
    .module-bar { padding: 4px; gap: 2px; justify-content: space-between; }
    /* 44px minimum touch target for the primary navigation */
    .mod-btn { min-width: 0; flex: 1; padding: 6px 4px; font-size: calc(10px * var(--text-scale)); min-height: 44px; justify-content: center; }
    .mod-ico { width: 20px; height: 20px; }
    .caret { top: 2px; right: 3px; font-size: calc(7px * var(--text-scale)); }
    .popover { min-width: 200px; max-width: calc(100vw - 24px); }
  }
  @media (max-width: 380px) {
    .mod-lbl { font-size: calc(9px * var(--text-scale)); }
  }

  /* Coarse pointers (touch): give the pull-handle a 44px target and keep the
     collapsed peek height in sync via the shared variable. */
  @media (pointer: coarse) {
    .module-bar-shell { --nav-handle-h: 44px; }
    .nav-handle { padding: 8px 22px; }
  }
</style>
