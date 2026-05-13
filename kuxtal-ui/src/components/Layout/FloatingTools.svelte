<script lang="ts">
  import Glyph from '../../lib/glyphs/Glyph.svelte'
  import type { GlyphName } from '../../lib/glyphs/glyph-data'

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
    setTool: (t: ToolId) => void
  } = $props()

  const tools: Array<{
    id: ToolId
    label: string
    hint: string
    icon: GlyphName
  }> = [
    { id: 'pan', label: 'Navegar', hint: 'V', icon: 'Compass' },
    { id: 'plant', label: 'Plantar', hint: 'P', icon: 'Plus' },
    { id: 'zone', label: 'Zona', hint: 'Z', icon: 'Layers' },
    { id: 'boundary', label: 'Contorno', hint: 'B', icon: 'Map' },
    { id: 'water', label: 'Agua', hint: 'W', icon: 'Drop' },
    { id: 'edit', label: 'Modificar', hint: 'M', icon: 'Map' },
    { id: 'erase', label: 'Borrar', hint: 'X', icon: 'Trash' }
  ]
</script>

<aside
  class="tools-rail codex-card"
  aria-label="Herramientas del lienzo"
>
  {#each tools as t}
    <button
      type="button"
      class="tool-btn"
      class:on={tool === t.id}
      aria-pressed={tool === t.id}
      aria-label={`${t.label} (${t.hint})`}
      title={`${t.label} · ${t.hint}`}
      onclick={() => setTool(t.id)}
    >
      <span class="tool-ico"
        ><Glyph
          name={t.icon}
          size={18}
        /></span
      >
      <span class="tool-lbl">{t.label}</span>
      <span class="tool-hint coord">{t.hint}</span>
    </button>
  {/each}
</aside>

<style>
  .tools-rail {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 11;
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
    font-size: 10px;
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
  .tool-ico {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tool-hint {
    font-size: 8px;
    opacity: 0.7;
  }
  @media (max-width: 760px) {
    .tools-rail {
      left: 50%;
      top: auto;
      bottom: 90px;
      transform: translateX(-50%);
      flex-direction: row;
      max-width: calc(100vw - 16px);
      overflow-x: auto;
    }
    .tool-btn {
      width: 56px;
      padding: 6px;
      font-size: 9px;
    }
    .tool-ico {
      width: 18px;
      height: 18px;
    }
    .tool-hint {
      display: none;
    }
  }
</style>
