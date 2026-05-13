<script lang="ts">
  import { GLYPHS, type GlyphName } from './glyph-data';

  let {
    name,
    size = 18,
    title,
    decorative = true,
    stroke = 1.4,
    strokeLinejoin = 'round'
  }: {
    name: GlyphName;
    size?: number | string;
    title?: string;
    decorative?: boolean;
    stroke?: number;
    strokeLinejoin?: 'round' | 'miter' | 'bevel';
  } = $props();

  const def = $derived(GLYPHS[name]);
</script>

<svg
  viewBox="0 0 32 32"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin={strokeLinejoin}
  class="glyph-wrap"
  role={decorative ? 'presentation' : 'img'}
  aria-hidden={decorative}
  aria-label={!decorative ? title : undefined}
>
  {#if title && !decorative}
    <title>{title}</title>
  {/if}

  {#each def?.paths ?? [] as d}
    <path {d} />
  {/each}
  {#each def?.circles ?? [] as c}
    <circle cx={c.cx} cy={c.cy} r={c.r} fill={c.fill ? 'currentColor' : 'none'} />
  {/each}
  {#each def?.ellipses ?? [] as e}
    <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} transform={e.transform} />
  {/each}
  {#each def?.rects ?? [] as r}
    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx ?? 0} />
  {/each}
</svg>
