/** Shared helpers for the plant guide and its extracted sub-components. */

/** Parse a JSON string array column (aliases, functions, edible_parts) safely. */
export function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

/** Map a PFAF "sun" description to the app's sun enum. */
export function sunFromPfaf(sun: string): 'completo' | 'sombra' | 'parcial' {
  const s = sun.toLowerCase();
  if (s.includes('pleno')) return 'completo';
  if (s.includes('sombra')) return 'sombra';
  return 'parcial';
}

/** Derive the app's function tags from PFAF edible/medicinal/other/habit scores. */
export function functionsFromPfaf(r: {
  edible: number; med: number; other: number; hab?: string;
}): string[] {
  const fns: string[] = [];
  if (r.edible > 3) fns.push('Comestible');
  if (r.med > 3) fns.push('Medicinal');
  if (r.other > 3) fns.push('Soporte/Otros');
  if (r.hab) fns.push(r.hab);
  return fns;
}
