import { describe, it, expect } from 'vitest';
import { classifyProvenance, isCommunityKnowledge, provenanceGlyph } from '../../src/lib/pfaf/provenance';

describe('classifyProvenance', () => {
  it('maps the seeded source values', () => {
    expect(classifyProvenance('pfaf')).toBe('pfaf');
    expect(classifyProvenance('kuxtal-prototype')).toBe('regional');
  });

  it('detects community / Indigenous knowledge', () => {
    expect(classifyProvenance('Conocimiento comunitario — Yucatán')).toBe('community');
    expect(isCommunityKnowledge('community: elders')).toBe(true);
    expect(isCommunityKnowledge('pfaf')).toBe(false);
  });

  it('handles user-added and unknown sources', () => {
    expect(classifyProvenance('user')).toBe('user');
    expect(classifyProvenance(null)).toBe('unknown');
    expect(classifyProvenance('')).toBe('unknown');
  });

  it('gives community a distinct glyph', () => {
    expect(provenanceGlyph('community')).toBe('People');
    expect(provenanceGlyph('pfaf')).not.toBe('People');
  });
});
