export type EntityKind = 'plant' | 'animal' | 'soil' | 'zone' | 'climate';

export type Relationship =
  | 'companion'
  | 'incompatible'
  | 'beneficial'
  | 'harmful'
  | 'unknown'
  | 'neutral';

export type Rule = {
  id: string;
  entity_a: string;
  entity_b: string | null;
  entity_a_kind: EntityKind;
  entity_b_kind: EntityKind | null;
  relationship: Relationship;
  trigger_distance_m: number | null;
  message: string;
  source: string | null;
  provenance_tag: string | null;
  attribution: string | null;
  retractable: number;
  retracted_at: string | null;
  is_user_owned: number;
  created_at: string;
  updated_at: string;
};

export type RuleHit = {
  rule: Rule;
  withEntityId: string;
  withEntityKind: EntityKind;
  distanceM: number;
};
