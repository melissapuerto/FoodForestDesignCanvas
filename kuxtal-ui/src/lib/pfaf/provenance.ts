/**
 * Plant data provenance (PD-10 / ICK-01). Classifies the raw `source` string
 * stored on each plant_species row into a small set of kinds so the UI can show
 * where the knowledge came from — and distinguish community/Indigenous
 * knowledge by icon + label (never colour alone).
 */
export type ProvenanceKind = 'pfaf' | 'regional' | 'community' | 'user' | 'unknown';

export function classifyProvenance(source: string | null | undefined): ProvenanceKind {
  if (!source) return 'unknown';
  const s = source.toLowerCase();
  if (s === 'pfaf' || s.includes('plants for a future')) return 'pfaf';
  if (s.includes('comunidad') || s.includes('community') || s.includes('indigenous') || s.includes('conocimiento')) return 'community';
  if (s.includes('kuxtal') || s.includes('regional') || s.includes('registro')) return 'regional';
  if (s === 'user' || s.includes('usuari') || s.includes('user')) return 'user';
  return 'unknown';
}

export function isCommunityKnowledge(source: string | null | undefined): boolean {
  return classifyProvenance(source) === 'community';
}

/** i18n key for the human-readable provenance label. */
export function provenanceLabelKey(kind: ProvenanceKind): string {
  return `prov_${kind}`;
}

/** Glyph name used to mark each provenance kind (community is visually distinct). */
export function provenanceGlyph(kind: ProvenanceKind): string {
  switch (kind) {
    case 'community':
      return 'People';
    case 'pfaf':
      return 'Book';
    case 'regional':
      return 'Star';
    case 'user':
      return 'Seed';
    default:
      return 'Help';
  }
}
