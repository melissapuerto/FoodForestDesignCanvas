import { selectAll } from '../db/sqlite';
import type { RuleIndex } from './types';

/**
 * Builds the companion/antagonist index from the SQLite `rule` table.
 *
 * The `rule` table keys on local species_id, but the registry seed (PDB ids like
 * "aguacate") and the recommendation pool (pfaf-* ids) are two different id
 * namespaces for the same species. We bridge them through scientific_name so a
 * rule authored on "aguacate" still boosts the "pfaf-28" candidate.
 */
function add(map: Map<string, Set<string>>, a: string, b: string): void {
  let set = map.get(a);
  if (!set) { set = new Set(); map.set(a, set); }
  set.add(b);
}

/** Build the index from all active plant↔plant rules. Call once per canvas tick. */
export function buildRuleIndex(): RuleIndex {
  const companions = new Map<string, Set<string>>();
  const antagonists = new Map<string, Set<string>>();

  const idToSci = new Map<string, string>();
  for (const row of selectAll<{ id: string; sci: string | null }>(
    `SELECT id, lower(scientific_name) AS sci FROM plant_species WHERE scientific_name IS NOT NULL`
  )) {
    if (row.sci) idToSci.set(row.id, row.sci);
  }

  const rules = selectAll<{ entity_a: string; entity_b: string | null; relationship: string }>(
    `SELECT entity_a, entity_b, relationship FROM rule
       WHERE retracted_at IS NULL AND entity_a_kind = 'plant' AND entity_b_kind = 'plant'`
  );

  const isCompanion = (rel: string) => rel === 'companion' || rel === 'beneficial';
  const isAntagonist = (rel: string) => rel === 'incompatible' || rel === 'harmful';

  for (const r of rules) {
    if (!r.entity_b) continue;
    const aSci = idToSci.get(r.entity_a);
    const bSci = idToSci.get(r.entity_b);
    if (!aSci || !bSci || aSci === bSci) continue;
    let target: Map<string, Set<string>> | null = null;
    if (isCompanion(r.relationship)) target = companions;
    else if (isAntagonist(r.relationship)) target = antagonists;
    if (!target) continue;
    add(target, aSci, bSci);
    add(target, bSci, aSci);
  }

  return { companions, antagonists };
}
