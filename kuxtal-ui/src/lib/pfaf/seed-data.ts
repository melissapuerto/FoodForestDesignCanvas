/**
 * Backwards-compat barrel — the actual data lives in `registry.ts` and `animals.ts`
 * so it can be edited and extended in isolation.
 */
export { PDB, type PdbEntry, PDB_GLYPH_FALLBACK } from './registry';
export { ANIMAL_SEED, type AnimalEntry } from './animals';
