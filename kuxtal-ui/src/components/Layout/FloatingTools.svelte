<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import type { GlyphName } from '../../lib/glyphs/glyph-data'
  import { t as tr } from '../../lib/i18n/index.svelte'
  import { undo, redo, canUndo, canRedo } from '../../lib/stores/history'
  import { navCollapsed } from '../../lib/stores/chrome'

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo. Ignored while typing.
  function onKeyDown(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
  }

  export type ToolId =
    | 'pan'
    | 'boundary'
    | 'zone'
    | 'plant'
    | 'water'
    | 'erase'
    | 'edit'

  let {
    tool,
    setTool
  }: {
    tool: ToolId
    setTool: (id: ToolId) => void
  } = $props()

  const tools = $derived<Array<{ id: ToolId; label: string; hint: string; icon: GlyphName }>>([
    { id: 'pan',      label: tr('tool_navigate'), hint: 'V', icon: 'Compass' },
    { id: 'plant',    label: tr('tool_plant'),    hint: 'P', icon: 'Plus'    },
    { id: 'zone',     label: tr('tool_zone'),     hint: 'Z', icon: 'Layers'  },
    { id: 'boundary', label: tr('tool_boundary'), hint: 'B', icon: 'Map'     },
    { id: 'water',    label: tr('tool_water'),    hint: 'W', icon: 'Drop'    },
    { id: 'edit',     label: tr('tool_edit'),     hint: 'M', icon: 'Map'     },
    { id: 'erase',    label: tr('tool_delete'),   hint: 'X', icon: 'Trash'   }
  ])
</script>

<svelte:window onkeydown={onKeyDown} />

<aside
  class="tools-rail codex-card"
  class:is-collapsed={$navCollapsed}
  aria-label={tr('tools_aria')}
  data-tour="tools"
>
  {#each tools as tool_item}
    <button
      type="button"
      class="tool-btn"
      class:on={tool === tool_item.id}
      aria-pressed={tool === tool_item.id}
      aria-label={tool_item.label}
      title={tool_item.label}
      onclick={() => setTool(tool_item.id)}
    >
      <span class="tool-ico"><Glyph name={tool_item.icon} size={18} /></span>
      <span class="tool-lbl">{tool_item.label}</span>
      <span class="tool-hint coord" aria-hidden="true">{tool_item.hint}</span>
    </button>
  {/each}
  <div class="tool-sep hide-on-mobile" aria-hidden="true"></div>
  <button
    type="button"
    class="tool-btn hide-on-mobile"
    disabled={!$canUndo}
    aria-label={tr('tool_undo')}
    title={`${tr('tool_undo')} · Ctrl+Z`}
    onclick={undo}
  >
    <span class="tool-ico"><Glyph name="Reset" size={18} /></span>
    <span class="tool-lbl">{tr('tool_undo')}</span>
  </button>
  <button
    type="button"
    class="tool-btn hide-on-mobile"
    disabled={!$canRedo}
    aria-label={tr('tool_redo')}
    title={`${tr('tool_redo')} · Ctrl+Y`}
    onclick={redo}
  >
    <span class="tool-ico" style="transform: scaleX(-1);"><Glyph name="Reset" size={18} /></span>
    <span class="tool-lbl">{tr('tool_redo')}</span>
  </button>
</aside>

<style>
  .tools-rail {
    position: absolute;
    left: calc(14px + var(--safe-left));
    top: 50%;
    transform: translateY(-50%);
    z-index: var(--z-canvas-rail);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 8px;
    border: none;
    background: transparent;
    color: var(--ink);
    border-radius: 4px;
    cursor: pointer;
    width: 60px;
    font-family: var(--sans);
    font-size: calc(10px * var(--text-scale));
    transition: all 0.15s var(--ease-codex);
  }
  .tool-btn:hover {
    background: var(--paper-warm);
  }
  .tool-btn.on {
    background: var(--ink);
    color: var(--paper);
  }
  .tool-btn.on .tool-hint {
    color: var(--maiz);
  }
  .tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .tool-btn:disabled:hover { background: transparent; }
  .tool-sep { height: 1px; background: var(--line); margin: 4px 6px; flex-shrink: 0; }
  .tool-ico {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tool-hint {
    font-size: calc(8px * var(--text-scale));
    opacity: 0.7;
  }
  @media (max-width: 760px) {
    .tools-rail {
      left: 50%;
      top: auto;
      /* Sit just above the floating bottom nav + home indicator */
      bottom: calc(var(--nav-h) + var(--safe-bottom) + 12px);
      transform: translateX(-50%);
      flex-direction: row;
      max-width: calc(100vw - 16px - var(--safe-left) - var(--safe-right));
      overflow-x: auto;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      transition: all 0.3s var(--ease-codex);
    }
    /* When the module bar collapses into a FAB on the left, shift this right */
    .tools-rail.is-collapsed {
      left: calc(60px + var(--safe-left));
      transform: none;
      max-width: calc(100vw - 68px - var(--safe-left) - var(--safe-right));
    }
    .tools-rail::-webkit-scrollbar { display: none; }
    .hide-on-mobile {
      display: none !important;
    }
    /* Icon-only on phones: the label lives in aria-label, so hiding it visually
       keeps every tool reachable while fitting more of them without scrolling. */
    .tool-btn {
      width: 46px;
      padding: 6px 4px;
      min-height: 44px;
      justify-content: center;
      flex-shrink: 0;
      scroll-snap-align: center;
    }
    .tool-lbl { display: none; }
    .tool-ico { width: 20px; height: 20px; }
    .tool-hint { display: none; }
  }
</style>
