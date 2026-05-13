<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Map as MlMap } from 'maplibre-gl';

  let {
    map,
    visible = true
  }: {
    map: MlMap | null;
    visible?: boolean;
  } = $props();

  let svgEl: SVGSVGElement | undefined = $state();
  let width = $state(0);
  let height = $state(0);
  let ticksX = $state<Array<{ x: number; label: string }>>([]);
  let ticksY = $state<Array<{ y: number; label: string }>>([]);

  function formatDist(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    if (m >= 1) return `${Math.round(m)} m`;
    return `${Math.round(m * 100)} cm`;
  }

  function update(): void {
    if (!map || !svgEl) return;
    const canvas = map.getCanvas();
    width = canvas.clientWidth;
    height = canvas.clientHeight;

    // Compute nice tick spacing based on scale
    const topLeft = map.unproject([0, 0]);
    const topRight = map.unproject([width, 0]);
    const bottomLeft = map.unproject([0, height]);

    // Distance across the viewport in meters
    const dxM = topLeft.distanceTo(topRight);
    const dyM = topLeft.distanceTo(bottomLeft);

    // Choose tick interval: aim for ~6-10 ticks
    function niceInterval(totalM: number, targetTicks: number): number {
      const raw = totalM / targetTicks;
      const pow = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / pow;
      if (norm < 1.5) return pow;
      if (norm < 3.5) return 2 * pow;
      if (norm < 7.5) return 5 * pow;
      return 10 * pow;
    }

    const intervalX = niceInterval(dxM, 8);
    const intervalY = niceInterval(dyM, 6);

    // Generate X ticks (top ruler)
    const newTicksX: Array<{ x: number; label: string }> = [];
    const pxPerMX = width / dxM;
    const startMX = Math.ceil(0 / intervalX) * intervalX;
    for (let m = startMX; m <= dxM; m += intervalX) {
      newTicksX.push({ x: m * pxPerMX, label: formatDist(m) });
    }
    ticksX = newTicksX;

    // Generate Y ticks (left ruler)
    const newTicksY: Array<{ y: number; label: string }> = [];
    const pxPerMY = height / dyM;
    const startMY = Math.ceil(0 / intervalY) * intervalY;
    for (let m = startMY; m <= dyM; m += intervalY) {
      newTicksY.push({ y: m * pxPerMY, label: formatDist(m) });
    }
    ticksY = newTicksY;
  }

  function onMove(): void { update(); }

  onMount(() => {
    if (map) {
      map.on('move', onMove);
      map.on('resize', onMove);
      update();
    }
  });

  onDestroy(() => {
    if (map) {
      map.off('move', onMove);
      map.off('resize', onMove);
    }
  });

  // Re-attach when map changes
  $effect(() => {
    if (map) {
      map.on('move', onMove);
      map.on('resize', onMove);
      update();
    }
  });
</script>

{#if visible && width > 0}
  <svg
    bind:this={svgEl}
    class="measurement-overlay"
    viewBox="0 0 {width} {height}"
    width={width}
    height={height}
    aria-hidden="true"
  >
    <!-- Top ruler background -->
    <rect x="0" y="0" width={width} height="24" fill="var(--paper)" fill-opacity="0.85" />
    <!-- Left ruler background -->
    <rect x="0" y="24" width="28" height={height - 24} fill="var(--paper)" fill-opacity="0.85" />

    <!-- Top ruler ticks -->
    {#each ticksX as tick}
      <line x1={tick.x} y1="16" x2={tick.x} y2="24" stroke="var(--ink-soft)" stroke-width="1" />
      <text x={tick.x + 3} y="13" class="ruler-label">{tick.label}</text>
    {/each}

    <!-- Left ruler ticks -->
    {#each ticksY as tick}
      <line x1="20" y1={tick.y} x2="28" y2={tick.y} stroke="var(--ink-soft)" stroke-width="1" />
      <text x="18" y={tick.y - 3} class="ruler-label ruler-label-y" text-anchor="end">{tick.label}</text>
    {/each}

    <!-- Corner badge -->
    <rect x="0" y="0" width="28" height="24" fill="var(--paper-warm)" fill-opacity="0.95" />
    <text x="14" y="15" text-anchor="middle" class="ruler-corner">↔</text>
  </svg>
{/if}

<style>
  .measurement-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
  .ruler-label {
    font-family: var(--mono);
    font-size: 9px;
    fill: var(--ink-soft);
    letter-spacing: 0.04em;
  }
  .ruler-label-y {
    font-size: 8px;
  }
  .ruler-corner {
    font-family: var(--mono);
    font-size: 10px;
    fill: var(--ink-soft);
  }
</style>
