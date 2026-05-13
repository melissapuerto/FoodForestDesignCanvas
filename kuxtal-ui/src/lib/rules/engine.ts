import { selectAll } from '../db/sqlite';
import { haversineMeters, type LngLat } from '../map/geometry';
import type { GeoSpatialIndex, SpatialItem } from '../map/spatialIndex';
import type { Rule, RuleHit, EntityKind } from './types';

const ACTIVE_RULE_FILTER = 'retracted_at IS NULL';

export function findRulesAt(opts: {
  index: GeoSpatialIndex;
  point: LngLat;
  candidateSpeciesId: string;
  candidateKind: EntityKind;
  searchRadiusM?: number;
}): RuleHit[] {
  const radius = opts.searchRadiusM ?? 30;
  const neighbors = opts.index.searchNear(opts.point, radius);
  if (!neighbors.length) return [];

  const hits: RuleHit[] = [];
  for (const n of neighbors) {
    const rules = lookupRules(opts.candidateSpeciesId, opts.candidateKind, n.speciesId, n.kind);
    for (const rule of rules) {
      const trigger = rule.trigger_distance_m ?? Infinity;
      if (n.distanceM <= trigger) {
        hits.push({
          rule,
          withEntityId: n.id,
          withEntityKind: n.kind,
          distanceM: n.distanceM
        });
      }
    }
  }
  return hits;
}

export function lookupRules(
  aId: string,
  aKind: EntityKind,
  bId: string,
  bKind: EntityKind
): Rule[] {
  return selectAll<Rule>(
    `SELECT * FROM rule
       WHERE ${ACTIVE_RULE_FILTER}
         AND (
           (entity_a = ? AND entity_a_kind = ? AND entity_b = ? AND entity_b_kind = ?)
        OR (entity_a = ? AND entity_a_kind = ? AND entity_b = ? AND entity_b_kind = ?)
         )`,
    [aId, aKind, bId, bKind, bId, bKind, aId, aKind]
  );
}

export function listRulesForSpecies(speciesId: string, kind: EntityKind = 'plant'): Rule[] {
  return selectAll<Rule>(
    `SELECT * FROM rule
       WHERE ${ACTIVE_RULE_FILTER}
         AND ((entity_a = ? AND entity_a_kind = ?) OR (entity_b = ? AND entity_b_kind = ?))
       ORDER BY relationship, message`,
    [speciesId, kind, speciesId, kind]
  );
}

export function listAllRules(): Rule[] {
  return selectAll<Rule>(
    `SELECT * FROM rule ORDER BY is_user_owned DESC, updated_at DESC`
  );
}

export function summarizeHits(hits: RuleHit[]): { tone: 'help' | 'warn' | 'info'; lines: string[] } {
  const incompat = hits.filter((h) => h.rule.relationship === 'incompatible' || h.rule.relationship === 'harmful');
  const helpful = hits.filter((h) => h.rule.relationship === 'companion' || h.rule.relationship === 'beneficial');
  if (incompat.length) {
    return {
      tone: 'warn',
      lines: incompat.map((h) => h.rule.message)
    };
  }
  if (helpful.length) {
    return {
      tone: 'help',
      lines: helpful.map((h) => h.rule.message)
    };
  }
  return { tone: 'info', lines: [] };
}

export function distanceBetween(a: SpatialItem, b: SpatialItem): number {
  return haversineMeters({ lng: a.lng, lat: a.lat }, { lng: b.lng, lat: b.lat });
}
