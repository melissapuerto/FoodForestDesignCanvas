import { exec, selectAll } from '../db/sqlite';
import { newId, nowIso } from '../utils/id';
import type { EntityKind, Relationship, Rule } from './types';

export type RuleInput = {
  id?: string;
  entity_a: string;
  entity_b: string | null;
  entity_a_kind: EntityKind;
  entity_b_kind: EntityKind | null;
  relationship: Relationship;
  trigger_distance_m: number | null;
  message: string;
  source?: string | null;
  provenance_tag?: string | null;
  attribution?: string | null;
  is_user_owned?: boolean;
};

export function listAllRulesIncludingRetracted(): Rule[] {
  return selectAll<Rule>('SELECT * FROM rule ORDER BY is_user_owned DESC, updated_at DESC');
}

export function upsertRule(input: RuleInput): string {
  const id = input.id ?? newId('rule');
  const now = nowIso();
  exec(
    `INSERT INTO rule (
       id, entity_a, entity_b, entity_a_kind, entity_b_kind,
       relationship, trigger_distance_m, message,
       source, provenance_tag, attribution, retractable, is_user_owned,
       created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       entity_a = excluded.entity_a,
       entity_b = excluded.entity_b,
       entity_a_kind = excluded.entity_a_kind,
       entity_b_kind = excluded.entity_b_kind,
       relationship = excluded.relationship,
       trigger_distance_m = excluded.trigger_distance_m,
       message = excluded.message,
       source = excluded.source,
       provenance_tag = excluded.provenance_tag,
       attribution = excluded.attribution,
       updated_at = excluded.updated_at`,
    [
      id,
      input.entity_a,
      input.entity_b,
      input.entity_a_kind,
      input.entity_b_kind,
      input.relationship,
      input.trigger_distance_m,
      input.message,
      input.source ?? null,
      input.provenance_tag ?? null,
      input.attribution ?? null,
      1,
      input.is_user_owned ? 1 : 0,
      now,
      now
    ]
  );
  return id;
}

export type SharedRulePayload = {
  entity_a: string;
  entity_b: string;
  relationship_type: string;
  message: string;
};

/** Import a community-shared rule into the local catalog as a user-owned rule. */
export function importSharedRule(remote: SharedRulePayload): string {
  return upsertRule({
    entity_a: remote.entity_a,
    entity_b: remote.entity_b,
    entity_a_kind: 'plant',
    entity_b_kind: 'plant',
    relationship: remote.relationship_type as Relationship,
    trigger_distance_m: null,
    message: remote.message,
    source: 'comunidad',
    is_user_owned: true
  });
}

export function retractRule(id: string): void {
  exec('UPDATE rule SET retracted_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), id]);
}

export function unretractRule(id: string): void {
  exec('UPDATE rule SET retracted_at = NULL, updated_at = ? WHERE id = ?', [nowIso(), id]);
}

export function deleteUserRule(id: string): void {
  exec('DELETE FROM rule WHERE id = ? AND is_user_owned = 1', [id]);
}

export function exportRulesAsJson(opts?: { onlyUser?: boolean }): string {
  const rules = opts?.onlyUser
    ? selectAll<Rule>('SELECT * FROM rule WHERE is_user_owned = 1 ORDER BY updated_at DESC')
    : listAllRulesIncludingRetracted();
  return JSON.stringify({ format: 'kuxtal-rules', version: 1, rules }, null, 2);
}

export function importRulesFromJson(json: string): { added: number; updated: number; errors: number } {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { added: 0, updated: 0, errors: 1 };
  }
  const list: any[] = parsed?.rules ?? [];
  let added = 0;
  let updated = 0;
  let errors = 0;
  for (const r of list) {
    try {
      if (!r.entity_a || !r.relationship || !r.message) {
        errors++;
        continue;
      }
      const existed = !!r.id;
      upsertRule({
        id: r.id,
        entity_a: r.entity_a,
        entity_b: r.entity_b ?? null,
        entity_a_kind: r.entity_a_kind ?? 'plant',
        entity_b_kind: r.entity_b_kind ?? null,
        relationship: r.relationship,
        trigger_distance_m: r.trigger_distance_m ?? null,
        message: r.message,
        source: r.source ?? 'imported',
        provenance_tag: r.provenance_tag ?? null,
        attribution: r.attribution ?? null,
        is_user_owned: r.is_user_owned !== false
      });
      existed ? updated++ : added++;
    } catch (err) {
      console.warn('import rule failed', err);
      errors++;
    }
  }
  return { added, updated, errors };
}
