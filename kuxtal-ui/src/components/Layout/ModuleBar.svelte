<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte';
  import type { GlyphName } from '../../lib/glyphs/glyph-data';
  import { onMount, untrack } from 'svelte';

  export type ModuleId =
    | 'plantas'
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
    onOpen
  }: {
    active: ModuleId | null;
    onOpen: (id: ModuleId | null) => void;
  } = $props();

  const groups: Group[] = [
    {
      id: 'tierra',
      label: 'Tierra',
      icon: 'Mountain',
      items: [
        { id: 'plantas', label: 'Plantas', icon: 'Seed', sub: 'Catálogo · funciones · reglas' },
        { id: 'animales', label: 'Animales', icon: 'Mariposa', sub: 'Lo que vive en tu tierra' },
        { id: 'recursos', label: 'Recursos', icon: 'Box', sub: 'Inventario y materiales' },
      ],
    },
    {
      id: 'bitacora',
      label: 'Bitácora',
      icon: 'Book',
      items: [
        { id: 'cuaderno', label: 'Cuaderno', icon: 'Mic', sub: 'Voz · foto · texto' },
        { id: 'protocolo', label: 'Protocolo', icon: 'List', sub: 'Planeación y tareas' },
        { id: 'cosecha', label: 'Cosecha', icon: 'Basket', sub: 'Registro de producción' },
      ],
    },
    {
      id: 'saberes-grp',
      label: 'Saberes',
      icon: 'Sparkle',
      items: [
        { id: 'heredado', label: 'Heredado', icon: 'Book', sub: 'Conocimiento ancestral' },
        { id: 'saberes', label: 'Reglas', icon: 'Sparkle', sub: 'Reglas · atribución' },
        { id: 'calendarios', label: 'Calendarios', icon: 'Sun', sub: 'Cuatro saberes del tiempo' },
      ],
    },
    {
      id: 'comunidad-grp',
      label: 'Comunidad',
      icon: 'People',
      items: [
        { id: 'comunidad', label: 'Comunidad', icon: 'People', sub: 'Foro · eventos · perfil' },
      ],
    },
    {
      id: 'codice',
      label: 'Códice',
      icon: 'Compass',
      items: [
        { id: 'analisis', label: 'Análisis', icon: 'Chart', sub: 'Métricas del códice' },
        { id: 'ajustes', label: 'Ajustes', icon: 'Settings', sub: 'Paleta · accesibilidad' },
      ],
    },
  ];

  let openGroup = $state<GroupId | null>(null);
  let containerEl: HTMLElement | undefined = $state();

  function activeGroupId(): GroupId | null {
    if (!active) return null;
    return groups.find((g) => g.items.some((i) => i.id === active))?.id ?? null;
  }

  function chooseModule(id: ModuleId): void {
    openGroup = null;
    onOpen(active === id ? null : id);
  }

  function clickGroup(g: Group): void {
    if (g.items.length === 1) {
      chooseModule(g.items[0].id);
      return;
    }
    openGroup = openGroup === g.id ? null : g.id;
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
      else openGroup = openGroup === g.id ? null : g.id;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (g.items.length > 1) openGroup = g.id;
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

<div class="module-bar-shell" bind:this={containerEl}>
  <nav class="module-bar codex-card" aria-label="Módulos del códice">
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
          aria-label={g.label + (single ? '' : ' (grupo)')}
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
            aria-label="{g.label}: módulos"
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
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    max-width: calc(100vw - 28px);
    /* Allow popovers to escape the bar */
    overflow: visible;
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
    font-size: 11px;
    letter-spacing: 0.04em;
    transition: background 0.18s var(--ease-codex), color 0.18s var(--ease-codex);
    position: relative;
  }
  .mod-btn:hover, .mod-btn.expanded { background: var(--paper-warm); }
  .mod-btn.on {
    background: var(--ocre);
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
    font-size: 8px;
    opacity: 0.6;
  }

  /* Popover above the bar */
  .popover {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    min-width: 220px;
    max-width: 290px;
    background: var(--paper);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    z-index: 20;
    animation: popUp 0.18s var(--ease-codex);
  }
  @keyframes popUp {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .popover-arrow {
    position: absolute;
    bottom: -7px;
    left: 50%;
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
    font-size: 10px;
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
  .popover-item.on { background: var(--ocre); color: var(--paper); }
  .popover-ico {
    width: 28px; height: 28px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .popover-text { display: flex; flex-direction: column; min-width: 0; }
  .popover-label { font-family: var(--sans); font-size: 14px; font-weight: 500; }
  .popover-sub {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    margin-top: 2px;
  }
  .popover-item.on .popover-sub { color: oklch(0.92 0.05 70); }

  :global(.a11y-large-text) .mod-btn { font-size: 12px; padding: 10px 16px; min-width: 84px; }
  :global(.a11y-large-text) .popover-label { font-size: 15px; }
  :global(.a11y-large-text) .popover-sub { font-size: 11px; }

  @media (max-width: 760px) {
    .module-bar-shell { bottom: 8px; max-width: calc(100vw - 16px); width: calc(100vw - 16px); }
    .module-bar { padding: 4px; gap: 2px; justify-content: space-between; }
    .mod-btn { min-width: 0; flex: 1; padding: 6px 4px; font-size: 10px; }
    .mod-ico { width: 20px; height: 20px; }
    .caret { top: 2px; right: 3px; font-size: 7px; }
    .popover { min-width: 200px; max-width: calc(100vw - 24px); }
  }
  @media (max-width: 380px) {
    .mod-lbl { font-size: 9px; }
  }
</style>
