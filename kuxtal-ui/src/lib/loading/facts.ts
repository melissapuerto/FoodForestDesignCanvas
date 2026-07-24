/**
 * Loading-time facts — the "Use Edges and Value the Marginals" × "Expose the
 * Seams" bridge (PermaSE). A wait is otherwise wasted time; here it teaches a
 * permaculture or sustainability fact and, opt-in, exposes the data/energy the
 * app is about to spend. Every fact carries a source (R10: knowledge is
 * attributed). Bilingual so it works in both shipped locales.
 *
 * This is deliberately calm and non-gamified (ETHICAL_CONSTRAINTS R9: no
 * engagement mechanics) and is only shown when the user leaves it on
 * (prefs.loadingFacts). The energy line is off by default (prefs.loadingEnergyHint)
 * so the seam is offered, never forced (Expose-the-Seams: do not force the seams).
 */

export type Fact = { es: string; en: string; source: string };

export const FACTS: readonly Fact[] = [
  {
    es: 'Después de tu primera visita, Kuxtal funciona sin conexión: las siguientes cargas transfieren casi 0 bytes.',
    en: 'After your first visit, Kuxtal works offline — later loads transfer almost 0 bytes.',
    source: 'Kuxtal ENERGY.md'
  },
  {
    es: 'Tus datos viven en tu dispositivo, no en un servidor. Nada se envía sin tu permiso.',
    en: 'Your data lives on your device, not on a server. Nothing is sent without your consent.',
    source: 'Kuxtal ETHICAL_CONSTRAINTS R2'
  },
  {
    es: 'Los bordes —donde se encuentran dos ecosistemas— son las zonas más productivas de un terreno.',
    en: 'Edges — where two ecosystems meet — are the most productive zones of a landscape.',
    source: 'Permaculture: Use Edges and Value the Marginal'
  },
  {
    es: '«El problema es la solución»: observa antes de actuar.',
    en: '"The problem is the solution" — observe before you act.',
    source: 'Bill Mollison, Permaculture'
  },
  {
    es: 'Las Tres Hermanas —maíz, frijol y calabaza— crecen mejor juntas que separadas.',
    en: 'The Three Sisters — maize, beans and squash — grow better together than apart.',
    source: 'Mesoamerican milpa tradition'
  },
  {
    es: 'Las plantas fijadoras de nitrógeno alimentan a sus vecinas tomando nitrógeno del aire.',
    en: 'Nitrogen-fixing plants feed their neighbours by taking nitrogen from the air.',
    source: 'Permaculture guilds'
  },
  {
    es: 'Un bosque de alimentos maduro almacena carbono en siete capas verticales.',
    en: 'A mature food forest stores carbon across seven vertical layers.',
    source: 'Food-forest design'
  },
  {
    es: 'Enviar 1 GB por la red gasta ~0,8 kWh, así que las páginas ligeras cuestan menos energía.',
    en: 'Sending 1 GB over the network costs ~0.8 kWh, so lighter pages spend less energy.',
    source: 'Sustainable Web Design model (estimate)'
  },
  {
    es: 'El modo oscuro y el movimiento reducido bajan el consumo de pantallas OLED.',
    en: 'Dark mode and reduced motion lower the energy use of OLED screens.',
    source: 'Kuxtal ENERGY.md'
  },
  {
    es: 'Soluciones pequeñas y lentas: empezar mínimo y crecer despacio suele ser más resiliente.',
    en: 'Small and slow solutions: starting minimal and growing slowly tends to be more resilient.',
    source: 'Permaculture: Use Small and Slow Solutions'
  }
];

/**
 * Estimated gzipped transfer for a chunk, in bytes. These are order-of-magnitude
 * figures from the real build (npm run budget), used only to show the user what a
 * one-time load costs — labelled as an estimate in the UI. 'boot' is the
 * first-paint + map-engine path; the rest are lazy module chunks.
 */
export const CHUNK_BYTES: Record<string, number> = {
  boot: 288_000, // MapLibre GL engine (~288 KB gz) — the heaviest one-time load
  analisis: 85_000, // Dashboard + Chart.js
  plantas: 60_000, // Plant guide + species catalog
  lienzo: 16_000,
  cuaderno: 18_000,
  animales: 14_000,
  calendarios: 20_000,
  heredado: 14_000,
  saberes: 14_000,
  recursos: 12_000,
  comunidad: 16_000,
  protocolo: 12_000,
  cosecha: 12_000,
  ajustes: 22_000
};

/**
 * Energy per gigabyte transferred, in kWh. Deliberately a single documented
 * estimate, consistent with the ENERGY.md honesty rule ("transparent, documented
 * estimates — NOT precision figures"). Source: Sustainable Web Design model (~0.81
 * kWh/GB end-to-end). Halve it as networks decarbonise if you re-baseline.
 */
export const ENERGY_KWH_PER_GB = 0.81;

/** Estimated energy for a transfer, in watt-hours (Wh). */
export function estimateWh(bytes: number): number {
  const gb = bytes / 1_000_000_000;
  return gb * ENERGY_KWH_PER_GB * 1000; // kWh → Wh
}

/** Human-readable transfer size, e.g. "288 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}

/** Pick a fact. With no seed, random; with a seed, deterministic (for tests/rotation). */
export function pickFact(seed?: number): Fact {
  const i =
    seed === undefined
      ? Math.floor(Math.random() * FACTS.length)
      : ((seed % FACTS.length) + FACTS.length) % FACTS.length;
  return FACTS[i];
}
