import { ANIMAL_SEED } from '../pfaf/animals';
import { PDB } from '../pfaf/registry';
import { EN_ANIMALS } from './animalNames.en';
import { EN_SPECIES_NAMES } from './speciesNames.en';
import { EN_SPECIES_NOTES } from './speciesNotes.en';
import { tr, currentLocale, type TranslationKey } from './translate';

/**
 * Display-time localization for the bundled catalogs.
 *
 * The species/animal rows keep their Spanish source text in the DB and in
 * pfafDb.json — that stays the source of truth and is what a user's own edits
 * write back to. These helpers only swap in an English label at render time,
 * keyed by scientific name (species) or seed id (animals). Anything the user
 * added themselves has no entry in the maps and is shown exactly as typed.
 */

function isEnglish(): boolean {
  return currentLocale() === 'en';
}

/** Common name of a species in the active locale; falls back to the stored name. */
export function localSpeciesName(storedName: string, sci: string | null | undefined): string {
  if (!isEnglish() || !sci) return storedName;
  return EN_SPECIES_NAMES[sci.trim().toLowerCase()] ?? storedName;
}

/** Notes for a seeded species in the active locale. */
export function localSpeciesNotes(id: string, storedNotes: string | null | undefined): string {
  if (!isEnglish() || !storedNotes) return storedNotes ?? '';
  return EN_SPECIES_NOTES[id] ?? storedNotes;
}

/** Common name of a seeded animal in the active locale. */
export function localAnimalName(id: string, storedName: string): string {
  if (!isEnglish()) return storedName;
  return EN_ANIMALS[id]?.n ?? storedName;
}

/** Notes for a seeded animal in the active locale. */
export function localAnimalNotes(id: string, storedNotes: string | null | undefined): string {
  if (!isEnglish() || !storedNotes) return storedNotes ?? '';
  return EN_ANIMALS[id]?.notes ?? storedNotes;
}

// Land-name helpers live in landName.ts so the app shell can use them without
// pulling this module's data files into the initial bundle. Re-exported here
// for the feature modules that already import them from dataLocal.
export { DEFAULT_LAND_NAME, localLandName, canonicalLandName } from './landName';

// ---- Seeded rules ----

type RuleLike = {
  entity_a: string;
  entity_b: string | null;
  entity_a_kind?: string | null;
  entity_b_kind?: string | null;
  relationship: string;
  message: string;
  is_user_owned?: boolean | number | null;
};

/** Display name of a rule's entity, whichever catalog it comes from. */
export function entityDisplayName(id: string, kind?: string | null): string | null {
  if (kind === 'animal') {
    const a = ANIMAL_SEED.find((x) => x.id === id);
    return a ? localAnimalName(a.id, a.n) : null;
  }
  const p = PDB[id];
  return p ? localSpeciesName(p.n, p.sci) : null;
}

/**
 * The seeded companion/incompatible rules were generated as Spanish sentences at
 * seed time (see db/seed.ts), so they can't be translated by swapping a key.
 * Rebuild those two from a template plus the localized species names. A rule the
 * user wrote (is_user_owned) is their words and is never rewritten.
 */
export function localRuleMessage(rule: RuleLike): string {
  if (rule.is_user_owned) return rule.message;
  if (rule.relationship !== 'companion' && rule.relationship !== 'incompatible') return rule.message;
  const a = entityDisplayName(rule.entity_a, rule.entity_a_kind);
  const b = rule.entity_b ? entityDisplayName(rule.entity_b, rule.entity_b_kind) : null;
  if (!a || !b) return rule.message;
  return tr(rule.relationship === 'companion' ? 'rule_companion_msg' : 'rule_incompatible_msg', { a, b });
}

// ---- Categorical PFAF fields (a small closed vocabulary in the dataset) ----

const FIELD_KEYS: Record<string, TranslationKey> = {
  // type
  'árbol': 'pf_type_tree',
  'arbusto': 'pf_type_shrub',
  'hierba': 'pf_type_herb',
  'hierba alta': 'pf_type_herb_tall',
  'hierba perenne': 'pf_type_herb_perennial',
  'enredadera': 'pf_type_vine',
  'enredadera rastrera': 'pf_type_vine_creeping',
  'raíz': 'pf_type_root',
  // sun
  'pleno sol': 'pf_sun_full',
  'sol parcial': 'pf_sun_partial',
  'sol o sombra parcial': 'pf_sun_full_or_partial',
  'sombra parcial': 'pf_sun_part_shade',
  'sombra': 'pf_sun_shade',
  // water
  'alta': 'pf_water_high',
  'media': 'pf_water_medium',
  'baja': 'pf_water_low',
  'media a alta': 'pf_water_medium_high',
  // soil
  'cualquiera': 'pf_soil_any',
  'ligero': 'pf_soil_light',
  'rico': 'pf_soil_rich',
  'húmedo': 'pf_soil_moist',
  'seco / drenado': 'pf_soil_dry_drained',
  'drenado': 'pf_soil_drained',
  'pobre': 'pf_soil_poor',
  'profundo': 'pf_soil_deep',
  'suelto': 'pf_soil_loose',
  'ácido': 'pf_soil_acid',
  'calcáreo': 'pf_soil_calcareous'
};

const FUNCTION_KEYS: Record<string, TranslationKey> = {
  comestible: 'pf_fn_edible',
  medicinal: 'pf_fn_medicinal',
  'fija-n': 'pf_fn_nfixer',
  forraje: 'pf_fn_fodder',
  madera: 'pf_fn_timber',
  sombra: 'pf_fn_shade',
  polinizador: 'pf_fn_pollinator',
  repelente: 'pf_fn_repellent',
  biocida: 'pf_fn_biocide',
  'cerca-viva': 'pf_fn_living_fence'
};

const EDIBLE_PART_KEYS: Record<string, TranslationKey> = {
  fruto: 'pf_part_fruit',
  hoja: 'pf_part_leaf',
  'raíz': 'pf_part_root',
  semilla: 'pf_part_seed',
  flor: 'pf_part_flower',
  tallo: 'pf_part_stem',
  bulbo: 'pf_part_bulb',
  vaina: 'pf_part_pod',
  pulpa: 'pf_part_pulp',
  savia: 'pf_part_sap'
};

function lookup(map: Record<string, TranslationKey>, value: string | null | undefined): string {
  if (!value) return '';
  if (!isEnglish()) return value;
  const key = map[value.trim().toLowerCase()];
  return key ? tr(key) : value;
}

/**
 * Translate one of the closed-vocabulary PFAF fields (type / sun / water /
 * soil). Values outside the vocabulary, including anything a user typed, are
 * returned unchanged. The same applies to the two helpers below.
 */
export function localPfafField(value: string | null | undefined): string {
  return lookup(FIELD_KEYS, value);
}

/** Translate a plant function tag ("comestible", "fija-n", …). */
export function localFunction(value: string | null | undefined): string {
  return lookup(FUNCTION_KEYS, value);
}

/** Translate an edible-part tag ("fruto", "hoja", …). */
export function localEdiblePart(value: string | null | undefined): string {
  return lookup(EDIBLE_PART_KEYS, value);
}
